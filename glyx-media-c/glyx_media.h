/**
 * glyx_media.h — Stable C API for the glyx-media DLL.
 *
 * This is the ONLY interface between glyx-runner (Rust) and the glyx-media
 * binary. Keep it small and stable — a breaking change requires a major version
 * bump and a new glyx-runner release.
 *
 * App developers never see this header. They use the React/JS API.
 */

#ifndef GLYX_MEDIA_H
#define GLYX_MEDIA_H

#include <stdint.h>

#ifdef _WIN32
  #define GLYX_EXPORT __declspec(dllexport)
#else
  #define GLYX_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* ── Lifecycle ──────────────────────────────────────────────────────────── */

/** Return the DLL version string, e.g. "1.0.0". Never NULL. */
GLYX_EXPORT const char* glyx_media_version(void);

/**
 * Set the FFmpeg internal log level.  Call once after loading the DLL.
 * AV_LOG_QUIET=-8, AV_LOG_ERROR=16, AV_LOG_WARNING=24, AV_LOG_INFO=32 (default).
 */
GLYX_EXPORT void glyx_media_set_log_level(int level);

/* ── Decoder (video playback) ───────────────────────────────────────────── */

typedef struct VmDecoder VmDecoder;

/**
 * Open a media source (local file path or URL) for decoding.
 *
 * On success: returns an opaque VmDecoder*, writes video dimensions and fps
 *             into the out-parameters.
 * On failure: returns NULL. out-params are undefined.
 *
 * The returned decoder must be closed with vm_decoder_close().
 */
GLYX_EXPORT VmDecoder* vm_decoder_open(
    const char* source_url,
    int*        out_width,
    int*        out_height,
    double*     out_fps
);

/**
 * Ask for frames at another size than the source's, scaled by the decoder (a SIMD scaler, far cheaper than scaling a full-size RGBA frame
 * afterwards, and the frames are that much smaller to hold and pass on). Takes effect with the next vm_decoder_next_frame call, which then
 * needs a buffer of (width * height * 4) bytes. Returns 0 on success, -1 on error (nothing changes). Optional: older libraries lack it.
 */
GLYX_EXPORT int vm_decoder_set_output_size(VmDecoder* dec, int width, int height);

/**
 * Decode the next video frame into rgba_out.
 *
 * rgba_out must point to at least (out_width * out_height * 4) bytes: the source's size until vm_decoder_set_output_size is called.
 * pts_seconds is written with the presentation timestamp of the decoded frame.
 *
 * Returns:
 *   1  — frame decoded successfully
 *   0  — end of stream
 *  -1  — decode error
 */
GLYX_EXPORT int vm_decoder_next_frame(
    VmDecoder* dec,
    uint8_t*   rgba_out,
    double*    pts_seconds
);

/**
 * Seek the decoder to the given position in seconds.
 * Subsequent vm_decoder_next_frame calls resume from the new position.
 */
GLYX_EXPORT void vm_decoder_seek(VmDecoder* dec, double seconds);

/**
 * Return the total duration of the open stream in seconds.
 * Returns -1.0 if unknown (e.g. live / network stream).
 * May be called at any point after vm_decoder_open succeeds.
 */
GLYX_EXPORT double vm_decoder_duration(VmDecoder* dec);

/** Close the decoder and free all resources. */
GLYX_EXPORT void vm_decoder_close(VmDecoder* dec);

/* ── Audio Decoder ──────────────────────────────────────────────────────── */

typedef struct VmAudioDecoder VmAudioDecoder;

/**
 * Open the audio stream of a media source (local file or URL).
 * Decodes any audio track to interleaved signed 16-bit PCM at the source's
 * native sample rate and channel count.
 *
 * Returns an opaque VmAudioDecoder* on success, NULL if the source has no
 * audio track or opening fails.  Must be closed with vm_audio_decoder_close().
 */
GLYX_EXPORT VmAudioDecoder* vm_audio_decoder_open(
    const char* source_url,
    int*        out_sample_rate,
    int*        out_channels
);

/**
 * Decode the next chunk of audio samples into buf (interleaved i16 PCM).
 *
 * max_samples: capacity of buf in i16 values (includes all channels).
 *
 * Returns:
 *   > 0  — number of i16 values written
 *     0  — end of stream
 *    -1  — decode error
 */
