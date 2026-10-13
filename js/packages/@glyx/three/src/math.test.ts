import { test, expect } from 'bun:test';
import { IDENTITY, makeTransform, makeRotationY, makeSimpleTransform, mat4mul, deg } from './math.js';
import { Scene, Mesh, PerspectiveCamera, AmbientLight, DirectionalLight, PointLight, SpotLight, Model } from './index.js';

const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

test('deg converts degrees to radians', () => {
  expect(deg(180)).toBeCloseTo(Math.PI);
  expect(deg(90)).toBeCloseTo(Math.PI / 2);
});

test('makeRotationY(0) is the identity', () => {
  expect(close(makeRotationY(0), IDENTITY)).toBe(true);
});

test('mat4mul with identity returns the other operand', () => {
  const m = makeTransform({ position: [1, 2, 3], rotation: [0.3, 0.5, 0.7], scale: 2 });
  expect(close(mat4mul(IDENTITY, m), m)).toBe(true);
  expect(close(mat4mul(m, IDENTITY), m)).toBe(true);
});

test('makeTransform puts translation in column 3 (column-major)', () => {
  const m = makeTransform({ position: [4, 5, 6] });
  expect(m.slice(12, 15)).toEqual([4, 5, 6]);
  expect(m[15]).toBe(1);
});

test('makeTransform applies uniform scale on the diagonal', () => {
  const m = makeTransform({ scale: 3 });
  expect(m[0]).toBeCloseTo(3);
  expect(m[5]).toBeCloseTo(3);
  expect(m[10]).toBeCloseTo(3);
});

test('makeSimpleTransform matches makeTransform with Y rotation', () => {
  const a = makeSimpleTransform({ x: 1, y: 2, z: 3, angle: 0.5, scale: 2 });
  const b = makeTransform({ position: [1, 2, 3], rotation: [0, 0.5, 0], scale: 2 });
  expect(close(a, b)).toBe(true);
});

test('scene components are exported', () => {
  for (const c of [Scene, Mesh, PerspectiveCamera, AmbientLight, DirectionalLight, PointLight, SpotLight, Model]) {
    expect(typeof c).toBe('function');
  }
});
