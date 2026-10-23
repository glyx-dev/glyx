//! Audio files as the 30-second windows of 16 kHz mono samples that Whisper takes.
//!
//! WAV (8/16/24/32-bit PCM or 32-bit float, any channel count and sample rate) is read by a small parser here. MP3, FLAC and OGG
//! (Vorbis) are decoded by `symphonia` when the `compressed-audio` feature is on, which it is by default. Either way the file is read
//! and decoded as the windows are asked for, so memory stays at about one window (2 MB) however long the recording is.

use anyhow::{bail, Context, Result};
use std::io::{Read, Seek, SeekFrom};

/// What Whisper's models take.
pub const SAMPLE_RATE: u32 = 16_000;
/// 30 s of audio, the length of one window.
pub const WINDOW_SAMPLES: usize = 30 * SAMPLE_RATE as usize;

/// Frames read from a WAV per block.
const WAV_BLOCK_FRAMES: usize = 16_384;

/// Mono samples in -1.0..1.0 at the source's own sample rate, block by block.
trait Source {
    fn rate(&self) -> u32;
    /// The next block, or `None` at the end of the audio.
    fn next_block(&mut self) -> Result<Option<Vec<f32>>>;
}

/// The windows of one audio file, in order. Each is 30 s long except the last, which is whatever is left.
pub struct Windows {
    source:    Box<dyn Source>,
    resampler: Option<Resampler>,
    pending:   Vec<f32>,
    ended:     bool,
}

impl Windows {
    /// Open `path` as audio. The format is recognised by its content, not its name.
    pub fn open(path: &str) -> Result<Self> {
        let mut file = std::fs::File::open(path)?;
        let mut head = [0u8; 12];
        let mut got = 0;
        while got < head.len() {
            match file.read(&mut head[got..])? { 0 => break, n => got += n }
        }
        file.seek(SeekFrom::Start(0))?;

        let source: Box<dyn Source> = if got == 12 && &head[0..4] == b"RIFF" && &head[8..12] == b"WAVE" {
            Box::new(WavSource::new(std::io::BufReader::new(file))?)
        } else {
            open_compressed(file, path)?
        };
        Ok(Self::from_source(source))
    }

    fn from_source(source: Box<dyn Source>) -> Self {
        let resampler = (source.rate() != SAMPLE_RATE).then(|| Resampler::new(source.rate(), SAMPLE_RATE));
        Windows { source, resampler, pending: Vec::new(), ended: false }
    }

    /// The next window, or `None` when the audio is over.
    pub fn next_window(&mut self) -> Result<Option<Vec<f32>>> {
        while self.pending.len() < WINDOW_SAMPLES && !self.ended {
            match self.source.next_block()? {
                Some(block) => match &mut self.resampler {
                    Some(r) => r.push(&block, &mut self.pending),
                    None => self.pending.extend_from_slice(&block),
                },
                None => {
                    self.ended = true;
                    if let Some(r) = &mut self.resampler { r.finish(&mut self.pending); }
                }
            }
        }
        if self.pending.is_empty() { return Ok(None); }
        let rest = self.pending.split_off(self.pending.len().min(WINDOW_SAMPLES));
        Ok(Some(std::mem::replace(&mut self.pending, rest)))
    }
}

// ── Resampling ───────────────────────────────────────────────────────────────

/// Linear-interpolation resampling that can be fed block by block. Good enough for speech going into a 16 kHz model; there is no
/// low-pass filter, so a much higher rate aliases a little.
struct Resampler {
    /// Input samples per output sample.
    ratio: f64,
    /// Where the next output sample sits in `buf`, in input samples.
    pos:   f64,
    buf:   Vec<f32>,
}

impl Resampler {
    fn new(from: u32, to: u32) -> Self {
        Resampler { ratio: from as f64 / to as f64, pos: 0.0, buf: Vec::new() }
    }

    fn at(&self, pos: f64) -> f32 {
        let j = pos as usize;
        let (a, b) = (self.buf[j.min(self.buf.len() - 1)], self.buf[(j + 1).min(self.buf.len() - 1)]);
        a + (b - a) * (pos - j as f64) as f32
    }

    fn push(&mut self, block: &[f32], out: &mut Vec<f32>) {
        self.buf.extend_from_slice(block);
        // An output sample needs the input sample after it as well.
        while self.pos + 1.0 < self.buf.len() as f64 {
            out.push(self.at(self.pos));
            self.pos += self.ratio;
        }
        let used = (self.pos as usize).min(self.buf.len());
        self.buf.drain(..used);
        self.pos -= used as f64;
    }

