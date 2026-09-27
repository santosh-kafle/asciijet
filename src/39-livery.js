// Liveries, painted per pixel so stripes and stars stay crisp across big triangles.
// Geometry entries opt in with `liv: '<role>'`; paint(role, s, y, z, n) gets the pixel's position
// (s = metres aft of the nose, y up, z starboard) and the face normal, and returns [r, g, b] or null
// to keep the normal scheme.

// Five-pointed star, point up, outer radius 1 (inner radius 0.38).
function inStar(u, v) {
  const r = Math.hypot(u, v);
  if (r > 1) return false;
  if (r < 0.38) return true;
  const seg = Math.PI / 5, a = ((Math.atan2(u, v) % (2 * seg)) + 2 * seg) % (2 * seg);
  const t = Math.abs(a - seg) / seg;   // 0 at a valley, 1 at a point
  return r < 0.38 + 0.62 * t;
}
// Staggered star field on a plane (like the flag's canton), pitch in metres.
function starField(a, b, pitch, size) {
  const row = Math.floor(b / pitch), off = row & 1 ? pitch / 2 : 0;
  const cu = Math.floor((a - off) / pitch) * pitch + off + pitch / 2, cv = row * pitch + pitch / 2;
  return inStar((a - cu) / size, (b - cv) / size);
}

const LIV_RGB = c => hex2rgb(c);
const LIVERIES = {
  // F-15E "Stars and Stripes" (heritage jet, 2025): blue forward fuselage with white stars, red and
  // white stripes running fore and aft on the wings and stabilators, black aft fuselage and fins.
  f15e: {
    name: 'Stars and Stripes',
    paint: (() => {
      const RED = LIV_RGB('#b3222f'), WHITE = LIV_RGB('#e9e9e6'), BLUE = LIV_RGB('#2b5bbf'), BLACK = LIV_RGB('#1c1e21');
      const RADOME = LIV_RGB('#4b5157'), UNDER = LIV_RGB('#737a7f');
      const STRIPE = 0.36, TIP = 6.6;            // 13 stripes root to tip, red at the tip
      const BLUE_END = 9.3;                       // blue ends at the wing root leading edge
      const stripes = z => (Math.floor((TIP - Math.abs(z)) / STRIPE) & 1 ? WHITE : RED);
      const stars = (s, y, z, n) => {
        // project on the plane the surface faces most: top view for upper skins, side view otherwise
        const side = Math.abs(n[2]) > Math.abs(n[1]);
        return starField(s, side ? -y : Math.abs(z), 0.7, 0.25) ? WHITE : BLUE;
      };
      return (role, s, y, z, n) => {
        const down = n[1] < -0.35;
        if (role === 'wing' || role === 'stab') return down ? UNDER : stripes(z);
        if (role === 'fin' || role === 'boom') return BLACK;
        if (down) return UNDER;
        if (role === 'fus' && s < 2.1) return RADOME;
        if (role === 'spine') return s > 9.5 && s < 11.4 ? WHITE : BLACK;   // white panel carrying the tail code
        return s < BLUE_END ? stars(s, y, z, n) : BLACK;
      };
    })(),
  },
};
