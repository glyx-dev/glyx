# @glyx-dev/three

Declarative React-Three-Fiber-style 3D API for Glyx Canvas3D.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/three
# or npm install @glyx-dev/three
```

## Usage

```jsx
import { Canvas3D } from '@glyx-dev/react';
import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, Mesh } from '@glyx-dev/three';

function My3DScene() {
  const c3dRef = React.useRef(null);
  const [angle, setAngle] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setAngle((a) => a + 0.02), 16);
    return () => clearInterval(id);
  }, []);

  return (
    <Canvas3D ref={c3dRef} width={640} height={400} style={{ borderRadius: 8 }}>
      <Scene canvasRef={c3dRef}>
        <PerspectiveCamera position={[0, 2, 5]} target={[0, 0, 0]} />
        <AmbientLight intensity={0.3} />
        <DirectionalLight />
        <Mesh geometry={{ type: 'box' }} transform={/* ... */ null} color={[1, 0, 0, 1]} />
      </Scene>
    </Canvas3D>
  );
}
```

Architecture: `<Scene>` owns a React context that child components register into. On each render, `Scene` resets an internal accumulator, children fill it synchronously (Glyx uses synchronous `LegacyRoot` rendering), then a `useLayoutEffect` commits the assembled scene to the native `Canvas3D` via `ctx.updateScene(scene)`. There's no custom reconciler — it's plain React hooks + context, producing a JSON scene description matching glyx-3d's Rust `Scene3D` struct exactly.

## API

- `Scene({ canvasRef, background, children })` — root 3D scene container; commits the accumulated scene to the given `Canvas3D` ref.
- `PerspectiveCamera({ position, target, up, fovDeg, near, far })` — sets the scene's camera.
- `AmbientLight({ color, intensity })` — adds an ambient light.
- `DirectionalLight({ ... })` — adds a directional light.
- `PointLight({ ... })` — adds a point light.
- `SpotLight({ ... })` — adds a spot light.
- `Group({ position, rotation, scale, transform, children })` — groups child meshes under one composed transform.
- `Mesh({ geometry, transform, color, ... })` — a single mesh (`geometry.type`: `'box' | 'sphere' | 'plane' | 'gltf'`).
- `Model({ ... })` — loads a GLTF model as a mesh, including animation clips.