    /// The end of the input: what is left, holding the last sample.
    fn finish(&mut self, out: &mut Vec<f32>) {
        if self.buf.is_empty() { return; }
        while self.pos <= (self.buf.len() - 1) as f64 {
            out.push(self.at(self.pos));
            self.pos += self.ratio;
        }
        self.buf.clear();
    }
}

// ── WAV ──────────────────────────────────────────────────────────────────────

struct WavSource<R: Read> {
    reader:    R,
    format:    u16,
    channels:  usize,
    rate:      u32,
    bits:      u16,
    /// Bytes of the data chunk not read yet (it may claim more than the file has: then the read ends at the end of the file).
    remaining: u64,
}

impl<R: Read> WavSource<R> {
    fn new(mut reader: R) -> Result<Self> {
        let mut riff = [0u8; 12];
        reader.read_exact(&mut riff).context("not a WAV file")?;
        if &riff[0..4] != b"RIFF" || &riff[8..12] != b"WAVE" { bail!("not a WAV file"); }

        let mut fmt: Option<(u16, u16, u32, u16)> = None; // (format, channels, rate, bits)
        loop {
            let mut head = [0u8; 8];
            if reader.read_exact(&mut head).is_err() { bail!("WAV has no data chunk"); }
            let size = u32::from_le_bytes([head[4], head[5], head[6], head[7]]) as u64;
            match &head[0..4] {
                b"fmt " if (16..=1024).contains(&size) => {
                    let mut body = vec![0u8; size as usize];
                    reader.read_exact(&mut body).context("WAV fmt chunk is cut short")?;
                    let u16_at = |o: usize| u16::from_le_bytes([body[o], body[o + 1]]);
                    let mut format = u16_at(0);
                    if format == 0xFFFE && body.len() >= 26 { format = u16_at(24); } // WAVE_FORMAT_EXTENSIBLE: the real tag is in the sub-format
                    fmt = Some((format, u16_at(2), u32::from_le_bytes([body[4], body[5], body[6], body[7]]), u16_at(14)));
                    if size & 1 == 1 { skip(&mut reader, 1)?; }
                }
                b"data" => {
                    let (format, channels, rate, bits) = fmt.context("WAV has no fmt chunk before its data")?;
                    if channels == 0 || rate == 0 { bail!("WAV header is invalid (channels {channels}, rate {rate})"); }
                    if !matches!((format, bits), (1, 8 | 16 | 24 | 32) | (3, 32)) {
                        bail!("unsupported WAV encoding (format {format}, {bits} bits): use PCM 8/16/24/32-bit or 32-bit float");
                    }
                    // 0 and 0xFFFFFFFF are what a recorder that streams to a file writes before it knows the length.
                    let remaining = if size == 0 || size == 0xFFFF_FFFF { u64::MAX } else { size };
                    return Ok(WavSource { reader, format, channels: channels as usize, rate, bits, remaining });
                }
                _ => skip(&mut reader, size + (size & 1))?,
            }
        }
    }

    fn sample(&self, c: &[u8]) -> f32 {
        match (self.format, self.bits) {
            (1, 8)  => (c[0] as f32 - 128.0) / 128.0,
            (1, 16) => i16::from_le_bytes([c[0], c[1]]) as f32 / 32768.0,
            (1, 24) => (i32::from_le_bytes([0, c[0], c[1], c[2]]) >> 8) as f32 / 8_388_608.0,
            (1, 32) => i32::from_le_bytes([c[0], c[1], c[2], c[3]]) as f32 / 2_147_483_648.0,
            _       => f32::from_le_bytes([c[0], c[1], c[2], c[3]]),
        }
    }
}

/// Read and drop `n` bytes. A chunk that claims to be longer than the file ends the read, which the next header read then reports.
fn skip<R: Read>(reader: &mut R, n: u64) -> Result<()> {
    std::io::copy(&mut reader.by_ref().take(n), &mut std::io::sink())?;
    Ok(())
}

impl<R: Read> Source for WavSource<R> {
    fn rate(&self) -> u32 { self.rate }

