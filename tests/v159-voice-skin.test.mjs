// V10.63 · voice player looks: pure helpers.
import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../Public/js/voice-skin.mjs";

test("skin: three looks, minimal by default (older layers have none)", () => {
  assert.equal(V.skinOf({}), "minimal");
  assert.equal(V.skinOf({ skin: "vinyl" }), "vinyl");
  assert.equal(V.skinOf({ skin: "recorder" }), "recorder");
  assert.equal(V.skinOf({ skin: "boombox" }), "minimal");
});

test("peaks: 20 values from the sound, loudest = 1, quiet ones still show", () => {
  const samples = Float32Array.from({ length: 4000 }, (_, i) => (i < 2000 ? 0.1 : 0.8) * Math.sin(i));
  const peaks = V.peaksFrom(samples);
  assert.equal(peaks.length, 20);
  assert.equal(Math.max(...peaks), 1);
  assert.ok(peaks.slice(0, 10).every((v) => v < 0.3 && v >= 0.12), JSON.stringify(peaks));
  assert.deepEqual(V.peaksFrom(new Float32Array(0)), []);
  assert.ok(V.peaksFrom(new Float32Array(100)).every((v) => v === 0.12), "silence: the lowest bars");
});

test("older clips: a steady pattern from the id, the same every time", () => {
  const a = V.peaksOf({ id: "clip-1" });
  assert.equal(a.length, 20);
  assert.deepEqual(a, V.peaksOf({ id: "clip-1" }));
  assert.notDeepEqual(a, V.peaksOf({ id: "clip-2" }));
  assert.deepEqual(V.peaksOf({ id: "x", peaks: Array(20).fill(0.5) }), Array(20).fill(0.5));
  assert.equal(V.peaksOf({ id: "x", peaks: [1, 2] }).length, 20, "a wrong length is not used");
});

test("played bars and the clock", () => {
  assert.equal(V.playedBars(0, 48), 0);
  assert.equal(V.playedBars(12, 48), 5);
  assert.equal(V.playedBars(48, 48), 20);
  assert.equal(V.playedBars(5, 0), 0);
  assert.equal(V.clock(0), "0:00");
  assert.equal(V.clock(72.9), "1:12");
});
