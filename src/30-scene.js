// Scene assembly: airframe parts + stations + stores -> one mesh, exhaust sources and label anchors.

const normLoad = v => v == null ? null : Array.isArray(v) ? { key: v[0], n: v[1] || 1 } : { key: v, n: 1 };

// Expand stations into instances (mirrored stations give a left and a right).
function stationInstances(ac, secsByName) {
  const out = [];
  for (const st of ac.stations || []) {
    let p;
    if (st.on) {
      const secs = secsByName[st.on];
      const [x, y, z, ch] = panelPoint(secs, st.f, st.c ?? 0.35);
      p = [x, y, z]; st._ch = ch;
    } else p = [ac.dims.len / 2 - st.at[0], st.at[1], st.at[2] || 0];
    if (st.side === -1) p[2] = -p[2];
    out.push({ st, p, side: st.mirror ? 'R' : '', idx: out.length });
    if (st.mirror) out.push({ st, p: [p[0], p[1], -p[2]], side: 'L', idx: out.length });
  }
  return out;
}

// Offsets of each store's centre from the station anchor, plus a roll about the store axis.
function arrange(n, S, st) {
  const r = S.d / 2, fin = (S.span || S.d) / 2, kind = st.kind || 'pylon';
  if (kind === 'rail') return [[0, 0, 0, 0]];
  if (kind === 'semi') return Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * (S.L + 0.2), -r * 0.45, 0, Math.PI / 4]);
  if (kind === 'conf') return Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * (S.L + 0.2), -r - 0.12, 0, Math.PI / 4]);
  if (kind === 'bay') {
    const b = st.bay, pitch = Math.max(S.d, fin * 1.45) + 0.06;
    if (b.arr === 'rotary' && n <= 8) {
      const R = n > 1 ? Math.max(pitch / 2 / Math.sin(Math.PI / n), r + 0.3) : 0, cy = -(R + pitch / 2 + 0.05);
      return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [0, cy + Math.cos(a) * R, Math.sin(a) * R, a + Math.PI / 4]; });
    }
    const cols = Math.max(1, Math.floor((b.w - 0.1) / pitch)), tand = Math.max(1, Math.floor((b.len + 0.1) / (S.L + 0.15)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, t = Math.floor(i / cols) % tand, l = Math.floor(i / (cols * tand));
      const inRow = Math.min(cols, n - Math.floor(i / cols) * cols);
      out.push([(t - (Math.min(tand, Math.ceil(n / cols)) - 1) / 2) * (S.L + 0.15), -(r + 0.06) - l * pitch, (c - (inRow - 1) / 2) * pitch, Math.PI / 4]);
    }
    return out;
  }
  // pylon: single, twin, triple ejector rack, then tandem groups of three
  const base = -(st.drop ?? 0.32);
  if (n === 1) return [[0, base - r, 0, Math.PI / 4]];
  const w = Math.max(r, fin * 0.72) + 0.05;
  if (n === 2) return [[0, base - r - 0.06, -w, Math.PI / 4], [0, base - r - 0.06, w, Math.PI / 4]];
  const groups = Math.ceil(n / 3), out = [];
  for (let g = 0; g < groups; g++) {
    const dx = (g - (groups - 1) / 2) * (S.L * 1.02), m = Math.min(3, n - g * 3);
    const tri = [[dx, base - r - 0.1, -w], [dx, base - r - 0.1, w], [dx, base - r * 3 - 0.2, 0]];
    for (let k = 0; k < m; k++) out.push([...tri[k], Math.PI / 4]);
  }
  return out;
}

