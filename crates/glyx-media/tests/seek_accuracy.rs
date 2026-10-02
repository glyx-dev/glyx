//! Where do seeks really land? Needs the glyx-media DLL cached and a clip
//! with a short beep at every whole second:
//!   GLYX_SEEK_CLIP=beeps.mp4 cargo test -p glyx-media --test seek_accuracy -- --ignored --nocapture

#[test]
#[ignore]
fn audio_and_video_seek_positions() {
    let clip = std::env::var("GLYX_SEEK_CLIP").expect("GLYX_SEEK_CLIP");
    let media = glyx_media::get_media().expect("glyx-media DLL");
    for target in [5.5_f64, 9.25, 13.9] {
        // Audio: samples until the next beep tell where playback started.
        let dec = media.audio_decoder_open(&clip).unwrap();
        let (rate, ch) = (dec.sample_rate as f64, dec.channels as usize);
        assert!(media.audio_decoder_seek(&dec, target), "no native audio seek");
        let mut buf = vec![0i16; 4096];
        let mut frames = 0usize;
        let mut beep_at = None;
        'outer: loop {
            let n = media.audio_decoder_next_samples(&dec, &mut buf);
            if n <= 0 { break; }
            for (i, s) in buf[..n as usize].chunks(ch).enumerate() {
                if s[0].unsigned_abs() > 3000 { beep_at = Some(frames + i); break 'outer; }
            }
            frames += n as usize / ch;
        }
        let secs_to_beep = beep_at.unwrap() as f64 / rate;
        let next_beep = target.ceil();
        let actual_audio_start = next_beep - secs_to_beep;
        media.audio_decoder_close(dec);

        // Video: pts of the first frame after the seek.
        let vdec = media.decoder_open(&clip).unwrap();
        let mut rgba = vec![0u8; (vdec.width * vdec.height * 4) as usize];
        media.decoder_seek(&vdec, target);
        let first_pts = media.decoder_next_frame(&vdec, &mut rgba).unwrap().unwrap();
        media.decoder_close(vdec);

        println!("seek {target:>5.2}s: audio starts at {actual_audio_start:.3}s (off by {:+.0} ms), first video frame pts {first_pts:.3}s (off by {:+.0} ms)",
            (actual_audio_start - target) * 1000.0, (first_pts - target) * 1000.0);
    }
}

/// Recording works without GPL encoders: encode 2 s of frames, read them back.
///   GLYX_ENCODE_OUT=out.mp4 cargo test -p glyx-media --test seek_accuracy encode -- --ignored --nocapture
#[test]
#[ignore]
fn encode_then_decode_round_trip() {
    let out = std::env::var("GLYX_ENCODE_OUT").expect("GLYX_ENCODE_OUT");
    let _ = std::fs::remove_file(&out);
    let media = glyx_media::get_media().expect("glyx-media DLL");
    let (w, h, fps) = (320u32, 240u32, 30u32);
    let enc = media.encoder_open(&out, w, h, fps).expect("an encoder opens");
    let mut rgba = vec![0u8; (w * h * 4) as usize];
    for f in 0..60u32 {
        for (i, px) in rgba.chunks_mut(4).enumerate() {
            let x = (i as u32 % w + f * 4) % 256;
            px.copy_from_slice(&[x as u8, (f * 4) as u8, 128, 255]);
        }
        media.encoder_write_rgba(&enc, &rgba).expect("write frame");
    }
    media.encoder_close(enc);
    let dec = media.decoder_open(&out).expect("the recording opens");
    let mut frame = vec![0u8; (dec.width * dec.height * 4) as usize];
    let mut n = 0;
    while let Ok(Some(_)) = media.decoder_next_frame(&dec, &mut frame) { n += 1; }
    media.decoder_close(dec);
    println!("recorded {} bytes, decoded {n} frames", std::fs::metadata(&out).unwrap().len());
    assert!(n >= 55, "{n} frames");
}
