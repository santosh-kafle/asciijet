// Screenshot the built page (needs Playwright): node tools/shot.cjs <aircraft> <out.png> [width] [height] [waitMs] [js]
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const [hash = 'f16', out = 'shot.png', w = 1440, h = 900, wait = 4000, js = ''] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + __dirname + '/../dist/index.html#' + hash);
  await p.waitForTimeout(+wait);
  if (js) { await p.evaluate(js); await p.waitForTimeout(1500); }
  const clip = process.env.CLIP ? Object.fromEntries(['x','y','width','height'].map((k, i) => [k, +process.env.CLIP.split(',')[i]])) : undefined;
  await p.screenshot({ path: out, clip });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