function buildScene(ac, o = {}) {
  const L = ac.dims.len, M = new Mesh(), exhausts = [], props = [], panels = [];
  M.segMul = [0.75, 1, 1.35, 1.7][o.detail ?? 1];
  const sweep = o.sweep ?? ac.sweep?.def;
  const secsByName = {};
  const bays = o.bays ?? false;
  const load = o.loadout || {};

  // Airframe
  for (const p of ac.geo) {
    for (const zs of p.mirror ? [1, -1] : [1]) {
      M.part();
      if (p.t === 'loft') {
        let st = p.st;
        if (ac.canopyH && (p.mat === 'glass' || p.mat === 'gold')) st = bubbleStations(ac, st, ac.canopyH);
        if (p.box) {   // sharp-edged rectangular intake duct with the same stations and rake
          const sg = Math.sign(p.z || 1) * zs, rk = p.rake || {};
          const pst = st.map(([ss, hw, top, bot, yc = 0], i) => {
            const c = [[-hw, top], [0, top], [hw, top], [hw, 0], [hw, -bot], [0, -bot], [-hw, -bot], [-hw, 0]];
            return { s: ss, yc, pts: c.map(([z, y]) => [z, y, i ? 0 : (rk.bot || 0) * (top - y) / ((top + bot) || 1) + (rk.out || 0) * Math.max(0, z * sg / (hw || 1))]) };
          });
          ploft(M, pst, { x0: L / 2, z: (p.z || 0) * zs, mat: p.mat, capF: p.capF, capB: p.capB });
          continue;
        }
        if (p.fine) { // resample long fuselages so bay cutouts stay close to the bay outline
          const out = [st[0]];
          for (let i = 1; i < st.length; i++) {
            const a = st[i - 1], b = st[i], k = Math.max(1, Math.ceil((b[0] - a[0]) / p.fine));
            for (let j = 1; j <= k; j++) out.push(a.map((v, q) => q === 5 ? lerp(a[5] ?? 2, b[5] ?? 2, j / k) : lerp(v ?? (q === 4 ? 0 : 2), b[q] ?? (q === 4 ? 0 : 2), j / k)));
          }
          st = out;
        }
        loft(M, st, { x0: L / 2, z: (p.z || 0) * zs, seg: p.seg, mat: p.mat, mats: p.mats, capF: p.capF, capB: p.capB, tf: p.tf, rake: p.rake, seams: p.fine ? (L > 30 ? 3.5 : 2.2) : 0 });
      } else if (p.t === 'ploft') {
        let st = p.st.map(([s, pts, yc = 0]) => ({ s, pts, yc }));
        if (p.fine) {   // resample so bay cut-outs follow the bay outline
          const out = [st[0]];
          for (let i = 1; i < st.length; i++) {
            const a = st[i - 1], b = st[i], k = Math.max(1, Math.ceil((b.s - a.s) / p.fine));
            for (let j = 1; j <= k; j++) {
              const u = j / k;
              out.push({ s: lerp(a.s, b.s, u), yc: lerp(a.yc, b.yc, u), pts: a.pts.map((q, m) => q.map((v, c) => lerp(v || 0, b.pts[m][c] || 0, u))) });
            }
          }
          st = out;
        }
        ploft(M, st, { x0: L / 2, z: (p.z || 0) * zs, zs, mat: p.mat, capF: p.capF, capB: p.capB, flat: p.flat, seams: p.fine ? (L > 30 ? 3.5 : 2.2) : 0 });
      } else if (p.t === 'panel') {
        let secs = panelSections(p, L, sweep);
        if (zs < 0) secs = secs.map(s => ({ ...s, le: [s.le[0], s.le[1], -s.le[2]], te: [s.te[0], s.te[1], -s.te[2]] }));
        if (p.name && zs > 0) secsByName[p.name] = secs;
        panel(M, secs, { mat: p.mat });
        panels.push({ p, secs, zs });
      } else if (p.t === 'noz') exhausts.push(nozzle(M, p, L, zs));
      else if (p.t === 'prop') props.push(propeller(M, p, L, zs));
      else if (p.t === 'gatling') gatling(M, p, L);
    }
  }

  // Gun muzzle(s) in aircraft space, for the firing effects
  const G = fxFor(ac).gun, guns = !G ? [] : (G.pair ? [1, -1] : [1]).map(sg => ({ x: L / 2 - G.at[0], y: G.at[1], z: G.at[2] * sg }));

  // Floor height from the published height: the tallest point of the airframe (fin tip) stands
  // dims.height above the ground.
  let maxY = -Infinity;
  for (let i = 1; i < M.v.length; i += 3) maxY = Math.max(maxY, M.v[i]);
  let groundY = maxY - ac.dims.height;

  markings(M, ac, panels);

  // Stations and stores
  const inst = stationInstances(ac, secsByName), labels = [];
  const cut = [];
  inst.forEach((I, k) => {
    const st = I.st, ld = normLoad(load[st.id]);
    const S = ld && STORES[ld.key];
    const tag = k + 1;
    const [ax, ay, az] = I.p;
    if (st.kind === 'bay') {
      if (!bays) { if (S) labels.push({ tag, st, side: I.side, S, n: ld.n, p: [ax, ay - 0.3, az], hidden: true }); return; }
      const b = st.bay, h = b.h ?? 0.8;
      cut.push({ x0: ax - b.len / 2, x1: ax + b.len / 2, z: az, w: b.w / 2, y: ay });
      // cavity walls and ceiling
      const x0 = ax - b.len / 2, x1 = ax + b.len / 2, z0 = az - b.w / 2, z1 = az + b.w / 2, yb = ay - h;
      const q = (pts, m) => { const ids = pts.map(p => M.vert(...p)); M.quad(ids[0], ids[1], ids[2], ids[3], m, 0); };
      q([[x0, ay, z0], [x1, ay, z0], [x1, ay, z1], [x0, ay, z1]], 'bay');
      q([[x0, ay, z0], [x1, ay, z0], [x1, yb, z0], [x0, yb, z0]], 'bay');
      q([[x0, ay, z1], [x1, ay, z1], [x1, yb, z1], [x0, yb, z1]], 'bay');
      q([[x0, ay, z0], [x0, ay, z1], [x0, yb, z1], [x0, yb, z0]], 'bay');
      q([[x1, ay, z0], [x1, ay, z1], [x1, yb, z1], [x1, yb, z0]], 'bay');
      if (b.doors !== false) {
        const dh = Math.min(b.w * 0.5, 1.6), sp = 0.25;
        for (const [ze, sg] of [[z0, -1], [z1, 1]])
          q([[x0, yb, ze], [x1, yb, ze], [x1, yb - dh, ze + sg * dh * sp], [x0, yb - dh, ze + sg * dh * sp]], 'door');
      }
    }
    if (!S) {
      if (st.fixed && st.kind !== 'bay' && st.kind !== 'rail') pylon(M, ax, ay, az, st.drop ?? 0.32, 1.6, tag);
      return;
    }
    const n = ld.n, offs = arrange(n, S, st);
    if ((st.kind || 'pylon') === 'pylon') pylon(M, ax, ay, az, (st.drop ?? 0.32) + (n > 2 ? 0.08 : 0), clamp(S.L * 0.55, 0.9, 3.2), tag);
    if (st.kind === 'rail') { const id = [M.vert(ax + S.L * 0.3, ay, az), M.vert(ax - S.L * 0.35, ay, az), M.vert(ax - S.L * 0.35, ay - 0.08, az), M.vert(ax + S.L * 0.3, ay - 0.08, az)]; M.quad(...id, 'dark', tag); }
    let cy = 0;
    for (const [dx, dy, dz, roll] of offs) {
      const cx = ax + dx, yy = ay + dy, zz = az + (st.kind === 'rail' ? Math.sign(az) * (S.d / 2 + 0.02) : 0) + dz;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      M.part();
      storeMesh(M, S, (x, y, z) => [cx + S.L / 2 + x, yy + y * cr - z * sr, zz + y * sr + z * cr], tag);
      cy += yy;
    }
    labels.push({ tag, st, side: I.side, S, n, p: [ax, cy / offs.length, az] });
  });

  // Cut open bays: drop airframe skin triangles in the bay footprint below the ceiling.
  if (cut.length) {
    const V = M.v, T = M.t, keep = { t: [], m: [], g: [], p: [] };
    for (let i = 0; i < M.m.length; i++) {
      const a = T[i * 3] * 3, b = T[i * 3 + 1] * 3, c = T[i * 3 + 2] * 3;
      const x = (V[a] + V[b] + V[c]) / 3, y = (V[a + 1] + V[b + 1] + V[c + 1]) / 3, z = (V[a + 2] + V[b + 2] + V[c + 2]) / 3;
      const skin = M.g[i] === 0 && (M.m[i] === MAT_ID.skin || M.m[i] === MAT_ID.skin2 || M.m[i] === MAT_ID.dark);
      if (skin && cut.some(k => x > k.x0 && x < k.x1 && Math.abs(z - k.z) < k.w && y < k.y + 0.05)) continue;
      keep.t.push(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]); keep.m.push(M.m[i]); keep.g.push(M.g[i]); keep.p.push(M.p[i]);
    }
    M.t = keep.t; M.m = keep.m; M.g = keep.g; M.p = keep.p;
  }

  // Keep everything above the floor (deep racks on bombers), then lower the gear to it.
  let lowY = Infinity;
  for (let i = 1; i < M.v.length; i += 3) lowY = Math.min(lowY, M.v[i]);
  groundY = Math.min(groundY, lowY - 0.12);
  if (o.gear !== false) landingGear(M, ac, groundY);

  const mesh = M.finish();
  let R = 0, minY = 0;
  for (let i = 0; i < mesh.V.length; i += 3) {
    R = Math.max(R, Math.hypot(mesh.V[i], mesh.V[i + 1], mesh.V[i + 2]));
    minY = Math.min(minY, mesh.V[i + 1]);
  }
  return { mesh, exhausts, props, labels, inst, R, minY, groundY, guns };
}

