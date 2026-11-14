// Debug-only (-LittleDaysCheck): the app's OWN voice flow, by its buttons —
// 更多方式 → 声音 → 开始录音 → 3 s → 停止 → the clip on the page → ▶ (first)
// → pause → ▶ (again). Reports the format recorded, how long until the clip
// is on the page, the app's own play timings (media_play "playing" /
// "moving", ms from the tap) and the file's leading silence. Records from the
// Simulator microphone into this throw-away install only.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
async function until(test, ms = 15000) {
  for (let t = 0; t < ms; t += 100) {
    const v = test();
    if (v) return v;
    await wait(100);
  }
  return null;
}
const click = async (sel) => {
  const el = await until(() => $(sel));
  if (!el) throw new Error("not found: " + sel);
  el.click();
  await wait(400);
};
const out = { steps: [] };
const step = (name, extra = {}) => out.steps.push({ name, at: Math.round(performance.now()), ...extra });
try {
  await until(() => $(".hero"));
  await wait(1500);
  await click('[data-action="quick-open"]');
  await click('[data-action="quick-way"][data-way="voice"]');
  await click(".quick-start");
  await click('[data-action="record-audio"]');
  await until(() => $('[data-action="stop-recording"]'));
  step("recording");
  await wait(3000);
  const stopAt = performance.now();
  await click('[data-action="stop-recording"]');
  const audio = await until(() => $('#journal-canvas .audio-layer audio[src^="blob:"]'), 20000);
  out.onPageMs = Math.round(performance.now() - stopAt);
  const s = JSON.parse(localStorage.getItem("little-days.v1"));
  const clip = Object.values(s.drafts || {}).flatMap((d) => [d, ...(d.moments || [])]).flatMap((p) => p.media || []).find((c) => c.origin === "recording");
  out.clip = { mime: clip?.mime, size: clip?.size, duration: clip?.duration, peaks: Boolean(clip?.peaks) };
  out.preload = audio?.getAttribute("preload");
  out.session = navigator.audioSession ? navigator.audioSession.type : "none";
  // the file: leading silence
  try {
    const buf = await (await fetch(audio.src)).arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const dec = await ctx.decodeAudioData(buf);
    const d = dec.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const th = Math.max(0.01, peak * 0.1);
    let first = 0;
    while (first < d.length && Math.abs(d[first]) < th) first++;
    out.file = { decodedSec: +dec.duration.toFixed(2), leadingSilenceMs: Math.round((first / dec.sampleRate) * 1000) };
    ctx.close();
  } catch (e) {
    out.file = "decode:" + e.name;
  }
  const plays = () => JSON.parse(localStorage.getItem("little-days.events") || "[]").filter((e) => e.e === "media_play");
  const n0 = plays().length;
  await click("#journal-canvas .audio-layer .layer-play");
  await until(() => plays().slice(n0).some((e) => e.stage === "moving"), 15000);
  await wait(800);
  out.firstPlay = plays().slice(n0);
  audio.pause();
  await wait(500);
  const n1 = plays().length;
  await click("#journal-canvas .audio-layer .layer-play");
  await until(() => plays().slice(n1).some((e) => e.stage === "moving"), 15000);
  out.againPlay = plays().slice(n1);
  audio.pause();
  await wait(300);
  out.peaksLater = Boolean(Object.values(JSON.parse(localStorage.getItem("little-days.v1")).drafts || {}).flatMap((d) => [d, ...(d.moments || [])]).flatMap((p) => p.media || []).find((c) => c.origin === "recording")?.peaks);
} catch (e) {
  out.error = String(e?.message || e);
}
return JSON.stringify(out);
