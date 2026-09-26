// One review image per aircraft: top, side, front 3/4, rear 3/4, plain shaded (not ASCII).
//   node build.mjs && node tools/review.cjs [key,key,...]   -> tools/out/review-<key>.png
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const eng = fs.readFileSync(path.join(__dirname, '../dist/engine.cjs'), 'utf8').replace(/module\.exports = /, 'window.E = ');
const only = (process.argv[2] || '').split(',').filter(Boolean);
const html = `<body style="margin:0;background:#fff"><canvas id=c></canvas><script>${eng}
const VW = 620, VH = 290, cv = document.getElementById('c'), g = cv.getContext('2d');
window.keys = E.AIRCRAFT.map(a => a.key);
window.draw = key => {
  const ac = E.AIRCRAFT.find(a => a.key === key);
  cv.width = VW * 2; cv.height = VH * 2 + 20;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  const sc = E.buildScene(ac, { loadout: {}, gear: true, detail: 3 });
  const R = new E.Renderer(VW / 2, VH / 4); R.setScene(sc, ac);
  const L = ac.dims.len, S = Math.max(ac.dims.span, L);
  const views = [[Math.PI / 2, 1.5699, S * 0.52], [Math.PI / 2, 0, L * 0.56], [0.7, 0.3, S * 0.5], [Math.PI - 0.7, 0.3, S * 0.5]];
  views.forEach(([yaw, pitch, half], i) => {
    const fov = 3, W = VW, H = VH, dist = half * (W > H * 2 ? 1 : 1) * H / W * 2.05 / Math.tan(fov * Math.PI / 360) * (i === 0 ? 1 : 1);
    const cam = E.makeCam({ yaw, pitch, dist: i === 0 ? half / Math.tan(fov * Math.PI / 360) * H / W * 2.1 : dist, W, H, fov });
    R.render(cam, { throttle: 0, time: 0, ground: false, spin: false });
    const img = g.createImageData(W, H);
    for (let k = 0; k < W * H; k++) {
      const v = R.z[k] === Infinity ? 255 : Math.max(20, Math.min(190, 30 + R.lum[k] * 150));
      img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, (i & 1) * VW, (i >> 1) * VH + 20);
    g.strokeStyle = '#ccc'; g.strokeRect((i & 1) * VW + 0.5, (i >> 1) * VH + 20.5, VW - 1, VH - 1);
  });
  g.fillStyle = '#000'; g.font = '14px sans-serif';
  g.fillText(ac.name + '   length ' + L + ' m, span ' + ac.dims.span + ' m, height ' + ac.dims.height + ' m   [top | side / front 3/4 | rear 3/4]', 6, 15);
};
</script>`;
(async () => {
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'review.html'), html);
  const b = await chromium.launch(), p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'review.html'));
  const keys = only.length ? only : await p.evaluate(() => window.keys);
  for (const k of keys) { await p.evaluate(k => window.draw(k), k); await (await p.$('#c')).screenshot({ path: path.join(out, `review-${k}.png`) }); }
  console.log(errs.length ? errs.join('\n') : `${keys.length} review images in tools/out`);
  await b.close();
})();
