// Afterburner plumes and propeller discs, splatted into the sample buffer as emission.

function splat(R, cam, x, y, z, rad, er, eg, eb, lum) {
  const { eye, f, r, u, foc, cx, cy } = cam;
  const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
  const vz = dx * f[0] + dy * f[1] + dz * f[2];
  if (vz < 0.3) return;
  const iz = foc / vz, sx = cx + (dx * r[0] + dy * r[1] + dz * r[2]) * iz, sy = cy - (dx * u[0] + dy * u[1] + dz * u[2]) * iz;
  const s = clamp(Math.round(rad * iz), 1, 3), h = s >> 1;
  const x0 = Math.floor(sx) - h, y0 = Math.floor(sy) - h, W = R.W, H = R.H, Z = R.z;
  for (let j = 0; j < s; j++) {
    const yy = y0 + j; if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < s; i++) {
      const xx = x0 + i; if (xx < 0 || xx >= W) continue;
      const k = yy * W + xx;
      if (vz > Z[k] + 0.15) continue;
      if (lum) { if (Z[k] === Infinity || vz < Z[k]) { Z[k] = vz; R.lum[k] = lum; R.spec[k] = 0; R.cr[k] = er; R.cg[k] = eg; R.cb[k] = eb; R.tag[k] = 0; } }
      else { R.er[k] += er; R.eg[k] += eg; R.eb[k] += eb; }
    }
  }
}

// Afterburner length as the reheat zones light in turn (F100 and F110 light five zones in sequence).
function abStage(ac, u) {
  const z = ac.eng.zones;
  if (!z || u <= 0) return u;
  const q = u * z, k = Math.floor(q);
  return Math.min(1, (k + smooth(0, 0.35, q - k)) / z);
}

// One plume per exhaust, shaped by the engine's profile (see 38-fx.js). Length, brightness and shock
// diamonds grow with the afterburner setting; some engines trail smoke at dry power.
function plume(R, cam, o) {
  const ac = R.ac, thr = o.throttle, t = o.time, ab = !!ac.eng.wet, mil = ab ? MIL : 1;
  const F = fxFor(ac).flame, ex = R.scene.exhausts, lights = [];
  o.floorLights = lights;
  const budget = 7000 / Math.max(2, ex.length);
  ex.forEach((e, ei) => {
    const rad = e.r, sy = e.flat ? e.h / rad : 1, sz = e.flat ? e.w / rad : 1;
    const seed = ei * 1013;
    if (thr <= mil) {
      const u = thr / mil;
      // dry: a faint heat shimmer that grows with power
      if (u >= 0.35) {
        const n = Math.floor(260 * u), Lp = rad * (3 + 4 * u), I = 0.05 * (u - 0.3);
        for (let i = 0; i < n; i++) {
          const h1 = hash(seed + i), h2 = hash(seed + i * 1.37 + 7), h3 = hash(seed + i * 2.11 + 3);
          const ph = (h1 + t * 1.6) % 1, d = ph * Lp, rr = rad * (0.9 + 0.5 * ph) * Math.sqrt(h2), a = h3 * 6.2832;
          const w = I * (1 - ph);
          splat(R, cam, e.x - d, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.08, w * 1.0, w * 0.55, w * 0.4);
        }
      }
      if (F.smoke && u > 0.2) smokeTrail(R, cam, e, F.smoke * smooth(0.2, 0.8, u), t, seed);
      return;
    }
    const u = abStage(ac, (thr - mil) / (1 - mil)), I = (0.45 + 0.55 * u) * F.I;
    const Lp = rad * lerp(F.len[0], F.len[1], u), sp = rad * 2 * F.dsp, nd = Math.round(2 + (F.dia - 2) * u);
    const n = Math.floor(budget * (0.55 + 0.45 * u)), flick = Math.floor(t * 30);
    for (let i = 0; i < n; i++) {
      const h1 = hash(seed + i), h2 = hash(seed + i * 1.37 + 7), h3 = hash(seed + i * 2.11 + 3), h4 = hash(seed + i + flick * 0.618);
      const ph = (h1 + t * 2.2) % 1, tt = ph ** 0.85, d = tt * Lp;
      const env = Math.sin(Math.PI * Math.min(1, tt * 1.4 + 0.15)) * (1 - 0.55 * tt * tt);
      const rmax = rad * (0.95 + 0.35 * env), rr = rmax * Math.sqrt(h2), a = h3 * 6.2832;
      const c = rr < rmax * 0.45 && tt < 0.3 ? F.core : tt < 0.4 ? F.hot : tt < 0.7 ? F.mid : F.tail;
      const w = I * 0.16 * (1 - tt) ** 1.1 * (0.6 + 0.4 * (1 - rr / rmax)) * (0.7 + 0.6 * h4);
      splat(R, cam, e.x - d, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.1, c[0] * w, c[1] * w, c[2] * w);
    }
    // Mach diamonds: bright lenses on the axis at regular spacing, tinted by the core colour
    for (let k = 0; k < nd; k++) {
      const dk = sp * (k + 0.75), fade = (1 - k / (nd + 1)) * (0.6 + 0.4 * u);
      if (dk > Lp * 0.85) break;
      for (let i = 0; i < 60; i++) {
        const h1 = hash(seed + k * 97 + i), h2 = hash(seed + k * 31 + i * 3.3), h3 = hash(seed + i * 5.1 + k + flick * 0.1);
        const along = (h1 - 0.5) * sp * 0.55, lens = 1 - Math.abs(along) / (sp * 0.28);
        if (lens <= 0) continue;
        const rr = rad * 0.5 * lens * Math.sqrt(h2), a = h3 * 6.2832, w = 0.7 * fade * I;
        splat(R, cam, e.x - dk - along, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.09,
          w * lerp(1, F.core[0], 0.3), w * lerp(0.9, F.core[1], 0.3), w * lerp(0.72, F.core[2], 0.4));
      }
    }
    lights.push({ x: e.x - Lp * 0.3, z: e.z, r: Lp * 0.22, i: 0.22 * I, c: [1, 0.55, 0.22] });
  });
}

