// V10.78 · Memory Wall v1.0 — the pure rules (photo-wall.mjs): hide /
// restore, whole pages, time and custom order, the 13 edge cases that can be
// checked without a browser. Nothing here may change a page. Synthetic data.
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../Public/js/photo-wall.mjs";
import { mediaReferences, visitMediaReferences } from "../Public/js/media.mjs";

const ph = (id, ref, extra = {}) => ({ id, kind: "photo", mediaRef: ref, x: 50, y: 50, scale: 1, rotation: 0, ...extra });
const base = () => ({
  books: [{ id: "a" }, { id: "b" }],
  entries: [
    { id: "e1", date: "2026-11-01", bookId: "a", layers: [], moments: [{ id: "m1", bookId: "a", layers: [ph("l1", "media:p1"), ph("l2", "media:p2")] }] },
    { id: "e2", date: "2026-11-03", bookId: "a", layers: [], moments: [{ id: "m2", bookId: "b", title: "整页", layers: [ph("l3", "media:p3"), ph("l4", "media:p1")] }] },
    { id: "demo", date: "2026-11-04", isDemo: true, bookId: "a", layers: [], moments: [{ id: "md", layers: [ph("x", "media:demo")] }] },
  ],
  drafts: {},
  checks: [],
});
const refs = (r) => r.shown.map((c) => c.ref || c.key);
const frozen = (s) => JSON.stringify({ e: s.entries, b: s.books });

test("MW-01: no setting = today's wall (photos once, newest day first, no samples)", () => {
  const r = W.applyWall(base());
  assert.deepEqual(refs(r), ["media:p3", "media:p1", "media:p2"]);
  assert.equal(r.order, "time");
});

test("MW-02: hide / restore; the same photo is hidden wherever it is; pages untouched", () => {
  const s = base();
  const before = frozen(s);
  const card = W.applyWall(s).shown.find((c) => c.ref === "media:p1");
  s.wall = W.hideCards(s, [card], "2026-11-15T00:00:00Z");
  let r = W.applyWall(s);
  assert.deepEqual(refs(r), ["media:p3", "media:p2"]);
  assert.deepEqual(r.hidden.map((c) => c.ref), ["media:p1"]);
  assert.equal(frozen(s), before, "hiding changes no page");
  // It stays hidden if its first place is removed (it moves to its other page).
  const s2 = structuredClone(s);
  s2.entries[1].moments[0].layers = s2.entries[1].moments[0].layers.filter((l) => l.id !== "l4");
  assert.ok(!refs(W.applyWall(s2)).includes("media:p1"));
  s.wall = W.unhideCards(s, r.hidden);
  assert.deepEqual(refs(W.applyWall(s)), ["media:p3", "media:p1", "media:p2"]);
});

test("edge 4: a replaced photo in a hidden place shows again (the new one was never hidden)", () => {
  const s = base();
  s.wall = W.hideCards(s, [W.applyWall(s).shown.find((c) => c.ref === "media:p3")]);
  s.entries[1].moments[0].layers[0].mediaRef = "media:p9";
  assert.ok(refs(W.applyWall(s)).includes("media:p9"));
});

test("MW-03: a whole page on the wall; gone when the page is deleted (no broken card); limit 50", () => {
  const s = base();
  s.wall = W.addPage(s, W.pageKeyOf("m2", "2026-11-03"));
  let r = W.applyWall(s);
  assert.equal(r.shown[0].type, "page");
  assert.equal(r.shown[0].momentId, "m2");
  assert.equal(W.applyWall(s, { bookId: "a" }).shown.filter((c) => c.type === "page").length, 0, "book filter: m2 is book b");
  const s2 = structuredClone(s);
  s2.entries[1].moments = [];
  assert.equal(W.applyWall(s2).shown.filter((c) => c.type === "page").length, 0);
  s.wall = W.removePage(s, W.pageKeyOf("m2", "2026-11-03"));
  assert.equal(W.applyWall(s).shown.filter((c) => c.type === "page").length, 0);
  const full = base();
  full.wall = { pages: Array.from({ length: 50 }, (_, i) => ({ key: `page:x${i}` })) };
  assert.throws(() => W.addPage(full, "page:m2"), { code: "wall-full" });
});

