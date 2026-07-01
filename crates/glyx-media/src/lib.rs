//! glyx-media — thin Rust wrapper around the glyx-media DLL.
//!
//! The DLL exposes a small, stable C API (see `glyx_media.h`).
//! This crate loads it via `libloading`, verifies integrity before loading,
//! and exposes safe Rust wrappers. All `unsafe` is isolated here.
//!
//! # Graceful degradation
//!
//! `get_media()` returns `None` if the DLL is absent or fails verification.
//! Callers should reject their Promise with `"GlyxMediaNotAvailable"` rather
//! than panicking — the app keeps running, only media features are unavailable.

pub mod download;
pub mod verify;

use libloading::{Library, Symbol};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_double, c_int, c_void};
use std::sync::{Arc, OnceLock};

// ── Global lazy-loaded singleton ──────────────────────────────────────────────

static GLYX_MEDIA: OnceLock<Option<Arc<GlyxMedia>>> = OnceLock::new();

/// Return the global `GlyxMedia` instance, loading it on first call.
///
/// Returns `None` if the DLL is not cached (call `download::find_cached_media`
/// or `download::download_and_cache_media` first), or if integrity checks fail.
pub fn get_media() -> Option<Arc<GlyxMedia>> {
    GLYX_MEDIA.get_or_init(|| {
        let path = download::find_cached_media()?;
        match GlyxMedia::load(&path) {
            Ok(m)  => {
                log::info!("[glyx-media] loaded v{}", m.version());
                Some(Arc::new(m))
            }
            Err(e) => {
                log::warn!("[glyx-media] load failed: {e}");
                None
            }
        }
    }).clone()
}

// ── GlyxMedia struct ─────────────────────────────────────────────────────────

/// Raw function pointer types matching `glyx_media.h`.
type FnVersion               = unsafe extern "C" fn() -> *const c_char;
type FnDecoderOpen           = unsafe extern "C" fn(*const c_char, *mut c_int, *mut c_int, *mut f64) -> *mut c_void;
type FnDecoderNextFrame      = unsafe extern "C" fn(*mut c_void, *mut u8, *mut f64) -> c_int;
type FnDecoderSeek           = unsafe extern "C" fn(*mut c_void, f64);
type FnDecoderDuration       = unsafe extern "C" fn(*mut c_void) -> f64;
type FnDecoderClose          = unsafe extern "C" fn(*mut c_void);
type FnEncoderOpen           = unsafe extern "C" fn(*const c_char, c_int, c_int, c_int) -> *mut c_void;
type FnEncoderWriteRgba      = unsafe extern "C" fn(*mut c_void, *const u8, c_int) -> c_int;
type FnEncoderClose          = unsafe extern "C" fn(*mut c_void);
type FnAudioDecoderOpen        = unsafe extern "C" fn(*const c_char, *mut c_int, *mut c_int) -> *mut c_void;
type FnAudioDecoderNextSamples = unsafe extern "C" fn(*mut c_void, *mut i16, c_int) -> c_int;
type FnAudioDecoderSeek        = unsafe extern "C" fn(*mut c_void, c_double);
type FnAudioDecoderClose       = unsafe extern "C" fn(*mut c_void);

/// Safe wrapper around the glyx-media dynamic library.
///
/// **Drop order matters**: function pointer fields borrow from `_lib`,
/// so `_lib` is declared last and dropped last.
pub struct GlyxMedia {
    version:                  FnVersion,
    decoder_open:             FnDecoderOpen,
    decoder_next_frame:       FnDecoderNextFrame,
    decoder_seek:             FnDecoderSeek,
    fn_decoder_duration:      Option<FnDecoderDuration>,  // optional — older DLLs won't have it
    decoder_close:            FnDecoderClose,
    encoder_open:             FnEncoderOpen,
    encoder_write_rgba:       FnEncoderWriteRgba,
    encoder_close:            FnEncoderClose,
    audio_decoder_open:       FnAudioDecoderOpen,
    audio_decoder_next_samp:  FnAudioDecoderNextSamples,
    fn_audio_decoder_seek:    Option<FnAudioDecoderSeek>,
    audio_decoder_close:      FnAudioDecoderClose,
    _lib: Library,  // ← LAST — must be dropped after function pointers
}

// SAFETY: GlyxMedia wraps a C library with no thread-local state.
// All decoder/encoder handles are opaque pointers managed by the caller.
unsafe impl Send for GlyxMedia {}
unsafe impl Sync for GlyxMedia {}

