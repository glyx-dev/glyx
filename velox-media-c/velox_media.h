/**
 * velox_media.h — Stable C API for the velox-media DLL.
 *
 * This is the ONLY interface between velox-runner (Rust) and the velox-media
 * binary. Keep it small and stable — a breaking change requires a major version
 * bump and a new velox-runner release.
 *
 * App developers never see this header. They use the React/JS API.
 */

#ifndef VELOX_MEDIA_H
#define VELOX_MEDIA_H

#include <stdint.h>

#ifdef _WIN32
  #define VELOX_EXPORT __declspec(dllexport)
#else
  #define VELOX_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* ── Lifecycle ──────────────────────────────────────────────────────────── */

/** Return the DLL version string, e.g. "1.0.0". Never NULL. */
VELOX_EXPORT const char* velox_media_version(void);

/**
 * Set the FFmpeg internal log level.  Call once after loading the DLL.
 * AV_LOG_QUIET=-8, AV_LOG_ERROR=16, AV_LOG_WARNING=24, AV_LOG_INFO=32 (default).
 */
VELOX_EXPORT void velox_media_set_log_level(int level);

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
VELOX_EXPORT VmDecoder* vm_decoder_open(
    const char* source_url,
    int*        out_width,
    int*        out_height,
    double*     out_fps
);

/**
 * Decode the next video frame into rgba_out.
 *
 * rgba_out must point to at least (width * height * 4) bytes.
 * pts_seconds is written with the presentation timestamp of the decoded frame.
 *
 * Returns:
 *   1  — frame decoded successfully
 *   0  — end of stream
 *  -1  — decode error
 */
VELOX_EXPORT int vm_decoder_next_frame(
    VmDecoder* dec,
    uint8_t*   rgba_out,
    double*    pts_seconds
);

/**
 * Seek the decoder to the given position in seconds.
 * Subsequent vm_decoder_next_frame calls resume from the new position.
 */
VELOX_EXPORT void vm_decoder_seek(VmDecoder* dec, double seconds);

/**
 * Return the total duration of the open stream in seconds.
 * Returns -1.0 if unknown (e.g. live / network stream).
 * May be called at any point after vm_decoder_open succeeds.
 */
VELOX_EXPORT double vm_decoder_duration(VmDecoder* dec);

/** Close the decoder and free all resources. */
VELOX_EXPORT void vm_decoder_close(VmDecoder* dec);

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
VELOX_EXPORT VmAudioDecoder* vm_audio_decoder_open(
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
VELOX_EXPORT int vm_audio_decoder_next_samples(
    VmAudioDecoder* dec,
    int16_t*        buf,
    int             max_samples
);

/** Seek the audio decoder to the given position in seconds. */
VELOX_EXPORT void vm_audio_decoder_seek(VmAudioDecoder* dec, double seconds);

/** Close the audio decoder and free all resources. */
VELOX_EXPORT void vm_audio_decoder_close(VmAudioDecoder* dec);

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
VELOX_EXPORT VmEncoder* vm_encoder_open(
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
VELOX_EXPORT int vm_encoder_write_rgba(
    VmEncoder*    enc,
    const uint8_t* rgba,
    int            len
);

/**
 * Finalize the MP4, flush all buffered frames, and close the encoder.
 * The output file is complete and playable after this returns.
 */
VELOX_EXPORT void vm_encoder_close(VmEncoder* enc);

#ifdef __cplusplus
}
#endif

#endif /* VELOX_MEDIA_H */
