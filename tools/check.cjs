// Data and render check: every preset uses known stores and stations, engine counts match the nozzles,
// every scene builds, and every aircraft draws (burner, gun, both ends of the wing sweep). Run after
// editing src/:
//   node build.mjs && node tools/check.cjs
const E = require('../dist/engine.cjs');
let bad = 0;
const err = (...a) => { bad++; console.log('  x', ...a); };
const keys = new Set();
for (const a of E.AIRCRAFT) {
  if (keys.has(a.key)) err(a.key, 'duplicate key'); keys.add(a.key);
  for (const f of ['name', 'short', 'role', 'cat', 'country', 'maker', 'first', 'intro', 'fact', 'dims', 'wt', 'eng', 'perf', 'geo', 'stations', 'loadouts'])
    if (a[f] == null) err(a.key, 'missing field', f);
  const ids = new Set(a.stations.map(s => s.id));
  for (const s of a.stations) if (s.on && !a.geo.some(p => p.name === s.on)) err(a.key, 'station', s.id, 'on unknown panel', s.on);
  for (const lo of a.loadouts) for (const [k, v] of Object.entries(lo.set)) {
    const key = Array.isArray(v) ? v[0] : v;
    if (!E.STORES[key]) err(a.key, lo.name, 'unknown store', key);
    if (!ids.has(k)) err(a.key, lo.name, 'unknown station', k);
  }
  for (const bays of [false, true]) for (const lo of a.loadouts) {
    const sc = E.buildScene(a, { loadout: lo.set, bays });
    if (!sc.mesh.nt || !isFinite(sc.R)) err(a.key, lo.name, 'empty scene');
    if (a.eng.type !== 'turboprop' && sc.exhausts.length !== a.eng.n) err(a.key, `${a.eng.n} engines but ${sc.exhausts.length} nozzles`);
  }
  const p = E.perfAt(a, 1, a.loadouts[0].set);
  if (!(p.Ttot > 0 && p.gross > 0)) err(a.key, 'bad performance numbers');
  // Draw it: 3/4, top and rear, at full burner with the gun firing, at each end of the wing sweep.
  const sweeps = a.sweep ? [a.sweep.min, a.sweep.max] : [undefined];
  for (const sweep of sweeps) {
    const sc = E.buildScene(a, { loadout: a.loadouts[0].set, sweep }), R = new E.Renderer(100, 40);
    R.setScene(sc, a);
    const dist = sc.R / Math.tan(16 * Math.PI / 180) * 1.05, tag = a.key + (sweep != null ? ` sweep ${sweep}` : '');
    for (const [yaw, pitch] of [[2.3, 0.32], [Math.PI / 2, 1.55], [Math.PI, 0.1]]) {
      try {
        const cam = E.makeCam({ yaw, pitch, dist, target: [0, 0, 0], W: 200, H: 160 });
        R.render(cam, { throttle: 1, time: 0.3, ground: true, groundY: sc.minY - 1.2, groundR: sc.R * 3, spin: true, gun: { bursts: [[0, null]] } });
      } catch (e) { err(tag, 'render threw:', e.message); continue; }
      let ink = 0;
      for (let c = 0; c < R.chars.length; c++) if (R.chars[c] !== 32) ink++;
      if (ink < 50) err(tag, `render nearly empty (${ink} cells) at yaw ${yaw.toFixed(2)}`);
      if (R.lum.some(v => !Number.isFinite(v))) err(tag, 'render produced NaN or infinite light');
    }
  }
}
console.log(`${E.AIRCRAFT.length} aircraft, ${Object.keys(E.STORES).length} stores: ${bad ? bad + ' problems' : 'all good'}`);
process.exit(bad ? 1 : 0);