impl GlyxMedia {
    /// Load the glyx-media DLL at `path`.
    ///
    /// Verifies integrity (Ed25519 manifest + SHA-256) before `dlopen`.
    pub fn load(path: &std::path::Path) -> Result<Self, String> {
        // Re-verify integrity every launch — the cached file may have been tampered.
        verify::verify_cached_dll(path)?;

        // On Windows, use LOAD_WITH_ALTERED_SEARCH_PATH so that ffmpeg DLLs
        // sitting next to the glyx-media DLL in the cache dir are found
        // (standard LoadLibrary only searches the EXE directory + PATH).
        #[cfg(target_os = "windows")]
        let lib = unsafe {
            use libloading::os::windows::{Library as WinLib, LOAD_WITH_ALTERED_SEARCH_PATH};
            Library::from(WinLib::load_with_flags(path, LOAD_WITH_ALTERED_SEARCH_PATH)
                .map_err(|e| format!("glyx-media: dlopen failed: {e}"))?)
        };
        #[cfg(not(target_os = "windows"))]
        let lib = unsafe {
            Library::new(path).map_err(|e| format!("glyx-media: dlopen failed: {e}"))?
        };

        macro_rules! sym {
            ($lib:expr, $name:literal, $ty:ty) => {{
                let s: Symbol<$ty> = unsafe {
                    $lib.get($name).map_err(|e| format!("glyx-media: symbol '{}' not found: {e}", stringify!($name)))?
                };
                *s
            }};
        }

        // Optional: suppress verbose FFmpeg stats (encoder summary, libx264 info, etc.).
        // AV_LOG_WARNING = 24 keeps real errors/warnings visible, silences stats.
        type FnSetLogLevel = unsafe extern "C" fn(i32);
        match unsafe { lib.get::<FnSetLogLevel>(b"glyx_media_set_log_level\0") } {
            Ok(sym) => unsafe { (*sym)(24) }, // AV_LOG_WARNING
            Err(_)  => log::warn!(
                "[glyx-media] glyx_media_set_log_level not in DLL — \
                 rebuild glyx-media-c to suppress FFmpeg logs"
            ),
        }

        let fn_decoder_duration = unsafe {
            lib.get::<FnDecoderDuration>(b"vm_decoder_duration\0").ok().map(|s| *s)
        };
        let fn_audio_decoder_seek = unsafe {
            lib.get::<FnAudioDecoderSeek>(b"vm_audio_decoder_seek\0").ok().map(|s| *s)
        };

        Ok(Self {
            version:                 sym!(lib, b"glyx_media_version\0",             FnVersion),
            decoder_open:            sym!(lib, b"vm_decoder_open\0",                 FnDecoderOpen),
            decoder_next_frame:      sym!(lib, b"vm_decoder_next_frame\0",           FnDecoderNextFrame),
            decoder_seek:            sym!(lib, b"vm_decoder_seek\0",                 FnDecoderSeek),
            fn_decoder_duration,
            decoder_close:           sym!(lib, b"vm_decoder_close\0",                FnDecoderClose),
            encoder_open:            sym!(lib, b"vm_encoder_open\0",                 FnEncoderOpen),
            encoder_write_rgba:      sym!(lib, b"vm_encoder_write_rgba\0",           FnEncoderWriteRgba),
            encoder_close:           sym!(lib, b"vm_encoder_close\0",                FnEncoderClose),
            audio_decoder_open:      sym!(lib, b"vm_audio_decoder_open\0",           FnAudioDecoderOpen),
            audio_decoder_next_samp: sym!(lib, b"vm_audio_decoder_next_samples\0",   FnAudioDecoderNextSamples),
            fn_audio_decoder_seek,
            audio_decoder_close:     sym!(lib, b"vm_audio_decoder_close\0",          FnAudioDecoderClose),
            _lib: lib,
        })
    }

    // ── Safe public API ───────────────────────────────────────────────────────

    /// Return the DLL version string (e.g. `"1.0.0"`).
    pub fn version(&self) -> &str {
        let ptr = unsafe { (self.version)() };
        if ptr.is_null() { return "unknown"; }
        unsafe { CStr::from_ptr(ptr) }.to_str().unwrap_or("unknown")
    }

    /// Open a video/audio source for decoding.
    pub fn decoder_open(&self, url: &str) -> Result<VmDecoder, String> {
        let c_url = CString::new(url).map_err(|e| e.to_string())?;
        let (mut w, mut h, mut fps) = (0i32, 0i32, 0f64);
        let ptr = unsafe {
            (self.decoder_open)(c_url.as_ptr(), &mut w, &mut h, &mut fps)
        };
        if ptr.is_null() {
            return Err(format!("glyx-media: vm_decoder_open returned null for '{url}'"));
        }
        Ok(VmDecoder {
            ptr,
            width:  w as u32,
            height: h as u32,
            fps,
            media: std::marker::PhantomData,
        })
    }

    /// Decode the next video frame into `rgba_out` (must be `width * height * 4` bytes).
    /// Returns `Ok(Some(pts))` on success, `Ok(None)` when the stream ends, `Err` on error.
    pub fn decoder_next_frame(&self, dec: &VmDecoder, rgba_out: &mut [u8]) -> Result<Option<f64>, String> {
        let mut pts = 0f64;
        let rc = unsafe { (self.decoder_next_frame)(dec.ptr, rgba_out.as_mut_ptr(), &mut pts) };
        match rc {
            1  => Ok(Some(pts)),   // frame decoded
            0  => Ok(None),        // end of stream
            _  => Err(format!("glyx-media: vm_decoder_next_frame error (rc={rc})")),
        }
    }