function pylon(M, x, y, z, h, ch, tag) {
  panel(M, [{ le: [x + ch / 2, y + 0.05, z], te: [x - ch / 2, y + 0.05, z], t: 0.1 }, { le: [x + ch / 2 - 0.1, y - h, z], te: [x - ch / 2 + 0.05, y - h, z], t: 0.1 }].map(s => ({ ...s, le: [s.le[0], s.le[1], s.le[2]], te: [s.te[0], s.te[1], s.te[2]] })), { mat: 'skin2', tag, solid: true });
}

// ---- weights and engine model

// Mass of a loadout: stores, fuel carried in drop tanks, and per-station entries.
function loadoutMass(ac, load) {
  let kg = 0, fuel = 0, n = 0;
  const rows = [];
  for (const st of ac.stations || []) {
    const ld = normLoad(load[st.id]);
    if (!ld || !STORES[ld.key]) continue;
    const S = STORES[ld.key], sides = st.mirror ? 2 : 1, cnt = ld.n * sides;
    kg += S.kg * cnt; fuel += (S.fuel || 0) * cnt; n += cnt;
    rows.push({ st, S, n: ld.n, sides, kg: (S.kg + (S.fuel || 0)) * cnt });
  }
  return { kg, fuel, n, rows };
}

// Throttle 0..1. Afterburning engines reach military power at 0.7 and full afterburner at 1.
// Sea-level static figures; fuel flow uses typical specific fuel consumption for the engine type.
const MIL = 0.7;
function perfAt(ac, thr, load, fuelFrac = 1) {
  const e = ac.eng, ab = !!e.wet, mil = ab ? MIL : 1;
  let T, sfc, zone = 0, state;
  const [sd, sw] = e.sfc || (ab ? [0.76, 2.0] : [0.6, 0.6]);
  if (thr <= mil) {
    const u = thr / mil;
    T = e.dry * (0.04 + 0.96 * u ** 1.6);
    sfc = sd * (1 + 0.25 * (1 - u));
    state = u < 0.02 ? 'Idle' : u > 0.985 ? 'Military power' : 'Dry ' + Math.round(u * 100) + '%';
  } else {
    const u = (thr - mil) / (1 - mil);
    T = e.dry + (e.wet - e.dry) * (0.35 + 0.65 * u);
    sfc = lerp(sw * 0.85, sw, u);
    zone = Math.max(1, Math.ceil(u * (e.zones || 5)));
    state = u > 0.985 ? 'Maximum afterburner' : 'Afterburner zone ' + zone;
  }
  const lm = loadoutMass(ac, load || {});
  const fuelInt = ac.wt.fuel * fuelFrac, fuel = fuelInt + lm.fuel * fuelFrac;
  const crew = (ac.crew || 1) * 100;
  const gross = ac.wt.empty + crew + fuelInt + lm.kg + lm.fuel * fuelFrac;
  const Ttot = T * e.n;                         // kN
  const flow = Ttot * sfc * 101.97 / 3600;       // kg/s, from lb/(lbf h)
  let power = null;
  if (e.type === 'turboprop') power = e.kw * e.n * (0.04 + 0.96 * (thr) ** 1.6);
  return {
    T, Ttot, sfc, flow, state, zone, ab, afterburner: thr > mil,
    gross, fuel, stores: lm.kg, extFuel: lm.fuel * fuelFrac, crew, overload: gross > ac.wt.mtow,
    tw: Ttot * 1000 / (gross * 9.80665), twMax: (e.wet || e.dry) * e.n * 1000 / (gross * 9.80665),
    wl: gross / ac.dims.wingArea, endurance: fuel / Math.max(flow, 1e-6) / 60, power,
  };
}

