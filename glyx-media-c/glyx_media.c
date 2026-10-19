/**
 * glyx_media.c — Glyx media component.
 *
 * Thin C wrapper around a minimal statically-linked ffmpeg build.
 * Implements the glyx_media.h API.
 *
 * Build with:
 *   cc -shared -fPIC -O2 -o glyx-media.so glyx_media.c \
 *      -I/path/to/ffmpeg/include \
 *      /path/to/ffmpeg/lib/libavformat.a \
 *      /path/to/ffmpeg/lib/libavcodec.a  \
 *      /path/to/ffmpeg/lib/libavfilter.a \
 *      /path/to/ffmpeg/lib/libswscale.a  \
 *      /path/to/ffmpeg/lib/libswresample.a \
 *      /path/to/ffmpeg/lib/libavutil.a   \
 *      -lpthread -lm -lz
 *
 * See .github/workflows/glyx-media-build.yml for the full CI build.
 */

#include "glyx_media.h"

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>
#include <libavutil/avutil.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libavutil/audio_fifo.h>
#include <libavutil/channel_layout.h>
#include <libavutil/samplefmt.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* ── Version ─────────────────────────────────────────────────────────────── */

/* The release workflow writes glyx_media_version.h (GLYX_MEDIA_VERSION_STR) so the
 * library reports the Glyx version it was built for; a local build says "dev". */
#if defined(__has_include)
#  if __has_include("glyx_media_version.h")
#    include "glyx_media_version.h"
#  endif
#endif
#ifndef GLYX_MEDIA_VERSION_STR
#  define GLYX_MEDIA_VERSION_STR "dev"
#endif

const char* glyx_media_version(void) {
    return GLYX_MEDIA_VERSION_STR;
}

void glyx_media_set_log_level(int level) {
    av_log_set_level(level);
}

/* ── Decoder ─────────────────────────────────────────────────────────────── */

struct VmDecoder {
    AVFormatContext*  fmt_ctx;
    AVCodecContext*   codec_ctx;
    struct SwsContext* sws_ctx;
    AVFrame*          frame;
    AVPacket*         packet;
    int               video_stream_idx;
    int               width;      /* the source's size */
    int               height;
    int               out_width;  /* the size frames come out at (see vm_decoder_set_output_size) */
    int               out_height;
    double            fps;
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

    /* Scaler: pixel format → RGBA, at the source's size until the caller asks for another. */
    dec->out_width  = dec->width;
    dec->out_height = dec->height;
    dec->sws_ctx = sws_getContext(
        dec->width, dec->height, dec->codec_ctx->pix_fmt,
        dec->out_width, dec->out_height, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, NULL, NULL, NULL);
    if (!dec->sws_ctx) {
        avcodec_free_context(&dec->codec_ctx);
        avformat_close_input(&dec->fmt_ctx); free(dec); return NULL;
    }