    /// Seek decoder to `seconds`.
    pub fn decoder_seek(&self, dec: &VmDecoder, seconds: f64) {
        unsafe { (self.decoder_seek)(dec.ptr, seconds) }
    }

    /// Return total stream duration in seconds, or `-1.0` if unknown.
    /// Returns `-1.0` on older DLLs that don't export `vm_decoder_duration`.
    pub fn decoder_duration(&self, dec: &VmDecoder) -> f64 {
        match self.fn_decoder_duration {
            Some(f) => unsafe { f(dec.ptr) },
            None    => -1.0,
        }
    }

    /// Close a decoder and free its resources.
    pub fn decoder_close(&self, dec: VmDecoder) {
        unsafe { (self.decoder_close)(dec.ptr) }
        std::mem::forget(dec); // avoid double-free via Drop
    }

    /// Open an MP4 encoder writing to `output_path`.
    pub fn encoder_open(&self, output_path: &str, width: u32, height: u32, fps: u32) -> Result<VmEncoder, String> {
        let c_path = CString::new(output_path).map_err(|e| e.to_string())?;
        let ptr = unsafe {
            (self.encoder_open)(c_path.as_ptr(), width as c_int, height as c_int, fps as c_int)
        };
        if ptr.is_null() {
            return Err(format!("glyx-media: vm_encoder_open returned null for '{output_path}'"));
        }
        Ok(VmEncoder { ptr, media: std::marker::PhantomData })
    }

    /// Write an RGBA frame to the encoder.
    pub fn encoder_write_rgba(&self, enc: &VmEncoder, rgba: &[u8]) -> Result<(), String> {
        let rc = unsafe {
            (self.encoder_write_rgba)(enc.ptr, rgba.as_ptr(), rgba.len() as c_int)
        };
        if rc != 0 {
            return Err(format!("glyx-media: vm_encoder_write_rgba error (rc={rc})"));
        }
        Ok(())
    }

    /// Finalize and close the encoder, flushing all buffered frames to disk.
    pub fn encoder_close(&self, enc: VmEncoder) {
        unsafe { (self.encoder_close)(enc.ptr) }
        std::mem::forget(enc);
    }

    /// Open an audio-only decoder for the given source URL.
    /// Returns `(VmAudioDecoder, sample_rate, channels)` on success.
    pub fn audio_decoder_open(&self, url: &str) -> Result<VmAudioDecoder, String> {
        let c_url = CString::new(url).map_err(|e| e.to_string())?;
        let (mut sample_rate, mut channels) = (0i32, 0i32);
        let ptr = unsafe {
            (self.audio_decoder_open)(c_url.as_ptr(), &mut sample_rate, &mut channels)
        };
        if ptr.is_null() {
            return Err(format!("glyx-media: vm_audio_decoder_open returned null for '{url}'"));
        }
        Ok(VmAudioDecoder { ptr, sample_rate: sample_rate as u32, channels: channels as u16 })
    }

    /// Decode the next chunk of audio into `buf` (interleaved i16 PCM).
    /// Returns the number of i16 values written, 0 for EOF, negative for error.
    pub fn audio_decoder_next_samples(&self, dec: &VmAudioDecoder, buf: &mut [i16]) -> i32 {
        unsafe {
            (self.audio_decoder_next_samp)(dec.ptr, buf.as_mut_ptr(), buf.len() as c_int) as i32
        }
    }

    /// Seek the audio decoder to `seconds`. Returns `true` if the native seek
    /// function is available in the loaded DLL, `false` if the DLL is older.
    pub fn audio_decoder_seek(&self, dec: &VmAudioDecoder, seconds: f64) -> bool {
        if let Some(f) = self.fn_audio_decoder_seek {
            unsafe { f(dec.ptr, seconds as c_double) };
            true
        } else {
            false
        }
    }

    /// Close the audio decoder and free its resources.
    pub fn audio_decoder_close(&self, dec: VmAudioDecoder) {
        unsafe { (self.audio_decoder_close)(dec.ptr) }
        std::mem::forget(dec);
    }
}

// ── Opaque handle types ───────────────────────────────────────────────────────

/// Opaque decoder handle. Created by `GlyxMedia::decoder_open`.
pub struct VmDecoder {
    ptr:    *mut c_void,
    pub width:  u32,
    pub height: u32,
    pub fps:    f64,
    media:  std::marker::PhantomData<*const GlyxMedia>,
}

unsafe impl Send for VmDecoder {}

/// Opaque encoder handle. Created by `GlyxMedia::encoder_open`.
pub struct VmEncoder {
    ptr:   *mut c_void,
    media: std::marker::PhantomData<*const GlyxMedia>,
}

unsafe impl Send for VmEncoder {}

/// Opaque audio-decoder handle. Created by `GlyxMedia::audio_decoder_open`.
pub struct VmAudioDecoder {
    pub ptr:         *mut c_void,
    pub sample_rate: u32,
    pub channels:    u16,
}

// SAFETY: VmAudioDecoder is a raw pointer to C data with no thread-local state.
// Access is single-threaded (owned by FfmpegAudioSource which is Send).
unsafe impl Send for VmAudioDecoder {}