GLYX_EXPORT int vm_audio_decoder_next_samples(
    VmAudioDecoder* dec,
    int16_t*        buf,
    int             max_samples
);

/** Seek the audio decoder to the given position in seconds. */
GLYX_EXPORT void vm_audio_decoder_seek(VmAudioDecoder* dec, double seconds);

/** Close the audio decoder and free all resources. */
GLYX_EXPORT void vm_audio_decoder_close(VmAudioDecoder* dec);

/* ── Encoder (camera MP4 recording) ─────────────────────────────────────── */

typedef struct VmEncoder VmEncoder;

/**
 * Open an MP4 encoder writing to output_path.
 *
 * width/height must match the RGBA frames that will be written.
 * fps is the target frame rate (e.g. 30).
 *
 * Returns opaque VmEncoder* on success, NULL on failure.
 * Must be closed with vm_encoder_close().
 */
GLYX_EXPORT VmEncoder* vm_encoder_open(
    const char* output_path,
    int         width,
    int         height,
    int         fps
);

/**
 * Write one RGBA frame to the encoder.
 *
 * rgba must point to exactly (width * height * 4) bytes (row-major, top-down).
 * len is the byte count of rgba.
 *
 * Returns 0 on success, non-zero on error.
 */
GLYX_EXPORT int vm_encoder_write_rgba(
    VmEncoder*    enc,
    const uint8_t* rgba,
    int            len
);

/**
 * Like vm_encoder_open, for frames that come with their own times (a camera): write them with vm_encoder_write_rgba_at.
 * fps_hint is only a hint for the encoder's rate control and key-frame spacing; the file's timing is the frames' own. The output is a
 * fragmented MP4 (an index up front and a fragment at each key frame), so a recording the app did not get to finish still plays up to
 * its last second. The bit rate follows the frame size (about 0.08 bit a pixel). Optional: older libraries lack it.
 */
GLYX_EXPORT VmEncoder* vm_encoder_open_timed(
    const char* output_path,
    int         width,
    int         height,
    int         fps_hint
);

/**
 * vm_encoder_open_timed with an AAC audio track (mono for one input channel, stereo for more) fed by vm_encoder_write_audio. audio_rate is
 * the samples a second of what will be written. If the audio track cannot be made the file is recorded without one: ask vm_encoder_has_audio.
 */
GLYX_EXPORT VmEncoder* vm_encoder_open_timed_av(
    const char* output_path,
    int         width,
    int         height,
    int         fps_hint,
    int         audio_rate,
    int         audio_channels
);

/** 1 when the encoder has an audio track, else 0. */
GLYX_EXPORT int vm_encoder_has_audio(VmEncoder* enc);

/**
 * Write n_frames of interleaved 16-bit samples (audio_channels values per frame) to the audio track. start_ms is when the first of them was
 * captured, in milliseconds from the start of the recording on the same clock as the video frames' times; it matters only for the first
 * chunk (after it the track is as continuous as the samples). Returns 0 on success.
 */
GLYX_EXPORT int vm_encoder_write_audio(
    VmEncoder*     enc,
    const int16_t* samples,
    int            n_frames,
    int64_t        start_ms
);

/**
 * Write one RGBA frame shown at pts_ms milliseconds from the start of the recording (an encoder from vm_encoder_open_timed; -1 on
 * any other). Times that do not increase are nudged forward by a millisecond. The frame is read, not kept: the caller may reuse it.
 */
GLYX_EXPORT int vm_encoder_write_rgba_at(
    VmEncoder*     enc,
    const uint8_t* rgba,
    int            len,
    int64_t        pts_ms
);

/**
 * The name of the codec the encoder opened with (for example "h264_mf" or "libopenh264"), for diagnostics. The environment variable
 * GLYX_VIDEO_ENCODER names an encoder to try first. Optional: older libraries lack it.
 */
GLYX_EXPORT const char* vm_encoder_name(VmEncoder* enc);

/**
 * Finalize the MP4, flush all buffered frames, and close the encoder.
 * The output file is complete and playable after this returns.
 */
GLYX_EXPORT void vm_encoder_close(VmEncoder* enc);

#ifdef __cplusplus
}
#endif

#endif /* GLYX_MEDIA_H */
