// Orbit camera. yaw 0 looks at the aircraft from ahead-right; pitch > 0 from above.
function makeCam({ yaw, pitch, dist, target = [0, 0, 0], W, H, fov = 32, ox = 0, oy = 0 }) {
  const cp = Math.cos(pitch), eye = [target[0] + dist * cp * Math.cos(yaw), target[1] + dist * Math.sin(pitch), target[2] + dist * cp * Math.sin(yaw)];
  let f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  const fl = Math.hypot(...f); f = f.map(x => x / fl);
  let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // f x up
  const rl = Math.hypot(...r) || 1; r = r.map(x => x / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const foc = (H / 2) / Math.tan(fov * D2R / 2);
  return { eye, f, r, u, foc, cx: W / 2 + ox, cy: H / 2 + oy };
}
