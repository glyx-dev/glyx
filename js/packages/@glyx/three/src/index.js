// @glyx-dev/three — Declarative React-Three-Fiber-style 3D for Glyx Canvas3D.
//
// Architecture:
//   • <Scene> owns a React context that child components register into.
//   • Each render, Scene resets the accumulator, children fill it synchronously
//     (Glyx uses synchronous LegacyRoot rendering), then useLayoutEffect commits
//     the assembled scene via ctx.updateScene(scene).
//   • No custom reconciler — pure React hooks + context.
//
// Scene JSON format matches glyx-3d's Scene3D Rust struct exactly:
//   {
//     background?: [r, g, b, a],
//     camera: { position, target, up, fovDeg, near, far },
//     lights: [ { type:'ambient'|'directional', ... } ],
//     meshes: [ { geometry:{type:'box'|'sphere'|'plane'|'gltf', path?}, transform:[16f], color:[r,g,b,a] } ],
//   }
//
// Usage:
//   import { Canvas3D } from '@glyx-dev/react';
//   import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, Mesh } from '@glyx-dev/three';
//
//   function My3DScene() {
//     const c3dRef = React.useRef(null);
//     const [angle, setAngle] = React.useState(0);
//     useEffect(() => {
//       const id = setInterval(() => setAngle(a => a + 0.02), 16);
//       return () => clearInterval(id);
//     }, []);
//     return (
//       <Canvas3D ref={c3dRef} width={640} height={400} style={{ borderRadius: 8 }}>
//         <Scene canvasRef={c3dRef} background={[0.05, 0.05, 0.1, 1]}>
//           <PerspectiveCamera position={[0, 1.5, 4]} target={[0, 0, 0]} fov={55} />
//           <AmbientLight intensity={0.3} />
//           <DirectionalLight direction={[-0.5, -1, -0.5]} intensity={1.2} />
//           <Mesh geometry="box"    rotation={[0, angle, 0]} color={[0.4, 0.6, 1, 1]} />
//           <Mesh geometry="sphere" position={[2, 0, 0]}     color={[1, 0.4, 0.4, 1]} scale={0.6} />
//           <Mesh geometry="plane"  position={[0, -0.8, 0]}  scale={[4, 1, 4]}        color={[0.3, 0.3, 0.3, 1]} />
//         </Scene>
//       </Canvas3D>
//     );
//   }

import React, {
  createContext, useContext, useRef, useId, useLayoutEffect, useEffect,
} from 'react';

export {
  makeTransform, makeRotationY, makeSimpleTransform, mat4mul, deg,
} from './math.js';
import { mat4mul as _mat4mul, IDENTITY as _IDENTITY } from './math.js';

// ── Scene context ──────────────────────────────────────────────────────────────

const SceneCtx = createContext(null);

// Ancestor world transform for whatever <Group> nesting a Mesh/Model sits
// inside. Defaults to identity for scenes with no <Group> at all — existing
// flat scenes are unaffected.
const GroupCtx = createContext(_IDENTITY);

// ── Scene ─────────────────────────────────────────────────────────────────────

/**
 * Root scene component. Wraps a <Canvas3D ref> and drives its 3D content
 * declaratively.  Must be a direct child of the <Canvas3D> node.
 *
 * @param {{
 *   canvasRef:   React.RefObject,  ref from <Canvas3D ref={...}>
 *   background?: [r,g,b,a],       clear color, default = transparent
 *   children:    React.ReactNode,
 * }} props
 */
export function Scene({ canvasRef, background, children }) {
  // Stable registry Map: child-id → { type, data }.
  // Children register/update themselves via useLayoutEffect (bottom-up), so by
  // the time Scene's own useLayoutEffect runs, every child has already written
  // its latest data.  This avoids the render-phase mutation that broke memoized
  // children (they never re-rendered → never re-filled the old accumulator).
  const registryRef = useRef(new Map());

  // Stable context value — identity never changes between renders so memoized
  // children are not forced to re-render just because Scene re-rendered.
  const ctxRef = useRef(null);
  if (!ctxRef.current) {
    ctxRef.current = {
      register:   (key, type, data) => { registryRef.current.set(key, { type, data }); },
      unregister: (key) => { registryRef.current.delete(key); },
      canvasRef:  null,
    };
  }
  // Keep canvasRef current so Model can call loadGltf.
  ctxRef.current.canvasRef = canvasRef;

  // Runs after every render, AFTER all children's useLayoutEffect have fired
  // (React calls effects bottom-up: deepest children first, then parents).
  useLayoutEffect(() => {
    const ctx3d = canvasRef?.current;
    if (!ctx3d) return;

    let camera = null;
    const lights = [];
    const meshes = [];

    for (const { type, data } of registryRef.current.values()) {
      if      (type === 'camera') camera = data;
      else if (type === 'light')  lights.push(data);
      else if (type === 'mesh')   meshes.push(data);
    }

    const scene = {
      camera: camera ?? {
        position: [0, 1, 5],
        target:   [0, 0, 0],
        up:       [0, 1, 0],
        fovDeg:   60,
        near:     0.1,
        far:      1000,
      },
      lights,
      meshes,
    };

    if (background != null) scene.background = background;
    ctx3d.updateScene(scene);
  });  // no dep array — deliberate; runs after every render

  return React.createElement(
    SceneCtx.Provider,
    { value: ctxRef.current },
    children,
  );
}

