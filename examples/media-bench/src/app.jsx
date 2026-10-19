// Plays one video on a loop, to measure what playback costs: CPU, memory and frame time (see `extra_perf.md`, media section).
// Point VIDEO at a file (make one with ffmpeg, for instance `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -t 20 out.mp4`).
import React from 'react';
import { View, Text, Video, render } from '@glyx-dev/react';

const VIDEO = 'C:/path/to/video.mp4';
const SHOW = 'fit'; // 'fit' scales the video to the window width, 'native' draws it at its own size

function App() {
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

render(<App />);
