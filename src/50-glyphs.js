// Shape-matched glyphs: each printable character is drawn once and measured as a 2 x 4 grid of
// ink densities. A cell's 8 samples (quantised to 4 levels) pick the closest character, memoised.
const GLYPHS = " .,:;'`\"^-_~=+*<>!/\\|()ivxzcoe#%@";
const RAMP = " .:-=+*#%@";

function shapeMatcher(font) {
  const gw = 24, gh = 48, cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const sig = [];
  let max = 0;
  for (const ch of GLYPHS) {
    g.clearRect(0, 0, gw, gh);
    g.fillStyle = '#fff'; g.font = `600 ${gw / 0.6}px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(ch, gw / 2, gh / 2 + 1);
    const d = g.getImageData(0, 0, gw, gh).data, s = new Float32Array(8);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) s[Math.floor(y / (gh / SY)) * SX + Math.floor(x / (gw / SX))] += d[(y * gw + x) * 4 + 3] / 255;
    for (let i = 0; i < 8; i++) { s[i] /= (gw / SX) * (gh / SY); max = Math.max(max, s[i]); }
    sig.push(s);
  }
  for (const s of sig) for (let i = 0; i < 8; i++) s[i] = Math.min(1, s[i] / max * 1.15);
  const memo = new Int16Array(65536).fill(-1), codes = [...GLYPHS].map(c => c.charCodeAt(0));
  const LV = [0, 0.14, 0.34, 0.6];
  return key => {
    const m = memo[key];
    if (m >= 0) return codes[m];
    if (m < -1) return -2 - m;
    let best = 0, bd = Infinity, sum = 0;
    const v = new Float32Array(8);
    let lo = 3, hi = 0, qs = 0;
    for (let i = 0; i < 8; i++) { const q = (key >> (i * 2)) & 3; v[i] = LV[q]; sum += v[i]; qs += q; lo = Math.min(lo, q); hi = Math.max(hi, q); }
    // flat shading reads best as a density ramp; only cells with an edge use shape matching
    if (hi - lo <= 1 && lo > 0) {
      const c = RAMP.charCodeAt(Math.min(RAMP.length - 1, Math.round(qs / 24 * (RAMP.length - 1))));
      memo[key] = -2 - c; return c;
    }
    for (let j = 1; j < sig.length; j++) {
      const s = sig[j];
      let d = 0;
      let ss = 0;
      for (let i = 0; i < 8; i++) { const e = v[i] - s[i]; d += e * e; ss += s[i]; }
      d += 0.35 * (sum - ss) * (sum - ss) / 8;   // keep overall brightness close
      if (d < bd) { bd = d; best = j; }
    }
    if (sum < 0.25 && bd > 0.2) best = 1; // a lone faint sample reads as a dot
    memo[key] = best;
    return codes[best];
  };
}
