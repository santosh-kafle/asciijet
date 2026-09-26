// Data check: every preset uses known stores and stations, engine counts match the nozzles,
// every scene builds. Run after editing src/35-aircraft.js or src/36-bombers.js:
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
}
console.log(`${E.AIRCRAFT.length} aircraft, ${Object.keys(E.STORES).length} stores: ${bad ? bad + ' problems' : 'all good'}`);
process.exit(bad ? 1 : 0);