    dec->frame      = av_frame_alloc();
    dec->packet     = av_packet_alloc();

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
            /* Got a frame — convert it to RGBA, at the output size, straight into the caller's buffer
             * (it used to go through a buffer of ours and be copied again: 8 MB a frame at 1080p). */
            uint8_t* dst[4]  = { rgba_out, NULL, NULL, NULL };
            int      dst_ls[4] = { dec->out_width * 4, 0, 0, 0 };
            sws_scale(dec->sws_ctx,
                      (const uint8_t* const*)dec->frame->data, dec->frame->linesize,
                      0, dec->height,
                      dst, dst_ls);

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

int vm_decoder_set_output_size(VmDecoder* dec, int width, int height) {
    if (!dec || width < 1 || height < 1) return -1;
    if (width == dec->out_width && height == dec->out_height) return 0;
    struct SwsContext* ctx = sws_getContext(
        dec->width, dec->height, dec->codec_ctx->pix_fmt,
        width, height, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, NULL, NULL, NULL);
    if (!ctx) return -1;
    sws_freeContext(dec->sws_ctx);
    dec->sws_ctx    = ctx;
    dec->out_width  = width;
    dec->out_height = height;
    return 0;
}

void vm_decoder_close(VmDecoder* dec) {
    if (!dec) return;
    if (dec->sws_ctx)    sws_freeContext(dec->sws_ctx);
    if (dec->frame)      av_frame_free(&dec->frame);
    if (dec->packet)     av_packet_free(&dec->packet);
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
    AVPacket*         packet;
    int               width;
    int               height;
    int               fps;
    int64_t           next_pts;
    int               timed;      /* frames carry their own times (vm_encoder_write_rgba_at) */
    int64_t           last_pts;
    const char*       codec_name; /* the encoder that opened (static string from the codec table) */
    /* The audio track, when there is one (vm_encoder_open_timed_av): AAC, fed 16-bit interleaved samples. */
    AVCodecContext*   a_codec;
    AVStream*         a_stream;
    struct SwrContext* a_swr;      /* S16 interleaved (any channel count) -> FLTP at the track's layout */
    AVAudioFifo*      a_fifo;      /* the converted samples waiting for a full AAC frame */
    AVFrame*          a_frame;
    int               a_rate;
    int               a_in_channels;
    int64_t           a_next_pts;  /* in samples */
    int               a_started;
};

/* H.264 encoders to try, best first: a GPU's own encoder (the least CPU, and the vendor's licence covers the codec), then Windows'
 * Media Foundation one (licensed by the OS but heavy: about twice the CPU and 8 times the memory of OpenH264 at 720p), then OpenH264, which is
 * built from source here (so without Cisco's patent grant: use it by choosing it with GLYX_VIDEO_ENCODER, not by default), then MPEG-4.
 *
 * (Older comment follows.) H.264 encoders to try, best first. `libx264` exists only in GPL FFmpeg
 * builds (Glyx ships LGPL); the OS / hardware encoders need no GPL code.
 * FFmpeg's own MPEG-4 encoder is the last resort: always present, and still
 * plays in .mp4 files everywhere. */
static const char* const ENCODERS[] = {
    "libx264", "h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox", "h264_vaapi", "h264_mf", "libopenh264", "mpeg4", NULL
};

/* The pixel format to feed `codec`: YUV420P when it takes it, else NV12,
 * else its first. */
static enum AVPixelFormat pick_pix_fmt(const AVCodec* codec) {
    const enum AVPixelFormat* fmts = NULL;
    int n = 0;
#if LIBAVCODEC_VERSION_INT >= AV_VERSION_INT(61, 13, 100)
    /* FFmpeg 7.1+: AVCodec.pix_fmts is deprecated in favour of this query. */
    if (avcodec_get_supported_config(NULL, codec, AV_CODEC_CONFIG_PIX_FORMAT, 0, (const void**)&fmts, &n) < 0 || !fmts || n == 0)
        return AV_PIX_FMT_YUV420P;
#else
    /* Older FFmpeg (e.g. Ubuntu's 6.x): a NONE-terminated list on the codec. */
    fmts = codec->pix_fmts;
    if (!fmts) return AV_PIX_FMT_YUV420P;
    while (fmts[n] != AV_PIX_FMT_NONE) n++;
    if (n == 0) return AV_PIX_FMT_YUV420P;
#endif
    for (int i = 0; i < n; i++) if (fmts[i] == AV_PIX_FMT_YUV420P) return AV_PIX_FMT_YUV420P;
    for (int i = 0; i < n; i++) if (fmts[i] == AV_PIX_FMT_NV12) return AV_PIX_FMT_NV12;
    return fmts[0];
}

/* Open an encoder that works on this machine: the one named by GLYX_VIDEO_ENCODER if that opens (to choose, or to compare), else the first
 * in ENCODERS. */
static AVCodecContext* open_encoder(const AVFormatContext* fmt, int width, int height, int fps, int timed, const AVCodec** out_codec) {
    const char* wanted = getenv("GLYX_VIDEO_ENCODER");
    for (int i = (wanted && *wanted) ? -1 : 0; ENCODERS[i < 0 ? 0 : i]; i++) {
        const char* name = i < 0 ? wanted : ENCODERS[i];
        const AVCodec* codec = avcodec_find_encoder_by_name(name);
        if (!codec) continue;
        AVCodecContext* c = avcodec_alloc_context3(codec);
        if (!c) continue;
        c->width     = width;
        c->height    = height;
        /* A timed encoder counts in milliseconds (frames come with their capture times); the other counts frames. */
        c->time_base = timed ? (AVRational){1, 1000} : (AVRational){1, fps};
        c->framerate = (AVRational){fps, 1};
        c->pix_fmt   = pick_pix_fmt(codec);
        /* About 0.08 bit a pixel: 2.2 Mbps for 720p at 30, 5 for 1080p (it was a flat 2 Mbps for any size). */
        {
            double bps = 0.08 * (double)width * (double)height * (double)(fps > 0 ? fps : 30);
            if (bps < 1000000.0)  bps = 1000000.0;
            if (bps > 20000000.0) bps = 20000000.0;
            c->bit_rate = (int64_t)bps;
        }
        c->gop_size  = fps; /* one I-frame per second */
        av_opt_set(c->priv_data, "preset", "fast", 0);  /* x264 / nvenc; ignored elsewhere */
        if (fmt->oformat->flags & AVFMT_GLOBALHEADER)
            c->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        if (avcodec_open2(c, codec, NULL) == 0) { *out_codec = codec; return c; }
        avcodec_free_context(&c);   /* e.g. no such GPU: try the next */
    }
    return NULL;
}

static void audio_free(VmEncoder* enc);

/* Add an AAC track (mono for one input channel, else stereo). Returns 0 on success; the file then has no audio and the caller can go on. */
static int audio_open(VmEncoder* enc, int rate, int in_channels) {
    const AVCodec* ac = avcodec_find_encoder_by_name("aac");
    if (!ac) return -1;
    int out_channels = in_channels == 1 ? 1 : 2;
    enc->a_codec = avcodec_alloc_context3(ac);
    if (!enc->a_codec) return -1;
    AVCodecContext* c = enc->a_codec;
    c->sample_rate = rate;
    c->sample_fmt  = AV_SAMPLE_FMT_FLTP;
    av_channel_layout_default(&c->ch_layout, out_channels);
    c->bit_rate    = out_channels == 1 ? 64000 : 128000;
    c->time_base   = (AVRational){1, rate};
    if (enc->fmt_ctx->oformat->flags & AVFMT_GLOBALHEADER) c->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    if (avcodec_open2(c, ac, NULL) < 0) goto fail;

    enc->a_stream = avformat_new_stream(enc->fmt_ctx, NULL);
    if (!enc->a_stream) goto fail;
    avcodec_parameters_from_context(enc->a_stream->codecpar, c);
    enc->a_stream->time_base = c->time_base;

    AVChannelLayout in_layout;
    av_channel_layout_default(&in_layout, in_channels);
    if (swr_alloc_set_opts2(&enc->a_swr, &c->ch_layout, AV_SAMPLE_FMT_FLTP, rate,
                            &in_layout, AV_SAMPLE_FMT_S16, rate, 0, NULL) < 0 || swr_init(enc->a_swr) < 0) {
        av_channel_layout_uninit(&in_layout);
        goto fail;
    }
    av_channel_layout_uninit(&in_layout);

    enc->a_fifo = av_audio_fifo_alloc(AV_SAMPLE_FMT_FLTP, out_channels, 1);
    enc->a_frame = av_frame_alloc();
    if (!enc->a_fifo || !enc->a_frame) goto fail;
    enc->a_frame->format      = AV_SAMPLE_FMT_FLTP;
    enc->a_frame->sample_rate = rate;
    enc->a_frame->nb_samples  = c->frame_size > 0 ? c->frame_size : 1024;
    av_channel_layout_copy(&enc->a_frame->ch_layout, &c->ch_layout);
    if (av_frame_get_buffer(enc->a_frame, 0) < 0) goto fail;
    enc->a_rate = rate;
    enc->a_in_channels = in_channels;
    return 0;
fail:
    audio_free(enc);
    return -1;
}

static void audio_free(VmEncoder* enc) {
    if (enc->a_frame) av_frame_free(&enc->a_frame);
    if (enc->a_fifo)  { av_audio_fifo_free(enc->a_fifo); enc->a_fifo = NULL; }
    if (enc->a_swr)   swr_free(&enc->a_swr);
    if (enc->a_codec) avcodec_free_context(&enc->a_codec);
    enc->a_stream = NULL;
    enc->a_rate = 0;
}

/* Encode what the FIFO holds in whole AAC frames (all of it when `flush`, the last one short). */
static int audio_drain(VmEncoder* enc, int flush) {
    int frame_size = enc->a_frame->nb_samples;
    while (av_audio_fifo_size(enc->a_fifo) >= frame_size || (flush && av_audio_fifo_size(enc->a_fifo) > 0)) {
        int n = av_audio_fifo_size(enc->a_fifo);
        if (n > frame_size) n = frame_size;
        if (av_frame_make_writable(enc->a_frame) < 0) return -1;
        if (av_audio_fifo_read(enc->a_fifo, (void**)enc->a_frame->data, n) < n) return -1;
        enc->a_frame->nb_samples = n;
        enc->a_frame->pts = enc->a_next_pts;
        enc->a_next_pts += n;
        if (avcodec_send_frame(enc->a_codec, enc->a_frame) < 0) return -1;
        enc->a_frame->nb_samples = frame_size;
        while (avcodec_receive_packet(enc->a_codec, enc->packet) == 0) {
            av_packet_rescale_ts(enc->packet, enc->a_codec->time_base, enc->a_stream->time_base);
            enc->packet->stream_index = enc->a_stream->index;
            av_interleaved_write_frame(enc->fmt_ctx, enc->packet);
            av_packet_unref(enc->packet);
        }
    }
    return 0;
}

static VmEncoder* encoder_open(const char* output_path, int width, int height, int fps, int timed, int audio_rate, int audio_channels) {
    VmEncoder* enc = (VmEncoder*)calloc(1, sizeof(VmEncoder));
    if (!enc) return NULL;
    enc->width = width; enc->height = height; enc->fps = fps; enc->timed = timed; enc->last_pts = -1;

    if (avformat_alloc_output_context2(&enc->fmt_ctx, NULL, NULL, output_path) < 0) {
        free(enc); return NULL;
    }

    const AVCodec* codec = NULL;
    enc->codec_ctx = open_encoder(enc->fmt_ctx, width, height, fps, timed, &codec);
    if (enc->codec_ctx) enc->codec_name = codec->name;
    if (!enc->codec_ctx) { avformat_free_context(enc->fmt_ctx); free(enc); return NULL; }
    enc->stream = avformat_new_stream(enc->fmt_ctx, codec);
    if (!enc->stream) {
        avcodec_free_context(&enc->codec_ctx);
        avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
    }

    avcodec_parameters_from_context(enc->stream->codecpar, enc->codec_ctx);
    enc->stream->time_base = enc->codec_ctx->time_base;

    /* An audio track must be declared before the header is written. If it cannot be made, record without. */
    enc->packet = av_packet_alloc();
    if (audio_rate > 0 && audio_channels > 0) audio_open(enc, audio_rate, audio_channels);

    if (!(enc->fmt_ctx->oformat->flags & AVFMT_NOFILE)) {
        if (avio_open(&enc->fmt_ctx->pb, output_path, AVIO_FLAG_WRITE) < 0) {
            avcodec_free_context(&enc->codec_ctx);
            avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
        }
    }

    /* A fragmented MP4 (a fragment at each key frame, an index up front) stays playable up to the last fragment if the app dies
     * mid-recording; a plain one keeps its index at the end and is lost. Other containers ignore the option. */
    if (timed) av_opt_set(enc->fmt_ctx->priv_data, "movflags", "frag_keyframe+empty_moov+default_base_moof", 0);

    if (avformat_write_header(enc->fmt_ctx, NULL) < 0) {
        avcodec_free_context(&enc->codec_ctx);
        avformat_free_context(enc->fmt_ctx); free(enc); return NULL;
    }

    /* RGBA → YUV420P scaler */
    enc->sws_ctx = sws_getContext(width, height, AV_PIX_FMT_RGBA,
                                  width, height, enc->codec_ctx->pix_fmt,
                                  SWS_BILINEAR, NULL, NULL, NULL);

    enc->yuv_frame  = av_frame_alloc();

    enc->yuv_frame->format = enc->codec_ctx->pix_fmt;
    enc->yuv_frame->width  = width;
    enc->yuv_frame->height = height;
    av_frame_get_buffer(enc->yuv_frame, 0);

    return enc;
}

VmEncoder* vm_encoder_open(const char* output_path, int width, int height, int fps) {
    return encoder_open(output_path, width, height, fps, 0, 0, 0);
}

VmEncoder* vm_encoder_open_timed(const char* output_path, int width, int height, int fps_hint) {
    return encoder_open(output_path, width, height, fps_hint, 1, 0, 0);
}

VmEncoder* vm_encoder_open_timed_av(const char* output_path, int width, int height, int fps_hint, int audio_rate, int audio_channels) {
    return encoder_open(output_path, width, height, fps_hint, 1, audio_rate, audio_channels);
}

int vm_encoder_has_audio(VmEncoder* enc) {
    return enc && enc->a_codec ? 1 : 0;
}

int vm_encoder_write_audio(VmEncoder* enc, const int16_t* samples, int n_frames, int64_t start_ms) {
    if (!enc || !enc->a_codec || n_frames <= 0) return -1;
    if (!enc->a_started) {
        /* The track starts where the first chunk started, on the recording's clock (the video's first frame is 0). */
        enc->a_next_pts = start_ms > 0 ? (int64_t)((double)start_ms * enc->a_rate / 1000.0) : 0;
        enc->a_started = 1;
    }
    int out_channels = enc->a_codec->ch_layout.nb_channels;
    uint8_t** conv = NULL;
    if (av_samples_alloc_array_and_samples(&conv, NULL, out_channels, n_frames, AV_SAMPLE_FMT_FLTP, 0) < 0) return -1;
    const uint8_t* in[1] = { (const uint8_t*)samples };
    int got = swr_convert(enc->a_swr, conv, n_frames, in, n_frames);
    int rc = 0;
    if (got > 0) {
        if (av_audio_fifo_write(enc->a_fifo, (void**)conv, got) < got) rc = -1;
    } else if (got < 0) rc = -1;
    av_freep(&conv[0]);
    av_freep(&conv);
    if (rc == 0) rc = audio_drain(enc, 0);
    return rc;
}

/* Encode one frame at presentation time `pts` (in the encoder's time base). */
static int encoder_write(VmEncoder* enc, const uint8_t* rgba, int len, int64_t pts) {
    if (len < enc->width * enc->height * 4) return -1;

    av_frame_make_writable(enc->yuv_frame);

    /* Scale straight from the caller's frame (it used to be copied into a buffer of ours first). */
    const uint8_t* src[4]    = { rgba, NULL, NULL, NULL };
    int            src_ls[4] = { enc->width * 4, 0, 0, 0 };
    sws_scale(enc->sws_ctx, src, src_ls, 0, enc->height,
              enc->yuv_frame->data, enc->yuv_frame->linesize);

    enc->yuv_frame->pts = pts;

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

int vm_encoder_write_rgba(VmEncoder* enc, const uint8_t* rgba, int len) {
    return encoder_write(enc, rgba, len, enc->next_pts++);
}

int vm_encoder_write_rgba_at(VmEncoder* enc, const uint8_t* rgba, int len, int64_t pts_ms) {
    if (!enc->timed) return -1;
    /* Times must increase: two frames in the same millisecond get consecutive ones. */
    if (pts_ms <= enc->last_pts) pts_ms = enc->last_pts + 1;
    enc->last_pts = pts_ms;
    return encoder_write(enc, rgba, len, pts_ms);
}

const char* vm_encoder_name(VmEncoder* enc) {
    return (enc && enc->codec_name) ? enc->codec_name : "";
}

void vm_encoder_close(VmEncoder* enc) {
    if (!enc) return;

    /* Flush the audio track: what is left in the FIFO (the last frame short), then the encoder. */
    if (enc->a_codec) {
        audio_drain(enc, 1);
        avcodec_send_frame(enc->a_codec, NULL);
        while (avcodec_receive_packet(enc->a_codec, enc->packet) == 0) {
            av_packet_rescale_ts(enc->packet, enc->a_codec->time_base, enc->a_stream->time_base);
            enc->packet->stream_index = enc->a_stream->index;
            av_interleaved_write_frame(enc->fmt_ctx, enc->packet);
            av_packet_unref(enc->packet);
        }
    }

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
    if (enc->a_codec)    audio_free(enc);
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
    /* After a seek: drop decoded audio before `skip_to` seconds, so playback
     * starts exactly where it was asked to (the container seek lands on a
     * packet at or before it). */
    int                skipping;
    double             skip_to;
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
            /* Frames before the seek target are dropped, the first one after
             * it trimmed to the exact sample. */
            int drop = 0;
            if (dec->skipping) {
                int64_t pts = dec->frame->best_effort_timestamp;
                if (pts == AV_NOPTS_VALUE) {
                    dec->skipping = 0;
                } else {
                    AVRational tb = dec->fmt_ctx->streams[dec->audio_stream_idx]->time_base;
                    double start = pts * av_q2d(tb);
                    double end   = start + (double)nb / dec->sample_rate;
                    if (end <= dec->skip_to) { av_frame_unref(dec->frame); continue; }
                    if (start < dec->skip_to) {
                        drop = (int)((dec->skip_to - start) * dec->sample_rate + 0.5);
                        if (drop > nb) drop = nb;
                    }
                    dec->skipping = 0;
                }
            }
            /* Allocate temporary packed S16 buffer for this frame. */
            int alloc = nb * dec->channels;
            int16_t* tmp = (int16_t*)av_malloc(alloc * sizeof(int16_t));
            if (!tmp) { av_frame_unref(dec->frame); break; }

            uint8_t* out_plane = (uint8_t*)tmp;
            int converted = swr_convert(dec->swr_ctx,
                                        &out_plane, nb,
                                        (const uint8_t**)dec->frame->data, nb);
            av_frame_unref(dec->frame);
            if (converted <= drop) { av_free(tmp); continue; }

            int16_t* src = tmp + drop * dec->channels;
            int total = (converted - drop) * dec->channels;
            int copy  = (total < max_samples) ? total : max_samples;
            memcpy(buf, src, copy * sizeof(int16_t));
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
                    memcpy(dec->overflow, src + copy, remain * sizeof(int16_t));
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
    if (seconds < 0) seconds = 0;
    /* Seek the audio stream itself, landing at or before the target (never
     * after: the old any-direction seek on the default stream could start
     * hundreds of ms late), then trim to it exactly while decoding. */
    AVStream* st = dec->fmt_ctx->streams[dec->audio_stream_idx];
    int64_t ts = av_rescale_q((int64_t)(seconds * AV_TIME_BASE), AV_TIME_BASE_Q, st->time_base);
    if (avformat_seek_file(dec->fmt_ctx, dec->audio_stream_idx, INT64_MIN, ts, ts, 0) < 0)
        avformat_seek_file(dec->fmt_ctx, dec->audio_stream_idx, INT64_MIN, ts, INT64_MAX, 0);
    avcodec_flush_buffers(dec->codec_ctx);
    dec->skipping = 1;
    dec->skip_to  = seconds;
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
