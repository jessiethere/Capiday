// V10.64 · merge / split / move a photo / photo order — nothing lost, nothing copied.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../Public/js/page-ops.mjs";

const photo = (id, order) => ({ id, kind: "photo", text: "", mediaRef: `media:${id}`, x: 50, y: 50, w: 40, h: 30, scale: 1, rotation: 0, ...(order != null ? { photoOrder: order } : {}) });
const day = () => ({
  date: "2026-11-14",
  bookId: "daily",
  layers: [],
  media: [],
  moments: [
    { id: "a", title: "早晨", body: "咖啡", time: "08:00", tags: ["咖啡"], bookId: "daily", layers: [photo("a1", 0), photo("a2", 1), { id: "a2c", kind: "text", text: "拿铁", captionOf: "a2", x: 50, y: 80 }, { id: "ag", kind: "text", gen: true, bind: "title", text: "早晨", x: 50, y: 10 }], media: [] },
    { id: "b", title: "午后", body: "海边", time: "14:00", tags: ["海"], bookId: "daily", layers: [photo("b1"), { id: "bs", kind: "sticker", text: "🌼", x: 20, y: 20 }, { id: "bv", kind: "audio", clipId: "clip-b", x: 50, y: 90 }, { id: "bg", kind: "text", gen: true, bind: "title", text: "午后", x: 50, y: 10 }], media: [{ id: "clip-b", kind: "audio", name: "风", source: "media:clip-b" }] },
    { id: "c", title: "", body: "", time: "", tags: [], bookId: "daily", layers: [photo("c1")], media: [] },
  ],
});
let n = 0;
const makeId = () => `new-${++n}`;
const makeMoment = (entry, values) => ({ id: makeId(), title: "", body: "", tags: [], layers: [], media: [], ...values });

test("photo order: photoOrder first, then stacking order for older pages", () => {
  const page = { layers: [photo("x"), photo("y", 0), { id: "t", kind: "text" }, photo("z")] };
  assert.deepEqual(P.photoSequence(page).map((l) => l.id), ["y", "x", "z"]);
  P.setPhotoOrder(page, ["z", "x"]);
  assert.deepEqual(P.photoSequence(page).map((l) => l.id), ["z", "x", "y"]);
  assert.deepEqual(page.layers.map((l) => l.id), ["x", "y", "t", "z"], "the stacking stays");
});

test("merge: everything joins the first page; titles become text; words and tags kept; media the same", () => {
  const entry = day();
  const refs = P.mediaRefs(entry);
  const id = P.mergeMoments(entry, ["b", "a", "c"], { makeId });
  assert.equal(id, "a", "the first page in the day's order");
  assert.deepEqual(entry.moments.map((m) => m.id), ["a"]);
  const a = entry.moments[0];
  assert.deepEqual(P.photoSequence(a).map((l) => l.id), ["a1", "a2", "b1", "c1"]);
  assert.ok(a.layers.some((l) => l.id === "bs") && a.layers.some((l) => l.id === "bv") && a.layers.some((l) => l.id === "a2c"));
  assert.ok(!a.layers.some((l) => l.id === "bg"), "b's generated title display goes …");
  assert.ok(a.layers.some((l) => l.kind === "text" && l.text === "午后" && !l.gen), "… and its title is kept as a text box");
  assert.equal(a.body, "咖啡\n\n海边");
  assert.deepEqual(a.tags, ["咖啡", "海"]);
  assert.deepEqual(a.media.map((c) => c.id), ["clip-b"], "the sound's clip moved with its layer");
  assert.deepEqual(P.mediaRefs(entry), refs, "no media reference lost or added");
  assert.equal(P.mergeMoments(entry, ["a"]), null, "one page: nothing to merge");
});

test("split from a photo: it and the ones after (with their captions) go to a new page right after", () => {
  const entry = day();
  const refs = P.mediaRefs(entry);
  const id = P.splitAt(entry, "a", "a2", { makeMoment });
  assert.deepEqual(entry.moments.map((m) => m.id), ["a", id, "b", "c"]);
  assert.deepEqual(entry.moments[0].layers.map((l) => l.id), ["a1", "ag"]);
  assert.deepEqual(entry.moments[1].layers.map((l) => l.id), ["a2", "a2c"]);
  assert.equal(entry.moments[1].bookId, "daily");
  assert.equal(entry.moments[1].time, "08:00");
  assert.deepEqual(P.mediaRefs(entry), refs);
  assert.equal(P.splitAt(entry, "a", "a1", { makeMoment }), null, "nothing before the first photo");
});

test("move a photo to another page, or to a page of its own; undo is one snapshot", () => {
  const entry = day();
  const before = structuredClone(entry);
  const refs = P.mediaRefs(entry);
  assert.equal(P.movePhoto(entry, "a", "a2", "c"), "c");
  assert.deepEqual(entry.moments[2].layers.map((l) => l.id), ["c1", "a2", "a2c"]);
  assert.deepEqual(P.photoSequence(entry.moments[2]).map((l) => [l.id, l.photoOrder]), [["c1", 0], ["a2", 1]]);
  assert.deepEqual(P.photoSequence(entry.moments[0]).map((l) => [l.id, l.photoOrder]), [["a1", 0]]);
  const own = P.movePhoto(entry, "b", "b1", null, { makeMoment });
  assert.deepEqual(entry.moments.map((m) => m.id), ["a", "b", own, "c"]);
  assert.deepEqual(entry.moments[1].layers.map((l) => l.id), ["bs", "bv", "bg"], "the sticker, sound and title stay");
  assert.deepEqual(P.mediaRefs(entry), refs);
  assert.equal(P.movePhoto(entry, "a", "nope", "c"), null);
  assert.equal(P.movePhoto(entry, "a", "a1", "a"), null, "not to the same page");
  // The editor's undo restores the snapshot taken before the change.
  assert.notDeepEqual(entry, before);
  assert.deepEqual(structuredClone(before), day());
});