test("MW-04: custom order; new photos first; time order again keeps the custom order for later", () => {
  const s = base();
  const keys = W.applyWall(s).shown.map((c) => c.key);
  s.wall = W.moveCard(s, keys, keys[2], -1);
  let r = W.applyWall(s);
  assert.equal(r.order, "custom");
  assert.deepEqual(refs(r), ["media:p3", "media:p2", "media:p1"]);
  // A new photo (written later) comes first in the custom order.
  s.entries.push({ id: "e3", date: "2026-11-02", bookId: "a", layers: [], moments: [{ id: "m3", bookId: "a", layers: [ph("l5", "media:p5")] }] });
  assert.equal(refs(W.applyWall(s))[0], "media:p5");
  // Editing a page (words) changes nothing in the order.
  s.entries[0].moments[0].title = "改了字";
  assert.deepEqual(refs(W.applyWall(s)).slice(1), ["media:p3", "media:p2", "media:p1"]);
  s.wall = W.setOrder(s, "time");
  assert.equal(W.applyWall(s).order, "time");
  s.wall = W.setOrder(s, "custom");
  assert.deepEqual(refs(W.applyWall(s)).slice(1), ["media:p3", "media:p2", "media:p1"], "the custom order came back");
});

test("edge 7: keys hold no date; a page moved to another day keeps its settings", () => {
  const s = base();
  s.wall = W.hideCards(s, [W.applyWall(s).shown.find((c) => c.ref === "media:p3")]);
  s.entries[1].date = "2026-11-09";
  assert.ok(!refs(W.applyWall(s)).includes("media:p3"));
});

test("MW-05 / edge 8–9: settings travel with the backup; ids renamed on restore; old backups need nothing", () => {
  const s = base();
  s.wall = W.hideCards(s, [W.applyWall(s).shown.find((c) => c.ref === "media:p2")]);
  assert.ok(!mediaReferences(s).has("p2") || true);
  assert.equal(mediaReferences(s).has("p2"), true, "p2 is still on its page (required as before)");
  const r = structuredClone(s);
  visitMediaReferences(r, (ref) => ref.replace("media:p", "media:q"));
  assert.equal(Object.values(r.wall.hidden)[0].ref, "media:q2", "the hidden photo is renamed with its page");
  assert.ok(!refs(W.applyWall(r)).includes("media:q2"), "still hidden after the restore");
  const old = base();
  delete old.wall;
  assert.equal(W.applyWall(old).shown.length, 3, "an old backup (no setting): the wall as before");
});

test("a damaged setting is ignored, never breaks the wall", () => {
  const s = base();
  s.wall = { order: 7, hidden: "x", pages: [null, 3], custom: "y" };
  assert.deepEqual(refs(W.applyWall(s)), ["media:p3", "media:p1", "media:p2"]);
});

test("edge 13: 5000 photos — the wall is worked out quickly", () => {
  const s = { books: [{ id: "a" }], entries: [], drafts: {}, checks: [] };
  for (let d = 0; d < 500; d++) {
    const date = `2025-${String((d % 12) + 1).padStart(2, "0")}-${String((d % 28) + 1).padStart(2, "0")}`;
    s.entries.push({ id: "e" + d, date, bookId: "a", layers: [], moments: [{ id: "m" + d, bookId: "a", layers: Array.from({ length: 10 }, (_, i) => ph(`l${i}`, `media:${d}-${i}`)) }] });
  }
  s.wall = W.hideCards(s, W.applyWall(s).shown.slice(0, 200));
  const t0 = performance.now();
  const r = W.applyWall(s);
  const ms = performance.now() - t0;
  assert.equal(r.shown.length + r.hidden.length, 5000);
  assert.ok(ms < 400, `${Math.round(ms)} ms`);
});
