// Capiday Botanical Decorative System (V10.88).
//
// One place for every plant, every Captain scene, the cover art and the paper
// grain, so pages never draw their own. Approved reference = specification:
// all pictures are the Founder's approved watercolour illustrations, cut by
// tools/cut_botanical_art.py from docs/visual/captain-scenes-v1.png and
// docs/visual/botanical-board-v1.png (paper → transparent). Nothing here is
// redrawn, turned into SVG or restyled. They are Phase 1 production assets,
// not brand masters (see Public/botanical/manifest.json for source, pixels
// and status).
//
//   botanical(kind, options)  kind: "corner" | "sprig" | "berry" | "blossom"
//   captainVignette(options)  pose: "sleep" | "sit" | "ready" | "stamp"
//   captainPortrait(kind)     "face" | "happy" | "sit-up" (Captain Pack v1)
//   coverArt(kind)            "everyday" | "captain" ("travel": NEEDS HI-RES)
//   decorPlan(surface, ctx)   which decorations a surface may show (density)
//
// Sizes: each asset has a ceiling — its clear size on a 3x iPhone. A request
// for more is held at that ceiling (never upscaled to fill space):
//   APPROVED      hi-res enough for its production size
//   LIMITED SIZE  used only up to its natural size (px / 3)
//   NEEDS HI-RES  not shipped (kept in docs/visual/asset-audit/ only)
//
// Every piece is decoration: alt="", aria-hidden, never tappable, never over
// words or controls, the same every time (no randomness, no animation).
// Storytelling surfaces may carry it; interaction surfaces stay clean.

// name: [width px, height px, ceiling pt, status]
export const ASSETS = {
  "captain-sleep": [540, 306, 180, "APPROVED"],
  "captain-sit": [540, 371, 180, "APPROVED"],
  "captain-ready": [540, 372, 180, "APPROVED"],
  "captain-stamp": [540, 342, 180, "APPROVED"],
  "corner-berry": [244, 169, 81, "APPROVED"],
  "corner-blossom": [175, 162, 58, "LIMITED SIZE"],
  "berry-1": [177, 107, 59, "APPROVED"],
  "berry-2": [140, 112, 46, "APPROVED"],
  "blossom-1": [161, 118, 53, "APPROVED"],
  "blossom-2": [151, 126, 50, "APPROVED"],
  "sprig-3": [86, 80, 28, "LIMITED SIZE"],
  "sprig-5": [94, 80, 31, "LIMITED SIZE"],
  "sprig-6": [83, 76, 27, "LIMITED SIZE"],
  "cover-sprig": [94, 101, 31, "LIMITED SIZE"],
};
// Captain Illustrated Asset Pack v1 (Public/captain/, cut by
// tools/cut_captain_pack.py; Founder 2026-11-18). Only what the interface
// uses is shipped; the rest stays staged in docs/visual/captain-pack-v1/.
export const CAPTAIN_PACK = {
  "captain-face": [360, 386, 120, "APPROVED"],
  "captain-sit-up": [540, 647, 180, "APPROVED"],
  "expr-happy": [360, 452, 120, "APPROVED"],
};
const assetOf = (name) => ASSETS[name] || CAPTAIN_PACK[name];
// Not good enough at their real size yet: never used in the interface.
export const NEEDS_HI_RES = ["cover-travel-blossom", "sprig-1", "sprig-2", "sprig-4"];

// Each kind's approved variants and its default display width (pt).
const KINDS = {
  corner: { variants: ["corner-berry", "corner-blossom"], size: 72 },
  sprig: { variants: ["sprig-5", "sprig-3", "sprig-6"], size: 30 },
  berry: { variants: ["berry-1", "berry-2"], size: 56 },
  blossom: { variants: ["blossom-1", "blossom-2"], size: 50 },
};
const PLACES = new Set(["tr", "tl", "br", "bl", "inline"]);
export const CAPTAIN_POSES = ["sleep", "sit", "ready", "stamp"];

// Display width in pt, held at the asset's clear ceiling.
export function clearWidth(name, wanted) {
  const asset = assetOf(name);
  if (!asset) return 0;
  return Math.min(Math.max(1, Math.round(wanted || asset[2])), asset[2]);
}
function art(name, { width, place = "inline", flip = false, tone = "", cls = "" } = {}) {
  const asset = assetOf(name);
  if (!asset) return "";
  const [w, h, , status] = asset;
  const shown = clearWidth(name, width);
  const classes = ["bot", `bot-${name.replace(/-\d+$/, "")}`, `bot-at-${PLACES.has(place) ? place : "inline"}`];
  if (flip) classes.push("bot-flip");
  if (tone === "quiet") classes.push("bot-quiet");
  if (status === "LIMITED SIZE") classes.push("bot-limited");
  if (cls) classes.push(cls);
  return `<img class="${classes.join(" ")}" src="${ASSETS[name] ? "botanical" : "captain"}/${name}.png" width="${w}" height="${h}" style="width:${shown}px" data-asset="${name}" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">`;
}

