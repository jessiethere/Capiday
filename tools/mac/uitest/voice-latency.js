// Debug-only probe (-LittleDaysCheck): WHY a new recording starts playing
// late. For each format the app may record in it measures, separately:
//   1. the file itself — decoded length and how long the start is silent;
//   2. the player — from src set to loadedmetadata, from play() to the
//      "playing" event, and to the moment currentTime really moves;
//   3. a second play of the same element (warm).
// Records ~3 s from the Simulator's microphone into memory only (nothing is
// saved or sent). Prints one JSON report.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.round(performance.now());
const out = { session0: navigator.audioSession ? navigator.audioSession.type : "none", formats: {} };
function setSession(type) {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type;
  } catch {}
}
async function record(mime) {
  setSession("play-and-record");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  const t0 = now();
  rec.start(250);
  await wait(3000);
  const tStop = now();
  rec.stop();
  await stopped;
  const stopMs = now() - tStop;
  stream.getTracks().forEach((t) => t.stop());
  setSession("playback");
  return { blob: new Blob(chunks, { type: rec.mimeType }), recMime: rec.mimeType, chunks: chunks.length, stopMs, recordedMs: tStop - t0 };
}
async function silence(blob) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const th = Math.max(0.01, peak * 0.1);
    let first = d.length;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) >= th) { first = i; break; }
    ctx.close();
    return { decodedSec: +buf.duration.toFixed(2), peak: +peak.toFixed(4), leadingSilenceMs: Math.round((first / buf.sampleRate) * 1000) };
  } catch (e) {
    return { decodeError: e.name };
  }
}
async function playOnce(a, label) {
  const r = {};
  const t0 = now();
  const playing = new Promise((res) => a.addEventListener("playing", () => res(now() - t0), { once: true }));
  let resolved = null;
  const p = a.play().then(() => (resolved = now() - t0), (e) => (resolved = "rejected:" + e.name));
  // currentTime really moving
  let moved = null;
  for (let i = 0; i < 120 && moved === null; i++) {
    await wait(50);
    if (a.currentTime > 0.05) moved = now() - t0;
  }
  await p;
  r.playResolvedMs = resolved;
  r.playingEventMs = await Promise.race([playing, wait(100).then(() => "none")]);
  r.timeMovesMs = moved ?? "no-move-6s";
  r.readyState = a.readyState;
  a.pause();
  return r;
}
async function player(blob) {
  const r = {};
  const a = document.createElement("audio");
  a.preload = "metadata"; // what the app's players use
  document.body.append(a);
  const t0 = now();
  const meta = new Promise((res) => {
    a.addEventListener("loadedmetadata", () => res(now() - t0), { once: true });
    a.addEventListener("error", () => res("error:" + (a.error && a.error.code)), { once: true });
  });
  a.src = URL.createObjectURL(blob);
  r.metadataMs = await Promise.race([meta, wait(10000).then(() => "timeout")]);
  r.duration = String(a.duration);
  r.first = await playOnce(a, "first");
  a.currentTime = 0;
  await wait(200);
  r.second = await playOnce(a, "second");
  a.remove();
  return r;
}
for (const mime of ["audio/webm;codecs=opus", "audio/mp4"]) {
  if (!MediaRecorder.isTypeSupported(mime)) {
    out.formats[mime] = "unsupported";
    continue;
  }
  try {
    const rec = await record(mime);
    const f = { recMime: rec.recMime, size: rec.blob.size, chunks: rec.chunks, stopMs: rec.stopMs, ...(await silence(rec.blob)) };
    f.player = await player(rec.blob);
    // The same bytes after the app's save path: an ArrayBuffer turned back into a Blob.
    const copy = new Blob([await rec.blob.arrayBuffer()], { type: rec.blob.type });
    f.storedCopy = await player(copy);
    out.formats[mime] = f;
  } catch (e) {
    out.formats[mime] = "error:" + e.name + ":" + e.message;
  }
}
out.appWouldRecord = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
out.sessionEnd = navigator.audioSession ? navigator.audioSession.type : "none";
return JSON.stringify(out);
