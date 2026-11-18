// V10.80 · 每日一问, 快速记录 into a day, notes added to one photo. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { PROMPTS, promptFor, promptText, pagePromptText } from "../Public/js/daily-prompts.mjs";
import { pagePhotos, photoNotes, noteTextLayer, noteAudio, noteSpot } from "../Public/js/photo-notes.mjs";
import { addPageToDay } from "../Public/js/model.mjs";

test("every question has both languages, unique ids, no empty text", () => {
  assert.ok(PROMPTS.length >= 20);
  assert.equal(new Set(PROMPTS.map((p) => p.id)).size, PROMPTS.length);
  for (const p of PROMPTS) {
    assert.ok(p.zh.trim() && p.en.trim(), p.id);
    assert.ok(/[一-鿿]/.test(p.zh), `${p.id} zh is Chinese`);
    assert.ok(!/[一-鿿]/.test(p.en), `${p.id} en has no Chinese`);
  }
});

test("one question per day, the same on every device; 换一题 moves on and comes round", () => {
  assert.equal(promptFor("2026-11-18").id, promptFor("2026-11-18", 0).id);
  assert.notEqual(promptFor("2026-11-18", 1).id, promptFor("2026-11-18", 0).id);
  assert.equal(promptFor("2026-11-18", PROMPTS.length).id, promptFor("2026-11-18", 0).id);
  assert.notEqual(promptFor("2026-11-18").id, promptFor("2026-11-19").id, "neighbouring days differ");
  assert.ok(promptFor("not a date"));
});

test("the page shows the question in the app's language; an unknown id keeps the words it was answered with", () => {
  const q = PROMPTS[0];
  assert.equal(promptText(q.id, "en"), q.en);
  assert.equal(promptText(q.id, "zh"), q.zh);
  assert.equal(pagePromptText({ prompt: { id: q.id, text: q.zh } }, "en"), q.en);
  assert.equal(pagePromptText({ prompt: { id: "gone", text: "以前的问题" } }, "en"), "以前的问题");
  assert.equal(pagePromptText({}, "zh"), "");
});

const photo = (id, x, y, w, h, extra = {}) => ({ id, kind: "photo", text: "", mediaRef: `media:00000000-0000-4000-8000-00000000000${id.slice(-1)}`, x, y, w, h, scale: 1, rotation: 0, ...extra });
const clip = (id) => ({ id, kind: "audio", name: "语音", source: `media:00000000-0000-4000-8000-0000000000a${id.slice(-1)}`, duration: 3, origin: "recording" });

test("one photo on a page: the page's words and sounds belong to it", () => {
  const page = { title: "今天的咖啡 really good", body: "", layers: [photo("p1", 50, 40, 60, 40), { id: "a1", kind: "audio", clipId: "c1" }], media: [clip("c1")] };
  const n = photoNotes(page, "p1");
  assert.deepEqual(n.words.map((w) => w.text), ["今天的咖啡 really good"]);
  assert.deepEqual(n.clips.map((c) => c.id), ["c1"]);
});

test("several photos: each shows only what was added for it — nothing crosses over", () => {
  const page = {
    title: "整页的话",
    layers: [photo("p1", 30, 30, 40, 30, { caption: "左边那张" }), photo("p2", 70, 30, 40, 30), { id: "a0", kind: "audio", clipId: "c0" }],
    media: [clip("c0")],
  };
  assert.equal(pagePhotos(page).length, 2);
  const text = noteTextLayer(page, "p2", "第二张后来想起的", () => "t1");
  page.layers.push(text);
  const { clip: c1, layer: a1 } = noteAudio(page, "p1", clip("c1"), () => "a1");
  page.layers.push(a1);
  page.media.push(c1);
  const one = photoNotes(page, "p1");
  const two = photoNotes(page, "p2");
  assert.deepEqual(one.words.map((w) => w.text), ["左边那张"]);
  assert.deepEqual(one.clips.map((c) => c.id), ["c1"]);
  assert.deepEqual(two.words.map((w) => w.text), ["第二张后来想起的"]);
  assert.deepEqual(two.clips.map((c) => c.id), []);
  assert.ok(!one.words.concat(two.words).some((w) => w.text === "整页的话"), "page-wide words belong to no single photo");
  assert.equal(text.forPhoto, "p2");
  assert.equal(a1.forPhoto, "p1");
});

test("a note goes under its photo, inside the paper; later ones step down", () => {
  const page = { layers: [photo("p1", 50, 40, 60, 40)] };
  const a = noteSpot(page, "p1");
  assert.ok(a.y > 60 && a.y <= 94 && a.x - a.w / 2 >= 0 && a.x + a.w / 2 <= 100, JSON.stringify(a));
  page.layers.push({ ...noteTextLayer(page, "p1", "一", () => "t1") });
  assert.ok(noteSpot(page, "p1").y > a.y);
  const low = { layers: [photo("p1", 50, 90, 60, 30)] };
  assert.ok(noteSpot(low, "p1").y <= 94);
});

test("a quick record joins the saved day; a draft keeps going and gets the page too", () => {
  const s = { entries: [{ id: "e1", date: "2026-11-18", bookId: "a", moments: [{ id: "old" }] }], drafts: { "2026-11-18": { id: "e1", date: "2026-11-18", moments: [{ id: "old" }, { id: "draft-only" }] } } };
  addPageToDay(s, "2026-11-18", { id: "j1", title: "hi", bookId: "a" });
  assert.deepEqual(s.entries[0].moments.map((m) => m.id), ["old", "j1"]);
  assert.deepEqual(s.drafts["2026-11-18"].moments.map((m) => m.id), ["old", "draft-only", "j1"], "the draft is neither lost nor saved");
});

test("a quick record on a day with nothing yet makes that day; a sample day is replaced", () => {
  const s = { entries: [{ id: "demo", date: "2026-11-17", isDemo: true, moments: [{ id: "x" }] }], drafts: {} };
  addPageToDay(s, "2026-11-17", { id: "j1" }, { id: "d1", bookId: "b" });
  addPageToDay(s, "2026-11-16", { id: "j2" }, { id: "d2", bookId: "b" });
  const d17 = s.entries.find((e) => e.date === "2026-11-17");
  assert.equal(d17.isDemo, false);
  assert.deepEqual(d17.moments.map((m) => m.id), ["j1"]);
  assert.equal(d17.bookId, "b");
  assert.equal(s.entries.filter((e) => e.date === "2026-11-16").length, 1);
  assert.throws(() => addPageToDay(s, "11/16", { id: "j3" }));
});
