/**
 * velox_media.c — VeloxKit media component.
 *
 * Thin C wrapper around a minimal statically-linked ffmpeg build.
 * Implements the velox_media.h API.
 *
 * Build with:
 *   cc -shared -fPIC -O2 -o velox-media.so velox_media.c \
 *      -I/path/to/ffmpeg/include \
 *      /path/to/ffmpeg/lib/libavformat.a \
 *      /path/to/ffmpeg/lib/libavcodec.a  \
 *      /path/to/ffmpeg/lib/libavfilter.a \
 *      /path/to/ffmpeg/lib/libswscale.a  \
 *      /path/to/ffmpeg/lib/libswresample.a \
 *      /path/to/ffmpeg/lib/libavutil.a   \
 *      -lpthread -lm -lz
 *
 * See .github/workflows/velox-media-build.yml for the full CI build.
 */

#include "velox_media.h"

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>
#include <libavutil/avutil.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* ── Version ─────────────────────────────────────────────────────────────── */

const char* velox_media_version(void) {
    return "1.0.0";
}

void velox_media_set_log_level(int level) {
    av_log_set_level(level);
}

/* ── Decoder ─────────────────────────────────────────────────────────────── */

struct VmDecoder {
    AVFormatContext*  fmt_ctx;
    AVCodecContext*   codec_ctx;
    struct SwsContext* sws_ctx;
    AVFrame*          frame;
    AVFrame*          rgba_frame;
    AVPacket*         packet;
    int               video_stream_idx;
    int               width;
    int               height;
    double            fps;
    uint8_t*          rgba_buf;
    int               rgba_buf_size;
};