// ---- national markings: roundels on the wings, stars on the fins

const INSIGNIA = {
  us: { wing: [['star', 1, 'insig']], where: 'us' },
  usColor: { wing: [['disc', 1, 'blue'], ['star', 0.9, 'white']], where: 'us' },
  ru: { wing: [['star', 1, 'white'], ['star', 0.78, 'red']], fin: true },
  cn: { wing: [['star', 1, 'yellow'], ['star', 0.78, 'red']], fin: true },
  fr: { wing: [['disc', 1, 'blue'], ['disc', 0.66, 'white'], ['disc', 0.33, 'red']] },
  uk: { wing: [['disc', 1, 'blue'], ['disc', 0.45, 'red']] },
  se: { wing: [['disc', 1, 'blue'], ['disc', 0.5, 'yellow']] },
};
function insigniaFor(ac) {
  if (ac.insignia) return INSIGNIA[ac.insignia];
  const c = ac.country;
  if (/Soviet|Russia/.test(c)) return INSIGNIA.ru;
  if (/China/.test(c)) return INSIGNIA.cn;
  if (/France/.test(c)) return INSIGNIA.fr;
  if (/UK|United Kingdom/.test(c)) return INSIGNIA.uk;
  if (/Sweden/.test(c)) return INSIGNIA.se;
  return INSIGNIA.us;
}

