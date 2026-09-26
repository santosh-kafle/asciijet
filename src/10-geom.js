// Geometry: lofted bodies, airfoil panels, nozzles, propellers.
// All builders write into a Mesh through a transform `tf(x, y, z) -> [x, y, z]` so the same
// code draws an airframe in aircraft space and a missile in its own space before placing it.

const ID_TF = (x, y, z) => [x, y, z];

// Loft through stations [s, halfWidth, top, bottom, yCentre, n]. n = superellipse exponent:
// 2 ellipse, >2 boxy, <2 diamond (stealth chines). x = x0 - s.
function loft(M, st, o = {}) {
  const seg = Math.round((o.seg || 18) * (M.segMul || 1)), tf = o.tf || ID_TF, x0 = o.x0 || 0, z0 = o.z || 0, mat = o.mat || 'skin', tag = o.tag || 0;
  const rings = [];
  for (const [s, hw, top, bot, yc = 0, n = 2] of st) {
    const ring = [], e = 2 / n, first = !rings.length && o.rake;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2 + (o.rot || 0), c = Math.cos(a), sn = Math.sin(a);
      const zz = hw * Math.sign(c) * Math.abs(c) ** e;
      const yy = yc + (sn >= 0 ? top : bot) * Math.sign(sn) * Math.abs(sn) ** e;
      let ds = 0;
      if (first) ds = (o.rake.bot || 0) * (1 - sn) / 2 + (o.rake.out || 0) * Math.max(0, c * Math.sign(z0 || 1));
      ring.push(M.vert(...tf(x0 - s - ds, yy, z0 + zz)));
    }
    rings.push(ring);
  }
  for (let i = 0; i + 1 < rings.length; i++) {
    const A = rings[i], B = rings[i + 1];
    const m = o.mats ? o.mats[i] || mat : mat;
    if (o.seams) M.sub = Math.floor((st[i][0] + st[i + 1][0]) / 2 / o.seams);   // fuselage panel seams
    for (let k = 0; k < seg; k++) M.quad(A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k], m, tag);
  }
  const cap = (ring, stn, m) => {
    if (stn[1] < 0.02 && stn[2] < 0.02) return;
    const rk = ring === rings[0] && o.rake ? ((o.rake.bot || 0) + (o.rake.out || 0)) / 2 : 0;
    const c = M.vert(...tf(x0 - stn[0] - rk, stn[4] || 0, z0));
    for (let k = 0; k < seg; k++) M.tri(c, ring[k], ring[(k + 1) % seg], m, tag);
  };
  M.sub = 15;
  cap(rings[0], st[0], o.capF || mat);
  cap(rings[rings.length - 1], st[st.length - 1], o.capB || mat);
}

// Symmetric airfoil half-thickness (NACA 4-digit form), u in 0..1 of chord.
const AF_U = [0, 0.025, 0.08, 0.18, 0.32, 0.5, 0.7, 0.86, 1];
const afT = u => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);

// Sections [s_le, y, z, chord, t] -> internal {le, te, t} in aircraft x. Swing wings rotate the
// sections outboard of the pivot about the vertical axis (more sweep moves the tips aft).
function panelSections(p, L, sweep) {
  const out = [];
  const d = p.sweep && sweep != null ? (sweep - p.sweep.def) * D2R : 0;
  for (const [s, y, z, ch, t] of p.sec) {
    let le = [s, z], te = [s + ch, z];
    if (d && p.pivot && Math.abs(z) > p.pivot[1] - 1e-6) {
      const rot = ([ss, zz]) => {
        const ds = ss - p.pivot[0], dz = zz - p.pivot[1];
        return [p.pivot[0] + ds * Math.cos(d) + dz * Math.sin(d), p.pivot[1] - ds * Math.sin(d) + dz * Math.cos(d)];
      };
      le = rot(le); te = rot(te);
    }
    out.push({ le: [L / 2 - le[0], y, le[1]], te: [L / 2 - te[0], y, te[1]], t: t ?? 0.05, ch });
  }
  return out;
}

