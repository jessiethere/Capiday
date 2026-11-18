// V10.79 · setPageBook: a page moves into another journal without being
// copied — same id, same content, only its journal changes. Moving the day
// page never takes the day's other pages (those without their own journal)
// along. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { setPageBook } from "../Public/js/model.mjs";
import { visiblePages } from "../Public/js/pages.mjs";

const day = () => ({
  id: "e1",
  date: "2026-11-18",
  bookId: "a",
  title: "",
  body: "",
  layers: [],
  media: [],
  moments: [
    { id: "m1", bookId: "a", title: "一", layers: [{ id: "l1", kind: "photo", mediaRef: "media:00000000-0000-4000-8000-000000000001", text: "" }], media: [] },
    { id: "m2", title: "二（跟着天）", layers: [], media: [] },
    { id: "m3", bookId: "b", title: "三", layers: [], media: [] },
  ],
});

test("a page moves: same object, same id and content, only bookId changes", () => {
  const e = day();
  const before = structuredClone(e.moments[0]);
  assert.equal(setPageBook(e, "m1", "b"), true);
  assert.equal(e.moments.length, 3, "nothing copied");
  assert.deepEqual({ ...e.moments[0], bookId: "a" }, before);
  assert.equal(e.moments[0].bookId, "b");
  assert.equal(e.bookId, "a", "the day keeps its journal");
  assert.equal(e.moments[1].bookId, undefined, "the other page is untouched");
});

test("the day page moves alone: pages following the day stay in their journal", () => {
  const e = day();
  setPageBook(e, null, "c");
  assert.equal(e.bookId, "c");
  assert.equal(e.moments[1].bookId, "a", "m2 was in a (through the day) and stays in a");
  assert.equal(e.moments[0].bookId, "a");
  assert.equal(e.moments[2].bookId, "b");
});

test("unknown page or no journal: nothing changes", () => {
  const e = day();
  const before = structuredClone(e);
  assert.equal(setPageBook(e, "nope", "b"), false);
  assert.equal(setPageBook(e, "m1", ""), false);
  assert.deepEqual(e, before);
});

test("books show the moved page in the new journal only", () => {
  const e = day();
  setPageBook(e, "m1", "b");
  const state = { schemaVersion: 1, books: [{ id: "a" }, { id: "b" }], entries: [e], drafts: {}, habits: [], checks: [] };
  const ids = (book) => visiblePages(state, { bookId: book }).map((p) => p.moment?.id || "cover");
  assert.deepEqual(ids("a"), ["m2"]);
  assert.deepEqual(ids("b").sort(), ["m1", "m3"]);
});
