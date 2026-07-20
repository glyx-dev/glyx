import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, render, useWindowSize, Canvas3D,
} from '@glyx-dev/react';
import {
  ThemeProvider, Button, Tabs, SwitchRow, NumberInput, Chip, useTheme,
} from '@glyx-dev/design';
import { Icon } from '@glyx-dev/icons';
import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, PointLight, Mesh } from '@glyx-dev/three';

const COLORS = [
  { name: 'Blue', rgba: [0.4, 0.6, 1, 1] },
  { name: 'Red', rgba: [1, 0.4, 0.4, 1] },
  { name: 'Green', rgba: [0.4, 1, 0.6, 1] },
];

function Viewer() {
  const C = useTheme();
  const ref = useRef(null);
  const [geom, setGeom] = useState('box');
  const [angle, setAngle] = useState(0);
  const [auto, setAuto] = useState(true);
  const [ambient, setAmbient] = useState(0.4);
  const [dir, setDir] = useState(1.1);
  const [point, setPoint] = useState(0.0);
  const [color, setColor] = useState(COLORS[0].rgba);
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setAngle((a) => a + 0.02), 16);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      <Canvas3D ref={ref} style={{ flex: 1, backgroundColor: '#0b0d12' }}>
        <Scene canvasRef={ref} background={[0.04, 0.05, 0.07, 1]}>
          <PerspectiveCamera position={[0, 1.5, 4.5]} target={[0, 0, 0]} fov={55} />
          <AmbientLight intensity={ambient} />
          <DirectionalLight direction={[-0.5, -1, -0.5]} intensity={dir} />
          {point > 0 ? <PointLight position={[2, 2, 2]} intensity={point} /> : null}
          <Mesh geometry={geom} color={color} rotation={[0, angle, 0]} scale={1} />
        </Scene>
      </Canvas3D>

      <View style={{ width: 264, padding: 16, gap: 16, backgroundColor: C.surface, borderLeftWidth: 1, borderLeftColor: C.border }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>Controls</Text>

        <View>
          <Text style={{ color: C.textMuted, marginBottom: 4 }}>Geometry</Text>
          <Tabs items={[{ key: 'box', label: 'Box' }, { key: 'sphere', label: 'Sphere' }, { key: 'plane', label: 'Plane' }]} value={geom} onChange={setGeom} />
        </View>

        <SwitchRow label="Auto-rotate" value={auto} onValueChange={setAuto} />

        <View>
          <Text style={{ color: C.textMuted, marginBottom: 4 }}>Ambient light · {ambient.toFixed(2)}</Text>
          <NumberInput label="" value={ambient} min={0} max={3} step={0.1} onChange={(v) => setAmbient(Math.max(0, Math.min(3, v)))} />
        </View>

        <View>
          <Text style={{ color: C.textMuted, marginBottom: 4 }}>Directional light · {dir.toFixed(2)}</Text>
          <NumberInput label="" value={dir} min={0} max={3} step={0.1} onChange={(v) => setDir(Math.max(0, Math.min(3, v)))} />
        </View>

        <View>
          <Text style={{ color: C.textMuted, marginBottom: 4 }}>Point light · {point.toFixed(2)}</Text>
          <NumberInput label="" value={point} min={0} max={3} step={0.1} onChange={(v) => setPoint(Math.max(0, Math.min(3, v)))} />
        </View>

        <View>
          <Text style={{ color: C.textMuted, marginBottom: 4 }}>Color</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {COLORS.map((c) => (
              <Chip key={c.name} label={c.name} selected={JSON.stringify(c.rgba) === JSON.stringify(color)} onPress={() => setColor(c.rgba)} />
            ))}
          </View>
        </View>

        <Button label="Reset view" variant="secondary" onPress={() => { setAngle(0); setGeom('box'); setAmbient(0.4); setDir(1.1); setPoint(0); setColor(COLORS[0].rgba); }} />
      </View>
    </View>
  );
}

function Root() {
  return (
    <ThemeProvider colorScheme="system">
      <Viewer />
    </ThemeProvider>
  );
}

render(<Root />);