    fn next_block(&mut self) -> Result<Option<Vec<f32>>> {
        let width = self.bits as usize / 8;
        let frame = width * self.channels;
        let want = (WAV_BLOCK_FRAMES * frame).min(self.remaining.min(usize::MAX as u64) as usize);
        if want < frame { return Ok(None); }
        let mut bytes = Vec::with_capacity(want);
        (&mut self.reader).take(want as u64).read_to_end(&mut bytes)?;
        if self.remaining != u64::MAX { self.remaining -= bytes.len() as u64; }
        let whole = bytes.len() / frame * frame; // a cut-off last frame is dropped
        if whole == 0 { self.remaining = 0; return Ok(None); }
        if bytes.len() < want { self.remaining = 0; } // the file ended early: this is the last block
        let channels = self.channels as f32;
        Ok(Some(bytes[..whole].chunks_exact(frame)
            .map(|f| f.chunks_exact(width).map(|c| self.sample(c)).sum::<f32>() / channels)
            .collect()))
    }
}

// ── MP3, FLAC, OGG ───────────────────────────────────────────────────────────

#[cfg(not(feature = "compressed-audio"))]
fn open_compressed(_file: std::fs::File, _path: &str) -> Result<Box<dyn Source>> {
    bail!("only .wav audio is supported (this build has no MP3/FLAC/OGG decoder: the `compressed-audio` feature of glyx-ai is off)")
}

#[cfg(feature = "compressed-audio")]
fn open_compressed(file: std::fs::File, path: &str) -> Result<Box<dyn Source>> {
    use symphonia::core::{codecs::{DecoderOptions, CODEC_TYPE_NULL}, formats::FormatOptions, io::MediaSourceStream, meta::MetadataOptions, probe::Hint};

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) { hint.with_extension(ext); }
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    let probed = symphonia::default::get_probe()
        .format(&hint, stream, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|_| anyhow::anyhow!("not a supported audio file (WAV, MP3, FLAC and OGG are)"))?;
    let format = probed.format;
    let track = format.tracks().iter().find(|t| t.codec_params.codec != CODEC_TYPE_NULL).context("the file has no audio track")?;
    let rate = track.codec_params.sample_rate.context("the audio file does not say its sample rate")?;
    let track_id = track.id;
    let decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| anyhow::anyhow!("no decoder for this audio: {e}"))?;
    Ok(Box::new(CompressedSource { format, decoder, track_id, rate, scratch: None }))
}

#[cfg(feature = "compressed-audio")]
struct CompressedSource {
    format:   Box<dyn symphonia::core::formats::FormatReader>,
    decoder:  Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    rate:     u32,
    scratch:  Option<symphonia::core::audio::SampleBuffer<f32>>,
}

#[cfg(feature = "compressed-audio")]
impl Source for CompressedSource {
    fn rate(&self) -> u32 { self.rate }

