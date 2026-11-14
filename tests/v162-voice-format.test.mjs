// V10.66 · P1: which format a voice note is recorded in.
import test from "node:test";
import assert from "node:assert/strict";
import { recordingMime } from "../Public/js/voice-skin.mjs";

const iPhoneApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const safariMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const both = () => true;

test("Apple WebKit (the iPhone app, Safari) records AAC in MP4 first — the format iOS plays natively", () => {
  assert.equal(recordingMime(iPhoneApp, both), "audio/mp4");
  assert.equal(recordingMime(safariMac, both), "audio/mp4");
});
test("other browsers keep WebM/Opus", () => {
  assert.equal(recordingMime(chrome, both), "audio/webm;codecs=opus");
});
test("falls back to what is supported, or nothing", () => {
  assert.equal(recordingMime(iPhoneApp, (t) => t.startsWith("audio/webm")), "audio/webm;codecs=opus");
  assert.equal(recordingMime(chrome, (t) => t === "audio/mp4"), "audio/mp4");
  assert.equal(recordingMime(chrome, () => false), "");
});
