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

// One plume per exhaust. Length, brightness and shock diamonds grow with the afterburner setting.
function plume(R, cam, o) {
  const ac = R.ac, thr = o.throttle, t = o.time, ab = !!ac.eng.wet, mil = ab ? MIL : 1;
  const ex = R.scene.exhausts, lights = [];
  o.floorLights = lights;
  const budget = 7000 / Math.max(2, ex.length);
  ex.forEach((e, ei) => {
    const rad = e.r, sy = e.flat ? e.h / rad : 1, sz = e.flat ? e.w / rad : 1;
    const seed = ei * 1013;
    if (thr <= mil) {
      // dry: a faint heat shimmer that grows with power
      const u = thr / mil;
      if (u < 0.35) return;
      const n = Math.floor(260 * u), Lp = rad * (3 + 4 * u), I = 0.05 * (u - 0.3);
      for (let i = 0; i < n; i++) {
        const h1 = hash(seed + i), h2 = hash(seed + i * 1.37 + 7), h3 = hash(seed + i * 2.11 + 3);
        const ph = (h1 + t * 1.6) % 1, d = ph * Lp, rr = rad * (0.9 + 0.5 * ph) * Math.sqrt(h2), a = h3 * 6.2832;
        const w = I * (1 - ph);
        splat(R, cam, e.x - d, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.08, w * 1.0, w * 0.55, w * 0.4);
      }
      return;
    }
    const u = (thr - mil) / (1 - mil), I = 0.45 + 0.55 * u;
    const Lp = rad * lerp(6, 16, u), sp = rad * 2 * 1.25, nd = Math.round(2 + 4 * u);
    const n = Math.floor(budget * (0.55 + 0.45 * u)), flick = Math.floor(t * 30);
    for (let i = 0; i < n; i++) {
      const h1 = hash(seed + i), h2 = hash(seed + i * 1.37 + 7), h3 = hash(seed + i * 2.11 + 3), h4 = hash(seed + i + flick * 0.618);
      const ph = (h1 + t * 2.2) % 1, tt = ph ** 0.85, d = tt * Lp;
      const env = Math.sin(Math.PI * Math.min(1, tt * 1.4 + 0.15)) * (1 - 0.55 * tt * tt);
      const rmax = rad * (0.95 + 0.35 * env), rr = rmax * Math.sqrt(h2), a = h3 * 6.2832;
      const core = rr < rmax * 0.45 && tt < 0.3;
      let c;
      if (core) c = [0.75, 0.82, 1.0];
      else if (tt < 0.4) c = [1.0, 0.74, 0.36];
      else if (tt < 0.7) c = [1.0, 0.47, 0.16];
      else c = [0.85, 0.24, 0.08];
      const w = I * 0.16 * (1 - tt) ** 1.1 * (0.6 + 0.4 * (1 - rr / rmax)) * (0.7 + 0.6 * h4);
      splat(R, cam, e.x - d, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.1, c[0] * w, c[1] * w, c[2] * w);
    }
    // Mach diamonds: bright lenses on the axis at regular spacing
    for (let k = 0; k < nd; k++) {
      const dk = sp * (k + 0.75), fade = (1 - k / (nd + 1)) * (0.6 + 0.4 * u);
      for (let i = 0; i < 60; i++) {
        const h1 = hash(seed + k * 97 + i), h2 = hash(seed + k * 31 + i * 3.3), h3 = hash(seed + i * 5.1 + k + flick * 0.1);
        const along = (h1 - 0.5) * sp * 0.55, lens = 1 - Math.abs(along) / (sp * 0.28);
        if (lens <= 0) continue;
        const rr = rad * 0.5 * lens * Math.sqrt(h2), a = h3 * 6.2832, w = 0.7 * fade * I;
        splat(R, cam, e.x - dk - along, e.y + Math.cos(a) * rr * sy, e.z + Math.sin(a) * rr * sz, 0.09, w, w * 0.9, w * 0.72);
      }
    }
    lights.push({ x: e.x - Lp * 0.3, z: e.z, r: Lp * 0.22, i: 0.22 * I, c: [1, 0.55, 0.22] });
  });
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
