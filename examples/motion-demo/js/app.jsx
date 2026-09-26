import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, render } from '@glyx-dev/react';

// Every animation below is interpolated natively, frame by frame, from ONE
// React state change — JS doesn't re-render while it plays.

const EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.68,-0.55,0.27,1.55)'];

function Button({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2a2a3a' }}
    >
      <Text style={{ color: '#e8e8f0', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function Card({ on }) {
  return (
    <View
      transition={{ duration: 600, properties: 'all', easing: 'ease-in-out' }}
      style={{
        width: 160,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor:     on ? '#ffd166' : '#3a3a55',
        backgroundColor: on ? '#ef476f' : '#118ab2',
        borderRadius:    on ? 50 : 6,
        opacity:         on ? 1 : 0.6,
        boxShadow:       on ? '8 12 0 #00000099' : '0 0 0 #00000000',
        transform:       on ? 'translate(120, 0) rotate(180) scale(1.2)' : 'translate(0, 0) rotate(0) scale(1)',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 16 }}>{on ? 'on' : 'off'}</Text>
    </View>
  );
}

function EasingRow({ easing, on }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 30 }}>
      <Text style={{ width: 150, color: '#9a9ab0', fontSize: 11 }}>{easing.startsWith('cubic') ? 'back (overshoot)' : easing}</Text>
      <View style={{ flex: 1, height: 22 }}>
        <View
          transition={{ duration: 1200, properties: ['transform'], easing }}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#06d6a0',
            transform: on ? 'translate(300, 0)' : 'translate(0, 0)',
          }}
        />
      </View>
    </View>
  );
}

function Keyframes() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 60 }}>
      {/* A spinner: one full turn per second, forever. */}
      <View
        animation={{ duration: 1000, easing: 'linear', iterations: Infinity,
                     keyframes: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }}
        style={{ width: 36, height: 36, borderRadius: 6, borderWidth: 4, borderColor: '#ffd166', backgroundColor: '#1a1a26' }}
      />
      <View style={{ width: 32 }} />
      {/* A pulse with a mid-point stop, bouncing back and forth. */}
      <View
        animation={{ duration: 900, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate',
                     keyframes: {
                       0:   { transform: 'scale(1)',   backgroundColor: '#118ab2', boxShadow: '0 0 0 #06d6a000' },
                       60:  { transform: 'scale(1.25)', backgroundColor: '#06d6a0' },
                       100: { transform: 'scale(1.1)', backgroundColor: '#ef476f', boxShadow: '0 6 0 #06d6a088' },
                     } }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#118ab2' }}
      />
      <View style={{ width: 32 }} />
      {/* A one-shot entrance that holds its last frame. */}
      <View
        animation={{ duration: 700, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'forwards',
                     keyframes: [
                       { opacity: 0, transform: 'translate(0, 20px) scale(0.6)' },
                       { opacity: 1, transform: 'translate(0, 0) scale(1)' },
                     ] }}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2a2a3a' }}
      >
        <Text style={{ color: '#e8e8f0', fontSize: 13 }}>popped in</Text>
      </View>
    </View>
  );
}

function App() {
  const [on, setOn] = useState(false);
  const [auto, setAuto] = useState(true);
  // Auto-play flips the state every 2 s — each flip is one React update; the
  // animation frames in between are all native.
  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => setOn((v) => !v), 2000);
    return () => clearInterval(t);
  }, [auto]);
  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f14', padding: 24 }}>
      <Text style={{ color: '#e8e8f0', fontSize: 22, marginBottom: 4 }}>Native transitions</Text>
      <Text style={{ color: '#7a7a90', fontSize: 12, marginBottom: 16 }}>
        One state change; the runtime interpolates every frame.
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 24 }}>
        <Button label={auto ? 'Pause auto-play' : 'Auto-play'} onPress={() => setAuto((v) => !v)} />
        <View style={{ width: 8 }} />
        <Button label={on ? 'Reverse' : 'Play'} onPress={() => { setAuto(false); setOn((v) => !v); }} />
      </View>

      <Text style={{ color: '#9a9ab0', fontSize: 12, marginBottom: 8 }}>
        All properties: transform, colours, radius, shadow, opacity
      </Text>
      <View style={{ height: 150, justifyContent: 'center' }}>
        <Card on={on} />
      </View>

      <Text style={{ color: '#9a9ab0', fontSize: 12, marginTop: 16, marginBottom: 8 }}>Easing curves</Text>
      {EASINGS.map((e) => <EasingRow key={e} easing={e} on={on} />)}

      <Text style={{ color: '#9a9ab0', fontSize: 12, marginTop: 16, marginBottom: 8 }}>
        Keyframes: spinner (infinite), pulse (alternate), pop-in (once, holds)
      </Text>
      <Keyframes />
    </View>
  );
}

render(<App />);
