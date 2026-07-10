import React, { useRef, useEffect, useState } from 'react';
import { video } from './api.js';

// ── Camera component ──────────────────────────────────────────────────────────
//
// Renders a live camera preview as a native node — frames NEVER cross the JS
// bridge. JS only controls lifecycle (open / close / capture / record).
//
// Usage:
//   const camRef = useRef();
//   <Camera ref={camRef} mirror style={{ width: 640, height: 480 }} />
//   await camRef.current.start(0);       // open device index 0
//   const path = await camRef.current.capture();   // take photo → PNG path
//   camRef.current.startRecord('/tmp/out.mp4');
//   const mp4 = await camRef.current.stopRecord(); // flush → MP4 path
//   camRef.current.stop();

export const Camera = React.forwardRef(function Camera({ mirror, style, ...rest }, ref) {
  const [cameraHandle, setCameraHandle] = React.useState(null);

  // Auto-close the camera when this component unmounts (e.g. tab switch, navigation).
  // Without this the native capture session keeps running in the background.
  React.useEffect(() => {
    return () => {
      if (cameraHandle !== null) {
        __glyx_camera_close(String(cameraHandle));
      }
    };
  }, [cameraHandle]);

  React.useImperativeHandle(ref, () => ({
    /** @returns {number|null} current handle, or null if not open */
    get handle() { return cameraHandle; },

    async start(deviceIndex = 0) {
      const handle = parseInt(await __glyx_camera_open(deviceIndex));
      setCameraHandle(handle);
      return handle;
    },
    stop() {
      if (cameraHandle !== null) {
        __glyx_camera_close(String(cameraHandle));
        setCameraHandle(null);
      }
    },
    /** Capture current frame → PNG. @returns {Promise<string>} path */
    async capture() {
      if (cameraHandle === null) throw new Error('Camera not open');
      return __glyx_camera_capture(String(cameraHandle));
    },
    /** Start MP4 recording via ffmpeg. @param {string} outputPath */
    startRecord(outputPath) {
      if (cameraHandle === null) throw new Error('Camera not open');
      __glyx_camera_record_start(String(cameraHandle), outputPath);
    },
    /** Stop recording and flush MP4. @returns {Promise<string>} path */
    async stopRecord() {
      if (cameraHandle === null) throw new Error('Camera not open');
      return __glyx_camera_record_stop(String(cameraHandle));
    },
  }), [cameraHandle]);

  return React.createElement('camera', {
    cameraHandle: cameraHandle,
    mirror: mirror === true,
    style,
    ...rest,
  });
});

// ── Video component ───────────────────────────────────────────────────────────
//
// Renders a video file / URL as a native node — frames NEVER cross the JS
// bridge. Requires `video: true` in glyx.config.json AND the glyx-media DLL
// to be present in ~/.glyx/cache/media/.
//
// Usage:
//   const vidRef = useRef();
//   <Video ref={vidRef} src="/path/to/movie.mp4"
//          style={{ width: 640, height: 360 }}
//          onEnded={() => console.log('done')} />
//   await vidRef.current.seek(30);   // jump to 30 s
//   vidRef.current.close();          // release handle early

export const Video = React.forwardRef(function Video(
  { src, autoPlay = true, loop = false, onEnded, onMetadata, onTimeUpdate, onError, style, ...rest },
  ref
) {
  const [videoHandle, setVideoHandle] = React.useState(null);
  // Mutable refs — updated from event callbacks without causing re-renders.
  const currentTimeRef = React.useRef(0);
  const durationRef    = React.useRef(-1);

  React.useEffect(() => {
    if (!src) return;
    let handle = null;
    let cancelled = false;
    currentTimeRef.current = 0;
    durationRef.current    = -1;
    video.open(src, {
      onEnded: loop ? () => { if (handle !== null) video.seek(handle, 0); } : onEnded,
      onMetadata: (m) => {
        durationRef.current = m.durationSecs ?? -1;
        if (onMetadata) onMetadata(m);
      },
      onTimeUpdate: (t) => {
        currentTimeRef.current = t;
        if (onTimeUpdate) onTimeUpdate(t);
      },
      onError,
    }).then(h => {
      if (cancelled) { video.close(h); return; }
      handle = h;
      setVideoHandle(h);
    }).catch(e => {
      if (onError) onError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      if (handle !== null) {
        video.close(handle);
        handle = null;
        setVideoHandle(null);
      }
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useImperativeHandle(ref, () => ({
    get handle()      { return videoHandle; },
    get currentTime() { return currentTimeRef.current; },
    get duration()    { return durationRef.current; },
    seek(seconds) {
      if (videoHandle !== null) video.seek(videoHandle, seconds);
    },
    setVolume(vol) {
      if (videoHandle !== null) video.setVolume(videoHandle, vol);
    },
    pause() {
      if (videoHandle !== null) video.pause(videoHandle);
    },
    play() {
      if (videoHandle !== null) video.play(videoHandle);
    },
    close() {
      if (videoHandle !== null) {
        video.close(videoHandle);
        setVideoHandle(null);
      }
    },
  }), [videoHandle]);

  return React.createElement('video', { videoHandle, style, ...rest });
});
