// Index, dossier tabs, live readouts, comparison, start-up.
const CATS = ['All', 'Fighter', 'Attack', 'Bomber'];
const CAT_LABEL = { All: 'All', Fighter: 'Fighters', Attack: 'Attack', Bomber: 'Bombers' };
const ESTX = '<span class="est" title="Open-source estimate">EST</span>';
const est = (ac, k) => (ac.est || []).includes(k) ? ESTX : '';
const maxThrust = ac => (ac.eng.wet || ac.eng.dry) * ac.eng.n;
const twRef = ac => maxThrust(ac) * 1000 / ((ac.wt.empty + ac.wt.fuel * 0.5 + (ac.crew || 1) * 100) * 9.80665);

function visibleList() {
  const q = state.q.trim().toLowerCase();
  let list = AIRCRAFT.filter(a => state.cat === 'All' || a.cat === state.cat);
  if (q) list = list.filter(a => {
    const stores = a.loadouts.flatMap(l => Object.values(l.set).map(v => (Array.isArray(v) ? v[0] : v))).map(k => (STORES[k]?.name || k)).join(' ');
    return [a.name, a.short, a.nick, a.variant, a.country, a.maker, a.role, a.eng.name, stores].join(' ').toLowerCase().includes(q);
  });
  const by = {
    cat: (a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.first - b.first,
    name: (a, b) => a.name.localeCompare(b.name), year: (a, b) => a.first - b.first,
    mach: (a, b) => b.perf.mach - a.perf.mach, thrust: (a, b) => maxThrust(b) - maxThrust(a),
    mtow: (a, b) => b.wt.mtow - a.wt.mtow, tw: (a, b) => twRef(b) - twRef(a),
  }[state.sort];
  return list.sort(by);
}

function renderIndex() {
  $('#cats').innerHTML = CATS.map(c => `<button class="chip ${state.cat === c ? 'on' : ''}" data-cat="${c}">${CAT_LABEL[c]}</button>`).join('');
  $$('#cats .chip').forEach(b => b.onclick = () => { state.cat = b.dataset.cat; renderIndex(); });
  const list = visibleList();
  $('#count').textContent = `${list.length} of ${AIRCRAFT.length}`;
  const metric = a => state.sort === 'thrust' ? [fmt(maxThrust(a)), 'kN'] : state.sort === 'mtow' ? [fmt(a.wt.mtow / 1000, 1), 't max'] : state.sort === 'tw' ? [fmt(twRef(a), 2), 'T/W'] : state.sort === 'year' ? [a.first, 'flew'] : [a.perf.mach >= 1 ? 'M ' + fmt(a.perf.mach, 2) : fmt(a.perf.vmax) , a.perf.mach >= 1 ? 'max' : 'km/h'];
  let html = '', grp = '';
  for (const a of list) {
    if (state.sort === 'cat' && a.cat !== grp) { grp = a.cat; html += `<li class="grp">${CAT_LABEL[grp]}</li>`; }
    const [v, u] = metric(a);
    html += `<li><button data-key="${a.key}" class="${state.ac === a ? 'on' : ''}"><span class="n">${a.short}</span><span class="v">${v}<i>${u}</i></span><span class="m">${a.nick ? a.nick + ' · ' : ''}${a.country} · ${a.first}</span></button></li>`;
  }
  $('#list').innerHTML = html || '<li class="grp">No aircraft match</li>';
  $$('#list button').forEach(b => b.onclick = () => { selectAircraft(b.dataset.key); $('#index').classList.remove('open'); });
}

function renderDossier() {
  const ac = state.ac;
  $('#eyebrow').innerHTML = `<span class="tag ${ac.cat.toLowerCase()}">${ac.cat}</span><span>${ac.gen ? 'Gen ' + ac.gen + ' · ' : ''}${ac.country}</span><span>${ac.first}</span>`;
  $('#acName').textContent = ac.name;
  $('#acSub').textContent = [ac.role, ac.nick && `"${ac.nick}"`, ac.variant].filter(Boolean).join(' · ');
  renderStrip();
  $$('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === state.tab); b.onclick = () => { state.tab = b.dataset.tab; renderDossier(); }; });
  renderPane();
}

function renderStrip() {
  const ac = state.ac, p = perfAt(ac, 1, state.load, state.fuel);
  $('#strip').innerHTML = `
    <div><b>${ac.perf.mach >= 1 ? 'M' + fmt(ac.perf.mach, 2) : fmt(ac.perf.vmax)}</b><span>${ac.perf.mach >= 1 ? 'top speed' : 'km/h max'}</span></div>
    <div><b>${fmt(maxThrust(ac))}</b><span>kN ${hasAB(ac) ? 'wet' : 'thrust'}</span></div>
    <div><b style="color:${p.overload ? 'var(--warn)' : ''}">${fmt(p.twMax, 2)}</b><span>T/W loaded</span></div>
    <div><b>${fmt(ac.perf.radius)}</b><span>km radius${est(ac, 'radius') ? ' est' : ''}</span></div>`;
}

function renderPane() {
  const f = { loadout: paneLoadout, engine: paneEngine, specs: paneSpecs, about: paneAbout }[state.tab];
  $('#pane').innerHTML = f(state.ac);
  bindPane();
  liveReadouts();
}

// Stores this aircraft carries anywhere in its presets, per station, for the custom builder.
function stationOptions(ac, st) {
  const seen = new Map();
  for (const l of ac.loadouts) { const v = normLoad(l.set[st.id]); if (v && !seen.has(v.key + '|' + v.n)) seen.set(v.key + '|' + v.n, v); }
  return [...seen.values()];
}

function paneLoadout(ac) {
  const p = perfAt(ac, 1, state.load, state.fuel), lm = loadoutMass(ac, state.load);
  const presets = ac.loadouts.map((l, i) => `<button class="preset ${!state.custom && i === state.loadIdx ? 'on' : ''}" data-lo="${i}"><b>${l.name}</b><span>${l.note || ''}</span></button>`).join('');
  const rows = (ac.stations || []).map(st => {
    const cur = normLoad(state.load[st.id]), opts = stationOptions(ac, st);
    const val = cur ? cur.key + '|' + cur.n : '';
    const sides = st.mirror ? 2 : 1, kg = cur && STORES[cur.key] ? (STORES[cur.key].kg + (STORES[cur.key].fuel || 0)) * cur.n * sides : 0;
    const hl = scene && scene.labels.some(L => L.tag === state.hl && L.st === st);
    return `<tr class="${hl ? 'hl' : ''}"><td>${st.id}</td><td><span class="lbl">${st.label || ''}${sides > 1 ? ' · pair' : ''}${st.kind === 'bay' ? ' · internal' : ''}${st.max ? ' · max ' + fmt(st.max) + ' kg' : ''}</span>
      <select data-st="${st.id}" aria-label="Station ${st.id}"><option value="">Empty</option>${opts.map(o => `<option value="${o.key}|${o.n}" ${o.key + '|' + o.n === val ? 'selected' : ''}>${STORES[o.key].name}${o.n > 1 ? ' ×' + o.n : ''}${sides > 1 ? ' (each side)' : ''}</option>`).join('')}</select></td>
      <td class="kg">${kg ? fmt(kg) + ' kg' : '–'}</td></tr>`;
  }).join('');
  // what is on board, summed by store
  const tally = {};
  for (const r of lm.rows) { const t = tally[r.S.key] ||= { S: r.S, n: 0, kg: 0 }; t.n += r.n * r.sides; t.kg += r.kg; }
  const carried = Object.values(tally).sort((a, b) => b.kg - a.kg).map(t => `<tr><th>${t.n} × ${t.S.name}${t.S.est ? ESTX : ''}</th><td>${t.S.cat}</td><td class="r num">${fmt(t.kg)} kg</td></tr>`).join('');
  const scale = Math.max(ac.wt.mtow, p.gross) * 1.04, pc = x => (x / scale * 100).toFixed(2) + '%';
  const segs = [['Empty', ac.wt.empty, '#4f7f93'], ['Crew', p.crew, '#8fcbe0'], ['Internal fuel', ac.wt.fuel * state.fuel, '#7fd49a'], ['Tank fuel', p.extFuel, '#3e8f5a'], ['Stores', p.stores, '#ffb04a']];
  return `
  <button class="btn sheetlink" id="sheetLink">Open loadout sheet: every station and weapon in detail <kbd>O</kbd></button>
  <div class="sec"><h3>Loadout presets <em>[ ] to cycle</em></h3><div class="presets">${presets}${state.custom ? '<button class="preset on"><b>Custom</b><span>Edited station by station below.</span></button>' : ''}</div></div>
  <div class="sec"><h3>Weight and balance <em>${fmt(p.gross)} kg of ${fmt(ac.wt.mtow)} kg max</em></h3>
    <div class="bar">${segs.map(s => `<i style="width:${pc(s[1])};background:${s[2]}"></i>`).join('')}<span class="mark" style="left:${pc(ac.wt.mtow)}" title="Maximum take-off weight"></span></div>
    <div class="legend">${segs.filter(s => s[1] > 0).map(s => `<span style="--c:${s[2]}">${s[0]} ${fmt(s[1])}</span>`).join('')}</div>
    <div class="kv" style="margin-top:10px">
      <div class="${p.overload ? 'warn' : ''}"><b>${fmt(p.gross / ac.wt.mtow * 100)}%</b><span>of max take-off</span></div>
      <div><b>${fmt(p.stores + p.extFuel)}</b><span>kg on stations</span></div>
      <div class="${p.twMax < 0.5 && hasAB(ac) ? 'warn' : ''}"><b>${fmt(p.twMax, 2)}</b><span>T/W, full ${hasAB(ac) ? 'reheat' : 'power'}</span></div>
      <div><b>${fmt(p.wl)}</b><span>kg/m² wing loading</span></div>
    </div>
    ${state.fuelTrim && !p.overload ? `<p class="note" style="margin-top:8px">Fuel set to ${Math.round(state.fuel * 100)}% to stay within maximum take-off weight. Crews top up from a tanker after take-off.</p>` : ''}
    ${p.overload ? `<p class="note" style="color:var(--warn);margin-top:8px">Over maximum take-off weight by ${fmt(p.gross - ac.wt.mtow)} kg. Take off with less fuel or fewer stores.</p>` : ''}
    <div class="range" style="margin-top:10px"><label for="fuel">Fuel</label><input id="fuel" type="range" min="0" max="100" value="${Math.round(state.fuel * 100)}"><span class="num">${Math.round(state.fuel * 100)}%</span></div>
  </div>
  <div class="sec"><h3>Stations <em>${(ac.stations || []).length} · ${ac.hard ? '' : ''}hover a store to inspect</em></h3><table class="stn">${rows}</table>
    ${hasBayStores() && !state.bays ? '<p class="note" style="margin-top:8px">Some stores ride in internal bays. Press <b>B</b> to open the doors.</p>' : ''}</div>
  ${carried ? `<div class="sec"><h3>On board</h3><table>${carried}</table></div>` : ''}`;
}

function paneEngine(ac) {
  const e = ac.eng, ab = hasAB(ac);
  const [sd, sw] = e.sfc || (ab ? [0.76, 2.0] : [0.6, 0.6]);
  return `
  <div class="sec"><h3>Live <em id="lvState"></em></h3>
    <div class="kv">
      <div><b id="lvT"></b><span>total thrust, kN</span></div>
      <div><b id="lvTe"></b><span>per engine, kN</span></div>
      <div><b id="lvFF"></b><span>fuel flow, kg/min</span></div>
      <div><b id="lvEnd"></b><span>fuel lasts at this setting</span></div>
      <div><b id="lvTW"></b><span>thrust / weight now</span></div>
      <div><b id="lvNz"></b><span>${e.type === 'turboprop' ? 'shaft power, kW' : ab ? 'nozzle area' : 'bypass ratio'}</span></div>
    </div></div>
  <div class="sec"><h3>Thrust and fuel flow vs throttle</h3><div id="chart"></div>
    <div class="legend"><span style="--c:#8fcbe0">Thrust (kN)</span><span style="--c:#ffb04a">Fuel flow (kg/min)</span></div></div>
  <div class="sec"><h3>Powerplant</h3><table>
    <tr><th>Engines</th><td>${e.n} × ${e.name}${est(ac, 'eng')}</td></tr>
    <tr><th>Type</th><td>${e.type}</td></tr>
    ${e.type === 'turboprop' ? `<tr><th>Shaft power</th><td class="num">${fmt(e.kw)} kW each (${fmt(e.kw * 1.341)} shp)</td></tr><tr><th>Propellers</th><td>${e.props}</td></tr>` : ''}
    <tr><th>${ab ? 'Dry thrust (military)' : 'Thrust'}</th><td class="num">${fmt(e.dry, 1)} kN each · ${fmt(e.dry * e.n, 1)} kN total</td></tr>
    ${ab ? `<tr><th>With afterburner</th><td class="num">${fmt(e.wet, 1)} kN each · ${fmt(e.wet * e.n, 1)} kN total</td></tr><tr><th>Afterburner boost</th><td class="num">+${fmt((e.wet / e.dry - 1) * 100)}%</td></tr>` : ''}
    ${e.zones ? `<tr><th>Afterburner zones</th><td class="num">${e.zones}</td></tr>` : ''}
    ${e.bypass != null ? `<tr><th>Bypass ratio</th><td class="num">${e.bypass}</td></tr>` : ''}
    ${e.tv ? `<tr><th>Thrust vectoring</th><td>${e.tv}</td></tr>` : ''}
    <tr><th>Fuel consumption used</th><td class="num">${sd} dry${ab ? ' · ' + sw + ' reheat' : ''} lb/(lbf·h)${e.sfc ? '' : ' typical'}</td></tr>
  </table>
  <p class="note" style="margin-top:8px">Sea-level static figures. Real fuel flow varies with altitude and speed; afterburner roughly triples it for about half as much thrust again.${e.type === 'turboprop' ? ' For the turboprop the thrust curve is an equivalent static thrust estimate.' : ''}</p></div>`;
}

function chartSVG(ac) {
  const W = 360, H = 150, pl = 36, pr = 40, pt = 10, pb = 22, n = 60;
  const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, p = perfAt(ac, t, state.load, state.fuel); return [t, p.Ttot, p.flow * 60]; });
  const Tm = Math.max(...pts.map(p => p[1])) * 1.08, Fm = Math.max(...pts.map(p => p[2])) * 1.08;
  const X = t => pl + t * (W - pl - pr), Yt = v => H - pb - v / Tm * (H - pt - pb), Yf = v => H - pb - v / Fm * (H - pt - pb);
  const path = (Y, k) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join(' ');
  const m = milPos(ac), cur = perfAt(ac, state.thr, state.load, state.fuel);
  const grid = [0.25, 0.5, 0.75, 1].map(g => `<line x1="${pl}" x2="${W - pr}" y1="${Yt(Tm / 1.08 * g)}" y2="${Yt(Tm / 1.08 * g)}" stroke="#243039"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Thrust and fuel flow against throttle position">
    ${grid}
    ${hasAB(ac) ? `<rect x="${X(m)}" y="${pt}" width="${X(1) - X(m)}" height="${H - pt - pb}" fill="#ffb04a" opacity="0.06"/><line x1="${X(m)}" x2="${X(m)}" y1="${pt}" y2="${H - pb}" stroke="#74838e" stroke-dasharray="2 3"/>` : ''}
    <path d="${path(Yf, 2)} L${X(1)} ${H - pb} L${X(0)} ${H - pb}Z" fill="#ffb04a" opacity="0.08"/>
    <path d="${path(Yf, 2)}" fill="none" stroke="#ffb04a" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${path(Yt, 1)}" fill="none" stroke="#8fcbe0" stroke-width="2"/>
    <circle id="chDot" cx="${X(state.thr)}" cy="${Yt(cur.Ttot)}" r="4" fill="#d7dee3" stroke="#0a0d10" stroke-width="2"/>
    <text x="${pl - 6}" y="${Yt(Tm / 1.08)}" fill="#8fcbe0" font-size="10" text-anchor="end" dominant-baseline="middle">${fmt(Tm / 1.08)}</text>
    <text x="${pl - 6}" y="${H - pb}" fill="#74838e" font-size="10" text-anchor="end" dominant-baseline="middle">0</text>
    <text x="${W - pr + 6}" y="${Yf(Fm / 1.08)}" fill="#ffb04a" font-size="10" dominant-baseline="middle">${fmt(Fm / 1.08)}</text>
    <text x="${X(0)}" y="${H - 6}" fill="#74838e" font-size="10">IDLE</text>
    <text x="${X(m)}" y="${H - 6}" fill="#74838e" font-size="10" text-anchor="${hasAB(ac) ? 'middle' : 'end'}">MIL</text>
    ${hasAB(ac) ? `<text x="${X(1)}" y="${H - 6}" fill="#ffb04a" font-size="10" text-anchor="end">MAX</text>` : ''}
  </svg>`;
}

function paneSpecs(ac) {
  const d = ac.dims, w = ac.wt, p = ac.perf, row = (k, v, e = '') => v == null || v === '' ? '' : `<tr><th>${k}</th><td class="num">${v}${e}</td></tr>`;
  const sw = ac.sweep;
  return `
  <div class="sec"><h3>Dimensions</h3><table>
    ${row('Length', fmt(d.len, 2) + ' m')}
    ${row('Wingspan', fmt(d.span, 2) + ' m' + (d.spanSwept ? ` spread · ${fmt(d.spanSwept, 2)} m swept` : ''))}
    ${row('Height', fmt(d.height, 2) + ' m')}
    ${row('Wing area', fmt(d.wingArea, 1) + ' m²')}
    ${sw ? row('Wing sweep', `${sw.min}° to ${sw.max}°`) : ''}
  </table></div>
  <div class="sec"><h3>Weights</h3><table>
    ${row('Empty', fmt(w.empty) + ' kg', est(ac, 'empty'))}
    ${row('Internal fuel', fmt(w.fuel) + ' kg', est(ac, 'fuel'))}
    ${row('Max take-off', fmt(w.mtow) + ' kg', est(ac, 'mtow'))}
    ${row('Max payload', ac.payload ? fmt(ac.payload) + ' kg' : '', est(ac, 'payload'))}
    ${row('Fuel fraction', fmt(w.fuel / w.mtow * 100) + '% of max take-off')}
  </table></div>
  <div class="sec"><h3>Performance</h3><table>
    ${row('Maximum speed', `${p.mach >= 1 ? 'Mach ' + fmt(p.mach, 2) + ' · ' : ''}${fmt(p.vmax)} km/h`, est(ac, 'vmax'))}
    ${row('Cruise', p.cruise || '')}
    ${row('Service ceiling', fmt(p.ceil) + ' m (' + fmt(p.ceil * 3.2808 / 1000, 1) + 'k ft)', est(ac, 'ceil'))}
    ${row('Combat radius', p.radius ? fmt(p.radius) + ' km' : '', est(ac, 'radius'))}
    ${row('Ferry range', p.ferry ? fmt(p.ferry) + ' km' : '', est(ac, 'ferry'))}
    ${row('Rate of climb', p.roc ? fmt(p.roc) + ' m/s' : '', est(ac, 'roc'))}
    ${row('g limits', p.g || '')}
    ${row('Thrust / weight', fmt(twRef(ac), 2) + ' at half fuel, clean')}
    ${row('Wing loading', fmt((w.empty + w.fuel * 0.5) / d.wingArea) + ' kg/m² at half fuel')}
  </table></div>
  <div class="sec"><h3>Systems</h3><table>
    ${[['Radar', ac.radar], ['Sensors', ac.sensors], ['Electronic warfare', ac.ew]].filter(r => r[1]).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
  </table></div>
  <div class="sec"><h3>Armament</h3><table>
    ${row('Gun', ac.gun || 'None')}
    ${row('Hardpoints', ac.hard || '')}
    ${row('Crew', ac.crew)}
  </table></div>`;
}

function paneAbout(ac) {
  const used = [...new Set(ac.loadouts.flatMap(l => Object.values(l.set).map(v => Array.isArray(v) ? v[0] : v)))].map(k => STORES[k]).filter(Boolean);
  const byCat = {};
  for (const s of used) (byCat[s.cat] ||= []).push(s.name);
  return `
  <div class="sec"><p class="prose">${ac.fact}</p></div>
  <div class="sec"><h3>Record</h3><table>
    <tr><th>Manufacturer</th><td>${ac.maker}</td></tr>
    <tr><th>Country</th><td>${ac.country}</td></tr>
    <tr><th>First flight</th><td class="num">${ac.first}</td></tr>
    <tr><th>Entered service</th><td class="num">${ac.intro}</td></tr>
    <tr><th>Number built</th><td class="num">${ac.built}</td></tr>
    <tr><th>Status</th><td>${ac.status}</td></tr>
    ${ac.cost ? `<tr><th>Unit cost</th><td>${ac.cost}</td></tr>` : ''}
  </table></div>
  ${ac.operators ? `<div class="sec"><h3>Operators</h3><p class="prose" style="font-size:14px">${ac.operators}</p></div>` : ''}
  ${ac.combat ? `<div class="sec"><h3>Combat record</h3><p class="prose" style="font-size:14px">${ac.combat}</p></div>` : ''}
  ${ac.variants ? `<div class="sec"><h3>Variants</h3><p class="prose" style="font-size:14px">${ac.variants}</p></div>` : ''}
  <div class="sec"><h3>Weapons shown in this atlas</h3><table>${STORE_CATS.filter(c => byCat[c]).map(c => `<tr><th>${c}</th><td>${byCat[c].join(', ')}</td></tr>`).join('')}</table></div>
  ${ac.est?.length ? `<p class="note">${ESTX} marks open-source estimates where no official figure is published.</p>` : ''}`;
}

function bindPane() {
  $$('#pane [data-lo]').forEach(b => b.onclick = () => setLoadout(+b.dataset.lo));
  const sl = $('#sheetLink'); if (sl) sl.onclick = () => openSheet();
  $$('#pane select[data-st]').forEach(s => s.onchange = () => {
    const v = s.value;
    if (v) { const [k, n] = v.split('|'); state.load[s.dataset.st] = [k, +n]; } else delete state.load[s.dataset.st];
    state.custom = true; fitFuel(); rebuild(); renderStrip(); renderPane(); audio.click();
  });
  const fu = $('#fuel');
  if (fu) {
    fu.oninput = () => { state.fuel = fu.value / 100; fu.nextElementSibling.textContent = fu.value + '%'; };
    fu.onchange = () => { state.fuelTrim = false; renderStrip(); renderPane(); $('#fuel').focus(); };
  }
}

// Updated ten times a second: throttle state, thrust and fuel readouts.
function liveReadouts() {
  if (!state.ac) return;
  const ac = state.ac, p = perfAt(ac, state.thr, state.load, state.fuel), ab = hasAB(ac);
  const st = $('#thrState');
  st.textContent = ac.eng.type === 'turboprop' ? (state.thr < 0.02 ? 'Idle' : `Power ${Math.round(state.thr * 100)}%`) : p.state;
  st.classList.toggle('ab', p.afterburner);
  const thrEl = $('#thr');
  if (document.activeElement !== thrEl) thrEl.value = Math.round(state.thrTarget * 1000);
  const mins = p.endurance;
  const endTxt = mins > 600 ? '10 h+' : mins >= 60 ? `${Math.floor(mins / 60)} h ${fmt(mins % 60)} min` : `${fmt(mins, mins < 10 ? 1 : 0)} min`;
  $('#readout').innerHTML = ac.eng.type === 'turboprop'
    ? `<span>Power <b>${fmt(p.power)}</b> kW</span><span>Thrust ~<b>${fmt(p.Ttot)}</b> kN</span><span>Fuel <b>${fmt(p.flow * 60)}</b> kg/min</span><span>Lasts <b>${endTxt}</b></span>`
    : `<span>Thrust <b>${ac.eng.n} × ${fmt(p.T, 1)}</b> = <b>${fmt(p.Ttot)}</b> kN</span><span>Fuel <b>${fmt(p.flow * 60)}</b> kg/min</span><span>T/W <b>${fmt(p.tw, 2)}</b></span><span>Fuel lasts <b>${endTxt}</b></span>`;
  $('#abBtn').classList.toggle('on', ab ? state.thrTarget > MIL : state.thrTarget > 0.5);
  if (state.tab === 'engine' && $('#lvT')) {
    $('#lvState').textContent = p.state;
    $('#lvT').textContent = fmt(p.Ttot, 1); $('#lvTe').textContent = fmt(p.T, 1);
    $('#lvFF').textContent = fmt(p.flow * 60); $('#lvEnd').textContent = endTxt; $('#lvTW').textContent = fmt(p.tw, 2);
    $('#lvNz').textContent = ac.eng.type === 'turboprop' ? fmt(p.power) : ab ? (p.afterburner ? 'Open ' + Math.round(40 + 60 * (state.thr - MIL) / (1 - MIL)) + '%' : 'Closed') : (ac.eng.bypass ?? '–');
    const ch = $('#chart');
    if (!ch.firstChild || Math.abs((ch._thr ?? -1) - state.thr) > 0.004) { ch.innerHTML = chartSVG(ac); ch._thr = state.thr; }
  }
}

// ---- compare
function addCompare() {
  const k = state.ac.key;
  if (!state.cmp.includes(k)) { state.cmp.push(k); if (state.cmp.length > 4) state.cmp.shift(); }
  store.set('cmp', state.cmp); renderTray();
}
function renderTray() {
  const tray = $('#cmpTray');
  tray.hidden = !state.cmp.length;
  tray.innerHTML = state.cmp.map(k => { const a = AIRCRAFT.find(x => x.key === k); return a ? `<button class="chip" data-rm="${k}" title="Remove">${a.short} ×</button>` : ''; }).join('')
    + (state.cmp.length ? `<button class="chip on" id="cmpOpen">Compare ${state.cmp.length}</button>` : '');
  $$('#cmpTray [data-rm]').forEach(b => b.onclick = () => { state.cmp = state.cmp.filter(x => x !== b.dataset.rm); store.set('cmp', state.cmp); renderTray(); });
  const o = $('#cmpOpen'); if (o) o.onclick = openCompare;
}
function openCompare() {
  const acs = state.cmp.map(k => AIRCRAFT.find(a => a.key === k)).filter(Boolean);
  const rows = [
    ['Role', a => a.role], ['Country', a => a.country], ['First flight', a => a.first, a => a.first],
    ['Length (m)', a => fmt(a.dims.len, 1), a => a.dims.len], ['Wingspan (m)', a => fmt(a.dims.span, 1), a => a.dims.span],
    ['Empty weight (kg)', a => fmt(a.wt.empty), a => a.wt.empty], ['Max take-off (kg)', a => fmt(a.wt.mtow), a => a.wt.mtow],
    ['Internal fuel (kg)', a => fmt(a.wt.fuel), a => a.wt.fuel],
    ['Engines', a => `${a.eng.n} × ${a.eng.name}`],
    ['Thrust, dry (kN)', a => fmt(a.eng.dry * a.eng.n), a => a.eng.dry * a.eng.n], ['Thrust, afterburner (kN)', a => a.eng.wet ? fmt(a.eng.wet * a.eng.n) : 'none', a => (a.eng.wet || 0) * a.eng.n],
    ['T/W (half fuel, clean)', a => fmt(twRef(a), 2), twRef],
    ['Max speed (km/h)', a => fmt(a.perf.vmax) + (a.perf.mach >= 1 ? ` (M${a.perf.mach})` : ''), a => a.perf.vmax],
    ['Ceiling (m)', a => fmt(a.perf.ceil), a => a.perf.ceil], ['Combat radius (km)', a => fmt(a.perf.radius), a => a.perf.radius],
    ['Max payload (kg)', a => fmt(a.payload), a => a.payload], ['Gun', a => a.gun || 'None'],
  ];
  const body = rows.map(([k, f, v]) => {
    const mx = v ? Math.max(...acs.map(v)) : 0;
    return `<tr><th>${k}</th>${acs.map(a => `<td class="${v ? 'num' : ''}">${f(a)}${v && mx ? `<div class="b"><i style="width:${(v(a) / mx * 100).toFixed(1)}%"></i></div>` : ''}</td>`).join('')}</tr>`;
  }).join('');
  $('#cmpBody').innerHTML = `<table><thead><tr><th></th>${acs.map(a => `<th>${a.short}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  $('#cmp').hidden = false;
}

// ---- start
async function start() {
  try { await Promise.race([document.fonts.load(`600 12px "JetBrains Mono"`), new Promise(r => setTimeout(r, 1500))]); } catch { }
  R.match = shapeMatcher(FONT);
  $('#q').addEventListener('input', e => { state.q = e.target.value; renderIndex(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderIndex(); });
  initControls(); initSheet();
  audio.on = store.get('sound', false);  // starts on the first click or key press
  resize();
  const key = (location.hash || '').slice(1);
  selectAircraft(AIRCRAFT.some(a => a.key === key) ? key : 'f22', false);
  renderTray();
  window.__jet = { state, cam, selectAircraft, setView, setLoadout, fire, fxFor, audio, keys: AIRCRAFT.map(a => a.key), R: () => R, scene: () => scene };
  // opening moment: spool up and light the afterburner
  state.thrTarget = 1; intro = 3;
  requestAnimationFrame(frame);
}
