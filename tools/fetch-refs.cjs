// Download the reference three-views listed in tools/refs.json from Wikimedia Commons into tools/ref/
// (not committed: they are third-party files). Needs Node 18+ for fetch.
//   node tools/fetch-refs.cjs [key,key,...]
const fs = require('fs'), path = require('path');
const refs = JSON.parse(fs.readFileSync(path.join(__dirname, 'refs.json'), 'utf8'));
const only = (process.argv[2] || '').split(',').filter(Boolean);
const UA = { 'User-Agent': 'jetatlas-refs/1.0 (reference drawings for model checking)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  }
  throw new Error('rate limited by Commons, try again later');
}

(async () => {
  const dir = path.join(__dirname, 'ref'); fs.mkdirSync(dir, { recursive: true });
  for (const [key, r] of Object.entries(refs)) {
    if (only.length && !only.includes(key)) continue;
    const out = path.join(__dirname, r.img);
    if (fs.existsSync(out)) { console.log('have', key); continue; }
    const q = new URLSearchParams({ action: 'query', titles: r.src, prop: 'imageinfo', iiprop: 'url', iiurlwidth: r.w, format: 'json' });
    const info = await (await get('https://commons.wikimedia.org/w/api.php?' + q)).json();
    const ii = Object.values(info.query.pages)[0].imageinfo?.[0];
    if (!ii) { console.log('not found', key, r.src); continue; }
    fs.writeFileSync(out, Buffer.from(await (await get(ii.thumburl || ii.url)).arrayBuffer()));
    console.log('saved', key, '<-', r.src);
    await sleep(1500);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
