// CPU renderer: rasterises the mesh into a sub-cell buffer (2 x 4 samples per character cell),
// then picks one ASCII glyph per cell whose shape best matches the 8 samples.
// No DOM here, so node tests can render the same frames to text.

const SX = 2, SY = 4;               // samples per cell (cells are twice as tall as wide, so samples are square)
const GLOW_RAMP = ' .,:;+*';

class Renderer {
  constructor(cols, rows) {
    this.match = defaultMatcher();
    this.resize(cols, rows);
    this.scene = null;
  }
  resize(cols, rows) {
    this.cols = cols; this.rows = rows;
    const W = this.W = cols * SX, H = this.H = rows * SY, n = W * H;
    this.z = new Float32Array(n); this.lum = new Float32Array(n); this.spec = new Float32Array(n);
    this.cr = new Float32Array(n); this.cg = new Float32Array(n); this.cb = new Float32Array(n);
    this.er = new Float32Array(n); this.eg = new Float32Array(n); this.eb = new Float32Array(n);
    this.tag = new Uint16Array(n); this.pt = new Uint16Array(n);
    const c = cols * rows;
    this.chars = new Uint8Array(c); this.col = new Uint8Array(c * 3); this.cellTag = new Uint16Array(c);
    this.gr = new Float32Array(c); this.gg = new Float32Array(c); this.gb = new Float32Array(c); this.tmp = new Float32Array(c);
  }

  setScene(scene, ac) {
    const m = scene.mesh;
    this.scene = scene; this.ac = ac;
    this.paint = hex2rgb(ac.paint || '#9aa3aa');
    this.paint2 = hex2rgb(ac.paint2 || ac.paint || '#7d8790');
    // per-triangle face normal, and whether each vertex normal agrees with it
    const FN = new Float32Array(m.nt * 3), VS = new Int8Array(m.nt * 3);
    for (let i = 0; i < m.nt; i++) {
      const a = m.T[i * 3] * 3, b = m.T[i * 3 + 1] * 3, c = m.T[i * 3 + 2] * 3, V = m.V;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
      const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      FN[i * 3] = nx; FN[i * 3 + 1] = ny; FN[i * 3 + 2] = nz;
      for (let k = 0; k < 3; k++) {
        const v = m.T[i * 3 + k] * 3;
        VS[i * 3 + k] = m.N[v] * nx + m.N[v + 1] * ny + m.N[v + 2] * nz >= 0 ? 1 : -1;
      }
    }
    this.FN = FN; this.VS = VS;
    const nv = m.nv;
    this.px = new Float32Array(nv); this.py = new Float32Array(nv); this.pz = new Float32Array(nv);
    this.dp = new Float32Array(nv); this.dm = new Float32Array(nv); this.sp = new Float32Array(nv); this.sm = new Float32Array(nv);
    this.matCol = MAT_KEYS.map(k => k === 'skin' || k === 'door' ? this.paint : k === 'skin2' ? this.paint2 : MATS[k].c);
    this.triCol = paintScheme(m, FN, ac, this.matCol);
    this.matSp = MAT_KEYS.map(k => MATS[k].sp);
    this.shadow = buildShadow(m);
  }

