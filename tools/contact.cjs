// Geometry review sheet: renders every aircraft top / side / front as plain shaded pixels
// (not ASCII) into tools/out/contact-N.png, six aircraft per sheet. Needs Playwright.
//   node build.mjs && node tools/contact.cjs [key,key,...]
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const eng = fs.readFileSync(path.join(__dirname, '../dist/engine.cjs'), 'utf8').replace(/module\.exports = /, 'window.E = ');
const only = (process.argv[2] || '').split(',').filter(Boolean);
const html = `<body style="margin:0;background:#fff"><canvas id=c></canvas><script>${eng}
const keys = ${JSON.stringify(only)};
const list = E.AIRCRAFT.filter(a => !keys.length || keys.includes(a.key));
const SIDE = location.hash === '#side', VW = SIDE ? 620 : 420, VH = SIDE ? 200 : 220, cv = document.getElementById('c'), g = cv.getContext('2d');
const PER = SIDE ? 10 : 6;
window.pages = Math.ceil(list.length / PER);
window.draw = page => {
  const part = list.slice(page * PER, page * PER + PER);
  const COLS = SIDE ? 2 : 1, rowsN = Math.ceil(part.length / COLS);
  cv.width = VW * (SIDE ? 2 : 3); cv.height = (VH + 18) * rowsN;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  part.forEach((ac, idx) => {
    const row = SIDE ? idx >> 1 : idx, ox = SIDE ? (idx & 1) * VW : 0;
    const sc = E.buildScene(ac, { loadout: {}, gear: false, detail: 3 });
    const R = new E.Renderer(VW / 2, VH / 4); R.setScene(sc, ac);
    (SIDE ? [[Math.PI / 2, 0]] : [[Math.PI / 2, 1.5707], [Math.PI / 2, 0], [0, 0.0001]]).forEach(([yaw, pitch], col) => {
      const fov = 3, W = VW, H = VH;
      const dist = (SIDE ? ac.dims.len * 0.56 * H / W * 1.02 : sc.R * 1.08) / Math.tan(fov * Math.PI / 360);
      const cam = E.makeCam({ yaw, pitch: Math.min(pitch, 1.5700), dist, W, H, fov });
      R.render(cam, { throttle: 0, time: 0, ground: false, spin: false });
      const img = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const z = R.z[i], l = R.lum[i];
        const v = z === Infinity ? 255 : Math.max(20, Math.min(190, 30 + l * 150));
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, ox + col * VW, row * (VH + 18) + 18);
      g.strokeStyle = '#ccc'; g.strokeRect(ox + col * VW + 0.5, row * (VH + 18) + 18.5, VW - 1, VH - 1);
    });
    g.fillStyle = '#000'; g.font = '13px sans-serif';
    g.fillText(ac.name + '   L ' + ac.dims.len + '  span ' + ac.dims.span + '  H ' + ac.dims.height + (SIDE ? '' : '    [top | side | front]'), ox + 4, row * (VH + 18) + 13);
  });
};
</script>`;
(async () => {
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'contact.html'), html);
  const b = await chromium.launch(), p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'contact.html') + (process.env.SIDE ? '#side' : ''));
  const n = await p.evaluate(() => window.pages);
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => window.draw(i), i);
    const el = await p.$('#c'); await el.screenshot({ path: path.join(out, `${process.env.SIDE ? 'side' : 'contact'}-${i + 1}.png`) });
  }
  console.log(errs.length ? errs.join('\n') : `${n} sheets in tools/out`);
  await b.close();
})();
