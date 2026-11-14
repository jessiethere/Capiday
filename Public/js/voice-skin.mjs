// V10.63 · 语音播放器的三种外观 (design round V10.52 §4, approved): pure helpers.
//
// One sound clip, three looks on the paper — the layer's optional `skin`:
//   "minimal" (default) · a cream ticket, a round play key, 20 bars, title, time
//   "recorder"          · a small flat cassette recorder; the reels turn while playing
//   "vinyl"             · a cream sleeve with a record half out; it turns while playing
// Changing the look changes only `layer.skin`: the sound file, its title
// (`clip.name`), its length and where it is in playing are untouched.
//
// The bars come from the sound itself, worked out once when it is added
// (`clip.peaks`, 20 numbers 0–1) — never analysed while playing. An older clip
// without them gets a steady pattern from its id (the same every time).

export const SKINS = ["minimal", "recorder", "vinyl"];
export const BARS = 20;

export const skinOf = (layer) => (SKINS.includes(layer?.skin) ? layer.skin : "minimal");

// 20 loudness values from decoded samples (one channel is enough), scaled so
// the loudest bar is 1 and a quiet one still shows (≥ 0.12).
export function peaksFrom(samples, count = BARS) {
  const n = samples?.length || 0;
  if (!n) return [];
  const size = Math.max(1, Math.floor(n / count));
  const out = [];
  for (let i = 0; i < count; i++) {
    let sum = 0;
    let seen = 0;
    const end = Math.min(n, (i + 1) * size);
    for (let j = i * size; j < end; j++) {
      sum += samples[j] * samples[j];
      seen++;
    }
    out.push(seen ? Math.sqrt(sum / seen) : 0);
  }
  const top = Math.max(...out);
  return out.map((v) => Math.round(Math.max(0.12, top ? v / top : 0) * 100) / 100);
}

// A steady pattern for a clip that has no peaks (older clips): the same id
// always gives the same bars.
export function fallbackPeaks(seed = "", count = BARS) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    out.push(Math.round((0.3 + (h % 70) / 100) * 100) / 100);
  }
  return out;
}

export function peaksOf(clip) {
  const peaks = Array.isArray(clip?.peaks) ? clip.peaks.filter((v) => Number.isFinite(v)) : [];
  return peaks.length === BARS ? peaks.map((v) => Math.min(1, Math.max(0.12, v))) : fallbackPeaks(clip?.id || clip?.name || "");
}

// How many of the bars are "played" at this point.
export const playedBars = (current, duration, count = BARS) => (duration > 0 ? Math.min(count, Math.max(0, Math.floor((current / duration) * count + 1e-9))) : 0);

export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// V10.66 (P1, iPhone: a new recording played ~7 s late): which format a
// voice note is recorded in. On Apple WebKit (the iPhone app, Safari) AAC in
// MP4 — the format iOS plays natively; WebM/Opus goes through WebKit's own
// WebM player there, and once stored its duration is lost (NaN in the
// Simulator probe tools/mac/uitest/voice-latency.js) and it is ~6× larger.
// Other browsers keep WebM/Opus. Recordings already saved are not changed.
export function recordingMime(ua = "", isSupported = () => false) {
  const appleWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua);
  const order = appleWebKit ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"] : ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return order.find((type) => isSupported(type)) || "";
}
