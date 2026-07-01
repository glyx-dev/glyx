// @glyx/three/src/math.js — column-major 4×4 matrix helpers (no external deps).
//
// Glyx's wgpu renderer consumes matrices via `Mat4::from_cols_array(&mesh.transform)`,
// which expects 16 floats in column-major order (column 0 first, then column 1, etc.).
//
// All functions return a plain 16-element JS Array in column-major order.

/** 4×4 identity matrix (column-major). */
export const IDENTITY = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

/**
 * Build a column-major TRS (Translation × Rotation × Scale) matrix.
 *
 * Rotation convention: Euler XYZ intrinsic (rotate around X first, then Y, then Z).
 *
 * @param {{
 *   position?: [x, y, z],           default [0, 0, 0]
 *   rotation?: [rx, ry, rz],        default [0, 0, 0]  (radians, Euler XYZ)
 *   scale?:    [sx, sy, sz] | number default [1, 1, 1]
 * }} opts
 * @returns {number[]}  16-element column-major matrix
 */
export function makeTransform({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const [tx, ty, tz] = position;
  const [rx, ry, rz] = rotation;
  const [sx, sy, sz] = typeof scale === 'number' ? [scale, scale, scale] : scale;

  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);

  // Combined R = Rz * Ry * Rx (row-major for readability)
  const r00 = cy * cz;
  const r01 = cy * sz_;
  const r02 = -sy_;
  const r10 = sx_ * sy_ * cz - cx * sz_;
  const r11 = sx_ * sy_ * sz_ + cx * cz;
  const r12 = sx_ * cy;
  const r20 = cx * sy_ * cz + sx_ * sz_;
  const r21 = cx * sy_ * sz_ - sx_ * cz;
  const r22 = cx * cy;

  // Column-major 4×4 with per-column scale and translation in column 3.
  // col[j][row] = R[row][j] * scale[j]
  return [
    r00 * sx, r10 * sx, r20 * sx, 0,   // col 0
    r01 * sy, r11 * sy, r21 * sy, 0,   // col 1
    r02 * sz, r12 * sz, r22 * sz, 0,   // col 2
    tx, ty, tz, 1,                      // col 3 (translation)
  ];
}

/**
 * Pure Y-axis rotation matrix (column-major).
 * @param {number} angle  Radians
 * @returns {number[]}
 */
export function makeRotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [
     c, 0, -s, 0,
     0, 1,  0, 0,
     s, 0,  c, 0,
     0, 0,  0, 1,
  ];
}

/**
 * Shorthand TRS with position, Y-rotation, and uniform scale.
 * @param {{ x?, y?, z?, angle?, scale? }} opts
 * @returns {number[]}
 */
export function makeSimpleTransform({ x = 0, y = 0, z = 0, angle = 0, scale = 1 } = {}) {
  return makeTransform({
    position: [x, y, z],
    rotation: [0, angle, 0],
    scale:    [scale, scale, scale],
  });
}

/**
 * Multiply two 4×4 column-major matrices: result = a * b.
 * @param {number[]} a  16-element column-major matrix
 * @param {number[]} b  16-element column-major matrix
 * @returns {number[]}
 */
export function mat4mul(a, b) {
  const r = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
      r[col * 4 + row] = s;
    }
  }
  return r;
}

/**
 * Degrees → radians convenience.
 * @param {number} deg
 * @returns {number}
 */
export function deg(d) { return d * (Math.PI / 180); }
