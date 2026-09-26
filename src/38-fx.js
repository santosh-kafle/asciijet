// Per-aircraft effects: how each engine's afterburner looks, how it sounds, and where the gun fires.
//
// flame: len [dry-ish, max AB] plume length in nozzle radii; I brightness; core/hot/mid/tail colours from
//   the nozzle outwards; dia max Mach diamonds; dsp diamond spacing in nozzle diameters; smoke 0..1 visible
//   exhaust smoke at dry power (J79, RD-33 and the old turbojets are famous for it; reheat burns it off).
// snd: whine [idle, max] Hz of the compressor/fan tone; wq its sharpness; wg its level; howl centre Hz and
//   level of the intake howl (J79, Olympus); roar and rumble scale the jet noise and its low end; crackle
//   scales the afterburner crackle (turbojets crackle most).
// gun: rate rounds per second, cal mm, at [s, y, z] muzzle position (s metres aft of the nose), dir +1
//   forward or -1 for tail guns, pair for two guns (mirrored in z), rotary for Gatling spin-up, rounds.

const FLAME = {
  base:  { len: [6, 16], I: 1, core: [0.75, 0.82, 1.0], hot: [1.0, 0.74, 0.36], mid: [1.0, 0.47, 0.16], tail: [0.85, 0.24, 0.08], dia: 6, dsp: 1.25, smoke: 0 },
  F110:  { hot: [1.0, 0.7, 0.3], dia: 6 },
  F100:  { core: [0.68, 0.78, 1.0], hot: [1.0, 0.62, 0.46], mid: [1.0, 0.42, 0.24], dia: 7, dsp: 1.15 },
  F119:  { len: [4, 10], I: 0.8, hot: [1.0, 0.62, 0.36], dia: 5, dsp: 1.0 },
  F135:  { len: [7, 19], I: 1.15, core: [0.72, 0.8, 1.0], hot: [1.0, 0.72, 0.4], dia: 7, dsp: 1.3 },
  F414:  { len: [6, 14], hot: [1.0, 0.66, 0.3], dia: 5 },
  J79:   { len: [7, 18], hot: [1.0, 0.82, 0.38], mid: [1.0, 0.54, 0.14], dia: 6, smoke: 0.9 },
  AL41:  { len: [7, 18], I: 1.1, core: [0.82, 0.76, 1.0], hot: [1.0, 0.72, 0.3], mid: [1.0, 0.45, 0.12], dia: 6, dsp: 1.35 },
  RD33:  { hot: [1.0, 0.68, 0.28], dia: 5, smoke: 0.6 },
  D30:   { len: [8, 20], I: 1.2, hot: [1.0, 0.7, 0.3], dia: 6, dsp: 1.4, smoke: 0.2 },
  R25:   { len: [8, 19], hot: [1.0, 0.8, 0.34], mid: [1.0, 0.52, 0.12], dia: 6, smoke: 0.35 },
  EJ200: { I: 0.95, core: [0.7, 0.8, 1.0], hot: [1.0, 0.7, 0.38], dia: 6 },
  M88:   { len: [5, 13], hot: [1.0, 0.66, 0.34], dia: 5 },
  RM12:  { len: [5, 13], dia: 5 },
  WS10:  { hot: [1.0, 0.66, 0.28], dia: 5, smoke: 0.2 },
  M53:   { len: [7, 17], hot: [1.0, 0.78, 0.34], dia: 6, smoke: 0.25 },
  RB199: { len: [5, 12], hot: [1.0, 0.62, 0.26], dia: 4 },
  F101:  { len: [6, 15], core: [0.7, 0.8, 1.0], dia: 6 },
  NK32:  { len: [8, 20], I: 1.2, dia: 6, dsp: 1.4 },
  NK25:  { len: [8, 19], I: 1.2, dia: 6, smoke: 0.4 },
  TF33:  { smoke: 0.75 }, OLY:   { smoke: 0.6 }, TF34:  {}, F118:  {},
};