// Flat layered disc or five-point star lying on a surface (centre c, unit normal n).
function decal(M, c, n, r, layers, lift = 0) {
  let a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const nm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const e1 = nm(cr(n, a)), e2 = nm(cr(n, e1));
  M.part();
  layers.forEach(([shape, f, mat], li) => {
    const off = lift + 0.015 * (li + 1), rr = r * f, pts = [];
    const N = shape === 'star' ? 10 : 18;
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2 + Math.PI / 2, rad = shape === 'star' ? (k % 2 ? rr * 0.4 : rr) : rr;
      const u = Math.cos(ang) * rad, v = Math.sin(ang) * rad;
      pts.push(M.vert(c[0] + e1[0] * u + e2[0] * v + n[0] * off, c[1] + e1[1] * u + e2[1] * v + n[1] * off, c[2] + e1[2] * u + e2[2] * v + n[2] * off));
    }
    const ctr = M.vert(c[0] + n[0] * off, c[1] + n[1] * off, c[2] + n[2] * off);
    for (let k = 0; k < N; k++) M.tri(ctr, pts[k], pts[(k + 1) % N], mat);
  });
}

function markings(M, ac, panels) {
  const ins = insigniaFor(ac);
  if (!ins) return;
  const wingP = panels.filter(q => q.p.name === 'wing');
  for (const { secs, zs } of wingP) {
    const A = secs[0], B = secs[secs.length - 1];
    const f = ac.cat === 'Bomber' ? 0.62 : 0.66;
    for (const side of [1, -1]) {
      // US practice: star on the upper left and lower right wing only
      if (ins.where === 'us' && !((side > 0 && zs < 0) || (side < 0 && zs > 0))) continue;
      const pt = panelPoint(secs, f, 0.45, side);
      const chord = [B.te[0] - B.le[0], 0, B.te[2] - B.le[2]], span = [B.le[0] - A.le[0], B.le[1] - A.le[1], B.le[2] - A.le[2]];
      let n = [chord[1] * span[2] - chord[2] * span[1], chord[2] * span[0] - chord[0] * span[2], chord[0] * span[1] - chord[1] * span[0]];
      const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
      if (Math.sign(n[1]) !== side) n = n.map(x => -x);
      const r = clamp(pt[3] * 0.24, 0.35, 2.4), u = r / pt[3], t = lerp(A.t, B.t, f);
      const lift = (afT(0.45) - Math.min(afT(Math.max(0.01, 0.45 - u)), afT(Math.min(0.99, 0.45 + u)))) * t * pt[3] + 0.02;
      decal(M, [pt[0], pt[1], pt[2]], n, r, ins.wing, lift);
    }
  }
  if (!ins.fin) return;
  for (const { secs } of panels) {
    const A = secs[0], B = secs[secs.length - 1];
    const dy = B.le[1] - A.le[1], dz = B.le[2] - A.le[2];
    if (Math.abs(dy) < Math.abs(dz) * 1.5 || dy < 0.8) continue;   // fins only
    const f = 0.5, le = [0, 1, 2].map(k => lerp(A.le[k], B.le[k], f)), te = [0, 1, 2].map(k => lerp(A.te[k], B.te[k], f));
    const c = [0, 1, 2].map(k => lerp(le[k], te[k], 0.45)), ch = Math.hypot(te[0] - le[0], te[2] - le[2]);
    const d = [dz, 0, 0], span = [0, dy, dz];
    let n = [0, -dz, dy]; const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    const t = afT(0.45) * lerp(A.t, B.t, f) * ch;
    const r = clamp(ch * 0.22, 0.3, 1.6), u = r / ch, tt = lerp(A.t, B.t, f);
    const lift = (afT(0.45) - Math.min(afT(Math.max(0.01, 0.45 - u)), afT(Math.min(0.99, 0.45 + u)))) * tt * ch + 0.02;
    for (const sg of [1, -1]) decal(M, [c[0] + n[0] * t * sg, c[1] + n[1] * t * sg, c[2] + n[2] * t * sg], n.map(x => x * sg), r, ins.wing, lift);
  }
}

