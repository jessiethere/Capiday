// Capiday Botanical Decorative System (V10.88; V10.87 was the first sketch).
//
// One place for every plant, the Captain vignette, the cover art and the paper
// grain, so pages never draw their own. Plants are original line-and-wash SVG
// made in code; Captain scenes and cover art are small PNGs cut from the
// Founder's reference board (V10.88, see captainVignette below).
//
//   botanical(kind, options)   kind: "corner" | "sprig" | "berry" | "blossom"
//   captainVignette(options)   Captain with two books, a small seal, a sprig
//   decorPlan(surface, ctx)    which decorations a surface may show (density)
//
// Colors come only from the botanical tokens (design-tokens.json "botanical"
// → tokens.css --bot-*), applied by class in styles.css, so themes can quiet
// them. Plants use 3–4 colors: branch brown, two leaf greens, and either a
// muted fruit or a white blossom. Cinnabar (--bot-seal) is only for a seal.
//
// Every piece is decoration: aria-hidden, focusable=false, no pointer events
// (styles.css), the same drawing every time (no randomness, no animation).
// Storytelling surfaces may carry it; interaction surfaces stay clean.

const n = (v) => Math.round(v * 10) / 10;

// ---------- drawing parts ----------
// A leaf from its stem point at `angle`: asymmetric sides, a slight curl at
// the tip, a light wash inside and a pale vein (soft, low contrast).
function leaf(x, y, angle, len, width, tone = 2, curl = 0) {
  const a = len * 0.3;
  const b = len * 0.72;
  const up = -width;
  const down = width * 0.78;
  const d = `M0 0C${n(a)} ${n(up)} ${n(b)} ${n(up * 1.04)} ${n(len)} ${n(curl)}C${n(b)} ${n(down + curl * 0.3)} ${n(a)} ${n(down)} 0 0Z`;
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><path class="bl bl-${tone}" d="${d}"/><path class="bw" d="${d}" transform="translate(${n(len * 0.14)} ${n(-width * 0.18)}) scale(.58)"/><path class="bv" d="M1 0Q${n(len * 0.5)} ${n(curl * 0.3 - width * 0.06)} ${n(len * 0.86)} ${n(curl * 0.85)}"/></g>`;
}
const twig = (d, w = 1.4) => `<path class="bb" d="${d}" style="stroke-width:${w}"/>`;
function fruit(x, y, r = 2.8) {
  return `<circle class="bf" cx="${n(x)}" cy="${n(y)}" r="${r}"/><circle class="bh" cx="${n(x - r * 0.35)}" cy="${n(y - r * 0.38)}" r="${n(r * 0.3)}"/>`;
}
// A very small white five-petal blossom.
function flower(x, y, r = 6, turn = 0) {
  const petals = Array.from({ length: 5 }, (_, k) => {
    const deg = turn + k * 72;
    const rad = (deg * Math.PI) / 180;
    const px = x + Math.cos(rad) * r * 0.52;
    const py = y + Math.sin(rad) * r * 0.52;
    return `<ellipse class="bp" cx="${n(px)}" cy="${n(py)}" rx="${n(r * 0.5)}" ry="${n(r * 0.42)}" transform="rotate(${n(deg)} ${n(px)} ${n(py)})"/>`;
  }).join("");
  const dots = Array.from({ length: 5 }, (_, k) => {
    const rad = ((turn + 36 + k * 72) * Math.PI) / 180;
    return `<circle class="bd" cx="${n(x + Math.cos(rad) * r * 0.3)}" cy="${n(y + Math.sin(rad) * r * 0.3)}" r="${n(Math.max(0.45, r * 0.07))}"/>`;
  }).join("");
  return `<g>${petals}<circle class="bc" cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.2)}"/>${dots}</g>`;
}
const bud = (x, y, r = 2.2) => `<ellipse class="bp" cx="${n(x)}" cy="${n(y)}" rx="${r}" ry="${n(r * 1.25)}"/>`;