  // cam: {eye, f, r, u, foc, cx, cy}; o: {throttle, time, ground, spin}
  render(cam, o) {
    const { W, H } = this, n = W * H, m = this.scene.mesh;
    this.z.fill(Infinity); this.lum.fill(0); this.spec.fill(0); this.tag.fill(0); this.pt.fill(0);
    this.cr.fill(0); this.cg.fill(0); this.cb.fill(0); this.er.fill(0); this.eg.fill(0); this.eb.fill(0);
    const { eye, f, r, u, foc, cx, cy } = cam;

    // Lights follow the camera (key from upper left, fill from lower right) so every angle reads.
    const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
    const Lk = nrm([-f[0] * 0.35 - r[0] * 0.55, 0.9 - f[1] * 0.35 - r[1] * 0.55, -f[2] * 0.35 - r[2] * 0.55]);
    const Lf = nrm([-f[0] * 0.4 - u[0] * 0.3 + r[0] * 0.8, -f[1] * 0.4 - u[1] * 0.3 + r[1] * 0.8, -f[2] * 0.4 - u[2] * 0.3 + r[2] * 0.8]);
    const Hh = nrm([Lk[0] - f[0], Lk[1] - f[1], Lk[2] - f[2]]);

    // Vertex pass: project, light both faces.
    const V = m.V, N = m.N, { px, py, pz, dp, dm, sp, sm } = this;
    for (let i = 0, j = 0; i < m.nv; i++, j += 3) {
      const x = V[j] - eye[0], y = V[j + 1] - eye[1], z = V[j + 2] - eye[2];
      const vz = x * f[0] + y * f[1] + z * f[2];
      pz[i] = vz;
      const iz = foc / Math.max(vz, 0.01);
      px[i] = cx + (x * r[0] + y * r[1] + z * r[2]) * iz;
      py[i] = cy - (x * u[0] + y * u[1] + z * u[2]) * iz;
      const nx = N[j], ny = N[j + 1], nz = N[j + 2];
      const k = nx * Lk[0] + ny * Lk[1] + nz * Lk[2], fl = nx * Lf[0] + ny * Lf[1] + nz * Lf[2];
      const h = nx * Hh[0] + ny * Hh[1] + nz * Hh[2], sky = ny * 0.5 + 0.5;
      const hl = -(nx * f[0] + ny * f[1] + nz * f[2]);   // faint headlight so faces toward the camera never go black
      dp[i] = 0.07 + 0.66 * Math.max(0, k) ** 1.3 + 0.14 * Math.max(0, fl) + 0.08 * sky + 0.3 * Math.max(0, hl);
      dm[i] = 0.07 + 0.66 * Math.max(0, -k) ** 1.3 + 0.14 * Math.max(0, -fl) + 0.08 * (1 - sky) + 0.3 * Math.max(0, -hl);
      sp[i] = h > 0 ? h ** 24 : 0; sm[i] = h < 0 ? (-h) ** 24 : 0;
    }

    const T = m.T, M = m.M, G = m.G, P = m.P, FN = this.FN, VS = this.VS, Z = this.z, LU = this.lum, SP = this.spec, TG = this.tag, PT = this.pt, TC = this.triCol;
    const CR = this.cr, CG = this.cg, CB = this.cb, ER = this.er, EG = this.eg, EB = this.eb;
    const glowMat = MAT_ID.burner, heat = burnerColor(this.ac, o.throttle);
    const spinning = o.spin;
    for (let t = 0; t < m.nt; t++) {
      if (spinning && G[t] === 0xffff) continue;
      const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
      if (pz[a] < 0.2 || pz[b] < 0.2 || pz[c] < 0.2) continue;
      const ax = px[a], ay = py[a], bx = px[b], by = py[b], qx = px[c], qy = py[c];
      const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      if (Math.abs(area) < 1e-9) continue;
      let x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
      let y0 = Math.max(0, Math.floor(Math.min(ay, by, qy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
      if (x0 > x1 || y0 > y1) continue;
      // which face we see: face normal against the direction to the camera
      const vx = V[a * 3] - eye[0], vy = V[a * 3 + 1] - eye[1], vz = V[a * 3 + 2] - eye[2];
      const sf = FN[t * 3] * vx + FN[t * 3 + 1] * vy + FN[t * 3 + 2] * vz < 0 ? 1 : -1;
      const la = VS[t * 3] * sf > 0 ? dp[a] : dm[a], lb = VS[t * 3 + 1] * sf > 0 ? dp[b] : dm[b], lc = VS[t * 3 + 2] * sf > 0 ? dp[c] : dm[c];
      const sa = VS[t * 3] * sf > 0 ? sp[a] : sm[a], sb = VS[t * 3 + 1] * sf > 0 ? sp[b] : sm[b], sc = VS[t * 3 + 2] * sf > 0 ? sp[c] : sm[c];
      const mi = M[t], cr0 = TC[t * 3], cg0 = TC[t * 3 + 1], cb0 = TC[t * 3 + 2], ms = this.matSp[mi], glow = mi === glowMat, tg = G[t] === 0xffff ? 0 : G[t], pid = P[t];
      const ia = 1 / area;
      for (let y = y0; y <= y1; y++) {
        const sy = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const sx = x + 0.5;
          const w0 = ((bx - sx) * (qy - sy) - (by - sy) * (qx - sx)) * ia;
          const w1 = ((qx - sx) * (ay - sy) - (qy - sy) * (ax - sx)) * ia;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const zz = w0 * pz[a] + w1 * pz[b] + w2 * pz[c], k = y * W + x;
          if (zz >= Z[k]) continue;
          Z[k] = zz; TG[k] = tg; PT[k] = pid;
          if (glow) {
            LU[k] = heat[3]; SP[k] = 0; CR[k] = heat[0]; CG[k] = heat[1]; CB[k] = heat[2];
            ER[k] = heat[0] * heat[3]; EG[k] = heat[1] * heat[3]; EB[k] = heat[2] * heat[3];
          } else {
            LU[k] = w0 * la + w1 * lb + w2 * lc; SP[k] = (w0 * sa + w1 * sb + w2 * sc) * ms;
            CR[k] = cr0; CG[k] = cg0; CB[k] = cb0;
            ER[k] = 0; EG[k] = 0; EB[k] = 0;
          }
        }
      }
    }

    // Ink lines: strong where depth jumps (a wing edge over the fuselage), medium where two parts
    // meet (canopy, intakes, fins), light for hinge lines and panel seams inside one part.
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const k = y * W + x, z0 = Z[k];
      if (z0 === Infinity) continue;
      for (let qq = 0; qq < 2; qq++) {
        const q = qq ? k + W : k + 1, z1 = Z[q];
        if (z1 === Infinity) continue;
        const far = z1 > z0 ? q : k;
        if (Math.abs(z1 - z0) > 0.25 + 0.012 * z0) { LU[far] *= 0.3; SP[far] *= 0.3; }
        else if (PT[q] !== PT[k]) {
          const f = (PT[q] >> 4) !== (PT[k] >> 4) ? 0.5 : 0.7;
          LU[far] *= f; SP[far] *= f;
        }
      }
    }

    if (this.scene.props.length && spinning) propDiscs(this, cam, o.time);
    if (this.scene.exhausts.length) plume(this, cam, o);
    if (o.gun) gunfire(this, cam, o);
    if (o.ground) ground(this, cam, o);
    this.resolve();
  }

  // Samples -> glyph, colour and tag per cell, plus a soft glow around bright emission.
  resolve() {
    const { cols, rows, W } = this, LU = this.lum, SP = this.spec, TG = this.tag;
    const CR = this.cr, CG = this.cg, CB = this.cb, ER = this.er, EG = this.eg, EB = this.eb;
    const chars = this.chars, col = this.col, gr = this.gr, gg = this.gg, gb = this.gb;
    for (let cyy = 0, c = 0; cyy < rows; cyy++) for (let cxx = 0; cxx < cols; cxx++, c++) {
      let key = 0, pow = 1, lr = 0, lg = 0, lb = 0, cov = 0, er = 0, eg = 0, eb = 0, tg = 0, sl = 0;
      for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
        const k = (cyy * SY + j) * W + cxx * SX + i;
        const e = ER[k] + EG[k] + EB[k];
        const v = LU[k] + SP[k] + e * 0.6;
        key += (v < 0.08 ? 0 : v < 0.36 ? 1 : v < 0.7 ? 2 : 3) * pow; pow *= 4;
        if (LU[k] > 0 || SP[k] > 0) {
          const l = LU[k] * 0.55 + 0.45, s = SP[k];
          lr += CR[k] * l + s; lg += CG[k] * l + s; lb += CB[k] * l + s; cov++; sl += LU[k];
        }
        er += ER[k]; eg += EG[k]; eb += EB[k];
        if (TG[k]) tg = TG[k];
      }
      this.cellTag[c] = tg;
      gr[c] = er / 8; gg[c] = eg / 8; gb[c] = eb / 8;
      chars[c] = key ? this.match(key) : 32;
      const w = cov ? 1 / cov : 0, ee = 1 / 8;
      col[c * 3] = Math.min(255, (lr * w + er * ee * 1.4) * 255);
      col[c * 3 + 1] = Math.min(255, (lg * w + eg * ee * 1.4) * 255);
      col[c * 3 + 2] = Math.min(255, (lb * w + eb * ee * 1.4) * 255);
    }
    // glow: blur emission over a few cells, light up empty cells around the flame
    blur(gr, this.tmp, cols, rows, 3); blur(gg, this.tmp, cols, rows, 3); blur(gb, this.tmp, cols, rows, 3);
    for (let c = 0; c < cols * rows; c++) {
      const g = gr[c] + gg[c] + gb[c];
      if (g < 0.02) continue;
      if (chars[c] === 32) {
        const idx = Math.min(GLOW_RAMP.length - 1, Math.floor(g * 7));
        if (idx > 0) {
          chars[c] = GLOW_RAMP.charCodeAt(idx);
          const s = 255 / Math.max(gr[c], gg[c], gb[c]) * Math.min(1, 0.35 + g);
          col[c * 3] = gr[c] * s; col[c * 3 + 1] = gg[c] * s; col[c * 3 + 2] = gb[c] * s;
        }
      } else {
        col[c * 3] = Math.min(255, col[c * 3] + gr[c] * 120); col[c * 3 + 1] = Math.min(255, col[c * 3 + 1] + gg[c] * 120); col[c * 3 + 2] = Math.min(255, col[c * 3 + 2] + gb[c] * 120);
      }
    }
  }