// Exhaust smoke: dark, sparse puffs that spread and thin out as they drift aft. Drawn solid but dim, so
// it reads as a light grey haze of fine glyphs rather than more airframe.
function smokeTrail(R, cam, e, k, t, seed) {
  const rad = e.r, L = Math.min(rad * 40, R.ac.dims.len * 1.5), n = Math.floor(2600 * k);
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed + i * 0.91 + 11), h2 = hash(seed + i * 1.77 + 5), h3 = hash(seed + i * 2.9 + 1);
    const ph = (h1 + t * 0.45) % 1, d = rad * 2 + ph * L, spread = rad * (0.7 + 3.2 * ph);
    if (h3 > 0.55 * k * (1 - ph * 0.8) + 0.08) continue;   // sparse, and thinner further aft
    const rr = spread * Math.sqrt(h2), a = hash(seed + i * 4.3) * 6.2832;
    const g = 0.34 + 0.1 * h2;
    splat(R, cam, e.x - d, e.y + Math.cos(a) * rr + ph * rad, e.z + Math.sin(a) * rr, 0.1, g, g, g * 1.04, 0.14 + 0.2 * (1 - ph));
  }
}

// Spinning propellers: a translucent disc with a faint rotating blade blur.
function propDiscs(R, cam, time) {
  for (const p of R.scene.props) {
    const rows = p.contra ? [0.4, -0.4] : [0];
    rows.forEach((dx, ri) => {
      const dir = ri ? -1 : 1, rot = time * 9 * dir;
      for (let i = 0; i < 900; i++) {
        const h1 = hash(i * 1.3 + ri * 71), h2 = hash(i * 2.7 + 5 + ri * 13);
        const rr = p.r * (0.12 + 0.88 * Math.sqrt(h1)), a = h2 * 6.2832;
        const blade = Math.cos((a - rot) * p.blades);
        const l = 0.1 + 0.18 * Math.max(0, blade) ** 6;
        splat(R, cam, p.x + dx, p.y + Math.cos(a) * rr, p.z + Math.sin(a) * rr, 0.06, 0.55, 0.57, 0.6, l);
      }
    });
  }
}
