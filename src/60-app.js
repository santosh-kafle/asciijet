// The page: viewer loop, camera controls, throttle, labels, tooltips.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = (x, d = 0) => x == null || isNaN(x) ? '–' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const store = {
  get(k, d) { try { const v = localStorage.getItem('jetatlas.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('jetatlas.' + k, JSON.stringify(v)); } catch { } },
};

const FONT = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const state = {
  ac: null, loadIdx: 0, load: {}, custom: false,
  thr: 0, thrTarget: 0, bays: false,
  labels: store.get('labels', true), ground: store.get('ground', true), spin: true,
  gear: store.get('gear', true), detail: 3,   // always maximum quality
  gun: { firing: false, bursts: [], ammo: 0 },
  sweep: null, fuel: 1, tab: 'loadout', cat: 'All', q: '', sort: 'cat', cmp: store.get('cmp', []), hl: 0, hover: 0,
};
const cam = { yaw: 2.3, pitch: 0.32, zoom: 1, tyaw: 2.3, tpitch: 0.32, tzoom: 1, drag: false, idle: 0, ext: 0 };
const VIEWS = { q: [0.75, 0.38], front: [0, 0.06], side: [Math.PI / 2, 0.02], top: [Math.PI / 2, 1.52], below: [0.9, -0.9], rear: [Math.PI - 0.45, 0.2] };

const canvas = $('#view'), ctx = canvas.getContext('2d', { alpha: false });
let R = new Renderer(10, 10), scene = null, geom = { cw: 7, ch: 14, fs: 12, w: 0, h: 0, dpr: 1 };
let lastCam = null, labelEls = [];

function hasAB(ac = state.ac) { return !!ac.eng.wet; }
function milPos(ac = state.ac) { return hasAB(ac) ? MIL : 1; }

// ---- scene
function rebuild() {
  const ac = state.ac;
  scene = buildScene(ac, { loadout: state.load, bays: state.bays, sweep: state.sweep, gear: state.gear, detail: state.detail });
  R.setScene(scene, ac);
  makeLabels();
}

function selectAircraft(key, push = true) {
  const ac = AIRCRAFT.find(a => a.key === key) || AIRCRAFT[0];
  state.ac = ac; state.loadIdx = 0; state.load = { ...(ac.loadouts[0]?.set || {}) }; state.custom = false;
  state.sweep = ac.sweep ? ac.sweep.def : null; state.hl = 0; state.bays = false;
  fire(false); state.gun = { firing: false, bursts: [], ammo: fxFor(ac).gun?.rounds || 0 };
  fitFuel();
  if (state.thrTarget > milPos()) state.thrTarget = milPos();
  if (push) try { history.replaceState(null, '', '#' + ac.key); } catch { }
  rebuild();
  renderIndex(); renderDossier(); renderThrottle(); syncButtons();
  cam.tzoom = 1;
}

function setLoadout(i) {
  const ac = state.ac, n = ac.loadouts.length;
  state.loadIdx = (i + n) % n; state.load = { ...ac.loadouts[state.loadIdx].set }; state.custom = false; state.hl = 0;
  fitFuel();
  if (!state.bays && hasBayStores()) state.bays = false;
  rebuild(); renderDossier(); syncButtons(); audio.click();
  if (sheet.open) renderSheet();
}
// Presets load as much fuel as the maximum take-off weight allows (heavy bombers top up in the air).
function fitFuel() {
  const ac = state.ac, p = perfAt(ac, 1, state.load, 1);
  state.fuelTrim = false; state.fuel = 1;
  if (p.overload) {
    const dry = ac.wt.empty + p.crew + p.stores, full = ac.wt.fuel + loadoutMass(ac, state.load).fuel;
    state.fuel = clamp(Math.floor((ac.wt.mtow - dry) / full * 100) / 100, 0.2, 1); state.fuelTrim = true;
  }
}
function hasBayStores() { return (state.ac.stations || []).some(s => s.kind === 'bay' && state.load[s.id]); }

// ---- sizing
function resize() {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  // maximum quality: about 340 columns on a desktop screen, scaled down on narrow screens
  const base = 340, target = r.width < 600 ? base * 0.5 : r.width < 1100 ? base * 0.75 : base;
  const fs = clamp(Math.round(r.width / target / 0.6), 5, 20);
  ctx.font = `600 ${fs}px ${FONT}`;
  const cw = ctx.measureText('M').width || fs * 0.6, ch = cw * 2;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  geom = { cw, ch, fs, w: r.width, h: r.height, dpr, left: r.left, top: r.top };
  const cols = Math.max(20, Math.floor(r.width / cw)), rows = Math.max(10, Math.floor(r.height / ch));
  R.resize(cols, rows);
  geom.ox = (r.width - cols * cw) / 2; geom.oy = (r.height - rows * ch) / 2;
}

// The free area between the panels, where the aircraft should sit (stage-relative CSS px).
function freeRect() {
  const s = $('#stage').getBoundingClientRect();
  if (innerWidth <= 860) return { x: 0, y: 0, w: s.width, h: s.height };
  const L = $('#index').getBoundingClientRect(), D = $('#dossier').getBoundingClientRect(), C = $('#console').getBoundingClientRect(), T = $('#top').getBoundingClientRect();
  const x0 = L.right + 8, x1 = D.left - 8, y0 = T.bottom, y1 = C.top - 4;
  return { x: x0, y: y0, w: Math.max(100, x1 - x0), h: Math.max(100, y1 - y0) };
}

// ---- frame
let tPrev = performance.now(), tNow = 0, uiTick = 0, audioTick = 0, intro = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(0.05, (t - tPrev) / 1000); tPrev = t; tNow += dt;
  if (!scene) return;

  // spool: engines take seconds to wind up; reheat lights quickly once at military power
  const mil0 = milPos(), diff = state.thrTarget - state.thr;
  const rate = (state.thr >= mil0 - 1e-3 && state.thrTarget > mil0) || (state.thr > mil0 && diff < 0) ? 1.2 : 0.28;
  state.thr += Math.sign(diff) * Math.min(Math.abs(diff), dt * rate);
  if (intro > 0) { intro -= dt; }

  // camera
  if (!cam.drag) {
    cam.idle += dt;
    if (state.spin && cam.idle > 1.5) cam.tyaw += dt * 0.16;
    cam.yaw += (cam.tyaw - cam.yaw) * Math.min(1, dt * 4);
    cam.pitch += (cam.tpitch - cam.pitch) * Math.min(1, dt * 4);
  }
  cam.zoom += (cam.tzoom - cam.zoom) * Math.min(1, dt * 6);

  const fr = freeRect(), cols = R.cols, rows = R.rows;
  const fov = 30, focCss = (geom.h / 2) / Math.tan(fov * D2R / 2);
  const fit = Math.min(fr.w * 1.12, fr.h * 1.4) / 2;
  // keep a lit afterburner plume in frame: shift the target aft and widen the fit
  const mil = milPos(), abU = hasAB() ? clamp((state.thr - mil) / (1 - mil), 0, 1) : 0;
  const FL = fxFor(state.ac).flame;
  const ext = scene.exhausts.length ? Math.max(...scene.exhausts.map(e => e.r)) * lerp(FL.len[0], FL.len[1], abU) * (abU > 0 ? 1 : 0) : 0;
  cam.ext += ((ext) - (cam.ext || 0)) * Math.min(1, dt * 3);
  // while the gun fires, widen the view on the muzzle side so the stream of rounds shows
  const Gf = fxFor(state.ac).gun, gext = Gf && state.gun.bursts.some(b => b[1] == null || tNow - b[1] < 1.5) ? state.ac.dims.len * 0.7 * Gf.dir : 0;
  cam.gext = (cam.gext || 0) + (gext - (cam.gext || 0)) * Math.min(1, dt * 3);
  const Reff = Math.max(scene.R, state.ac.dims.len / 2 + cam.ext / 2 + Math.abs(cam.gext) / 2);
  const dist = Reff * focCss / fit * cam.zoom;
  const ox = ((fr.x + fr.w / 2) - geom.w / 2) / geom.cw * SX, oy = ((fr.y + fr.h / 2) - geom.h / 2) / geom.ch * SY;
  const c = makeCam({ yaw: cam.yaw, pitch: cam.pitch, dist, target: [(-(cam.ext || 0) + cam.gext) / 2, 0, 0], W: cols * SX, H: rows * SY, fov, ox, oy });
  lastCam = c;
  if ((audioTick += dt) > 0.033) {
    audioTick = 0;
    const e = state.ac.eng, rear = clamp(-Math.cos(cam.yaw) * Math.cos(cam.pitch) * 0.5 + 0.5, 0, 1);
    audio.update({ thr: state.thr, mil, ab: hasAB(), n: e.n, big: state.ac.cat === 'Bomber', rear, zoom: cam.zoom,
      type: e.type === 'turboprop' ? 'turboprop' : (e.bypass || 0) >= 0.7 && !e.wet ? 'fan' : 'jet', snd: fxFor(state.ac).snd });
  }
  const gs = state.gun, G = fxFor(state.ac).gun;
  if (gs.firing) {
    gs.ammo = Math.max(0, gs.ammo - G.rate * (G.pair ? 2 : 1) * dt);
    if (!gs.ammo) fire(false);
  }
  gs.bursts = gs.bursts.filter(b => b[1] == null || tNow - b[1] < 4);
  if (sheet.open) { fire(false); drawSheet(dt); return; }
  R.render(c, { throttle: state.thr, time: tNow, gun: gs.bursts.length ? gs : null, ground: state.ground, groundY: scene.groundY, groundR: scene.R * 2.6, groundStep: scene.R > 18 ? 5 : 2, spin: state.thr > 0.03 });
  drawGrid(ctx, R, geom, state.hl || state.hover);
  placeLabels(c);
  if ((uiTick += dt) > 0.1) { uiTick = 0; liveReadouts(); if (state.gun.firing) renderGun(); }
}

// Glyphs are batched by colour so each fillStyle is set once per frame.
const bucketCount = new Uint32Array(4097), bucketStart = new Uint32Array(4097);
let order = new Uint32Array(0);
function drawGrid(ctx, R, geom, hl) {
  const { cw, ch, dpr } = geom, cols = R.cols, rows = R.rows, n = cols * rows;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a0d10'; ctx.fillRect(0, 0, geom.w, geom.h);
  ctx.font = `600 ${geom.fs}px ${FONT}`; ctx.textBaseline = 'middle';
  if (order.length < n) order = new Uint32Array(n);
  const keyOf = new Uint16Array(n), C = R.col, chars = R.chars, tags = R.cellTag;
  bucketCount.fill(0);
  for (let i = 0; i < n; i++) {
    if (chars[i] === 32) { keyOf[i] = 4096; continue; }
    let r = C[i * 3], g = C[i * 3 + 1], b = C[i * 3 + 2];
    if (hl && tags[i] === hl) { r = 255; g = 176; b = 74; }
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    keyOf[i] = k; bucketCount[k]++;
  }
  let acc = 0;
  for (let k = 0; k < 4096; k++) { bucketStart[k] = acc; acc += bucketCount[k]; }
  const fill = bucketStart.slice();
  for (let i = 0; i < n; i++) if (keyOf[i] < 4096) order[fill[keyOf[i]]++] = i;
  const ox = geom.ox, oy = geom.oy + ch / 2;
  for (let k = 0; k < 4096; k++) {
    const cnt = bucketCount[k]; if (!cnt) continue;
    // lift dark colours a little so dim surfaces stay legible on the dark ground
    const r = (k >> 8) * 17, g = ((k >> 4) & 15) * 17, b = (k & 15) * 17;
    ctx.fillStyle = `rgb(${24 + r * 0.92 | 0},${26 + g * 0.92 | 0},${30 + b * 0.92 | 0})`;
    for (let j = bucketStart[k], e = j + cnt; j < e; j++) {
      const i = order[j], x = i % cols, y = (i / cols) | 0;
      ctx.fillText(String.fromCharCode(chars[i]), ox + x * cw, oy + y * ch);
    }
  }
}

// ---- labels on stores
function makeLabels() {
  const box = $('#labels'); box.textContent = '';
  labelEls = scene.labels.map(L => {
    const el = document.createElement('div');
    el.className = 'lab';
    const nm = L.S.key.replace(/^Tank /, '') + (L.S.cat === 'Fuel tank' && !/L$/.test(L.S.key) ? ' gal' : '');
    el.innerHTML = `<b>${L.st.id}</b>${nm}${L.n > 1 ? ' ×' + L.n : ''}${L.hidden ? ' · internal' : ''}`;
    box.appendChild(el);
    return el;
  });
}
function project(c, p) {
  const dx = p[0] - c.eye[0], dy = p[1] - c.eye[1], dz = p[2] - c.eye[2];
  const vz = dx * c.f[0] + dy * c.f[1] + dz * c.f[2];
  const iz = c.foc / vz;
  const sx = c.cx + (dx * c.r[0] + dy * c.r[1] + dz * c.r[2]) * iz, sy = c.cy - (dx * c.u[0] + dy * c.u[1] + dz * c.u[2]) * iz;
  return [geom.ox + sx / SX * geom.cw, geom.oy + sy / SY * geom.ch, vz];
}
function placeLabels(c) {
  if (!labelEls.length) return;
  // one label per station: the nearer side of a mirrored pair
  const best = {};
  scene.labels.forEach((L, i) => {
    const p = project(c, L.p);
    L._s = p;
    const k = L.st.id;
    if (!best[k] || p[2] < best[k][1]) best[k] = [i, p[2]];
  });
  scene.labels.forEach((L, i) => {
    const el = labelEls[i], show = state.labels && !L.hidden && best[L.st.id][0] === i && L._s[2] > 0;
    el.classList.toggle('on', show);
    if (show) el.style.transform = `translate(${L._s[0] + 10}px, ${L._s[1]}px) translateY(-50%)`;
  });
}

// ---- tooltips and highlight
function tagAt(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left - geom.ox) / geom.cw), y = Math.floor((e.clientY - r.top - geom.oy) / geom.ch);
  if (x < 0 || y < 0 || x >= R.cols || y >= R.rows) return 0;
  return R.cellTag[y * R.cols + x];
}
function storeTip(L) {
  const S = L.S, total = (S.kg + (S.fuel || 0)) * L.n;
  return `<b>${S.name}${S.est ? '<span class="est">EST</span>' : ''}</b>
    <div class="mono">${L.st.id} · ${L.st.label || ''}${L.side ? ' (' + (L.side === 'L' ? 'left' : 'right') + ')' : ''}</div>
    <div>${S.cat}${S.guide ? ' · ' + S.guide : ''}</div>
    <div class="mono">${L.n} × ${fmt(S.kg)} kg${S.fuel ? ' + ' + fmt(S.fuel) + ' kg fuel' : ''} = ${fmt(total)} kg</div>
    <div class="mono">${fmt(S.L, 2)} m long · ${fmt(S.d * 1000)} mm dia${S.range ? ' · range ' + S.range : ''}</div>
    ${S.note ? `<div style="color:var(--muted)">${S.note}</div>` : ''}`;
}

