// Plays one video on a loop, or shows the camera (and records it), to measure what that costs: CPU, memory and frame time
// (see `extra_perf.md`, media section). Point VIDEO at a file (make one with ffmpeg, for instance
// `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -t 20 out.mp4`), or set MODE to 'camera' or 'record' (the camera, and
// recording it to RECORD_TO after a few seconds).
import React from 'react';
import { View, Text, Video, Camera, render } from '@glyx-dev/react';

const MODE = 'video'; // 'video' | 'camera' | 'record'
const VIDEO = 'C:/path/to/video.mp4';
const RECORD_TO = 'C:/path/to/recording.mp4';
const RECORD_SECS = 10; // how long 'record' mode records before it stops and saves
const SHOW = 'fit'; // 'fit' scales the video to the window width, 'native' draws it at its own size

function VideoView() {
  const [meta, setMeta] = React.useState(null);
  const w = meta && SHOW === 'native' ? meta.width : 1280;
  const h = meta ? Math.round(w * meta.height / meta.width) : 720;
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      <Video src={VIDEO} autoPlay loop style={{ width: w, height: h }} onMetadata={setMeta} />
      <Text fontSize={14} style={{ color: '#8a8aa0', marginTop: 8, marginLeft: 12 }}>
        {meta ? `${meta.width}x${meta.height} at ${meta.fps} fps` : 'opening...'}
      </Text>
    </View>
  );
}

function CameraView() {
  const ref = React.useRef(null);
  const [state, setState] = React.useState('opening camera...');
  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await ref.current.start(0);
        if (dead) return;
        setState('camera on');
        if (MODE === 'record') {
          await new Promise((r) => setTimeout(r, 3000));
          ref.current.startRecord(RECORD_TO);
          setState('recording');
          await new Promise((r) => setTimeout(r, RECORD_SECS * 1000));
          const saved = await ref.current.stopRecord();
          setState('saved ' + saved);
        }
      } catch (e) { setState('error: ' + (e && e.message)); }
    })();
    return () => { dead = true; };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      <Camera ref={ref} style={{ width: 960, height: 540 }} />
      <Text fontSize={14} style={{ color: '#8a8aa0', marginTop: 8, marginLeft: 12 }}>{state}</Text>
    </View>
  );
}

render(MODE === 'video' ? <VideoView /> : <CameraView />);
