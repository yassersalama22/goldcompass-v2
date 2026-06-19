// One-off WCAG contrast check for brand color tokens (oklch -> sRGB).
function oklchToLinearSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const relLum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b; // linear inputs
const contrast = (c1, c2) => {
  const l1 = relLum(oklchToLinearSrgb(...c1));
  const l2 = relLum(oklchToLinearSrgb(...c2));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};
const pass = (r, large = false) => (r >= (large ? 3 : 4.5) ? "PASS" : "FAIL");

const light = {
  background: [0.995, 0.003, 85],
  foreground: [0.205, 0.012, 75],
  gold: [0.72, 0.13, 80],
  goldStrong: [0.48, 0.11, 68],
  bull: [0.52, 0.15, 150],
  bear: [0.58, 0.2, 25],
  mutedFg: [0.52, 0.018, 78],
};
const dark = { background: [0.17, 0.01, 80], goldStrong: [0.82, 0.12, 84] };

console.log("LIGHT MODE (vs background):");
for (const [k, v] of Object.entries(light)) {
  if (k === "background") continue;
  const r = contrast(v, light.background);
  console.log(`  ${k.padEnd(12)} ${r.toFixed(2)}:1  text=${pass(r)} large=${pass(r, true)}`);
}
console.log("white text on bull/bear badges:");
const white = [1, 0, 0];
console.log(`  on bull       ${contrast(white, light.bull).toFixed(2)}:1  ${pass(contrast(white, light.bull))}`);
console.log(`  on bear       ${contrast(white, light.bear).toFixed(2)}:1  ${pass(contrast(white, light.bear))}`);
console.log("DARK MODE:");
const rd = contrast(dark.goldStrong, dark.background);
console.log(`  goldStrong   ${rd.toFixed(2)}:1  text=${pass(rd)}`);

// --- Candidate search for hero gold (large text, >=3:1 on light bg) and bull badge ---
console.log("\nCANDIDATES:");
const bg = light.background, white2 = [1,0,0];
for (const L of [0.66,0.64,0.62,0.60,0.58]) {
  const r = contrast([L,0.14,78], bg);
  console.log(`  hero gold L=${L} C0.14  ${r.toFixed(2)}:1 large=${r>=3?'PASS':'FAIL'}`);
}
for (const L of [0.56,0.54,0.52,0.50,0.48]) {
  const r = contrast(white2, [L,0.15,150]);
  console.log(`  bull L=${L} C0.15 white-text ${r.toFixed(2)}:1 ${r>=4.5?'PASS':'FAIL'}`);
}
