// V10.87 · Little botanical decorations for the interface (Founder request:
// 「我会希望我们的页面也有树叶梅花这样的装饰」).
//
// Original line-and-wash drawings made in code (no downloaded art): an autumn
// branch with leaves and red berries, a plum-blossom sprig and a small leaf
// sprig. They are pure decoration: aria-hidden, never tappable, never inside a
// journal page, a cover, an export or a backup, and the same on every render
// (no randomness), so nothing about a person's journal changes.

const INK = "#5E5246";
const TWIG = "#6B5446";

const n = (v) => Math.round(v * 10) / 10;

// A leaf from its stem point, pointing at `angle` degrees.
function leaf(x, y, angle, len, width, fill, lean = 0.85) {
  const w1 = width;
  const w2 = width * lean;
  const d = `M0 0C${n(len * 0.28)} ${n(-w1)} ${n(len * 0.72)} ${n(-w1)} ${n(len)} 0C${n(len * 0.7)} ${n(w2)} ${n(len * 0.3)} ${n(w2)} 0 0Z`;
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><path d="${d}" fill="${fill}" fill-opacity=".86" stroke="${INK}" stroke-width=".55" stroke-opacity=".75"/><path d="M1 0L${n(len * 0.86)} 0" stroke="${INK}" stroke-width=".45" stroke-opacity=".55" fill="none"/></g>`;
}
function berry(x, y, r = 3.1) {
  return `<g><circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#C2544A" stroke="#8E3B33" stroke-width=".5"/><circle cx="${n(x - r * 0.35)}" cy="${n(y - r * 0.35)}" r="${n(r * 0.3)}" fill="#fff" fill-opacity=".55"/></g>`;
}
// A five-petal plum blossom.
function blossom(x, y, r, turn = 0, open = 1) {
  const petals = Array.from({ length: 5 }, (_, k) => {
    const a = ((turn + k * 72) * Math.PI) / 180;
    return `<circle cx="${n(x + Math.cos(a) * r * 0.55 * open)}" cy="${n(y + Math.sin(a) * r * 0.55 * open)}" r="${n(r * 0.5)}" fill="#E7A39A" fill-opacity=".92" stroke="#B5554B" stroke-width=".45"/>`;
  }).join("");
  const stamens = Array.from({ length: 7 }, (_, k) => {
    const a = ((turn + 20 + k * 51) * Math.PI) / 180;
    const ex = x + Math.cos(a) * r * 0.42;
    const ey = y + Math.sin(a) * r * 0.42;
    return `<path d="M${n(x)} ${n(y)}L${n(ex)} ${n(ey)}" stroke="#9C4A3E" stroke-width=".4"/><circle cx="${n(ex)}" cy="${n(ey)}" r=".7" fill="#D9A441"/>`;
  }).join("");
  return `<g>${petals}<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.24)}" fill="#C2544A"/>${stamens}</g>`;
}
function bud(x, y, r = 2.6) {
  return `<g><circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#D9776B" stroke="#A9483A" stroke-width=".45"/><path d="M${n(x - r * 0.8)} ${n(y + r * 0.6)}Q${n(x)} ${n(y + r * 1.5)} ${n(x + r * 0.8)} ${n(y + r * 0.6)}" fill="#6B5446" fill-opacity=".8"/></g>`;
}
const svg = (cls, box, body) => `<svg class="deco ${cls}" viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;

// Autumn branch: comes in from the top right, leaves and a few red berries.
const GREEN = "#8C9B72";
const OLIVE = "#A7AE7C";
const OCHRE = "#CDA25B";
const RUST = "#B9703F";
export const BERRY_BRANCH = svg(
  "deco-branch",
  "0 0 170 120",
  `<path d="M170 6C140 14 118 26 96 44C78 58 62 74 44 92" fill="none" stroke="${TWIG}" stroke-width="2.1" stroke-linecap="round"/>` +
    `<path d="M120 26C116 40 112 50 104 60" fill="none" stroke="${TWIG}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M80 58C70 60 60 58 50 52" fill="none" stroke="${TWIG}" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M62 74C64 86 62 96 56 106" fill="none" stroke="${TWIG}" stroke-width="1" stroke-linecap="round"/>` +
    leaf(160, 8, 205, 20, 5.5, OLIVE) +
    leaf(150, 11, 158, 28, 7.5, GREEN) +
    leaf(138, 16, 212, 25, 7, OCHRE) +
    leaf(128, 21, 262, 22, 6, GREEN) +
    leaf(116, 29, 150, 30, 8, OLIVE) +
    leaf(110, 48, 112, 25, 7, GREEN) +
    leaf(96, 44, 200, 28, 7.5, RUST) +
    leaf(88, 51, 258, 22, 6, OLIVE) +
    leaf(80, 58, 145, 27, 7.5, GREEN) +
    leaf(66, 56, 215, 23, 6.5, OCHRE) +
    leaf(50, 52, 170, 21, 6, OLIVE) +
    leaf(70, 66, 112, 22, 6, OCHRE) +
    leaf(44, 92, 140, 25, 7, GREEN) +
    leaf(52, 84, 228, 20, 5.5, RUST) +
    leaf(56, 106, 100, 18, 5, OCHRE) +
    berry(104, 62) + berry(98, 66, 2.8) + berry(107, 68, 2.6) +
    berry(60, 108, 2.8) + berry(66, 103, 2.5) +
    berry(40, 95, 2.7),
);

// Plum blossom sprig: a dark twig, three flowers, two buds.
export const PLUM_SPRIG = svg(
  "deco-plum",
  "0 0 120 90",
  `<path d="M4 86C22 74 38 62 54 46C66 34 80 22 100 12" fill="none" stroke="${TWIG}" stroke-width="1.9" stroke-linecap="round"/>` +
    `<path d="M40 60C46 52 48 44 46 34" fill="none" stroke="${TWIG}" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M70 32C80 34 88 40 92 48" fill="none" stroke="${TWIG}" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M100 12L110 6" fill="none" stroke="${TWIG}" stroke-width="1" stroke-linecap="round"/>` +
    blossom(46, 30, 11, 8) +
    blossom(78, 26, 9.5, 40) +
    blossom(26, 70, 8.5, -12) +
    bud(93, 50) + bud(111, 6, 2.3) + bud(60, 42, 2.2) +
    leaf(88, 18, 300, 10, 3, GREEN),
);

// Small leaf sprig (竹青), for a corner.
export const LEAF_SPRIG = svg(
  "deco-leaf",
  "0 0 90 70",
  `<path d="M88 66C70 52 54 40 36 30C26 24 16 18 4 14" fill="none" stroke="${TWIG}" stroke-width="1.3" stroke-linecap="round"/>` +
    leaf(80, 60, 228, 22, 6, "#9AAA84") +
    leaf(70, 54, 215, 25, 6.5, "#7F9470") +
    leaf(62, 47, 300, 24, 6.2, "#9AAA84") +
    leaf(48, 38, 212, 25, 6.5, "#6B7F62") +
    leaf(40, 33, 292, 22, 6, "#9AAA84") +
    leaf(26, 24, 208, 21, 5.8, "#7F9470") +
    leaf(18, 20, 288, 19, 5.2, "#6B7F62") +
    leaf(4, 14, 190, 15, 4.4, "#9AAA84") +
    berry(30, 27, 2.2),
);