  // Plain text of the current frame (tests, photo mode copy).
  text() {
    let s = '';
    for (let y = 0; y < this.rows; y++) {
      s += String.fromCharCode(...this.chars.subarray(y * this.cols, (y + 1) * this.cols)).replace(/\s+$/, '') + '\n';
    }
    return s;
  }
}

function blur(a, tmp, w, h, r) {
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x < w; x++) {
      if (x + r < w) acc += a[y * w + x + r];
      if (x - r - 1 >= 0) acc -= a[y * w + x - r - 1];
      if (x >= 0) tmp[y * w + x] = acc / (2 * r + 1);
    }
  }
  const ry = Math.max(1, r >> 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -ry; y < h; y++) {
      if (y + ry < h) acc += tmp[(y + ry) * w + x];
      if (y - ry - 1 >= 0) acc -= tmp[(y - ry - 1) * w + x];
      if (y >= 0) a[y * w + x] = acc / (2 * ry + 1);
    }
  }
}

// Fallback glyph matcher: density ramp with a little shape awareness (used in node).
function defaultMatcher() {
  const ramp = " .:-=+*#%@";
  return key => {
    let s = 0, top = 0, bot = 0;
    for (let i = 0; i < 8; i++) { const q = (key >> (i * 2)) & 3; s += q; if (i < 4) top += q; else bot += q; }
    if (s <= 2 && bot > 0 && top === 0) return 95; // _
    if (s <= 2 && top > 0 && bot === 0) return 39; // '
    return ramp.charCodeAt(Math.min(ramp.length - 1, Math.round(s / 24 * (ramp.length - 1))));
  };
}