function panel(M, secs, o = {}) {
  const tf = o.tf || ID_TF, mat = o.mat || 'skin', tag = o.tag || 0, n = secs.length, K = AF_U.length;
  const rings = [];
  for (let i = 0; i < n; i++) {
    // thickness direction: perpendicular to the span direction within the y-z plane
    const a = secs[Math.max(0, i - 1)], b = secs[Math.min(n - 1, i + 1)];
    let dy = b.le[1] - a.le[1], dz = b.le[2] - a.le[2];
    const l = Math.hypot(dy, dz) || 1; dy /= l; dz /= l;
    const ny = Math.abs(dz) > 1e-6 || Math.abs(dy) > 1e-6 ? dz : 1, nz = Math.abs(dz) > 1e-6 || Math.abs(dy) > 1e-6 ? -dy : 0;
    const S = secs[i], chord = Math.hypot(S.te[0] - S.le[0], S.te[2] - S.le[2]);
    const ring = [];
    const pt = (u, side) => {
      const h = afT(u) * S.t * chord * side;
      const x = lerp(S.le[0], S.te[0], u), y = lerp(S.le[1], S.te[1], u) + ny * h, z = lerp(S.le[2], S.te[2], u) + nz * h;
      return M.vert(...tf(x, y, z));
    };
    for (let k = K - 1; k >= 0; k--) ring.push(pt(AF_U[k], 1));
    for (let k = 1; k < K - 1; k++) ring.push(pt(AF_U[k], -1));
    rings.push(ring);
  }
  const R = rings[0].length;
  const uAt = k => k < K ? AF_U[K - 1 - k] : AF_U[k - K + 1];   // chord position of ring point k
  for (let i = 0; i + 1 < n; i++)
    for (let k = 0; k < R; k++) {
      const u = (uAt(k) + uAt((k + 1) % R)) / 2;
      M.sub = u > 0.7 && !o.solid ? 1 + i * 2 + (k % 2 ? 0 : 0) : 0;
      M.quad(rings[i][k], rings[i][(k + 1) % R], rings[i + 1][(k + 1) % R], rings[i + 1][k], mat, tag);
    }
  M.sub = 0;
  for (const ring of [rings[0], rings[n - 1]])
    for (let k = 1; k + 1 < R; k++) M.tri(ring[0], ring[k], ring[k + 1], mat, tag);
}

// Engine nozzle: outer shell, dark throat, glowing burner face. Returns the exhaust source.
function nozzle(M, p, L, zs = 1) {
  const x = L / 2 - p.s, z = (p.z || 0) * zs, y = p.y || 0, len = p.len || 1.2, seg = 20;
  if (p.shape === '2d') {
    const w = p.w, h = p.h, st = [[0, w * 1.08, h * 1.15, h * 1.15, 0, 5], [len * 0.7, w, h, h, 0, 6], [len, w * 0.98, h * 0.8, h * 0.8, 0, 6]];
    loft(M, st, { x0: x + len, z, seg, mat: 'metal', capB: 'burner', tf: (a, b, c) => [a, b + y, c] });
    return { x, y, z, r: Math.max(w, h), w, h, flat: true };
  }
  const r = p.r, r2 = p.r2 || r * 1.12;
  const st = [[0, r2, r2, r2], [len * 0.6, r * 1.03, r * 1.03, r * 1.03], [len, r, r, r], [len - 0.05, r * 0.94, r * 0.94, r * 0.94], [len - 0.25, r * 0.8, r * 0.8, r * 0.8]];
  loft(M, st, { x0: x + len, z, seg, mat: p.mat || 'metal', mats: [p.mat || 'metal', p.mat || 'metal', 'hole', 'hole'], capB: 'burner', tf: (a, b, c) => [a, b + y, c] });
  return { x, y, z, r, flat: false };
}

// Contra-rotating turboprop (Tu-95): spinner plus two blade rows. Blades are tagged 0xffff so the
// renderer can swap them for a blurred disc while turning.
function propeller(M, p, L, zs = 1) {
  const x = L / 2 - p.s, z = (p.z || 0) * zs, y = p.y || 0, r = p.r;
  loft(M, [[0, 0.02, 0.02, 0.02], [0.4, 0.35, 0.35, 0.35], [1.4, 0.5, 0.5, 0.5], [2.2, 0.55, 0.55, 0.55]], { x0: x, z, seg: 12, mat: 'prop', tf: (a, b, c) => [a, b + y, c] });
  const rows = p.contra ? [0.55, 1.35] : [0.8];
  rows.forEach((ds, ri) => {
    for (let b = 0; b < p.blades; b++) {
      const a = (b / p.blades + ri * 0.125) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const secs = [0.45, r].map((rr, j) => {
        const bx = x - ds, by = y + ca * rr, bz = z + sa * rr, w = j ? 0.18 : 0.3;
        return { le: [bx + w, by, bz], te: [bx - w, by, bz], t: 0.12 };
      });
      panel(M, secs, { mat: 'prop', tag: 0xffff, solid: true });
    }
  });
  return { x: x - 0.9, y, z, r, contra: !!p.contra, blades: p.blades };
}