// The one way to put a plant on a surface.
//   variant: which approved picture; size: wanted width in pt (held at the
//   clear ceiling); place: tr | tl | br | bl | inline; flip: mirror left↔right;
//   tone: "quiet" (lighter).
export function botanical(kind, { variant = 0, size, place = "tr", flip = false, tone = "", cls = "" } = {}) {
  const k = KINDS[kind];
  if (!k) return "";
  const name = k.variants[Math.abs(variant) % k.variants.length];
  return art(name, { width: size ?? k.size, place, flip, tone, cls });
}

// Captain — Little Keeper / 守册猫: the grey long-haired cat with amber eyes,
// with books, a small seal and a few leaves. The Eastern feeling comes from
// the books, paper, seal and plants, never from costume.
//   sleep: resting on the books · sit: sitting by the books and the seal ·
//   ready: a paw on the seal · stamp: pressing a stamp for you.
export function captainVignette({ pose = "sit", size = 150, place = "inline", cls = "" } = {}) {
  const p = CAPTAIN_POSES.includes(pose) ? pose : "sit";
  return art(`captain-${p}`, { width: size, place, cls: ["bot-vignette", `pose-${p}`, cls].filter(Boolean).join(" ") });
}

// Captain on his own (no props), from Pack v1:
//   face: front bust, calm (avatars) · happy: smiling, eyes closed ·
//   sit-up: sitting, looking up (greeting).
// No outfit is drawn yet: keeper.outfit stays stored and untouched.
const PORTRAITS = { face: "captain-face", happy: "expr-happy", "sit-up": "captain-sit-up" };
export function captainPortrait(kind = "face", { size = 64, cls = "" } = {}) {
  const name = PORTRAITS[kind] || PORTRAITS.face;
  return art(name, { width: size, place: "inline", cls: ["bot-captain", `cap-${kind in PORTRAITS ? kind : "face"}`, cls].filter(Boolean).join(" ") });
}

// The default covers' art. Travel Notes has none until its blossom has a
// hi-res source (NEEDS HI-RES): the cover stays cloth + title + seal.
const COVER_ART = { everyday: ["cover-sprig", 31], captain: ["captain-sit", 120] };
export function coverArt(kind, cls = "") {
  const entry = COVER_ART[kind];
  if (!entry) return "";
  return art(entry[0], { width: entry[1], cls: [`bot-cover-${kind}`, cls].filter(Boolean).join(" ") });
}

// ---------- density ----------
// Botanical details stay scarce. In one viewport: at most one large piece
// (corner / berry), one Captain scene and about two or three small ones. Many
// photos → fewer plants; an empty page → a little more. Priority: the
// person's content > typography > stamps > plants.
export const DENSITY = { corner: 1, vignette: 1, small: 3 };
const CORNERS = new Set(["corner", "berry"]);

// surface: "home" | "stampCard" | "stamps". ctx: what is on screen.
export function decorPlan(surface, ctx = {}) {
  const plan = [];
  if (surface === "home") {
    // One small sprig by the date — none when the first screen is already
    // full of the person's own photos.
    if ((ctx.photos || 0) < 4) plan.push({ slot: "date", kind: "sprig", variant: 0, size: 30, place: "tr" });
  } else if (surface === "stampCard") {
    // The stamp card's one corner: the seasonal berry branch.
    plan.push({ slot: "corner", kind: "berry", variant: 0, size: 56, place: "bl" });
  } else if (surface === "stamps") {
    // One very subtle corner (smaller when the month is full of photo stamps).
    const busy = (ctx.photoStamps || 0) >= 10;
    plan.push({ slot: "corner", kind: "corner", variant: 1, size: busy ? 44 : 58, place: "br", tone: "quiet" });
    // An empty month: Captain sitting by the books and the seal.
    if (ctx.empty) plan.push({ slot: "empty", kind: "vignette", pose: "sit", size: 150, place: "inline" });
  }
  return plan;
}
// True when a plan keeps to the density rules (tests).
export function withinDensity(plan) {
  const corners = plan.filter((p) => CORNERS.has(p.kind)).length;
  const vignettes = plan.filter((p) => p.kind === "vignette").length;
  return corners <= DENSITY.corner && vignettes <= DENSITY.vignette && plan.length - corners - vignettes <= DENSITY.small;
}
// Draw one planned decoration.
export function drawPlanned(item, extra = "") {
  if (!item) return "";
  if (item.kind === "vignette") return captainVignette({ pose: item.pose, size: item.size, place: item.place, cls: extra });
  return botanical(item.kind, { ...item, cls: [item.cls, extra].filter(Boolean).join(" ") });
}
