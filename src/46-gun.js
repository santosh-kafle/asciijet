// Gunfire: muzzle flash, the stream of rounds (every fifth a tracer) and propellant smoke.
// o.gun = { bursts: [[start, end or null], ...] } in the same clock as o.time. Stateless: every round and
// smoke puff is worked out from the burst times, so the effect is the same at any frame rate.
const ROUND_V = 1000;   // m/s, about the muzzle velocity of 20-30 mm cannon

function gunfire(R, cam, o) {
  const G = fxFor(R.ac).gun, guns = R.scene.guns;
  if (!G || !guns.length || !o.gun) return;
  const t = o.time, k = G.cal / 20, dir = G.dir;
  const lights = o.floorLights || (o.floorLights = []);
  for (const [b0, b1] of o.gun.bursts) {
    const end = b1 == null ? t : Math.min(t, b1), firing = b1 == null || t < b1;
    if (t - end > 4) continue;
    guns.forEach((m, gi) => {
      const seed = gi * 577 + Math.floor(b0 * 10);
      if (firing) muzzle(R, cam, m, G, k, dir, t, seed, lights);
      rounds(R, cam, m, G, dir, b0, end, t, seed);
      gunSmoke(R, cam, m, G, k, dir, b0, end, t, seed);
    });
  }
}

// Flash: a bright core and a forward cone that changes shape every shot.
function muzzle(R, cam, m, G, k, dir, t, seed, lights) {
  const shot = Math.floor(t * G.rate), f = 0.65 + 0.35 * hash(shot * 1.7 + seed);
  const Lf = (0.6 + 0.9 * k) * f, n = Math.floor(420 * k);
  for (let i = 0; i < n; i++) {
    const h1 = hash(shot * 3.1 + i * 1.3 + seed), h2 = hash(shot * 5.3 + i * 2.1), h3 = hash(shot + i * 7.7);
    const along = h1 * h1 * Lf, rr = 0.08 * k * (1 + 3 * along / Lf) * Math.sqrt(h2), a = h3 * 6.2832;
    const hot = 1 - along / Lf, w = 0.9 * hot * f;
    splat(R, cam, m.x + dir * along, m.y + Math.cos(a) * rr, m.z + Math.sin(a) * rr, 0.1,
      w * 1.0, w * lerp(0.42, 0.78, hot), w * lerp(0.06, 0.3, hot * hot));
  }
  lights.push({ x: m.x + dir * Lf * 0.4, z: m.z, r: 1.5 + 2 * k, i: 0.35 * f, c: [1, 0.7, 0.35] });
}

// Rounds in flight within 150 m, drawn as motion-blurred streaks; every fifth is a tracer.
function rounds(R, cam, m, G, dir, b0, end, t, seed) {
  const maxD = 150, dt = 1 / G.rate, blur = ROUND_V / 30 * 0.7;
  const j0 = Math.max(0, Math.ceil((t - maxD / ROUND_V - b0) / dt)), j1 = Math.floor((end - b0) / dt);
  for (let j = j0; j <= j1; j++) {
    const age = t - (b0 + j * dt);
    if (age < 0) continue;
    const d = age * ROUND_V, tracer = j % 5 === 0;
    if (d - blur > maxD) continue;
    const ey = (hash(j * 3.3 + seed) - 0.5) * 0.006, ez = (hash(j * 7.1 + seed) - 0.5) * 0.006;
    const len = Math.min(blur, d), steps = Math.ceil(len / 0.15);
    for (let s = 0; s < steps; s++) {
      const dd = d - len * s / steps, fade = 1 - s / steps;
      const w = (tracer ? 1.6 : 0.5) * fade * (1 - dd / maxD);
      if (w <= 0.01) continue;
      splat(R, cam, m.x + dir * dd, m.y + ey * dd, m.z + ez * dd, 0.06 * G.cal / 10,
        w, w * (tracer ? 0.5 : 0.72), w * (tracer ? 0.16 : 0.4));
    }
  }
}

// Propellant smoke: a translucent haze puffed out just ahead of the muzzle that spreads and streams back
// over the nose (the A-10's gun smoke famously envelops the forward fuselage).
function gunSmoke(R, cam, m, G, k, dir, b0, end, t, seed) {
  const rate = 30, life = 3, i0 = Math.max(0, Math.floor((t - life - b0) * rate)), i1 = Math.floor((end - b0) * rate);
  for (let i = i0; i <= i1; i++) {
    const age = t - (b0 + i / rate);
    if (age < 0 || age > life) continue;
    const u = age / life, h1 = hash(i * 1.9 + seed), h2 = hash(i * 3.7 + seed + 1);
    const push = (0.8 + 1.2 * h1) * k * (1 - Math.exp(-age * 6)), drift = 3 * age + 2.5 * age * age;
    const cx = m.x + dir * (push - drift), cy = m.y + 0.35 * age + (h2 - 0.5) * 0.3, cz = m.z + (h1 - 0.5) * 0.9 * age;
    const r = (0.25 + 1.2 * u) * k, puffs = 18, w0 = 0.035 * (1 - u) ** 1.2;
    for (let p = 0; p < puffs; p++) {
      const q1 = hash(i * 13 + p * 1.3 + seed), q2 = hash(i * 17 + p * 2.9), q3 = hash(i * 19 + p * 4.1), a = q3 * 6.2832;
      const rr = r * Math.sqrt(q2), w = w0 * (0.6 + 0.8 * q1);
      splat(R, cam, cx + (q1 - 0.5) * r * 1.5, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr, 0.14, w, w * 0.98, w * 0.95);
    }
  }
}