// Colour and brightness of the burner face: dull red at high dry power, white-orange in reheat.
function burnerColor(ac, thr) {
  const ab = !!ac.eng.wet, mil = ab ? MIL : 1;
  if (ac.eng.type === 'turboprop') return [0.3, 0.1, 0.05, 0.1];
  if (thr <= mil) { const u = thr / mil; return [0.9, 0.25, 0.08, 0.08 + 0.35 * u * u]; }
  const u = (thr - mil) / (1 - mil);
  return [1, lerp(0.55, 0.8, u), lerp(0.25, 0.55, u), 0.9 + 0.5 * u];
}

// Top-down coverage map for the ground shadow (sun overhead).
function buildShadow(m) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < m.V.length; i += 3) { x0 = Math.min(x0, m.V[i]); x1 = Math.max(x1, m.V[i]); z0 = Math.min(z0, m.V[i + 2]); z1 = Math.max(z1, m.V[i + 2]); }
  const res = Math.max(0.08, Math.max(x1 - x0, z1 - z0) / 400);
  const w = Math.ceil((x1 - x0) / res) + 2, h = Math.ceil((z1 - z0) / res) + 2, a = new Uint8Array(w * h);
  for (let t = 0; t < m.nt; t++) {
    if (m.G[t] === 0xffff) continue;
    const p = [0, 1, 2].map(k => { const v = m.T[t * 3 + k] * 3; return [(m.V[v] - x0) / res, (m.V[v + 2] - z0) / res]; });
    const bx0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), bx1 = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const by0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), by1 = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const ar = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(ar) < 1e-9) continue;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const w0 = ((p[1][0] - sx) * (p[2][1] - sy) - (p[1][1] - sy) * (p[2][0] - sx)) / ar;
      const w1 = ((p[2][0] - sx) * (p[0][1] - sy) - (p[2][1] - sy) * (p[0][0] - sx)) / ar;
      if (w0 >= -0.01 && w1 >= -0.01 && 1 - w0 - w1 >= -0.01) a[y * w + x] = 1;
    }
  }
  return { x0, z0, res, w, h, a };
}

