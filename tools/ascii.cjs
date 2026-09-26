// Render one aircraft to text in the terminal: node tools/ascii.cjs f16 [yawDeg] [pitchDeg] [throttle] [loadoutIndex] [bays]
const E = require('../dist/engine.cjs');
const [key = 'f16', yaw = 35, pitch = 18, thr = 1, li = 0, bays = 0, cols = 150, rows = 50] = process.argv.slice(2);
const ac = E.AIRCRAFT.find(a => a.key === key);
const lo = ac.loadouts[+li] || { set: {} };
const sc = E.buildScene(ac, { loadout: lo.set, bays: !!+bays });
const R = new E.Renderer(+cols, +rows);
R.setScene(sc, ac);
const W = cols * 2, H = rows * 4;
const dist = sc.R / Math.tan(16 * Math.PI / 180) * 1.05;
const cam = E.makeCam({ yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, dist, target: [0, 0, 0], W, H });
const t0 = performance.now();
R.render(cam, { throttle: +thr, time: 0.3, ground: true, groundY: sc.minY - 1.2, groundR: sc.R * 3, spin: true });
const ms = performance.now() - t0;
console.log(R.text());
console.log(`${ac.name} tris=${sc.mesh.nt} R=${sc.R.toFixed(1)} render=${ms.toFixed(1)}ms`);
const p = E.perfAt(ac, +thr, lo.set, 1);
console.log(p.state, 'T', p.Ttot.toFixed(0), 'kN  gross', p.gross.toFixed(0), 'T/W', p.tw.toFixed(2), 'flow', p.flow.toFixed(2), 'kg/s');