// Rotary cannon seen from outside (the A-10's GAU-8): a ring of barrels held by a muzzle clamp and a
// mid-barrel support, running back into the nose. s0 muzzle, s1 where the barrels enter the fuselage.
function gatling(M, p, L) {
  const x0 = L / 2 - p.s0, x1 = L / 2 - p.s1, tf = (a, b, c) => [a, b + p.y, c + (p.z || 0)];
  for (let i = 0; i < p.n; i++) {
    const a = i / p.n * Math.PI * 2, by = Math.cos(a) * p.rc, bz = Math.sin(a) * p.rc;
    loft(M, [[0, p.rb, p.rb, p.rb, by, 2], [x0 - x1, p.rb * 1.1, p.rb * 1.1, p.rb * 1.1, by, 2]],
      { x0, seg: 6, mat: 'metal', capF: 'hole', tf: (q, b, c) => tf(q, b, c + bz) });
  }
  const R = p.rc + p.rb + 0.02;
  for (const [ds, w] of [[0.05, 0.05], [(p.s1 - p.s0) * 0.45, 0.04]])
    loft(M, [[0, R, R, R], [w, R, R, R]], { x0: x0 - ds, seg: 14, mat: 'dark', capF: 'dark', capB: 'dark', tf });
  loft(M, [[0, p.rc * 0.45, p.rc * 0.45, p.rc * 0.45], [x0 - x1, p.rc * 0.45, p.rc * 0.45, p.rc * 0.45]], { x0: x0 - 0.02, seg: 8, mat: 'dark', tf });
}

// ---- landing gear: struts and wheels down to the floor

