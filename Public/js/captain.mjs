// The illustrated Captain (V10.91): looks, moods and the Playroom.
//
// Founder decision (2026-11-18): the illustrated Captain is the one
// character. Captain wears no hat by default; the lemon hat is put on by the
// person in Looks. Pictures come from Captain Illustrated Asset Pack v1 and
// Playroom Asset Addendum v1.1 (Public/captain/, tools/cut_captain_pack.py) —
// never redrawn.
//
// keeper.outfit is stored as before: the default look is stored as "" and
// any other look by its id. Nothing here rewrites what is stored.

export const DEFAULT_LOOK = "none";

// The wardrobe. `art` is the picture shown on the look's chip.
export const LOOKS = [
  { id: "none", kind: "hat", zh: "不戴帽", en: "No hat", art: "captain-face" },
  { id: "lemon", kind: "hat", zh: "柠檬帽", en: "Lemon hat", art: "acc-lemon-hat" },
  { id: "yarn", kind: "accessory", zh: "毛线球", en: "Yarn ball", art: "acc-yarn" },
];

// The look Captain is wearing ("" and anything unknown = the default).
export function lookOf(keeper) {
  const id = keeper?.outfit || "";
  return LOOKS.some((look) => look.id === id) ? id : DEFAULT_LOOK;
}
// What to store for a chosen look (the default stays "").
export function storedLook(id) {
  return LOOKS.some((look) => look.id === id) && id !== DEFAULT_LOOK ? id : "";
}
export function looks(language = "zh-CN") {
  const en = language === "en";
  return LOOKS.map((look) => ({ ...look, name: en ? look.en : look.zh }));
}

// The app's moods → Captain Pack v1 portraits (botanicals.mjs captainPortrait).
const MOOD_ART = {
  idle: "face",
  normal: "face",
  happy: "happy",
  excited: "happy",
  encouraging: "happy",
  sleepy: "sleepy",
  quiet: "sleepy",
  peek: "calm",
  curious: "calm",
};
export function moodArt(mood) {
  return MOOD_ART[mood] || "face";
}

// Playroom (Founder: option B). One tap plays one round and stays on the last
// frame; another tap plays it again. Each sequence: four 768x512 frames on one
// canvas, at the Founder's timings.
//   no hat (default) → hugging the heart cushion
//   lemon hat        → batting the yarn ball, wearing the hat
//   yarn ball        → batting the yarn ball, no hat (Pack v1 playroom/01–04)
// (A hug wearing the lemon hat is still to come.)
export const PLAY = {
  none: { id: "hug", frames: ["hug-1", "hug-2", "hug-3", "hug-4"], ms: [180, 150, 220, 420] },
  lemon: { id: "yarn-hat", frames: ["play-hat-1", "play-hat-2", "play-hat-3", "play-hat-4"], ms: [160, 130, 130, 360] },
  yarn: { id: "yarn", frames: ["play-watch", "play-reach", "play-bat", "play-rolled"], ms: [160, 130, 130, 360] },
};
export function playFor(keeper) {
  return PLAY[lookOf(keeper)] || PLAY[DEFAULT_LOOK];
}
