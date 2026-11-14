// V10.62 · 新手引导: who sees the Home guide and the first-page card.
import test from "node:test";
import assert from "node:assert/strict";
import * as O from "../Public/js/onboarding.mjs";

const mem = (init = {}) => {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), data };
};
const sample = { entries: [{ date: "2026-11-01", isDemo: true, moments: [{ id: "s" }] }], drafts: {} };
const own = { entries: [{ date: "2026-11-01", moments: [{ id: "a" }] }], drafts: {} };

test("someone new starts it; samples do not count", () => {
  const s = mem();
  assert.equal(O.decide(s, { entries: [], drafts: {} }), "start");
  assert.equal(O.decide(s, sample), "start");
  assert.equal(s.data[O.ONBOARDING_KEY], undefined, "deciding alone writes nothing");
});

test("an older user with pages (or a draft) is marked done and never shown it", () => {
  for (const journal of [own, { entries: [], drafts: { "2026-11-02": { moments: [] } } }]) {
    const s = mem();
    assert.equal(O.decide(s, journal), "none");
    assert.deepEqual({ ...O.load(s), at: "" }, { v: 1, home: "done", firstPage: "done", at: "" });
    assert.equal(O.shouldShowFirstPage(O.load(s), own), false);
  }
});

test("started and left half-way counts as skipped next time", () => {
  const s = mem();
  O.begin(s);
  assert.equal(O.load(s).home, "new");
  assert.equal(O.decide(s, { entries: [], drafts: {} }), "none");
  assert.equal(O.load(s).home, "skipped");
});

test("skip, finish, and a replay that is skipped keeps done", () => {
  const s = mem();
  O.begin(s);
  O.finishHome("skipped", s);
  assert.equal(O.load(s).home, "skipped");
  O.finishHome("done", s);
  O.finishHome("skipped", s);
  assert.equal(O.load(s).home, "done");
});

test("the first-page card: once, only for a kept page (not a draft, not a sample)", () => {
  const s = mem();
  O.begin(s);
  const r = O.load(s);
  assert.equal(O.shouldShowFirstPage(r, { entries: [] }), false);
  assert.equal(O.shouldShowFirstPage(r, sample), false);
  assert.equal(O.shouldShowFirstPage(r, { entries: [{ date: "d", status: "draft", moments: [{ id: "x" }] }] }), false);
  assert.equal(O.shouldShowFirstPage(r, own), true);
  O.markFirstPage(s);
  assert.equal(O.shouldShowFirstPage(O.load(s), own), false);
});

test("a damaged record is read safely (and counts as seen)", () => {
  const s = mem({ [O.ONBOARDING_KEY]: "{oops" });
  assert.equal(O.load(s), null);
  const t = mem({ [O.ONBOARDING_KEY]: JSON.stringify({ home: "weird" }) });
  assert.equal(O.load(t).home, "skipped");
  assert.equal(O.decide(t, { entries: [] }), "none");
});