// Canopy seated on the fuselage top line: keeps the authored length and width, raises the bubble
// to the given height above the spine (windscreen steeper than the rear).
// Top and bottom of the main fuselage at s (round loft or faceted ploft).
function mainBody(ac) {
  return ac.geo.find(p => (p.t === 'loft' || p.t === 'ploft') && !p.z && p.fine !== 0 && p.mat !== 'glass' && p.mat !== 'gold') || ac.geo[0];
}
function bodyExtent(ac, s) {
  const f = mainBody(ac);
  const ext = f.t === 'ploft'
    ? f.st.map(([ss, pts, yc = 0]) => [ss, yc + Math.max(...pts.map(q => q[1])), yc + Math.min(...pts.map(q => q[1]))])
    : f.st.map(q => [q[0], (q[4] || 0) + q[2], (q[4] || 0) - q[3]]);
  if (s <= ext[0][0]) return { top: ext[0][1], bot: ext[0][2] };
  for (let i = 0; i + 1 < ext.length; i++) if (s >= ext[i][0] && s <= ext[i + 1][0]) {
    const u = (s - ext[i][0]) / ((ext[i + 1][0] - ext[i][0]) || 1);
    return { top: lerp(ext[i][1], ext[i + 1][1], u), bot: lerp(ext[i][2], ext[i + 1][2], u) };
  }
  const e = ext[ext.length - 1];
  return { top: e[1], bot: e[2] };
}
const fuselageTop = (ac, s) => bodyExtent(ac, s).top;
function bubbleStations(ac, st, h) {
  const s0 = st[0][0], s1 = st[st.length - 1][0], w = Math.max(...st.map(x => x[1])), out = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, pk = 0.32;
    const prof = u < pk ? Math.sin(u / pk * Math.PI / 2) ** 0.7 : Math.cos((u - pk) / (1 - pk) * Math.PI / 2) ** 0.55;
    const s = lerp(s0, s1, u), base = fuselageTop(ac, s) - 0.08;
    out.push([s, Math.max(0.03, w * (0.35 + 0.65 * prof ** 0.6)), Math.max(0.02, h * prof), 0.08, base, 2.2]);
  }
  return out;
}

const fuselageBottom = (ac, s) => bodyExtent(ac, s).bot;

function landingGear(M, ac, groundY) {
  const L = ac.dims.len, big = ac.cat === 'Bomber';
  const legs = ac.gear || [
    { s: 0.19 * L, z: 0, r: big ? 0.5 : 0.28, n: big ? 2 : 1 },
    { s: 0.6 * L, z: clamp(ac.dims.span * 0.13, 1.1, 3.6), r: big ? 0.62 : 0.38, n: big ? 4 : 1, mirror: true },
  ];
  for (const g of legs) for (const zs of g.mirror ? [1, -1] : [1]) {
    const x = L / 2 - g.s, z = g.z * zs, r = g.r, w = r * 0.62;
    const top = g.y ?? fuselageBottom(ac, g.s) + 0.15, hub = groundY + r;
    M.part();
    const sr = Math.max(0.06, r * 0.22);
    loft(M, [[0, sr, sr, sr], [top - hub, sr * 0.8, sr * 0.8, sr * 0.8]], { seg: 8, mat: 'strut', tf: (a, b, c) => [x + b, top + a, z + c] });
    const wheels = g.n === 4 ? [[r * 1.15, -1], [r * 1.15, 1], [-r * 1.15, -1], [-r * 1.15, 1]] : g.n === 2 ? [[0, -1], [0, 1]] : [[0, 0]];
    if (g.n === 4) loft(M, [[0, 0.08, 0.08, 0.08], [r * 2.6, 0.08, 0.08, 0.08]], { seg: 6, mat: 'strut', x0: x + r * 1.3, tf: (a, b, c) => [a, hub + b, z + c] });
    for (const [dx, dzs] of wheels) {
      const cx = x + dx, cz = z + dzs * (w / 2 + sr + 0.03);
      M.part();
      loft(M, [[0, r * 0.55, r * 0.55, r * 0.55], [0.03, r * 0.95, r * 0.95, r * 0.95], [w * 0.5, r, r, r], [w - 0.03, r * 0.95, r * 0.95, r * 0.95], [w, r * 0.55, r * 0.55, r * 0.55]],
        { seg: 14, mat: 'tire', capF: 'strut', capB: 'strut', tf: (a, b, c) => [cx + c, hub + b, cz - a - w / 2] });
    }
  }
}