    fn next_block(&mut self) -> Result<Option<Vec<f32>>> {
        use symphonia::core::{audio::SampleBuffer, errors::Error};
        loop {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                // The end of the stream is reported as an unexpected end of file; a reset means the stream changed shape, which a
                // transcription cannot follow.
                Err(Error::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
                Err(Error::ResetRequired) => return Ok(None),
                Err(e) => return Err(anyhow::anyhow!("reading the audio failed: {e}")),
            };
            if packet.track_id() != self.track_id { continue; }
            let decoded = match self.decoder.decode(&packet) {
                Ok(d) => d,
                Err(Error::DecodeError(_)) => continue, // one damaged packet: skip it, keep the rest
                Err(e) => return Err(anyhow::anyhow!("decoding the audio failed: {e}")),
            };
            let spec = *decoded.spec();
            let channels = spec.channels.count().max(1);
            if self.scratch.as_ref().map_or(true, |s| s.capacity() < decoded.capacity() * channels) {
                self.scratch = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, spec));
            }
            let scratch = self.scratch.as_mut().expect("just created");
            scratch.copy_interleaved_ref(decoded);
            let mono: Vec<f32> = scratch.samples().chunks_exact(channels).map(|f| f.iter().sum::<f32>() / channels as f32).collect();
            if !mono.is_empty() { return Ok(Some(mono)); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    /// A WAV in memory: `extra` is a chunk placed between fmt and data.
    fn wav(format: u16, channels: u16, rate: u32, bits: u16, data: &[u8], extra: &[u8]) -> Vec<u8> {
        let mut fmt = Vec::new();
        fmt.extend(format.to_le_bytes());
        fmt.extend(channels.to_le_bytes());
        fmt.extend(rate.to_le_bytes());
        fmt.extend((rate * channels as u32 * bits as u32 / 8).to_le_bytes());
        fmt.extend((channels * bits / 8).to_le_bytes());
        fmt.extend(bits.to_le_bytes());
        let mut body = b"WAVE".to_vec();
        body.extend(b"fmt "); body.extend((fmt.len() as u32).to_le_bytes()); body.extend(&fmt);
        body.extend(extra);
        body.extend(b"data"); body.extend((data.len() as u32).to_le_bytes()); body.extend(data);
        let mut out = b"RIFF".to_vec();
        out.extend((body.len() as u32).to_le_bytes());
        out.extend(body);
        out
    }

    /// Everything a WAV holds, at its own sample rate.
    fn decode_wav(bytes: &[u8]) -> Result<(Vec<f32>, u32)> {
        let mut src = WavSource::new(Cursor::new(bytes.to_vec()))?;
        let mut all = Vec::new();
        while let Some(block) = src.next_block()? { all.extend(block); }
        Ok((all, src.rate()))
    }

    /// Everything a file gives as windows, joined.
    fn all_windows(source: Box<dyn Source>) -> Vec<Vec<f32>> {
        let mut w = Windows::from_source(source);
        let mut out = Vec::new();
        while let Some(win) = w.next_window().unwrap() { out.push(win); }
        out
    }

    #[test]
    fn a_16_bit_mono_file_decodes_to_unit_range() {
        let data: Vec<u8> = [0i16, 16384, -32768].iter().flat_map(|s| s.to_le_bytes()).collect();
        let (s, rate) = decode_wav(&wav(1, 1, 16000, 16, &data, &[])).unwrap();
        assert_eq!(rate, 16000);
        assert_eq!(s, vec![0.0, 0.5, -1.0]);
    }

    #[test]
    fn extra_chunks_before_the_data_are_skipped_including_an_odd_sized_one() {
        let mut extra = b"LIST".to_vec();
        extra.extend(3u32.to_le_bytes());
        extra.extend([1, 2, 3, 0]); // 3 bytes + 1 pad byte
        let data: Vec<u8> = 1000i16.to_le_bytes().to_vec();
        let (s, _) = decode_wav(&wav(1, 1, 16000, 16, &data, &extra)).unwrap();
        assert_eq!(s.len(), 1);
        assert!((s[0] - 1000.0 / 32768.0).abs() < 1e-6);
    }

    #[test]
    fn stereo_is_mixed_to_mono_and_other_encodings_decode() {
        let stereo: Vec<u8> = [16384i16, -16384, 16384, 16384].iter().flat_map(|s| s.to_le_bytes()).collect();
        assert_eq!(decode_wav(&wav(1, 2, 16000, 16, &stereo, &[])).unwrap().0, vec![0.0, 0.5]);
        let float: Vec<u8> = [0.25f32, -0.5].iter().flat_map(|s| s.to_le_bytes()).collect();
        assert_eq!(decode_wav(&wav(3, 1, 44100, 32, &float, &[])).unwrap(), (vec![0.25, -0.5], 44100));
        assert_eq!(decode_wav(&wav(1, 1, 8000, 8, &[128, 255, 0], &[])).unwrap().0, vec![0.0, 127.0 / 128.0, -1.0]);
        let b24: Vec<u8> = vec![0x00, 0x00, 0x40, 0x00, 0x00, 0xC0]; // +0.5, -0.5
        assert_eq!(decode_wav(&wav(1, 1, 16000, 24, &b24, &[])).unwrap().0, vec![0.5, -0.5]);
    }

    #[test]
    fn a_data_chunk_that_claims_more_than_the_file_has_reads_what_is_there() {
        let mut file = wav(1, 1, 16000, 16, &[1, 0, 2, 0, 3], &[]); // two samples and a stray byte
        let n = file.len();
        file[n - 5 - 4..n - 5].copy_from_slice(&1000u32.to_le_bytes()); // lie about the data size
        assert_eq!(decode_wav(&file).unwrap().0.len(), 2);
    }

    #[test]
    fn a_streamed_file_whose_data_size_is_zero_or_unset_reads_to_the_end() {
        for size in [0u32, 0xFFFF_FFFF] {
            let mut file = wav(1, 1, 16000, 16, &[1, 0, 2, 0, 3, 0], &[]);
            let n = file.len();
            file[n - 6 - 4..n - 6].copy_from_slice(&size.to_le_bytes());
            assert_eq!(decode_wav(&file).unwrap().0.len(), 3, "data size {size:#x}");
        }
    }

    #[test]
    fn what_is_not_a_wav_or_not_supported_says_so() {
        let err = |b: &[u8]| decode_wav(b).err().expect("should fail").to_string();
        assert!(err(b"ID3 and mp3 bytes").contains("not a WAV"));
        assert!(err(&wav(2, 1, 16000, 4, &[0, 0], &[])).contains("unsupported WAV encoding"));
        assert!(err(b"RIFF\0\0\0\0WAVE").contains("no data chunk"));
        let mut no_fmt = b"RIFF\0\0\0\0WAVEdata".to_vec();
        no_fmt.extend(2u32.to_le_bytes());
        no_fmt.extend([0, 0]);
        assert!(err(&no_fmt).contains("no fmt chunk"));
    }

    #[test]
    fn a_long_file_comes_out_in_30_second_windows_and_the_last_is_what_is_left() {
        // 70 s at 16 kHz: windows of 30 s, 30 s and 10 s.
        let n = 70 * 16_000;
        let data: Vec<u8> = (0..n).flat_map(|i| ((i % 100) as i16 * 100).to_le_bytes()).collect();
        let windows = all_windows(Box::new(WavSource::new(Cursor::new(wav(1, 1, 16000, 16, &data, &[]))).unwrap()));
        assert_eq!(windows.iter().map(Vec::len).collect::<Vec<_>>(), vec![WINDOW_SAMPLES, WINDOW_SAMPLES, 10 * 16_000]);
        assert!((windows[1][5] - 500.0 / 32768.0).abs() < 1e-6, "windows must not drop or repeat samples at their edges");
    }

    #[test]
    fn a_file_at_another_rate_is_resampled_to_16k_across_blocks_without_a_seam() {
        // A 48 kHz ramp longer than one read block: the resampled ramp must stay a straight line through the block edges.
        let n = 48_000usize;
        let data: Vec<u8> = (0..n).flat_map(|i| (i as f32 / 48_000.0).to_le_bytes()).collect();
        let windows = all_windows(Box::new(WavSource::new(Cursor::new(wav(3, 1, 48000, 32, &data, &[]))).unwrap()));
        let out: Vec<f32> = windows.concat();
        assert!((out.len() as i64 - 16_000).abs() <= 1, "1 s at 48 kHz is 16000 samples, got {}", out.len());
        let step = out[1] - out[0];
        assert!(step > 0.0);
        for pair in out.windows(2).take(out.len() - 2) {
            assert!(((pair[1] - pair[0]) - step).abs() < step * 0.01, "a jump in the resampled ramp: {} then {}", pair[0], pair[1]);
        }
    }

    #[test]
    fn resampling_changes_the_length_by_the_rate_ratio_and_keeps_a_ramp_linear() {
        let ramp: Vec<f32> = (0..4800).map(|i| i as f32).collect();
        let mut r = Resampler::new(48000, 16000);
        let mut out = Vec::new();
        r.push(&ramp, &mut out);
        r.finish(&mut out);
        assert!((out.len() as i64 - 1600).abs() <= 1);
        assert!((out[10] - 30.0).abs() < 1e-3);
        // Fed in pieces it gives the same samples as fed at once.
        let mut r = Resampler::new(48000, 16000);
        let mut pieces = Vec::new();
        for chunk in ramp.chunks(777) { r.push(chunk, &mut pieces); }
        r.finish(&mut pieces);
        assert_eq!(pieces.len(), out.len());
        assert!(pieces.iter().zip(&out).all(|(a, b)| (a - b).abs() < 1e-3));
        let mut up = Vec::new();
        let mut r = Resampler::new(8000, 16000);
        r.push(&[0.0, 1.0], &mut up);
        r.finish(&mut up);
        assert_eq!(up, vec![0.0, 0.5, 1.0]);
    }

    #[test]
    fn a_name_that_lies_is_still_read_by_its_content() {
        let dir = std::env::temp_dir().join(format!("glyx_ai_audio_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("recording.mp3"); // a WAV with the wrong extension
        let data: Vec<u8> = [0i16, 8192].iter().flat_map(|s| s.to_le_bytes()).collect();
        std::fs::write(&path, wav(1, 1, 16000, 16, &data, &[])).unwrap();
        let mut w = Windows::open(path.to_str().unwrap()).unwrap();
        assert_eq!(w.next_window().unwrap().unwrap(), vec![0.0, 0.25]);
        assert!(w.next_window().unwrap().is_none());

        std::fs::write(&path, b"this is not audio at all, just text").unwrap();
        assert!(Windows::open(path.to_str().unwrap()).is_err());
        assert!(Windows::open(dir.join("missing.wav").to_str().unwrap()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(feature = "compressed-audio")]
    mod compressed {
        use super::*;

        fn fixture(name: &str) -> String {
            format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"))
        }

        fn decode(name: &str) -> Vec<f32> {
            let mut w = Windows::open(&fixture(name)).unwrap_or_else(|e| panic!("{name}: {e:#}"));
            let mut out = Vec::new();
            while let Some(win) = w.next_window().unwrap() { out.extend(win); }
            out
        }

        fn rms(s: &[f32]) -> f32 { (s.iter().map(|x| x * x).sum::<f32>() / s.len() as f32).sqrt() }

        #[test]
        fn flac_decodes_to_the_same_samples_as_the_wav_it_came_from() {
            let (wav, flac) = (decode("speech_2s.wav"), decode("speech_2s.flac"));
            assert_eq!(wav.len(), 32_000);
            assert_eq!(flac.len(), wav.len(), "lossless: same length");
            let worst = wav.iter().zip(&flac).map(|(a, b)| (a - b).abs()).fold(0f32, f32::max);
            assert!(worst < 1e-4, "FLAC is lossless but differs by {worst}");
        }

        #[test]
        fn mp3_and_ogg_decode_to_speech_of_the_right_length_and_loudness() {
            let reference = decode("speech_2s.wav");
            for name in ["speech_2s.mp3", "speech_2s.ogg"] {
                let s = decode(name);
                // Encoders add a little silence at the start and end.
                assert!((s.len() as i64 - 32_000).abs() < 3_000, "{name}: {} samples for 2 s", s.len());
                let ratio = rms(&s) / rms(&reference);
                assert!((0.8..1.2).contains(&ratio), "{name}: loudness {ratio:.2} of the original");
                assert!(s.iter().all(|x| x.abs() <= 1.2));
            }
        }

        #[test]
        fn the_lossy_decodes_follow_the_original_waveform() {
            // Same speech, so the loudness over time must line up. Lossy encoders add a delay of tens of milliseconds, so compare the 10 ms
            // energies at every shift up to 100 ms and take the best match.
            let energy = |s: &[f32]| s.chunks(160).map(rms).collect::<Vec<_>>();
            let correlation = |a: &[f32], b: &[f32]| {
                let n = a.len().min(b.len());
                let (a, b) = (&a[..n], &b[..n]);
                let (ma, mb) = (a.iter().sum::<f32>() / n as f32, b.iter().sum::<f32>() / n as f32);
                let cov: f32 = a.iter().zip(b).map(|(x, y)| (x - ma) * (y - mb)).sum();
                let (va, vb): (f32, f32) = (a.iter().map(|x| (x - ma).powi(2)).sum(), b.iter().map(|y| (y - mb).powi(2)).sum());
                cov / (va.sqrt() * vb.sqrt())
            };
            let reference = energy(&decode("speech_2s.wav"));
            for name in ["speech_2s.mp3", "speech_2s.ogg"] {
                let e = energy(&decode(name));
                let best = (0..=10usize)
                    .flat_map(|lag| [correlation(&reference[lag..], &e), correlation(&reference, &e[lag..])])
                    .fold(f32::MIN, f32::max);
                assert!(best > 0.9, "{name}: best energy correlation with the original is only {best:.2}");
            }
        }

        #[test]
        fn a_damaged_or_truncated_file_gives_what_could_be_read_or_a_clear_error() {
            let bytes = std::fs::read(fixture("speech_2s.mp3")).unwrap();
            let dir = std::env::temp_dir().join(format!("glyx_ai_trunc_{}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let cut = dir.join("cut.mp3");
            std::fs::write(&cut, &bytes[..bytes.len() / 2]).unwrap();
            let mut w = Windows::open(cut.to_str().unwrap()).expect("half an MP3 still opens");
            let first = w.next_window().expect("a cut file reads to its end").expect("some audio");
            assert!(first.len() > 8_000 && first.len() < 32_000, "{} samples from half the file", first.len());
            let _ = std::fs::remove_dir_all(&dir);
        }
    }
}
