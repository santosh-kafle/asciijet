// Loadout sheet: a stores loading chart in span order, and a detail card for one weapon with its
// own spinning ASCII model rendered by a second Renderer.
const sheet = { open: false, key: null, R: null, scene: null, geom: null, yaw: 0.6 };
const sheetCanvas = $('#sheetView'), sheetCtx = sheetCanvas.getContext('2d', { alpha: false });

function openSheet(key) {
  sheet.open = true; $('#sheet').hidden = false; sheet.scene = null;
  const first = loadoutMass(state.ac, state.load).rows.sort((a, b) => b.kg - a.kg)[0];
  renderSheet();
  selectStore(key || sheet.keep || first?.S.key || stationOptions(state.ac, state.ac.stations[0])[0]?.key);
}
function closeSheet() { sheet.open = false; $('#sheet').hidden = true; }

function renderSheet() {
  const ac = state.ac, lo = state.custom ? { name: 'Custom' } : ac.loadouts[state.loadIdx];
  const p = perfAt(ac, 1, state.load, state.fuel), lm = loadoutMass(ac, state.load);
  $('#sheetTitle').innerHTML = `${ac.short} <span>· ${lo.name}</span>`;
  $('#sheetSum').innerHTML = [
    [lm.n, 'stores'], [fmt(p.stores) + ' kg', 'weapons and pods'], [fmt(p.extFuel) + ' kg', 'fuel in drop tanks'],
    [ac.payload ? fmt((p.stores + lm.fuel) / ac.payload * 100) + '%' : '–', 'of max payload'],
    [fmt(p.gross) + ' kg', 'take-off weight'], [fmt(p.twMax, 2), 'T/W, full ' + (hasAB(ac) ? 'reheat' : 'power')],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

  // Loading chart: every station instance, left wingtip to right wingtip.
  const secs = {};
  const L = ac.dims.len;
  for (const g of ac.geo) if (g.t === 'panel' && g.name) secs[g.name] = panelSections(g, L, state.sweep ?? ac.sweep?.def);
  const inst = stationInstances(ac, secs).sort((a, b) => a.p[2] - b.p[2] || a.p[0] - b.p[0]);
  $('#chart').innerHTML = inst.map(I => {
    const st = I.st, ld = normLoad(state.load[st.id]), S = ld && STORES[ld.key];
    const side = I.side === 'L' ? 'left' : I.side === 'R' ? 'right' : I.p[2] < -0.3 ? 'left' : I.p[2] > 0.3 ? 'right' : 'centre';
    const kind = { bay: 'internal bay', rail: 'rail', conf: 'conformal', semi: 'semi-recessed' }[st.kind] || 'pylon';
    return `<button class="stc ${S ? '' : 'empty'} ${S && S.key === sheet.key ? 'on' : ''} ${st.kind === 'bay' ? 'bay' : ''}" ${S ? `data-store="${S.key}"` : 'disabled'}>
      <span class="sid">${st.id}</span><span class="sk">${side} · ${kind}</span>
      <span class="line"></span>
      ${S ? `<b>${S.key}</b><span class="n">${ld.n > 1 ? '× ' + ld.n : '× 1'}</span><span class="cat" style="--c:${catColor(S.cat)}">${S.cat}</span><span class="kg">${fmt((S.kg + (S.fuel || 0)) * ld.n)} kg</span>`
        : `<b class="none">empty</b><span class="kg">${st.max ? 'max ' + fmt(st.max) + ' kg' : ''}</span>`}
    </button>`;
  }).join('');
  $$('#chart [data-store]').forEach(b => b.onclick = () => { selectStore(b.dataset.store); audio.click(); });

  // By category
  const cats = {};
  for (const r of lm.rows) { const c = cats[r.S.cat] ||= { n: 0, kg: 0 }; c.n += r.n * r.sides; c.kg += r.kg; }
  const tot = Object.values(cats).reduce((s, c) => s + c.kg, 0) || 1;
  $('#sheetCats').innerHTML = Object.keys(cats).length
    ? `<div class="bar">${Object.entries(cats).map(([k, c]) => `<i style="width:${(c.kg / tot * 100).toFixed(2)}%;background:${catColor(k)}"></i>`).join('')}</div>
       <div class="legend">${Object.entries(cats).map(([k, c]) => `<span style="--c:${catColor(k)}">${k}: ${c.n}, ${fmt(c.kg)} kg</span>`).join('')}</div>`
    : '<p class="note">Clean: nothing on the stations.</p>';

  // Everything this aircraft carries in any preset
  const cleared = [...new Set(ac.loadouts.flatMap(l => Object.values(l.set).map(v => normLoad(v).key)))].map(k => STORES[k]).filter(Boolean)
    .sort((a, b) => STORE_CATS.indexOf(a.cat) - STORE_CATS.indexOf(b.cat));
  $('#sheetCleared').innerHTML = cleared.map(S => `<button class="chip ${S.key === sheet.key ? 'on' : ''}" data-store="${S.key}" style="border-left:3px solid ${catColor(S.cat)}">${S.key}</button>`).join('');
  $$('#sheetCleared [data-store]').forEach(b => b.onclick = () => { selectStore(b.dataset.store); audio.click(); });
}

const CAT_COLORS = { 'Air-to-air': '#8fcbe0', 'Air-to-surface': '#e0a96d', 'Anti-radiation': '#d98ad0', 'Anti-ship': '#6fb3d9', 'Cruise missile': '#ffb04a', 'Air-launched ballistic': '#ff6b57', 'Guided bomb': '#c8b560', 'Bomb': '#9aa36b', 'Cluster bomb': '#b58a5a', 'Nuclear': '#ff7a2e', 'Fuel tank': '#7fd49a', 'Targeting pod': '#a9b6bf', 'Sensor pod': '#a9b6bf', 'Jamming pod': '#a9b6bf' };
const catColor = c => CAT_COLORS[c] || '#a9b6bf';

function selectStore(key) {
  const S = STORES[key]; if (!S) return;
  sheet.key = key; sheet.keep = key;
  $$('#chart .stc, #sheetCleared .chip').forEach(b => b.classList.toggle('on', b.dataset.store === key));
  // one-store scene for the viewer
  const M = new Mesh();
  storeMesh(M, S, (x, y, z) => [x + S.L / 2, y, z], 1);
  const mesh = M.finish();
  let r = 0; for (let i = 0; i < mesh.V.length; i += 3) r = Math.max(r, Math.hypot(mesh.V[i], mesh.V[i + 1], mesh.V[i + 2]));
  sheet.scene = { mesh, exhausts: [], props: [], labels: [], R: r, minY: -S.d };
  sizeSheetView();
  sheet.R.setScene(sheet.scene, { paint: '#9aa3aa', paint2: '#6f7a82', eng: {} });

  const ac = state.ac, ld = Object.entries(state.load).map(([id, v]) => [id, normLoad(v)]).filter(([, v]) => v.key === key);
  const onboard = ld.reduce((s, [id, v]) => s + v.n * ((ac.stations.find(x => x.id === id) || {}).mirror ? 2 : 1), 0);
  const carriers = AIRCRAFT.filter(a => a.loadouts.some(l => Object.values(l.set).some(v => normLoad(v).key === key)));
  const row = (k, v) => v == null || v === '' ? '' : `<tr><th>${k}</th><td>${v}</td></tr>`;
  $('#storeCard').innerHTML = `
    <div class="eyebrow"><span class="tag" style="background:${catColor(S.cat)}">${S.cat}</span><span>${S.origin || ''}${S.year ? ' · ' + S.year : ''}</span></div>
    <h3>${S.name}${S.est ? ESTX : ''}</h3>
    ${onboard ? `<p class="note">${onboard} on board: stations ${ld.map(([id]) => id).join(', ')}.</p>` : '<p class="note">Not in the current loadout.</p>'}
    <table>
      ${row('Guidance', S.guide)}${row('Range', S.range)}${row('Top speed', S.spd)}${row('Warhead', S.wh)}${row('Propulsion', S.prop)}
      ${row('Mass', fmt(S.kg) + ' kg' + (S.fuel ? ` empty, ${fmt(S.kg + S.fuel)} kg full (${fmt(S.fuel)} kg of fuel)` : ''))}
      ${row('Length', fmt(S.L, 2) + ' m')}${row('Diameter', fmt(S.d * 1000) + ' mm')}${row('Fin or wing span', S.span ? fmt(S.span, 2) + ' m' : '')}
      ${row('Maker', S.maker)}${row('Note', S.note)}
    </table>
    <h4>Carried in this atlas by</h4>
    <div class="chips">${carriers.map(a => `<button class="chip ${a === ac ? 'on' : ''}" data-ac="${a.key}">${a.short}</button>`).join('')}</div>`;
  $$('#storeCard [data-ac]').forEach(b => b.onclick = () => { selectAircraft(b.dataset.ac); renderSheet(); selectStore(key); });
}

function sizeSheetView() {
  const r = sheetCanvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const fs = clamp(Math.round(r.width / 90 / 0.6), 7, 12);
  sheetCtx.font = `600 ${fs}px ${FONT}`;
  const cw = sheetCtx.measureText('M').width || fs * 0.6, ch = cw * 2;
  sheetCanvas.width = Math.round(r.width * dpr); sheetCanvas.height = Math.round(r.height * dpr);
  const cols = Math.max(20, Math.floor(r.width / cw)), rows = Math.max(8, Math.floor(r.height / ch));
  if (!sheet.R) { sheet.R = new Renderer(cols, rows); sheet.R.match = R.match; } else sheet.R.resize(cols, rows);
  sheet.geom = { cw, ch, fs, w: r.width, h: r.height, dpr, ox: (r.width - cols * cw) / 2, oy: (r.height - rows * ch) / 2 };
}

function drawSheet(dt) {
  if (!sheet.scene || !sheet.R) return;
  sheet.yaw += dt * 0.5;
  const R2 = sheet.R, W = R2.cols * SX, H = R2.rows * SY, fov = 28;
  const foc = (H / 2) / Math.tan(fov * D2R / 2);
  const dist = sheet.scene.R * foc / (Math.min(W, H * 1.9) / 2 * 0.72);
  const c = makeCam({ yaw: sheet.yaw, pitch: 0.32 + 0.12 * Math.sin(sheet.yaw * 0.7), dist, W, H, fov });
  R2.render(c, { throttle: 0, time: 0, ground: false, spin: false });
  drawGrid(sheetCtx, R2, sheet.geom, 0);
}

function initSheet() {
  $('#sheetBtn').onclick = () => openSheet();
  $('#sheetClose').onclick = closeSheet;
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
  addEventListener('resize', () => { if (sheet.open && sheet.key) selectStore(sheet.key); });
}