// ---- controls
function initControls() {
  const ptrs = new Map();
  let pinch = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    cam.drag = true; cam.idle = 0; canvas.classList.add('drag');
    cam._moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) {
      const tg = tagAt(e), L = tg && scene.labels.find(l => l.tag === tg), tip = $('#tip');
      state.hover = L ? tg : 0;
      if (L) { tip.innerHTML = storeTip(L); tip.hidden = false; tip.style.left = Math.min(innerWidth - 270, e.clientX + 16) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; }
      else tip.hidden = true;
      canvas.style.cursor = L ? 'pointer' : '';
      return;
    }
    const prev = ptrs.get(e.pointerId), dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    cam._moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.tzoom = clamp(cam.tzoom * pinch / d, 0.25, 4);
      pinch = d; return;
    }
    cam.tyaw += dx * 0.008; cam.tpitch = clamp(cam.tpitch + dy * 0.006, -1.45, 1.52);
    cam.yaw = cam.tyaw; cam.pitch = cam.tpitch;
    $('#tip').hidden = true;
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (!ptrs.size) {
      cam.drag = false; canvas.classList.remove('drag'); cam.idle = 0;
      if (cam._moved < 4) { const tg = tagAt(e); state.hl = state.hl === tg ? 0 : tg; renderPane(); }
    }
    pinch = 0;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { $('#tip').hidden = true; state.hover = 0; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.tzoom = clamp(cam.tzoom * Math.exp(e.deltaY * 0.0012), 0.25, 4); }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam.tzoom = 1; });

  $('#thr').addEventListener('input', e => { state.thrTarget = e.target.value / 1000; intro = 0; });
  $('#abBtn').onclick = toggleAB;
  const gb = $('#gunBtn');
  gb.addEventListener('pointerdown', e => { e.preventDefault(); gb.setPointerCapture(e.pointerId); fire(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) gb.addEventListener(ev, () => fire(false));
  addEventListener('keyup', e => { if (e.key.toLowerCase() === 'f') fire(false); });
  addEventListener('blur', () => fire(false));
  $('#baysBtn').onclick = () => { state.bays = !state.bays; rebuild(); syncButtons(); audio.bay(state.bays); };
  $('#labBtn').onclick = () => { state.labels = !state.labels; store.set('labels', state.labels); syncButtons(); };
  $('#grdBtn').onclick = () => { state.ground = !state.ground; store.set('ground', state.ground); syncButtons(); };
  $('#gearBtn').onclick = () => { state.gear = !state.gear; store.set('gear', state.gear); rebuild(); syncButtons(); audio.bay(state.gear); };
  $('#spinBtn').onclick = () => { state.spin = !state.spin; syncButtons(); };
  $$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#sweep').addEventListener('input', e => {
    const s = state.ac.sweep; state.sweep = lerp(s.min, s.max, e.target.value / 100);
    $('#sweepVal').textContent = Math.round(state.sweep) + '°'; rebuild();
  });
  $('#menuBtn').onclick = () => { const o = $('#index').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o); };
  $('#helpBtn').onclick = () => { $('#help').hidden = false; };
  $('#helpClose').onclick = () => { $('#help').hidden = true; };
  $('#cmpAdd').onclick = addCompare;
  $('#sndBtn').onclick = () => { audio.toggle(!audio.on); store.set('sound', audio.on); syncButtons(); };
  const wake = () => { if (audio.on) audio.start(); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
  $('#cmpClose').onclick = () => { $('#cmp').hidden = true; };
  $('#cmp').addEventListener('click', e => { if (e.target.id === 'cmp') $('#cmp').hidden = true; });
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') $('#help').hidden = true; });

  addEventListener('keydown', e => {
    if (e.target.matches('input[type=search], select')) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key;
    if (k === 'Escape') { closeSheet(); $('#help').hidden = true; $('#cmp').hidden = true; $('#index').classList.remove('open'); state.hl = 0; return; }
    if (k === '/') { e.preventDefault(); $('#index').classList.add('open'); $('#q').focus(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = k.toLowerCase();
    if (key === 'f') { if (!e.repeat) fire(true); }
    else if (key === 'a') toggleAB();
    else if (key === 'w') { state.thrTarget = clamp(state.thrTarget + 0.05, 0, 1); intro = 0; }
    else if (key === 's') { state.thrTarget = clamp(state.thrTarget - 0.05, 0, 1); intro = 0; }
    else if (key === 'b') $('#baysBtn').click();
    else if (key === 'l') $('#labBtn').click();
    else if (key === 'g') $('#grdBtn').click();
    else if (key === 'u') $('#gearBtn').click();
    else if (key === 'c') addCompare();
    else if (key === 'o') sheet.open ? closeSheet() : openSheet();
    else if (key === 'm') $('#sndBtn').click();
    else if (k === ' ') { e.preventDefault(); $('#spinBtn').click(); }
    else if (k >= '1' && k <= '6') setView(['q', 'front', 'side', 'top', 'below', 'rear'][+k - 1]);
    else if (k === '[') setLoadout(state.loadIdx - 1);
    else if (k === ']') setLoadout(state.loadIdx + 1);
    else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const vis = visibleList(), i = vis.indexOf(state.ac);
      const nx = vis[(i + (k === 'ArrowRight' ? 1 : -1) + vis.length) % vis.length];
      if (nx) selectAircraft(nx.key);
    }
  });
  addEventListener('resize', () => { resize(); });
}

// Gun: hold F or the Gun button. Each press is a burst; the effects are drawn from the burst times.
function fire(on) {
  const gs = state.gun, G = state.ac && fxFor(state.ac).gun;
  if (!gs) return;
  if (on && G && !gs.firing) {
    if (gs.ammo <= 0) { gs.ammo = G.rounds; renderGun(); return; }   // empty: a press reloads
    gs.firing = true; gs.bursts.push([tNow, null]); audio.gun(true, G);
  } else if (!on && gs.firing) {
    gs.firing = false; const b = gs.bursts[gs.bursts.length - 1]; if (b) b[1] = tNow; audio.gun(false, G);
  }
  renderGun();
}
function renderGun() {
  const G = state.ac && fxFor(state.ac).gun, gs = state.gun, b = $('#gunBtn');
  b.hidden = !G;
  if (!G) return;
  b.classList.toggle('on', gs.firing);
  b.firstChild.textContent = gs.ammo <= 0 ? 'Reload ' : 'Gun ';
  $('#ammo').textContent = gs.ammo <= 0 ? '' : fmt(Math.ceil(gs.ammo));
  b.title = `${G.name}: ${fmt(G.rate * 60)} rounds a minute${G.pair ? ' per gun, two guns' : ''}${G.dir < 0 ? ', firing aft' : ''}. Hold to fire.`;
}

function toggleAB() {
  intro = 0;
  if (!hasAB()) { state.thrTarget = state.thrTarget > 0.5 ? 0 : 1; }
  else state.thrTarget = state.thrTarget > MIL ? 0 : 1;
  syncButtons();
}
function setView(v) {
  const [y, p] = VIEWS[v];
  // turn the short way round
  let ty = y; while (ty - cam.yaw > Math.PI) ty -= Math.PI * 2; while (cam.yaw - ty > Math.PI) ty += Math.PI * 2;
  cam.tyaw = ty; cam.tpitch = p; cam.idle = -4; cam.tzoom = 1;
}
function syncButtons() {
  $('#baysBtn').hidden = !(state.ac.stations || []).some(s => s.kind === 'bay');
  $('#baysBtn').classList.toggle('on', state.bays);
  $('#labBtn').classList.toggle('on', state.labels);
  $('#grdBtn').classList.toggle('on', state.ground);
  $('#gearBtn').classList.toggle('on', state.gear);
  $('#spinBtn').classList.toggle('on', state.spin);
  $('#sndBtn').classList.toggle('on', audio.on);
  $('#sndBtn').innerHTML = (audio.on ? 'Sound on' : 'Sound off') + ' <kbd>M</kbd>';
  const ab = hasAB();
  $('#abBtn').innerHTML = (ab ? 'Burner' : 'Full power') + ' <kbd>A</kbd>';
  $('#abBtn').classList.toggle('on', ab ? state.thrTarget > MIL : state.thrTarget > 0.5);
  const sw = state.ac.sweep;
  $('#sweepBox').hidden = !sw;
  renderGun();
  if (sw) { $('#sweep').value = Math.round((state.sweep - sw.min) / (sw.max - sw.min) * 100); $('#sweepVal').textContent = Math.round(state.sweep) + '°'; }
}

// ---- throttle strip
function renderThrottle() {
  const ab = hasAB(), m = milPos() * 100, ac = state.ac;
  $('#thr').style.setProperty('--track', ab
    ? `linear-gradient(90deg, #22323c 0%, #4f7f93 ${m}%, #8a5a1f ${m}%, #ffb04a ${m + 12}%, #ff7a2e 100%)`
    : `linear-gradient(90deg, #22323c 0%, #4f7f93 100%)`);
  const ticks = ab
    ? [[0, 'IDLE'], [m, 'MIL'], [m + 3, ''], [100, 'MAX AB']]
    : [[0, 'IDLE'], [50, '50%'], [100, ac.eng.type === 'turboprop' ? 'MAX POWER' : 'MIL · no afterburner']];
  $('#ticks').innerHTML = ticks.filter(t => t[1]).map(([p, l]) => `<span style="left:${p}%" class="${p > m ? 'ab' : ''}">${l}</span>`).join('');
}