const SOUND = {
  base:  { whine: [900, 3300], wq: 6, wg: 1, howl: 0, hg: 0, roar: 1, rumble: 1, crackle: 1 },
  F110:  {},
  F100:  { whine: [950, 3600], crackle: 1.2 },
  F119:  { whine: [700, 2600], roar: 1.15, rumble: 1.3 },
  F135:  { whine: [650, 2400], roar: 1.35, rumble: 1.45 },
  F414:  { whine: [1000, 3500] },
  J79:   { whine: [1200, 2900], howl: 1900, hg: 1, crackle: 1.4 },
  AL41:  { whine: [800, 3000], rumble: 1.3 },
  RD33:  { whine: [1000, 3500] },
  D30:   { whine: [600, 2400], roar: 1.2, rumble: 1.5 },
  R25:   { whine: [1100, 2800], howl: 1500, hg: 0.6, crackle: 1.5 },
  EJ200: { whine: [1100, 3800] },
  M88:   { whine: [1100, 3600] },
  RM12:  { whine: [1000, 3400] },
  WS10:  { whine: [800, 3000] },
  M53:   { whine: [1300, 3200], wg: 1.4 },
  RB199: { whine: [1400, 4200], wg: 1.3 },
  F101:  { rumble: 1.2 },
  NK32:  { whine: [700, 2600], roar: 1.2, rumble: 1.5 },
  NK25:  { whine: [700, 2700], rumble: 1.4 },
  TF33:  { whine: [1200, 3200], roar: 1.1 },
  OLY:   { whine: [1000, 2800], howl: 1350, hg: 1.2 },
  // the TF34's fan gives the A-10 its "hog whistle"
  TF34:  { whine: [2000, 5200], wq: 12, wg: 2.4, roar: 0.6 },
  F118:  { roar: 0.85 },
};

// engine family from the engine name
const ENGINE_FAMILY = [
  [/F110/, 'F110'], [/F100/, 'F100'], [/F119/, 'F119'], [/F135/, 'F135'], [/F414/, 'F414'], [/J79/, 'J79'],
  [/AL-41/, 'AL41'], [/RD-33/, 'RD33'], [/D-30F6/, 'D30'], [/R25/, 'R25'], [/EJ200/, 'EJ200'], [/M88/, 'M88'],
  [/RM12/, 'RM12'], [/WS-10/, 'WS10'], [/M53/, 'M53'], [/RB199/, 'RB199'], [/F101/, 'F101'], [/NK-32/, 'NK32'],
  [/NK-25/, 'NK25'], [/TF33/, 'TF33'], [/Olympus/, 'OLY'], [/TF34/, 'TF34'], [/F118/, 'F118'],
];

const GUNS = {
  f16:     { rate: 100, cal: 20, at: [4.9, 0.4, -0.74], rotary: true },
  f22:     { rate: 100, cal: 20, at: [7.3, 0.45, 1.2], rotary: true },
  f35a:    { rate: 55, cal: 25, at: [6.4, 0.6, -0.95], rotary: true },
  f15e:    { rate: 100, cal: 20, at: [8.4, 0.4, 1.3], rotary: true },
  fa18e:   { rate: 100, cal: 20, at: [0.9, 0.36, 0], rotary: true },
  f14d:    { rate: 100, cal: 20, at: [3.6, -0.3, -0.66], rotary: true },
  f4e:     { rate: 100, cal: 20, at: [0.25, -0.5, 0], rotary: true },
  su35:    { rate: 27, cal: 30, at: [6.8, 0.6, 1.1] },
  su57:    { rate: 27, cal: 30, at: [6.9, 0.4, 1.05] },
  mig29:   { rate: 27, cal: 30, at: [6.6, 0.55, -1.0] },
  mig31:   { rate: 150, cal: 23, at: [11.5, -0.3, 1.5], rotary: true },
  mig21:   { rate: 57, cal: 23, at: [6.0, -0.72, 0] },
  typhoon: { rate: 28, cal: 27, at: [7.3, -0.3, 1.0] },
  rafale:  { rate: 42, cal: 30, at: [6.2, -0.05, 1.25] },
  gripen:  { rate: 28, cal: 27, at: [6.5, -0.42, -0.48] },
  m2000:   { rate: 30, cal: 30, at: [6.9, -0.45, 0.55], pair: true },
  tornado: { rate: 28, cal: 27, at: [3.9, -0.42, -0.5] },
  a10:     { rate: 65, cal: 30, at: [-0.16, -0.4, 0], rotary: true, barrels: 7 },
  tu22m3:  { rate: 57, cal: 23, at: [42.3, 0.9, 0], dir: -1, rounds: 1200 },
  tu95:    { rate: 57, cal: 23, at: [46.0, 0.9, 0.16], dir: -1, pair: true, rounds: 1200 },
};

function fxFor(ac) {
  if (ac._fx) return ac._fx;
  const fam = (ENGINE_FAMILY.find(([re]) => re.test(ac.eng.name)) || [])[1];
  const flame = { ...FLAME.base, ...(FLAME[fam] || {}) }, snd = { ...SOUND.base, ...(SOUND[fam] || {}) };
  let gun = GUNS[ac.key] ? { dir: 1, barrels: 1, ...GUNS[ac.key] } : null;
  if (gun && !gun.rounds) {
    const m = /([\d,]+) rounds( each)?/.exec(ac.gun || '');
    gun.rounds = m ? +m[1].replace(/,/g, '') * (m[2] ? 2 : 1) : 500;
  }
  if (gun) gun.name = (ac.gun || '').replace(/,? ?[\d,]+ rounds.*$/, '').replace(/ \(.*$/, '');
  return (ac._fx = { fam, flame, snd, gun });
}
