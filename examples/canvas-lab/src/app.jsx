// The 2D canvas, end to end: transforms and save/restore, global alpha and blend modes, line caps / joins /
// dashes, shadows, linear / radial / conic gradients (fills and strokes), shapes with holes, images, round
// rectangles and arcs; a freehand drawing area that follows the pointer's whole path (coalesced points, pointer
// capture); PNG export, toBlob and getImageData; rotated text and path clips.
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Canvas, render } from '@glyx-dev/react';

const W = 640, H = 640, CELL_W = W / 4, CELL_H = H / 4;

function label(ctx, text, col, row) {
  ctx.save();
  ctx.fillStyle = '#8a8aa8';
  ctx.fillText(text, col * CELL_W + 8, row * CELL_H + 6, 11);
  ctx.restore();
}

/** Every cell draws inside its own clip, so nothing spills into its neighbour. */
function cell(ctx, col, row, name, draw) {
  ctx.save();
  ctx.pushClip(col * CELL_W, row * CELL_H, CELL_W, CELL_H);
  ctx.translate(col * CELL_W, row * CELL_H);
  draw(ctx);
  ctx.popClip();
  ctx.restore();
  label(ctx, name, col, row);
}

function drawLab(ctx, logo) {
  ctx.clear();

  cell(ctx, 0, 0, 'transforms', (c) => {
    for (let i = 0; i < 8; i++) {
      c.save();
      c.translate(80, 95);
      c.rotate((i * Math.PI) / 8);
      c.fillStyle = `rgba(${60 + i * 24}, ${200 - i * 18}, 255, 0.8)`;
      c.fillRect(-46, -8, 92, 16);
      c.restore();
    }
    c.fillStyle = '#ffffff'; c.fillCircle(80, 95, 5);
  });

  cell(ctx, 1, 0, 'alpha + blend', (c) => {
    c.globalAlpha = 0.65;
    c.fillStyle = '#ff4060'; c.fillCircle(55, 80, 34);
    c.fillStyle = '#40ff90'; c.fillCircle(92, 80, 34);
    c.fillStyle = '#4080ff'; c.fillCircle(74, 112, 34);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = '#ffd040'; c.fillRect(30, 134, 100, 18);
    c.fillStyle = '#40d0ff'; c.fillRect(60, 130, 40, 26);
    c.globalCompositeOperation = 'source-over';
  });

  cell(ctx, 2, 0, 'caps, joins, dashes', (c) => {
    c.strokeStyle = '#ffd866'; c.lineWidth = 12;
    ['butt', 'round', 'square'].forEach((cap, i) => {
      c.lineCap = cap;
      c.beginPath(); c.moveTo(30, 40 + i * 24); c.lineTo(130, 40 + i * 24); c.stroke();
    });
    c.lineWidth = 8; c.strokeStyle = '#78dce8';
    ['miter', 'bevel', 'round'].forEach((join, i) => {
      c.lineJoin = join; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(24 + i * 44, 140); c.lineTo(40 + i * 44, 112); c.lineTo(56 + i * 44, 140); c.stroke();
    });
    c.lineCap = 'butt'; c.lineJoin = 'round';
    c.setLineDash([6, 5]); c.lineWidth = 2; c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(20, 154); c.lineTo(140, 154); c.stroke();
    c.setLineDash([]);
  });

  cell(ctx, 3, 0, 'shadows', (c) => {
    c.shadowColor = '#000000d0'; c.shadowBlur = 12; c.shadowOffsetX = 5; c.shadowOffsetY = 6;
    c.fillStyle = '#a678ff'; c.roundRect(24, 30, 90, 60, 12); c.fill();
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    c.shadowColor = '#ffffff60'; c.shadowOffsetX = 2; c.shadowOffsetY = 2;
    c.fillStyle = '#ffd866'; c.fillText('Shadow', 24, 112, 22);
  });

  cell(ctx, 0, 1, 'linear + radial', (c) => {
    const lin = c.createLinearGradient(20, 0, 140, 0);
    lin.addColorStop(0, '#ff5f6d'); lin.addColorStop(1, '#ffc371');
    c.fillStyle = lin; c.fillRect(20, 24, 120, 40);
    const rad = c.createRadialGradient(80, 118, 4, 80, 118, 40);
    rad.addColorStop(0, '#ffffff'); rad.addColorStop(0.5, '#5ec8ff'); rad.addColorStop(1, '#10204000');
    c.fillStyle = rad; c.fillCircle(80, 118, 40);
  });

  cell(ctx, 1, 1, 'conic + gradient stroke', (c) => {
    const con = c.createConicGradient(0, 55, 80);
    con.addColorStop(0, '#ff0000'); con.addColorStop(0.33, '#00ff00'); con.addColorStop(0.66, '#0000ff'); con.addColorStop(1, '#ff0000');
    c.fillStyle = con; c.fillCircle(55, 80, 38);
    const lin = c.createLinearGradient(90, 40, 150, 120);
    lin.addColorStop(0, '#ff8a00'); lin.addColorStop(1, '#00e5ff');
    c.strokeStyle = lin; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(96, 44); c.lineTo(140, 80); c.lineTo(96, 118); c.stroke();
  });

  cell(ctx, 2, 1, 'holes (even-odd)', (c) => {
    c.fillStyle = '#7bd88f';
    c.beginPath();
    c.arc(80, 80, 52, 0, Math.PI * 2); c.moveTo(110, 80);
    c.arc(80, 80, 30, 0, Math.PI * 2);
    c.fill('evenodd');
    c.fillStyle = '#ffffff';
    c.beginPath(); c.rect(70, 70, 20, 20); c.fill();
  });

  cell(ctx, 3, 1, 'images', (c) => {
    if (!logo) { c.fillStyle = '#555'; c.fillText('loading…', 40, 70, 12); return; }
    c.drawImage(logo, 14, 30, 54, 54);
    c.globalAlpha = 0.4; c.drawImage(logo, 76, 30, 54, 54); c.globalAlpha = 1;
    c.drawImage(logo, 0, 0, 50, 50, 14, 96, 64, 64);      // part of the image, scaled up
    c.save(); c.translate(105, 125); c.rotate(0.5); c.drawImage(logo, -24, -24, 48, 48); c.restore();
  });

  cell(ctx, 0, 2, 'paths', (c) => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.roundRect(14, 26, 80, 50, 14); c.stroke();
    c.beginPath(); c.ellipse(110, 100, 34, 18, 0.4, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ff9ac1';
    c.beginPath(); c.moveTo(16, 150); c.arcTo(80, 150, 80, 100, 30); c.lineTo(80, 100); c.stroke();
  });

  cell(ctx, 1, 2, 'eraser', (c) => {
    c.fillStyle = '#ff6188'; c.fillRect(20, 30, 120, 100);
    c.globalCompositeOperation = 'destination-out';
    c.fillCircle(80, 80, 28);
    c.fillRect(20, 76, 120, 8);
    c.globalCompositeOperation = 'source-over';
  });

  cell(ctx, 2, 2, 'text', (c) => {
    c.fillStyle = '#e8e8f0'; c.fillText('Canvas', 16, 30, 26);
    c.save(); c.translate(16, 80); c.scale(1.6, 1.6); c.fillStyle = '#78dce8'; c.fillText('scaled', 0, 0, 16); c.restore();
    c.fillStyle = '#ffd866'; c.fontWeight = 'bold'; c.fillText('bold', 16, 128, 18); c.fontWeight = 'normal';
  });

  cell(ctx, 3, 2, 'nested clips', (c) => {
    c.save();
    c.pushClip(20, 30, 110, 110);
    c.fillStyle = '#3a3a5a'; c.fillRect(0, 0, 160, 160);
    c.pushClip(50, 60, 90, 90);
    c.fillStyle = '#ffd866'; c.fillCircle(90, 100, 70);
    c.popClip();
    c.fillStyle = '#ff6188'; c.fillCircle(30, 40, 22);
    c.popClip();
    c.restore();
  });

  cell(ctx, 0, 3, 'rotated text', (c) => {
    c.fillStyle = '#e8e8f0';
    c.save(); c.translate(26, 150); c.rotate(-Math.PI / 2); c.fillText('y axis label', 0, 0, 13); c.restore();
    c.save(); c.translate(48, 56); c.rotate(0.45); c.fillStyle = '#ffd866'; c.fillText('Rotated 26°', 0, 0, 18); c.restore();
    c.save(); c.translate(150, 18); c.rotate(Math.PI / 2);
    c.shadowColor = '#000000a0'; c.shadowOffsetX = 2; c.shadowOffsetY = 2;
    c.fillStyle = '#78dce8'; c.fillText('down', 0, 0, 16); c.restore();
  });

  cell(ctx, 1, 3, 'path clips', (c) => {
    c.save();
    c.beginPath(); c.arc(54, 78, 38, 0, Math.PI * 2); c.clip();
    const g = c.createLinearGradient(16, 0, 92, 0);
    g.addColorStop(0, '#ff5f6d'); g.addColorStop(1, '#5ec8ff');
    c.fillStyle = g; c.fillRect(0, 0, 160, 160);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.lineCap = 'butt';
    for (let i = -3; i < 8; i++) { c.beginPath(); c.moveTo(i * 14, 36); c.lineTo(40 + i * 14, 120); c.stroke(); }
    c.restore();
    c.save();
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 14 : 34, a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 118 + Math.cos(a) * r, y = 80 + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
    c.moveTo(126, 80); c.arc(118, 80, 8, 0, Math.PI * 2);
    c.clip('evenodd');
    c.fillStyle = '#7bd88f'; c.fillRect(70, 30, 90, 100);
    c.fillStyle = '#ffd866'; c.fillRect(70, 80, 90, 8);
    c.restore();
  });

  cell(ctx, 2, 3, 'pixels', (c) => {
    const rad = c.createRadialGradient(80, 80, 0, 80, 80, 46);
    rad.addColorStop(0, '#ff3366'); rad.addColorStop(1, '#3366ff');
    c.fillStyle = rad; c.fillRect(34, 34, 92, 92);
    c.fillStyle = '#8a8aa8'; c.fillText('use "Read pixel"', 22, 134, 11);
  });

  ctx.flush();
}

