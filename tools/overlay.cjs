// Paint a model's silhouette over a published three-view so shape errors can be measured.
//   node tools/fetch-refs.cjs && node build.mjs && node tools/overlay.cjs [key,...]   -> tools/out/overlay-<key>.png
// Calibration lives in tools/refs.json: per aircraft an image path and, per view, two pixel points:
//   top / side: a = nose tip, b = tail (rearmost point, on the centreline)
//   front: a = left wingtip, b = right wingtip (as seen head-on; wingtip height is matched)
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const eng = fs.readFileSync(path.join(__dirname, '../dist/engine.cjs'), 'utf8').replace(/module\.exports = /, 'window.E = ');
const refs = JSON.parse(fs.readFileSync(path.join(__dirname, 'refs.json'), 'utf8'));
const only = (process.argv[2] || '').split(',').filter(Boolean);
const html = `<body style="margin:0"><canvas id=c></canvas><script>${eng}
window.draw = async (key, ref, src) => {
  const ac = E.AIRCRAFT.find(a => a.key === key);
  const img = new Image(); img.src = src; await img.decode();
  // calibration points were taken on an image ref.w pixels wide; rescale if Commons served another size
  const f = ref.w ? img.width / ref.w : 1;
  for (const v of ['top', 'side', 'front']) if (ref[v]) ref[v] = { a: ref[v].a.map(q => q * f), b: ref[v].b.map(q => q * f) };
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  cv.width = img.width; cv.height = img.height;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
  const sc = E.buildScene(ac, { loadout: {}, gear: false, detail: 3 });
  const m = sc.mesh, V = m.V, T = m.T, L = ac.dims.len;
  let xmax = -1e9, xmin = 1e9, ynose = 0, zmax = 0, ytip = 0;
  for (let i = 0; i < V.length; i += 3) {
    if (V[i] > xmax) { xmax = V[i]; ynose = V[i + 1]; }
    xmin = Math.min(xmin, V[i]);
    if (V[i + 2] > zmax) { zmax = V[i + 2]; ytip = V[i + 1]; }
  }
  const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
  const o = off.getContext('2d');
  for (const view of ['top', 'side', 'front']) {
    const c = ref[view]; if (!c) continue;
    const [ax, ay] = c.a, [bx, by] = c.b, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    let px = -uy, py = ux; if (view !== 'top' && py > 0) { px = -px; py = -py; }   // perpendicular, pointing up
    let P;
    if (view === 'front') {
      const k = len / (2 * zmax), mx = (ax + bx) / 2, my = (ay + by) / 2;
      P = (x, y, z) => [mx + ux * z * k + px * (y - ytip) * k, my + uy * z * k + py * (y - ytip) * k];
    } else {
      const k = len / L;   // scale from the published length, so overruns show up
      P = view === 'top'
        ? (x, y, z) => [ax + ux * (xmax - x) * k + px * z * k, ay + uy * (xmax - x) * k + py * z * k]
        : (x, y, z) => [ax + ux * (xmax - x) * k + px * (y - ynose) * k, ay + uy * (xmax - x) * k + py * (y - ynose) * k];
    }
    o.clearRect(0, 0, off.width, off.height); o.fillStyle = view === 'top' ? '#e0201a' : view === 'side' ? '#1a5fe0' : '#10a040';
    for (let t = 0; t < T.length; t += 3) {
      const a = P(V[T[t] * 3], V[T[t] * 3 + 1], V[T[t] * 3 + 2]), b = P(V[T[t + 1] * 3], V[T[t + 1] * 3 + 1], V[T[t + 1] * 3 + 2]), d = P(V[T[t + 2] * 3], V[T[t + 2] * 3 + 1], V[T[t + 2] * 3 + 2]);
      o.beginPath(); o.moveTo(...a); o.lineTo(...b); o.lineTo(...d); o.closePath(); o.fill(); o.lineWidth = 0.6; o.strokeStyle = o.fillStyle; o.stroke();
    }
    g.globalAlpha = 0.38; g.drawImage(off, 0, 0); g.globalAlpha = 1;
    // metre grid: stations every metre (labelled every 2), offsets every metre
    g.lineWidth = 1; g.font = '11px sans-serif'; g.fillStyle = '#0a0';
    const H = view === 'top' ? Math.ceil(ac.dims.span / 2) : 3;
    const line = (p, q, c) => { g.strokeStyle = c; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); };
    if (view === 'front') {
      for (let z = -H; z <= H; z++) line(P(0, ytip - 3, z), P(0, ytip + 4, z), z ? 'rgba(0,160,0,.25)' : 'rgba(0,160,0,.6)');
      for (let y = -3; y <= 4; y++) line(P(0, ytip + y, -H), P(0, ytip + y, H), 'rgba(0,160,0,.25)');
    } else {
      const y0 = view === 'top' ? 0 : ynose, lo = view === 'top' ? -H : -2, hi = view === 'top' ? H : 4;
      const Q = (sv, o) => view === 'top' ? P(xmax - sv, 0, o) : P(xmax - sv, y0 + o, 0);
      for (let sv = 0; sv <= L + 0.01; sv++) { line(Q(sv, lo), Q(sv, hi), sv % 5 ? 'rgba(0,160,0,.22)' : 'rgba(0,160,0,.55)'); if (sv % 2 === 0) g.fillText(sv, ...Q(sv, lo - 0.3)); }
      for (let o = lo; o <= hi; o++) { line(Q(0, o), Q(L, o), o ? 'rgba(0,160,0,.22)' : 'rgba(0,160,0,.6)'); g.fillText(o, ...Q(-0.6, o)); }
    }
  }
  g.drawImage(img, 0, 0, 0, 0);
};
</script>`;
(async () => {
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent(html);
  const keys = only.length ? only : Object.keys(refs);
  for (const k of keys) {
    const r = refs[k]; if (!r) { console.log('no reference for', k); continue; }
    const file = path.isAbsolute(r.img) ? r.img : path.join(__dirname, r.img);
    if (!fs.existsSync(file)) { console.log('missing', r.img, '- run node tools/fetch-refs.cjs'); continue; }
    const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    await p.evaluate(([k, r, s]) => window.draw(k, r, s), [k, r, src]);
    await (await p.$('#c')).screenshot({ path: path.join(out, `overlay-${k}.png`) });
  }
  console.log(errs.length ? errs.join('\n') : `${keys.length} overlays in tools/out`);
  await b.close();
})();
