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
  const L = ac.dims.len, M = new Mesh(), exhausts = [], props = [];
  const sweep = o.sweep ?? ac.sweep?.def;
  const secsByName = {};
  const bays = o.bays ?? false;
  const load = o.loadout || {};

  // Airframe
  for (const p of ac.geo) {
    for (const zs of p.mirror ? [1, -1] : [1]) {
      if (p.t === 'loft') {
        let st = p.st;
        if (p.fine) { // resample long fuselages so bay cutouts stay close to the bay outline
          const out = [st[0]];
          for (let i = 1; i < st.length; i++) {
            const a = st[i - 1], b = st[i], k = Math.max(1, Math.ceil((b[0] - a[0]) / p.fine));
            for (let j = 1; j <= k; j++) out.push(a.map((v, q) => q === 5 ? lerp(a[5] ?? 2, b[5] ?? 2, j / k) : lerp(v ?? (q === 4 ? 0 : 2), b[q] ?? (q === 4 ? 0 : 2), j / k)));
          }
          st = out;
        }
        loft(M, st, { x0: L / 2, z: (p.z || 0) * zs, seg: p.seg, mat: p.mat, mats: p.mats, capF: p.capF, capB: p.capB, tf: p.tf });
      } else if (p.t === 'panel') {
        let secs = panelSections(p, L, sweep);
        if (zs < 0) secs = secs.map(s => ({ ...s, le: [s.le[0], s.le[1], -s.le[2]], te: [s.te[0], s.te[1], -s.te[2]] }));
        if (p.name && zs > 0) secsByName[p.name] = secs;
        panel(M, secs, { mat: p.mat });
      } else if (p.t === 'noz') exhausts.push(nozzle(M, p, L, zs));
      else if (p.t === 'prop') props.push(propeller(M, p, L, zs));
    }
  }

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
      storeMesh(M, S, (x, y, z) => [cx + S.L / 2 + x, yy + y * cr - z * sr, zz + y * sr + z * cr], tag);
      cy += yy;
    }
    labels.push({ tag, st, side: I.side, S, n, p: [ax, cy / offs.length, az] });
  });

  // Cut open bays: drop airframe skin triangles in the bay footprint below the ceiling.
  if (cut.length) {
    const V = M.v, T = M.t, keep = { t: [], m: [], g: [] };
    for (let i = 0; i < M.m.length; i++) {
      const a = T[i * 3] * 3, b = T[i * 3 + 1] * 3, c = T[i * 3 + 2] * 3;
      const x = (V[a] + V[b] + V[c]) / 3, y = (V[a + 1] + V[b + 1] + V[c + 1]) / 3, z = (V[a + 2] + V[b + 2] + V[c + 2]) / 3;
      const skin = M.g[i] === 0 && (M.m[i] === MAT_ID.skin || M.m[i] === MAT_ID.skin2 || M.m[i] === MAT_ID.dark);
      if (skin && cut.some(k => x > k.x0 && x < k.x1 && Math.abs(z - k.z) < k.w && y < k.y + 0.05)) continue;
      keep.t.push(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]); keep.m.push(M.m[i]); keep.g.push(M.g[i]);
    }
    M.t = keep.t; M.m = keep.m; M.g = keep.g;
  }

  const mesh = M.finish();
  let R = 0, minY = 0;
  for (let i = 0; i < mesh.V.length; i += 3) {
    R = Math.max(R, Math.hypot(mesh.V[i], mesh.V[i + 1], mesh.V[i + 2]));
    minY = Math.min(minY, mesh.V[i + 1]);
  }
  return { mesh, exhausts, props, labels, inst, R, minY };
}

function pylon(M, x, y, z, h, ch, tag) {
  panel(M, [{ le: [x + ch / 2, y + 0.05, z], te: [x - ch / 2, y + 0.05, z], t: 0.1 }, { le: [x + ch / 2 - 0.1, y - h, z], te: [x - ch / 2 + 0.05, y - h, z], t: 0.1 }].map(s => ({ ...s, le: [s.le[0], s.le[1], s.le[2]], te: [s.te[0], s.te[1], s.te[2]] })), { mat: 'skin2', tag });
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