VmDecoder* vm_decoder_open(const char* source_url,
                            int*        out_width,
                            int*        out_height,
                            double*     out_fps)
{
    VmDecoder* dec = (VmDecoder*)calloc(1, sizeof(VmDecoder));
    if (!dec) return NULL;

    /* Open input */
    if (avformat_open_input(&dec->fmt_ctx, source_url, NULL, NULL) < 0) {
        free(dec); return NULL;
    }
    if (avformat_find_stream_info(dec->fmt_ctx, NULL) < 0) {
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    /* Find best video stream */
    dec->video_stream_idx = av_find_best_stream(
        dec->fmt_ctx, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (dec->video_stream_idx < 0) {
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    AVStream* stream = dec->fmt_ctx->streams[dec->video_stream_idx];
    const AVCodec* codec = avcodec_find_decoder(stream->codecpar->codec_id);
    if (!codec) {
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->codec_ctx = avcodec_alloc_context3(codec);
    if (!dec->codec_ctx) {
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }
    if (avcodec_parameters_to_context(dec->codec_ctx, stream->codecpar) < 0 ||
        avcodec_open2(dec->codec_ctx, codec, NULL) < 0) {
        avcodec_free_context(&dec->codec_ctx);
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->width  = dec->codec_ctx->width;
    dec->height = dec->codec_ctx->height;

    AVRational fr = stream->avg_frame_rate;
    dec->fps = (fr.den > 0) ? (double)fr.num / fr.den : 30.0;

    /* Scaler: pixel format → RGBA */
    dec->sws_ctx = sws_getContext(
        dec->width, dec->height, dec->codec_ctx->pix_fmt,
        dec->width, dec->height, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, NULL, NULL, NULL);
    if (!dec->sws_ctx) {
        avcodec_free_context(&dec->codec_ctx);
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->frame      = av_frame_alloc();
    dec->rgba_frame = av_frame_alloc();
    dec->packet     = av_packet_alloc();

    dec->rgba_buf_size = av_image_get_buffer_size(
        AV_PIX_FMT_RGBA, dec->width, dec->height, 1);
    dec->rgba_buf = (uint8_t*)av_malloc(dec->rgba_buf_size);
    av_image_fill_arrays(dec->rgba_frame->data, dec->rgba_frame->linesize,
                         dec->rgba_buf, AV_PIX_FMT_RGBA,
                         dec->width, dec->height, 1);

    *out_width  = dec->width;
    *out_height = dec->height;
    *out_fps    = dec->fps;
    return dec;
}

int vm_decoder_next_frame(VmDecoder* dec, uint8_t* rgba_out, double* pts_seconds) {
    while (1) {
        /* Try to receive a frame from the codec first */
        int ret = avcodec_receive_frame(dec->codec_ctx, dec->frame);
        if (ret == 0) {
            /* Got a frame — convert to RGBA */
            sws_scale(dec->sws_ctx,
                      (const uint8_t* const*)dec->frame->data, dec->frame->linesize,
                      0, dec->height,
                      dec->rgba_frame->data, dec->rgba_frame->linesize);
            memcpy(rgba_out, dec->rgba_buf, dec->rgba_buf_size);

            AVStream* s = dec->fmt_ctx->streams[dec->video_stream_idx];
            *pts_seconds = dec->frame->best_effort_timestamp
                         * av_q2d(s->time_base);
            return 1;
        }
        if (ret == AVERROR_EOF) return 0;
        if (ret != AVERROR(EAGAIN)) return -1;

        /* Read next packet */
        ret = av_read_frame(dec->fmt_ctx, dec->packet);
        if (ret == AVERROR_EOF) {
            avcodec_send_packet(dec->codec_ctx, NULL); /* flush */
            continue;
        }
        if (ret < 0) return -1;
        if (dec->packet->stream_index == dec->video_stream_idx) {
            ret = avcodec_send_packet(dec->codec_ctx, dec->packet);
        }
        av_packet_unref(dec->packet);
        if (ret < 0 && ret != AVERROR(EAGAIN)) return -1;
    }
}

void vm_decoder_seek(VmDecoder* dec, double seconds) {
    int64_t ts = (int64_t)(seconds * AV_TIME_BASE);
    avformat_seek_file(dec->fmt_ctx, -1, INT64_MIN, ts, INT64_MAX, 0);
    avcodec_flush_buffers(dec->codec_ctx);
}

double vm_decoder_duration(VmDecoder* dec) {
    if (!dec || !dec->fmt_ctx) return -1.0;
    if (dec->fmt_ctx->duration == AV_NOPTS_VALUE) return -1.0;
    return (double)dec->fmt_ctx->duration / (double)AV_TIME_BASE;
}

void vm_decoder_close(VmDecoder* dec) {
    if (!dec) return;
    if (dec->sws_ctx)    sws_freeContext(dec->sws_ctx);
    if (dec->frame)      av_frame_free(&dec->frame);
    if (dec->rgba_frame) av_frame_free(&dec->rgba_frame);
    if (dec->packet)     av_packet_free(&dec->packet);
    if (dec->rgba_buf)   av_free(dec->rgba_buf);
    if (dec->codec_ctx)  avcodec_free_context(&dec->codec_ctx);
    if (dec->fmt_ctx)    avformat_close_input(&dec->fmt_ctx);
    free(dec);
}

/* ── Encoder ─────────────────────────────────────────────────────────────── */

struct VmEncoder {
    AVFormatContext*  fmt_ctx;
    AVCodecContext*   codec_ctx;
    AVStream*         stream;
    struct SwsContext* sws_ctx;
    AVFrame*          yuv_frame;
    AVFrame*          rgba_frame;
    AVPacket*         packet;
    int               width;
    int               height;
    int               fps;
    int64_t           next_pts;
    uint8_t*          rgba_buf;
};

VmEncoder* vm_encoder_open(const char* output_path, int width, int height, int fps) {
    VmEncoder* enc = (VmEncoder*)calloc(1, sizeof(VmEncoder));
    if (!enc) return NULL;
    enc->width = width; enc->height = height; enc->fps = fps;

    if (avformat_alloc_output_context2(&enc->fmt_ctx, NULL, NULL, output_path) < 0) {
        free(enc); return NULL;
    }

    const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec) { avformat_free_context(enc->fmt_ctx); free(enc); return NULL; }

    enc->stream    = avformat_new_stream(enc->fmt_ctx, codec);
    enc->codec_ctx = avcodec_alloc_context3(codec);
    if (!enc->stream || !enc->codec_ctx) {
        avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
    }

    enc->codec_ctx->width     = width;
    enc->codec_ctx->height    = height;
    enc->codec_ctx->time_base = (AVRational){1, fps};
    enc->codec_ctx->pix_fmt   = AV_PIX_FMT_YUV420P;
    enc->codec_ctx->bit_rate  = 2000000;
    enc->codec_ctx->gop_size  = fps; /* one I-frame per second */
    av_opt_set(enc->codec_ctx->priv_data, "preset", "fast", 0);

    if (enc->fmt_ctx->oformat->flags & AVFMT_GLOBALHEADER)
        enc->codec_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;

    if (avcodec_open2(enc->codec_ctx, codec, NULL) < 0) {
        avcodec_free_context(&enc->codec_ctx);
        avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
    }

    avcodec_parameters_from_context(enc->stream->codecpar, enc->codec_ctx);
    enc->stream->time_base = enc->codec_ctx->time_base;

    if (!(enc->fmt_ctx->oformat->flags & AVFMT_NOFILE)) {
        if (avio_open(&enc->fmt_ctx->pb, output_path, AVIO_FLAG_WRITE) < 0) {
            avcodec_free_context(&enc->codec_ctx);
            avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
        }
    }

    if (avformat_write_header(enc->fmt_ctx, NULL) < 0) {
        avcodec_free_context(&enc->codec_ctx);
        avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
    }

    /* RGBA → YUV420P scaler */
    enc->sws_ctx = sws_getContext(width, height, AV_PIX_FMT_RGBA,
                                  width, height, AV_PIX_FMT_YUV420P,
                                  SWS_BILINEAR, NULL, NULL, NULL);

    enc->yuv_frame  = av_frame_alloc();
    enc->rgba_frame = av_frame_alloc();
    enc->packet     = av_packet_alloc();

    enc->yuv_frame->format = AV_PIX_FMT_YUV420P;
    enc->yuv_frame->width  = width;
    enc->yuv_frame->height = height;
    av_frame_get_buffer(enc->yuv_frame, 0);

    int rgba_size = width * height * 4;
    enc->rgba_buf = (uint8_t*)av_malloc(rgba_size);
    av_image_fill_arrays(enc->rgba_frame->data, enc->rgba_frame->linesize,
                         enc->rgba_buf, AV_PIX_FMT_RGBA, width, height, 1);

    return enc;
}

int vm_encoder_write_rgba(VmEncoder* enc, const uint8_t* rgba, int len) {
    if (len < enc->width * enc->height * 4) return -1;
    memcpy(enc->rgba_buf, rgba, enc->width * enc->height * 4);

    sws_scale(enc->sws_ctx,
              (const uint8_t* const*)enc->rgba_frame->data, enc->rgba_frame->linesize,
              0, enc->height,
              enc->yuv_frame->data, enc->yuv_frame->linesize);

    enc->yuv_frame->pts = enc->next_pts++;

    if (avcodec_send_frame(enc->codec_ctx, enc->yuv_frame) < 0) return -1;

    while (avcodec_receive_packet(enc->codec_ctx, enc->packet) == 0) {
        av_packet_rescale_ts(enc->packet, enc->codec_ctx->time_base,
                             enc->stream->time_base);
        enc->packet->stream_index = enc->stream->index;
        av_interleaved_write_frame(enc->fmt_ctx, enc->packet);
        av_packet_unref(enc->packet);
    }
    return 0;
}

void vm_encoder_close(VmEncoder* enc) {
    if (!enc) return;

    /* Flush encoder */
    avcodec_send_frame(enc->codec_ctx, NULL);
    while (avcodec_receive_packet(enc->codec_ctx, enc->packet) == 0) {
        av_packet_rescale_ts(enc->packet, enc->codec_ctx->time_base,
                             enc->stream->time_base);
        enc->packet->stream_index = enc->stream->index;
        av_interleaved_write_frame(enc->fmt_ctx, enc->packet);
        av_packet_unref(enc->packet);
    }
    av_write_trailer(enc->fmt_ctx);

    if (enc->sws_ctx)    sws_freeContext(enc->sws_ctx);
    if (enc->yuv_frame)  av_frame_free(&enc->yuv_frame);
    if (enc->rgba_frame) av_frame_free(&enc->rgba_frame);
    if (enc->rgba_buf)   av_free(enc->rgba_buf);
    if (enc->packet)     av_packet_free(&enc->packet);
    if (enc->codec_ctx)  avcodec_free_context(&enc->codec_ctx);
    if (!(enc->fmt_ctx->oformat->flags & AVFMT_NOFILE))
        avio_closep(&enc->fmt_ctx->pb);
    avformat_free_context(enc->fmt_ctx);
    free(enc);
}

/* ── Audio Decoder ───────────────────────────────────────────────────────── */

struct VmAudioDecoder {
    AVFormatContext*   fmt_ctx;
    AVCodecContext*    codec_ctx;
    struct SwrContext* swr_ctx;
    AVFrame*           frame;
    AVPacket*          packet;
    int                audio_stream_idx;
    int                sample_rate;
    int                channels;
    /* Overflow samples from the previous call that didn't fit in the caller's buf. */
    int16_t*           overflow;
    int                overflow_count;  /* total i16 values stored   */
    int                overflow_pos;    /* next i16 index to read    */
};

VmAudioDecoder* vm_audio_decoder_open(const char* source_url,
                                       int*        out_sample_rate,
                                       int*        out_channels)
{
    VmAudioDecoder* dec = (VmAudioDecoder*)calloc(1, sizeof(VmAudioDecoder));
    if (!dec) return NULL;

    if (avformat_open_input(&dec->fmt_ctx, source_url, NULL, NULL) < 0)
        { free(dec); return NULL; }
    if (avformat_find_stream_info(dec->fmt_ctx, NULL) < 0)
        { avformat_close_input(&dec->fmt_ctx); free(dec); return NULL; }

    dec->audio_stream_idx = av_find_best_stream(
        dec->fmt_ctx, AVMEDIA_TYPE_AUDIO, -1, -1, NULL, 0);
    if (dec->audio_stream_idx < 0)
        { avformat_close_input(&dec->fmt_ctx); free(dec); return NULL; }

    AVStream* stream = dec->fmt_ctx->streams[dec->audio_stream_idx];
    const AVCodec* codec = avcodec_find_decoder(stream->codecpar->codec_id);
    if (!codec)
        { avformat_close_input(&dec->fmt_ctx); free(dec); return NULL; }

    dec->codec_ctx = avcodec_alloc_context3(codec);
    if (!dec->codec_ctx ||
        avcodec_parameters_to_context(dec->codec_ctx, stream->codecpar) < 0 ||
        avcodec_open2(dec->codec_ctx, codec, NULL) < 0) {
        avcodec_free_context(&dec->codec_ctx);
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->sample_rate = dec->codec_ctx->sample_rate;
    dec->channels    = dec->codec_ctx->ch_layout.nb_channels;

    /* Resampler: native sample format → interleaved S16 at the same rate. */
    AVChannelLayout out_layout = {0};
    av_channel_layout_copy(&out_layout, &dec->codec_ctx->ch_layout);
    int swr_ret = swr_alloc_set_opts2(&dec->swr_ctx,
        &out_layout,                    AV_SAMPLE_FMT_S16, dec->sample_rate,
        &dec->codec_ctx->ch_layout,     dec->codec_ctx->sample_fmt, dec->sample_rate,
        0, NULL);
    av_channel_layout_uninit(&out_layout);
    if (swr_ret < 0 || !dec->swr_ctx || swr_init(dec->swr_ctx) < 0) {
        if (dec->swr_ctx) swr_free(&dec->swr_ctx);
        avcodec_free_context(&dec->codec_ctx);
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->frame  = av_frame_alloc();
    dec->packet = av_packet_alloc();

    *out_sample_rate = dec->sample_rate;
    *out_channels    = dec->channels;
    return dec;
}

int vm_audio_decoder_next_samples(VmAudioDecoder* dec, int16_t* buf, int max_samples)
{
    int written = 0;

    /* Drain overflow from the previous call first. */
    if (dec->overflow && dec->overflow_pos < dec->overflow_count) {
        int avail = dec->overflow_count - dec->overflow_pos;
        int copy  = (avail < max_samples) ? avail : max_samples;
        memcpy(buf, dec->overflow + dec->overflow_pos, copy * sizeof(int16_t));
        dec->overflow_pos += copy;
        written           += copy;
        buf               += copy;
        max_samples       -= copy;
        if (max_samples == 0) return written;
    }

    while (max_samples > 0) {
        int ret = avcodec_receive_frame(dec->codec_ctx, dec->frame);
        if (ret == 0) {
            int nb = dec->frame->nb_samples;
            /* Allocate temporary packed S16 buffer for this frame. */
            int alloc = nb * dec->channels;
            int16_t* tmp = (int16_t*)av_malloc(alloc * sizeof(int16_t));
            if (!tmp) { av_frame_unref(dec->frame); break; }

            uint8_t* out_plane = (uint8_t*)tmp;
            int converted = swr_convert(dec->swr_ctx,
                                        &out_plane, nb,
                                        (const uint8_t**)dec->frame->data, nb);
            av_frame_unref(dec->frame);
            if (converted <= 0) { av_free(tmp); continue; }

            int total = converted * dec->channels;
            int copy  = (total < max_samples) ? total : max_samples;
            memcpy(buf, tmp, copy * sizeof(int16_t));
            written     += copy;
            buf         += copy;
            max_samples -= copy;

            /* Save any overflow for the next call. */
            if (copy < total) {
                if (dec->overflow) av_free(dec->overflow);
                int remain            = total - copy;
                dec->overflow         = (int16_t*)av_malloc(remain * sizeof(int16_t));
                dec->overflow_count   = remain;
                dec->overflow_pos     = 0;
                if (dec->overflow)
                    memcpy(dec->overflow, tmp + copy, remain * sizeof(int16_t));
            }
            av_free(tmp);
            continue;
        }
        if (ret == AVERROR_EOF) return written > 0 ? written : 0;
        if (ret != AVERROR(EAGAIN)) return written > 0 ? written : -1;

        /* Need more packets from the container. */
        ret = av_read_frame(dec->fmt_ctx, dec->packet);
        if (ret == AVERROR_EOF) {
            avcodec_send_packet(dec->codec_ctx, NULL); /* flush */
            continue;
        }
        if (ret < 0) return written > 0 ? written : -1;
        if (dec->packet->stream_index == dec->audio_stream_idx)
            avcodec_send_packet(dec->codec_ctx, dec->packet);
        av_packet_unref(dec->packet);
    }
    return written;
}

void vm_audio_decoder_seek(VmAudioDecoder* dec, double seconds)
{
    if (!dec) return;
    int64_t ts = (int64_t)(seconds * AV_TIME_BASE);
    avformat_seek_file(dec->fmt_ctx, -1, INT64_MIN, ts, INT64_MAX, 0);
    avcodec_flush_buffers(dec->codec_ctx);
    /* Reset overflow buffer so no stale pre-seek samples are replayed */
    dec->overflow_pos   = 0;
    dec->overflow_count = 0;
}

void vm_audio_decoder_close(VmAudioDecoder* dec)
{
    if (!dec) return;
    if (dec->swr_ctx)   swr_free(&dec->swr_ctx);
    if (dec->frame)     av_frame_free(&dec->frame);
    if (dec->packet)    av_packet_free(&dec->packet);
    if (dec->overflow)  av_free(dec->overflow);
    if (dec->codec_ctx) avcodec_free_context(&dec->codec_ctx);
    if (dec->fmt_ctx)   avformat_close_input(&dec->fmt_ctx);
    free(dec);
}
