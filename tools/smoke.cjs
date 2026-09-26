// Browser smoke test: every aircraft, tab and preset; bays, custom station, compare, sweep.
// Needs Playwright: node tools/smoke.cjs
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + __dirname + '/../dist/index.html');
  await p.waitForTimeout(1500);
  const keys = await p.evaluate(() => [...document.querySelectorAll('#list button')].map(b => b.dataset.key));
  for (const k of keys) {
    await p.click(`#list button[data-key="${k}"]`);
    for (const tab of ['engine', 'specs', 'about', 'loadout']) { await p.click(`#tabs [data-tab="${tab}"]`); await p.waitForTimeout(60); }
    const n = await p.$$eval('#pane .preset', e => e.length);
    for (let i = 0; i < n; i++) { await p.click(`#pane [data-lo="${i}"]`); await p.waitForTimeout(40); }
    if (await p.isVisible('#baysBtn')) { await p.click('#baysBtn'); await p.waitForTimeout(80); await p.click('#baysBtn'); }
    const sel = await p.$('#pane select[data-st]');
    if (sel) { const opts = await sel.$$eval('option', o => o.map(x => x.value)); await sel.selectOption(opts[opts.length - 1]); await p.waitForTimeout(40); }
    if (await p.isVisible('#sweepBox')) { await p.fill('#sweep', '100'); await p.dispatchEvent('#sweep', 'input'); await p.waitForTimeout(60); }
    await p.keyboard.press('c');
  }
  await p.click('#cmpOpen'); await p.waitForTimeout(200);
  const rows = await p.$$eval('#cmpBody tr', r => r.length);
  await p.keyboard.press('Escape');
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 60) requestAnimationFrame(f); else r(60000 / (performance.now() - t0)); }; requestAnimationFrame(f); }));
  console.log(`${keys.length} aircraft exercised, compare rows ${rows}, ~${fps.toFixed(0)} fps (headless, software GL)`);
  console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'no errors');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