// ---------- the assets ----------
// Each kind has a few variants (drawn once, at load) and a natural reading
// direction: it grows from the top-right corner ("tr").
const ASSETS = {
  // Botanical Corner (large): a naturally bent twig, 5–6 irregular leaves;
  // variant 1 adds two tiny white blossoms, variant 2 three muted fruits.
  corner: {
    box: [160, 120],
    variants: [0, 1, 2].map((v) => {
      let s =
        twig("M160 3C138 9 118 20 100 34C84 47 70 62 56 80C50 88 46 95 43 102", 1.6) +
        twig("M114 24C111 36 106 45 98 53", 1) +
        twig("M74 56C64 57 55 54 47 48", 0.9) +
        leaf(148, 6, 160, 30, 8, 2, 2) +
        leaf(128, 14, 218, 28, 7.5, 3, -2) +
        leaf(108, 28, 148, 32, 8.5, 1, 3) +
        leaf(98, 53, 108, 26, 7, 3, -2) +
        leaf(80, 50, 206, 28, 7.5, 2, 2) +
        leaf(47, 48, 168, 24, 6.5, 3, 2) +
        leaf(60, 75, 128, 24, 6.5, 2, -2);
      if (v === 1) s += flower(50, 90, 6.5, 8) + flower(66, 66, 5, 40) + bud(43, 104);
      if (v === 2) s += fruit(98, 57) + fruit(93, 62, 2.5) + fruit(102, 63, 2.3) + fruit(44, 104, 2.4);
      return s;
    }),
  },
  // Small Botanical Sprig: one short stem, 2–4 leaves. The everyday piece.
  sprig: {
    box: [60, 60],
    variants: [
      twig("M8 57C16 48 24 38 32 28C38 20 44 14 52 8", 1.1) + leaf(26, 35, 300, 22, 6.5, 2, -1) + leaf(38, 20, 205, 21, 6.2, 3, 1),
      twig("M8 57C16 48 24 38 32 28C38 20 44 14 52 8", 1.1) + leaf(17, 46, 210, 19, 5.8, 3, 1) + leaf(30, 30, 302, 21, 6.2, 2, -1) + leaf(52, 8, 318, 15, 4.8, 1, -1),
      twig("M8 57C16 48 24 38 32 28C38 20 44 14 52 8", 1.1) + leaf(14, 50, 212, 17, 5.2, 2, 1) + leaf(23, 40, 300, 19, 5.6, 3, -1) + leaf(36, 24, 206, 19, 5.6, 1, 1) + leaf(50, 10, 314, 15, 4.6, 2, -1),
    ],
  },
  // Berry Branch: twig + grey-green leaves + a few muted (not bright) fruits.
  // A seasonal accent: Home's stamp card only.
  berry: {
    box: [120, 90],
    variants: [
      twig("M118 6C98 14 80 26 64 40C50 52 34 66 14 82", 1.4) +
        twig("M80 26C78 36 74 44 68 50", 0.9) +
        twig("M42 58C40 66 36 72 30 76", 0.8) +
        leaf(104, 11, 158, 22, 6, 2, 2) +
        leaf(90, 20, 215, 21, 5.8, 3, -2) +
        leaf(66, 38, 150, 22, 6, 2, 2) +
        leaf(52, 49, 222, 19, 5.2, 3, -1) +
        fruit(68, 52) + fruit(63, 56, 2.5) + fruit(71, 58, 2.3) + fruit(30, 78, 2.6) + fruit(36, 80, 2.2),
    ],
  },
  // Small White Blossom: thin stems, a few tiny white flowers, muted leaves.
  // Covers, empty states, special papers — never a border or a bouquet.
  blossom: {
    box: [70, 90],
    variants: [
      twig("M30 88C30 70 32 52 38 34C40 26 44 18 48 12", 0.9) +
        twig("M33 56C26 50 20 42 16 34", 0.7) +
        leaf(31, 70, 205, 15, 4.4, 2, 1) +
        leaf(34, 50, 320, 14, 4, 3, -1) +
        leaf(22, 46, 230, 12, 3.6, 2, 1) +
        flower(48, 12, 7, 10) + flower(16, 33, 5.6, 50) + flower(39, 32, 4.6, 20) + bud(44, 22, 1.8),
      // a single flower head on a short stem (small sizes)
      twig("M30 88C31 74 33 60 36 46", 0.9) + leaf(32, 66, 210, 14, 4.2, 2, 1) + leaf(34, 56, 320, 13, 3.8, 3, -1) + flower(36, 40, 8, 14),
    ],
  },
};
const inner = (kind, variant = 0) => ASSETS[kind].variants[variant % ASSETS[kind].variants.length];
const SIZES = new Set(["xs", "s", "m", "l"]);
const PLACES = new Set(["tr", "tl", "br", "bl", "inline"]);
const TONES = new Set(["", "quiet"]);

// The one way to put a plant on a surface.
//   size: xs | s | m | l (CSS widths), place: tr | tl | br | bl | inline,
//   flip: mirror left↔right, tone: "" | "quiet" (lighter), cls: extra class.
export function botanical(kind, { variant = 0, size = "m", place = "tr", flip = false, tone = "", cls = "" } = {}) {
  const asset = ASSETS[kind];
  if (!asset) return "";
  const body = asset.variants[Math.abs(variant) % asset.variants.length];
  const classes = ["bot", `bot-${kind}`, `bot-${SIZES.has(size) ? size : "m"}`, `bot-at-${PLACES.has(place) ? place : "tr"}`];
  if (flip) classes.push("bot-flip");
  if (TONES.has(tone) && tone) classes.push(`bot-${tone}`);
  if (cls) classes.push(cls);
  const [w, h] = asset.box;
  return `<svg class="${classes.join(" ")}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${body}</svg>`;
}