// ── Internal: register via useLayoutEffect ────────────────────────────────────

function useRegister(type, data) {
  const ctx = useContext(SceneCtx);
  if (!ctx) throw new Error(`@glyx-dev/three: must be a descendant of <Scene>`);
  // Stable per-instance key so the registry entry survives prop changes.
  const id = useId();
  useLayoutEffect(() => {
    ctx.register(id, type, data);
    return () => ctx.unregister(id);
  }); // no dep array — re-register on every render so data stays fresh
}

// ── Camera ────────────────────────────────────────────────────────────────────

/**
 * Perspective camera. Only one per Scene is effective (last wins).
 *
 * @param {{
 *   position?: [x,y,z],  default [0,1,5]
 *   target?:   [x,y,z],  default [0,0,0]
 *   up?:       [x,y,z],  default [0,1,0]
 *   fov?:      number,   degrees, default 60
 *   near?:     number,   default 0.1
 *   far?:      number,   default 1000
 * }} props
 */
export function PerspectiveCamera({
  position = [0, 1, 5],
  target   = [0, 0, 0],
  up       = [0, 1, 0],
  fov      = 60,
  near     = 0.1,
  far      = 1000,
}) {
  useRegister('camera', { position, target, up, fovDeg: fov, near, far });
  return null;
}

// ── Lights ────────────────────────────────────────────────────────────────────

/**
 * Ambient (omnidirectional) light. Only one per Scene is effective.
 * @param {{ color?: [r,g,b], intensity?: number }} props
 */
export function AmbientLight({ color = [1, 1, 1], intensity = 0.3 }) {
  useRegister('light', { type: 'ambient', color, intensity });
  return null;
}

/**
 * Directional light. Only one per Scene is effective.
 * @param {{ direction?: [x,y,z], color?: [r,g,b], intensity?: number }} props
 */
export function DirectionalLight({
  direction = [-0.5, -1.0, -0.5],
  color     = [1, 1, 1],
  intensity = 1.0,
}) {
  useRegister('light', { type: 'directional', direction, color, intensity });
  return null;
}

/**
 * Point (omnidirectional) light. Up to 8 dynamic lights per scene.
 * @param {{ position?: [x,y,z], color?: [r,g,b], intensity?: number,
 *           range?: number }} props  range 0 = no distance falloff
 */
export function PointLight({
  position  = [0, 2, 0],
  color     = [1, 1, 1],
  intensity = 1.0,
  range     = 0,
}) {
  useRegister('light', { type: 'point', position, color, intensity, range });
  return null;
}

/**
 * Spot (cone) light. `innerDeg`/`outerDeg` are cone half-angles in degrees.
 * @param {{ position?: [x,y,z], direction?: [x,y,z], color?: [r,g,b],
 *           intensity?: number, range?: number, innerDeg?: number, outerDeg?: number }} props
 */