function hex(bytes, n) {
  return Array.from(bytes.slice(0, n)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

function App() {
  const labRef = useRef(null);
  const penRef = useRef(null);
  const strokes = useRef([]);
  const logoRef = useRef(null);
  const [info, setInfo] = useState('');
  const [pointer, setPointer] = useState('draw with the mouse');

  const redrawLab = useCallback(() => { if (labRef.current) drawLab(labRef.current, logoRef.current); }, []);
  const redrawPen = useCallback(() => {
    const ctx = penRef.current;
    if (!ctx) return;
    ctx.clear();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffd866';
    for (const s of strokes.current) {
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.length === 1) ctx.fillCircle(s[0].x, s[0].y, 1.5); else ctx.stroke();
    }
    ctx.flush();
  }, []);

  useEffect(() => {
    // The image loads in the background; draw again when it is probably ready.
    if (labRef.current && !logoRef.current) logoRef.current = labRef.current.loadImage('public/glyx-mark.svg', 96, 96);
    // Handy for scripts and the DevTools console: `__canvasLab.lab.toDataURL()`.
    globalThis.__canvasLab = { lab: labRef.current, pen: penRef.current };
    redrawLab();
    redrawPen();
    const t = setTimeout(redrawLab, 400);
    return () => clearTimeout(t);
  }, []);

  const penDown = (e) => {
    strokes.current.push([{ x: e.locationX, y: e.locationY }]);
    redrawPen();
  };
  const penMove = (e) => {
    if (!(e.buttons & 1) || !strokes.current.length) { setPointer(`over ${Math.round(e.locationX)}, ${Math.round(e.locationY)}`); return; }
    const pts = e.points || [e];
    const cur = strokes.current[strokes.current.length - 1];
    for (const p of pts) cur.push({ x: p.locationX, y: p.locationY });
    setPointer(`drawing: ${pts.length} point${pts.length === 1 ? '' : 's'} this frame (${cur.length} in the stroke), pressure ${e.pressure}`);
    redrawPen();
  };
  const penUp = (e) => setPointer(`released at ${Math.round(e.locationX)}, ${Math.round(e.locationY)} (the pointer was captured)`);

  // getImageData: the pixel under the middle of the radial gradient in the 'pixels' cell.
  const readPixel = () => {
    labRef.current.getImageData(2 * CELL_W + 80, 3 * CELL_H + 80, 1, 1).then(
      (img) => setInfo(`pixel at the centre: rgba(${Array.from(img.data).join(', ')})`),
      (err) => setInfo(`read failed: ${err.message}`),
    );
  };
  const blobLab = () => {
    labRef.current.toBlob().then(
      (b) => setInfo(`toBlob: ${b.type}, ${b.size} bytes`),
      (err) => setInfo(`toBlob failed: ${err.message}`),
    );
  };

  const exportLab = (which) => {
    const ctx = which === 'lab' ? labRef.current : penRef.current;
    ctx.toPNG({ scale: 2 }).then(
      (b) => setInfo(`${which}: PNG ${b.length} bytes, starts ${hex(b, 8)}`),
      (err) => setInfo(`${which}: export failed: ${err.message}`),
    );
  };

  const button = (text, onPress) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#2a2a40' }}>
      <Text fontSize={13} style={{ color: '#e8e8f0' }}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#12121a', padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Canvas ref={labRef} style={{ width: W, height: H, backgroundColor: '#1c1c2a', borderRadius: 8 }} />
        <View style={{ gap: 10 }}>
          <Text fontSize={13} style={{ color: '#8a8aa8' }}>Freehand: the whole path of each stroke, captured</Text>
          <Pressable
            onPointerDown={penDown} onPointerMove={penMove} onPointerUp={penUp}
            style={{ width: 420, height: 300, borderRadius: 8, backgroundColor: '#1c1c2a' }}
          >
            <Canvas ref={penRef} style={{ width: 420, height: 300 }} />
          </Pressable>
          <Text fontSize={12} style={{ color: '#a0a0b8' }}>{pointer}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {button('Clear', () => { strokes.current = []; redrawPen(); })}
            {button('Export lab (PNG)', () => exportLab('lab'))}
            {button('Export drawing (PNG)', () => exportLab('pen'))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {button('Read pixel', readPixel)}
            {button('toBlob', blobLab)}
          </View>
          <Text fontSize={12} style={{ color: '#a0a0b8' }}>{info}</Text>
        </View>
      </View>
    </View>
  );
}

render(<App />);