// ---------- Captain vignette & cover art (raster) ----------
// Captain — the grey long-haired Little Keeper with amber eyes — with books,
// a small seal and a few leaves. A modern, natural little cat: the Eastern
// feeling comes from the books, paper, seal and plants, never from costume.
// The pictures are cut from the Founder's Captain sheet
// (docs/visual/captain-scenes-v1.png, tools/cut_botanical_art.py) with the
// paper turned white, so they sit on paper with `mix-blend-mode: multiply`.
// Static; one picture per pose; PNGs 540 px wide (≈90 KB), loaded lazily.
const ART = {
  "captain-sleep": [540, 306],
  "captain-sit": [540, 371],
  "captain-ready": [540, 372],
  "captain-stamp": [540, 342],
  "cover-sprig": [97, 107],
  "cover-captain": [166, 182],
  "cover-travel-blossom": [108, 104],
};
// sleep: asleep on the books · sit: sitting by the books, looking up ·
// ready: a paw on the seal · stamp: has just pressed a stamp for you.
export const CAPTAIN_POSES = ["sleep", "sit", "ready", "stamp"];
function artImg(name, classes) {
  const [w, h] = ART[name];
  return `<img class="${classes.join(" ")}" src="botanical/${name}.png" width="${w}" height="${h}" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">`;
}
export function captainVignette({ pose = "sit", size = "m", place = "inline", cls = "" } = {}) {
  const p = CAPTAIN_POSES.includes(pose) ? pose : "sit";
  const classes = ["bot", "bot-art", "bot-vignette", `bot-${SIZES.has(size) ? size : "m"}`, `bot-at-${PLACES.has(place) ? place : "inline"}`, `pose-${p}`];
  if (cls) classes.push(cls);
  return artImg(`captain-${p}`, classes);
}
// The three default covers' art: "travel" (white blossom on the green cloth),
// "everyday" (a barely-there sprig), "captain" (Captain looking up, plants).
const COVER_ART = { travel: "cover-travel-blossom", everyday: "cover-sprig", captain: "cover-captain" };
export function coverArt(kind, cls = "") {
  const name = COVER_ART[kind];
  if (!name) return "";
  // The travel blossom is a cut-out (its cloth is transparent); the others blend into paper.
  const classes = ["bot", kind === "travel" ? "bot-cutout" : "bot-art", `bot-cover-${kind}`];
  if (cls) classes.push(cls);
  return artImg(name, classes);
}

// ---------- density ----------
// Botanical details stay scarce. In one viewport: at most one large piece
// (corner / berry / vignette) and about two or three small ones. Many photos
// → fewer plants; an empty page → a little more. Priority: the person's
// content > typography > stamps > plants.
export const DENSITY = { corner: 1, vignette: 1, small: 3 };
const CORNERS = new Set(["corner", "berry"]);

// surface: "home" | "stampCard" | "stamps". ctx: what is on screen.
// Returns [{ slot, kind, ...options }] — the only decorations that surface shows.
export function decorPlan(surface, ctx = {}) {
  const plan = [];
  if (surface === "home") {
    // Home is the most restrained: one small sprig by the date (none when the
    // first screen is already full of the person's photos). Captain's area
    // keeps the approved Captain art; other modules stay clean.
    if ((ctx.photos || 0) < 4) plan.push({ slot: "date", kind: "sprig", variant: 1, size: "s", place: "tr" });
  } else if (surface === "stampCard") {
    // The stamp card's one corner: the seasonal berry branch.
    plan.push({ slot: "corner", kind: "berry", size: "s", place: "bl", flip: true });
  } else if (surface === "stamps") {
    // The stamp page: one very subtle corner; stamps stay the subject.
    const busy = (ctx.photoStamps || 0) >= 10;
    // Bottom right, by the note: the month arrows at the top stay clear.
    plan.push({ slot: "corner", kind: "corner", variant: 0, size: busy ? "xs" : "s", place: "br", tone: "quiet" });
    // An empty month may show a little more: Captain looking at a seal.
    if (ctx.empty) plan.push({ slot: "empty", kind: "vignette", pose: "sit", size: "m", place: "inline" });
  }
  return plan;
}
// True when a plan keeps to the density rules (used by tests): at most one
// large corner, one Captain vignette and three small pieces.
export function withinDensity(plan) {
  const corners = plan.filter((p) => CORNERS.has(p.kind)).length;
  const vignettes = plan.filter((p) => p.kind === "vignette").length;
  const small = plan.length - corners - vignettes;
  return corners <= DENSITY.corner && vignettes <= DENSITY.vignette && small <= DENSITY.small;
}
// Draw one planned decoration.
export function drawPlanned(item, extra = "") {
  if (!item) return "";
  if (item.kind === "vignette") return captainVignette({ pose: item.pose, size: item.size, place: item.place, cls: extra });
  return botanical(item.kind, { ...item, cls: [item.cls, extra].filter(Boolean).join(" ") });
}