export function SpotLight({
  position  = [0, 3, 0],
  direction = [0, -1, 0],
  color     = [1, 1, 1],
  intensity = 1.0,
  range     = 0,
  innerDeg  = 15,
  outerDeg  = 25,
}) {
  useRegister('light', { type: 'spot', position, direction, color, intensity, range, innerDeg, outerDeg });
  return null;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

const IDENTITY_MAT = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function buildTransform(position, rotation, scale) {
  if (!position && !rotation && scale == null) return IDENTITY_MAT;

  const [tx = 0, ty = 0, tz = 0] = position ?? [0, 0, 0];
  const [rx = 0, ry = 0, rz = 0] = rotation ?? [0, 0, 0];
  const [sx = 1, sy = 1, sz = 1] = typeof scale === 'number'
    ? [scale, scale, scale]
    : (scale ?? [1, 1, 1]);

  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);

  const r00 = cy * cz;
  const r01 = cy * sz_;
  const r02 = -sy_;
  const r10 = sx_ * sy_ * cz - cx * sz_;
  const r11 = sx_ * sy_ * sz_ + cx * cz;
  const r12 = sx_ * cy;
  const r20 = cx * sy_ * cz + sx_ * sz_;
  const r21 = cx * sy_ * sz_ - sx_ * cz;
  const r22 = cx * cy;

  return [
    r00 * sx, r10 * sx, r20 * sx, 0,
    r01 * sy, r11 * sy, r21 * sy, 0,
    r02 * sz, r12 * sz, r22 * sz, 0,
    tx, ty, tz, 1,
  ];
}

// ── Group ─────────────────────────────────────────────────────────────────────

/**
 * Groups nested `<Mesh>`/`<Model>`/`<Group>` children under a shared parent
 * transform. Purely a JS-side authoring convenience — the renderer never
 * sees groups, only the final composed world matrix per mesh (same as an
 * ungrouped scene), so this adds zero runtime cost on the Rust side.
 *
 * @param {{
 *   position?:  [x, y, z],
 *   rotation?:  [rx, ry, rz],           radians Euler XYZ
 *   scale?:     [sx, sy, sz] | number,
 *   transform?: number[],               raw 16-float column-major (overrides pos/rot/scale)
 *   children:   React.ReactNode,
 * }} props
 */
export function Group({ position, rotation, scale, transform, children }) {
  const parentTransform = useContext(GroupCtx);
  const localTransform = transform ?? buildTransform(position, rotation, scale);
  const worldTransform = _mat4mul(parentTransform, localTransform);
  return React.createElement(GroupCtx.Provider, { value: worldTransform }, children);
}

// ── Mesh ──────────────────────────────────────────────────────────────────────

/**
 * A 3D mesh rendered by the Phong pipeline.
 * Primitives (box/sphere/plane) are unit-sized; use `scale` to resize.
 *
 * @param {{
 *   geometry:   'box' | 'sphere' | 'plane',
 *   color?:     [r, g, b, a],           default [1,1,1,1]
 *   position?:  [x, y, z],              default [0,0,0]
 *   rotation?:  [rx, ry, rz],           radians Euler XYZ, default [0,0,0]
 *   scale?:     [sx, sy, sz] | number,  default [1,1,1]
 *   transform?: number[],               raw 16-float column-major (overrides pos/rot/scale)
 * }} props
 */
export function Mesh({
  geometry  = 'box',
  color     = [1, 1, 1, 1],
  position,
  rotation,
  scale,
  transform,
}) {
  const parentTransform = useContext(GroupCtx);
  const localTransform = transform ?? buildTransform(position, rotation, scale);
  const finalTransform = _mat4mul(parentTransform, localTransform);
  useRegister('mesh', {
    geometry:  { type: geometry.toLowerCase() },
    transform: finalTransform,
    color,
  });
  return null;
}

// ── Model (GLTF) ──────────────────────────────────────────────────────────────

/**
 * A GLTF/GLB model. Preloads via `loadGltf` on mount, then renders each frame.
 * First frame before load completes renders as a box (Rust fallback).
 *
 * @param {{
 *   src:        string,              absolute path or URL to .glb/.gltf file
 *   color?:     [r, g, b, a],       default [1,1,1,1]
 *   position?:  [x, y, z],
 *   rotation?:  [rx, ry, rz],
 *   scale?:     [sx, sy, sz] | number,
 *   transform?: number[],
 * }} props
 */
export function Model({
  src,
  color     = [1, 1, 1, 1],
  position,
  rotation,
  scale,
  transform,
}) {
  const ctx = useContext(SceneCtx);
  if (!ctx) throw new Error('@glyx-dev/three: <Model> must be a descendant of <Scene>');

  // Preload GLTF once per src change.
  useEffect(() => {
    const ctx3d = ctx.canvasRef?.current;
    if (ctx3d && src) ctx3d.loadGltf(src);
  }, [src, ctx]);

  const parentTransform = useContext(GroupCtx);
  const localTransform = transform ?? buildTransform(position, rotation, scale);
  const finalTransform = _mat4mul(parentTransform, localTransform);
  useRegister('mesh', {
    geometry:  { type: 'gltf', path: src },
    transform: finalTransform,
    color,
  });
  return null;
}