// Point on a panel's lower surface at span fraction f and chord fraction c (for hardpoints).
function panelPoint(secs, f, c, side = -1) {
  const z0 = secs[0].le[2], z1 = secs[secs.length - 1].le[2], zt = lerp(z0, z1, f);
  for (let i = 0; i + 1 < secs.length; i++) {
    const A = secs[i], B = secs[i + 1];
    if ((zt - A.le[2]) * (zt - B.le[2]) <= 0 || i + 2 === secs.length) {
      const u = clamp((zt - A.le[2]) / ((B.le[2] - A.le[2]) || 1), 0, 1);
      const le = [0, 1, 2].map(k => lerp(A.le[k], B.le[k], u)), te = [0, 1, 2].map(k => lerp(A.te[k], B.te[k], u));
      const ch = Math.hypot(te[0] - le[0], te[2] - le[2]), t = lerp(A.t, B.t, u);
      return [lerp(le[0], te[0], c), lerp(le[1], te[1], c) + side * afT(c) * t * ch, lerp(le[2], te[2], c), ch];
    }
  }
  return [0, 0, 0, 1];
}

// ---- faceted bodies for stealth shaping
// Polygon loft through stations { s, pts: [[z, y, ds], ...] full ring, yc }. Flat-shaded by default:
// every face gets its own vertices, so chines stay sharp. ds shifts a point aft (raked intake lips).
function ploft(M, st, o = {}) {
  const tf = o.tf || ID_TF, x0 = o.x0 || 0, z0 = o.z || 0, zs = o.zs || 1, mat = o.mat || 'skin', tag = o.tag || 0, flat = o.flat !== false;
  const rings = st.map(({ s, pts, yc = 0 }) => pts.map(([z, y, ds = 0]) => tf(x0 - s - ds, yc + y, z0 + zs * z)));
  const n = rings[0].length;
  const shared = flat ? null : rings.map(r => r.map(p => M.vert(...p)));
  for (let i = 0; i + 1 < rings.length; i++) {
    if (o.seams) M.sub = Math.floor((st[i].s + st[i + 1].s) / 2 / o.seams);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      if (flat) {
        const a = M.vert(...rings[i][k]), b = M.vert(...rings[i][k2]), c = M.vert(...rings[i + 1][k2]), d = M.vert(...rings[i + 1][k]);
        M.quad(a, b, c, d, mat, tag);
      } else M.quad(shared[i][k], shared[i][k2], shared[i + 1][k2], shared[i + 1][k], mat, tag);
    }
  }
  M.sub = 15;
  const cap = (ring, m) => {
    const c = [0, 1, 2].map(j => ring.reduce((s, p) => s + p[j], 0) / ring.length);
    const span = Math.max(...ring.map(p => Math.hypot(p[1] - c[1], p[2] - c[2])));
    if (span < 0.02) return;
    const ci = M.vert(...c), ids = ring.map(p => M.vert(...p));
    for (let k = 0; k < n; k++) M.tri(ci, ids[k], ids[(k + 1) % n], m, tag);
  };
  cap(rings[0], o.capF || mat);
  cap(rings[rings.length - 1], o.capB || mat);
  M.sub = 0;
}

// Right half (top centre round to bottom centre) -> full ring mirrored about z = 0.
const mirrorHalf = half => [...half, ...half.slice(1, -1).reverse().map(([z, y, ds]) => [-z, y, ds])];
// Stealth cross-section: flat top out to tf*w, chine edge at height c, flat bottom out to bf*w.
const hexa = (w, t, b, c = 0, tf = 0.4, bf = 0.5) => mirrorHalf([[0, t], [w * tf, t * 0.97], [w, c], [w * bf, -b * 0.97], [0, -b]]);
// Trapezoid intake duct (full ring, centred on its own axis): inner wall width, outer lip leaning,
// rake = how far aft [top-inner, top-outer, bottom-outer, bottom-inner] sit behind the lip.
const duct = (wi, wo, h, lean = 0.15, rake = [0, 0, 0, 0]) => {
  const pts = [[-wi, h / 2, rake[0]], [wo, h / 2, rake[1]], [wo - lean, -h / 2, rake[2]], [-wi, -h / 2, rake[3]]];
  const out = [];
  for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; out.push(a, a.map((v, j) => lerp(v, b[j], 0.5))); }
  return out;
};