// Ground plane: a surveyed grid of dots and lines, the aircraft's shadow, and afterburner light on the floor.
function ground(R, cam, o) {
  const { W, H, z: Z } = R, { eye, f, r, u, foc, cx, cy } = cam, gy = o.groundY, sh = R.shadow;
  const lights = o.floorLights || [];
  // The camera's right vector is level (r[1] = 0), so the ray's height and its hit distance are
  // constant along a screen row: work them out once per row.
  for (let y = 0; y < H; y++) {
    const vy = -(y + 0.5 - cy) / foc;
    const dy = f[1] + u[1] * vy;
    if (dy >= -1e-4) continue;
    const t = (gy - eye[1]) / dy, pw = t / foc * 1.2;
    const bx = eye[0] + (f[0] + u[0] * vy) * t, bz = eye[2] + (f[2] + u[2] * vy) * t;
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (Z[k] !== Infinity) continue;
      const vx = (x + 0.5 - cx) / foc;
      const gx = bx + r[0] * vx * t, gz = bz + r[2] * vx * t;
      const dist = Math.hypot(gx, gz), fade = 1 - smooth(o.groundR * 0.5, o.groundR, dist);
      if (fade <= 0) continue;
      const st = o.groundStep || 2, ST = st * 5;
      const lx = Math.abs(gx - Math.round(gx / st) * st), lz = Math.abs(gz - Math.round(gz / st) * st);
      const Lx = Math.abs(gx - Math.round(gx / ST) * ST), Lz = Math.abs(gz - Math.round(gz / ST) * ST);
      let v = 0;
      if (lx < pw * 0.6 && lz < pw * 0.6) v = 0.4;      // grid dots every step (2 m, or 5 m for bombers)
      if (Lx < pw * 0.5 || Lz < pw * 0.5) v = Math.max(v, 0.26); // lines every 5 steps
      const sxx = Math.floor((gx - sh.x0) / sh.res), szz = Math.floor((gz - sh.z0) / sh.res);
      const shade = sxx >= 0 && szz >= 0 && sxx < sh.w && szz < sh.h && sh.a[szz * sh.w + sxx];
      if (shade) v = 0;
      let er = 0, eg = 0, eb = 0;
      if (lights.length) for (const L of lights) {
        const d2 = (gx - L.x) ** 2 + (gz - L.z) ** 2, w = L.i / (1 + d2 / (L.r * L.r));
        er += w * L.c[0]; eg += w * L.c[1]; eb += w * L.c[2];
      }
      v *= fade;
      if (shade) { er *= 0.3; eg *= 0.3; eb *= 0.3; }
      R.lum[k] = v; R.cr[k] = 0.42; R.cg[k] = 0.5; R.cb[k] = 0.55;
      if (er + eg + eb > 0.01) {
        R.lum[k] = Math.max(v, Math.min(0.45, (er + eg + eb) * 0.6) * fade);
        R.cr[k] = lerp(R.cr[k], er / (er + eg + eb + 1e-6) * 2, Math.min(1, er * 2));
        R.cg[k] = lerp(R.cg[k], eg / (er + eg + eb + 1e-6) * 2, Math.min(1, er * 2));
        R.cb[k] = lerp(R.cb[k], eb / (er + eg + eb + 1e-6) * 2, Math.min(1, er * 2));
      }
    }
  }
}

// ---- paint schemes: camouflage from 3D value noise, lighter undersides, per triangle

function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const h = (a, b, c) => hash(a * 157 + b * 113 + c * 311);
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
           l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

function paintScheme(m, FN, ac, matCol) {
  const out = new Float32Array(m.nt * 3), cam = ac.camo || {};
  const cols = (cam.cols || []).map(hex2rgb), under = cam.under ? hex2rgb(cam.under) : matCol[MAT_ID.skin].map(c => Math.min(1, c * 1.12 + 0.03));
  const top = cam.top ? hex2rgb(cam.top) : null, f = cam.f || 0.22, skinIds = [MAT_ID.skin, MAT_ID.door];
  for (let t = 0; t < m.nt; t++) {
    let c = matCol[m.M[t]];
    if (skinIds.includes(m.M[t]) && m.G[t] === 0) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { const v = m.T[t * 3 + k] * 3; cx += m.V[v]; cy += m.V[v + 1]; cz += m.V[v + 2]; }
      cx /= 3; cy /= 3; cz /= 3;
      const ny = FN[t * 3 + 1], down = ny < -0.35;
      if (down && cam.wrap !== true) c = under;
      else if (cols.length) {
        const nz = vnoise(cx * f + 11, cy * f * 0.6 + 3, cz * f + 7);
        c = cols[Math.floor(clamp((nz - 0.28) / 0.44, 0, 0.999) * cols.length)];
      } else if (top && ny > 0.35) c = top;
    }
    out[t * 3] = c[0]; out[t * 3 + 1] = c[1]; out[t * 3 + 2] = c[2];
  }
  return out;
}
