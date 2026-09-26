// Core helpers shared by the engine and the page.
// Frame: x forward (nose is +x), y up, z to starboard. Units: metres, kilograms, kilonewtons.
// Aircraft data is authored with s = distance aft of the nose; x = len/2 - s puts the origin mid-length.

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Materials: albedo, specular strength, shininess, emissive flag.
// 'skin' is replaced per aircraft by its paint colour.
const MATS = {
  skin:    { c: [0.62, 0.66, 0.70], sp: 0.35, sh: 18 },
  skin2:   { c: [0.45, 0.50, 0.55], sp: 0.30, sh: 18 },   // second camouflage tone / panels
  dark:    { c: [0.20, 0.22, 0.25], sp: 0.20, sh: 10 },   // radomes, intake lips, walkways
  glass:   { c: [0.55, 0.78, 0.95], sp: 1.30, sh: 40 },
  gold:    { c: [0.85, 0.68, 0.35], sp: 1.30, sh: 40 },   // gold-tinted canopy (F-22, F-35)
  metal:   { c: [0.55, 0.52, 0.50], sp: 0.90, sh: 28 },   // bare metal nozzles
  hole:    { c: [0.05, 0.05, 0.06], sp: 0.00, sh: 1 },    // intake and nozzle openings
  burner:  { c: [0.10, 0.06, 0.04], sp: 0.00, sh: 1, glow: 1 }, // nozzle interior, glows with throttle
  white:   { c: [0.86, 0.87, 0.88], sp: 0.45, sh: 20 },   // most missiles
  olive:   { c: [0.44, 0.47, 0.33], sp: 0.20, sh: 12 },   // US bombs
  sand:    { c: [0.70, 0.64, 0.50], sp: 0.20, sh: 12 },
  tank:    { c: [0.68, 0.70, 0.71], sp: 0.40, sh: 18 },
  band:    { c: [0.90, 0.72, 0.20], sp: 0.30, sh: 12 },   // yellow HE band
  seeker:  { c: [0.30, 0.34, 0.40], sp: 1.00, sh: 30 },
  prop:    { c: [0.30, 0.30, 0.32], sp: 0.40, sh: 16 },
  door:    { c: [0.50, 0.54, 0.58], sp: 0.25, sh: 14 },   // open bay doors (skin tone set per aircraft)
  bay:     { c: [0.18, 0.19, 0.20], sp: 0.10, sh: 8 },
};
const MAT_KEYS = Object.keys(MATS);
const MAT_ID = Object.fromEntries(MAT_KEYS.map((k, i) => [k, i]));

const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// Mesh builder: vertices, triangles, per-triangle material and tag (0 airframe, k+1 store station k).
class Mesh {
  constructor() { this.v = []; this.t = []; this.m = []; this.g = []; }
  vert(x, y, z) { this.v.push(x, y, z); return this.v.length / 3 - 1; }
  tri(a, b, c, mat, tag = 0) { this.t.push(a, b, c); this.m.push(MAT_ID[mat] ?? 0); this.g.push(tag); }
  quad(a, b, c, d, mat, tag) { this.tri(a, b, c, mat, tag); this.tri(a, c, d, mat, tag); }
  append(o) {
    const base = this.v.length / 3;
    for (const x of o.v) this.v.push(x);
    for (const i of o.t) this.t.push(i + base);
    for (const x of o.m) this.m.push(x);
    for (const x of o.g) this.g.push(x);
  }
  // Freeze into typed arrays and compute smooth vertex normals.
  finish() {
    const V = new Float32Array(this.v), T = new Uint32Array(this.t), N = new Float32Array(V.length);
    for (let i = 0; i < T.length; i += 3) {
      const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      // Consistent orientation is not guaranteed across parts, so accumulate unsigned
      // against the running normal to keep smooth shading on shared vertices.
      for (const k of [a, b, c]) {
        const s = (N[k] * nx + N[k + 1] * ny + N[k + 2] * nz) < 0 ? -1 : 1;
        N[k] += s * nx; N[k + 1] += s * ny; N[k + 2] += s * nz;
      }
    }
    for (let i = 0; i < N.length; i += 3) {
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
      N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
    }
    return { V, N, T, M: new Uint8Array(this.m), G: new Uint16Array(this.g), nv: V.length / 3, nt: T.length / 3 };
  }
}
