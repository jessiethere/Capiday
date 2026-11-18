// V10.84 · 集章 — the recorded-day rules, through the real Store (every
// change goes through Store.update, where the dates are remembered).
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../Public/js/model.mjs";
import { contentDays, ledger, stampedDates, syncRecordedDays } from "../Public/js/recorded-days.mjs";
import { stampsByDate, monthStamps, stampMonths, totalStamps, weekReview, weekStartKey } from "../Public/js/stamps.mjs";

const seed = JSON.parse(readFileSync(new URL("../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/seed.json", import.meta.url)));
const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
};
const fresh = () => new Store(memory(), { ...seed, sampleDays: [] }, "2026-11-17");
const page = (id, extra = {}) => ({ id, title: "", body: "", time: "", mood: "", tags: [], layers: [], media: [], bookId: "daily", template: "minimal", font: "serif", createdAt: "2026-11-17T09:00:00.000Z", ...extra });
const day = (date, moments, extra = {}) => ({ id: `e-${date}`, date, bookId: "daily", title: "", body: "", photo: "", mood: "", template: "minimal", font: "serif", layers: [], media: [], moments, ...extra });
const add = (store, date, moment) =>
  store.update((s) => {
    const e = s.entries.find((x) => x.date === date && !x.isDemo);
    if (e) e.moments.push(moment);
    else s.entries.push(day(date, [moment]));
  });
const remove = (store, date, id) =>
  store.update((s) => {
    const e = s.entries.find((x) => x.date === date);
    e.moments = e.moments.filter((m) => m.id !== id);
    if (!e.moments.length && !e.title && !e.body && !e.photo && !e.layers.length) s.entries = s.entries.filter((x) => x !== e);
  });
const move = (store, from, to, id) =>
  store.update((s) => {
    const a = s.entries.find((x) => x.date === from);
    const m = a.moments.find((x) => x.id === id);
    a.moments = a.moments.filter((x) => x !== m);
    if (!a.moments.length) s.entries = s.entries.filter((x) => x !== a);
    const b = s.entries.find((x) => x.date === to);
    if (b) b.moments.push(m);
    else s.entries.push(day(to, [m]));
  });
const L = (o) => ({ text: "", x: 50, y: 50, scale: 1, rotation: 0, ...o });
const photo = (ref) => L({ id: `p-${ref}`, kind: "photo", mediaRef: ref });

test("A/B/D: the first kept page stamps the day; more pages that day still make one", () => {
  const store = fresh();
  assert.equal(totalStamps(store.state), 0);
  add(store, "2026-11-17", page("m1", { title: "第一页" }));
  assert.deepEqual(stampedDates(store.state), ["2026-11-17"]);
  assert.ok(ledger(store.state)["2026-11-17"]?.at);
  add(store, "2026-11-17", page("m2", { body: "第二页" }));
  for (let i = 3; i <= 10; i++) add(store, "2026-11-17", page(`m${i}`, { body: `第 ${i} 页` }));
  assert.equal(totalStamps(store.state), 1);
  assert.equal(monthStamps(store.state, 2026, 11).count, 1);
});

test("an empty page or an unsaved draft is not a record", () => {
  const store = fresh();
  add(store, "2026-11-17", page("m1"));
  assert.equal(totalStamps(store.state), 0);
  store.update((s) => (s.drafts["2026-11-16"] = day("2026-11-16", [page("d1", { title: "草稿" })])));
  assert.equal(totalStamps(store.state), 0);
});

test("C/M: a page dated 10 days back (or last month) stamps that date, not today", () => {
  const store = fresh();
  add(store, "2026-11-07", page("old", { title: "补记的一页", createdAt: "2026-11-17T21:00:00.000Z" }));
  assert.deepEqual(stampedDates(store.state), ["2026-11-07"]);
  add(store, "2026-10-28", page("oct", { body: "十月的事" }));
  assert.equal(monthStamps(store.state, 2026, 10).count, 1);
  assert.equal(monthStamps(store.state, 2026, 11).count, 1);
  assert.equal(stampsByDate(store.state)["2026-11-07"].kind, "word", "a backfilled day looks the same as any other");
});

test("E/F: deleting one of two pages keeps a full stamp; deleting the last keeps an empty stamp", () => {
  const store = fresh();
  add(store, "2026-11-12", page("a", { layers: [photo("media:11111111-1111-4111-8111-111111111111")] }));
  add(store, "2026-11-12", page("b", { body: "还有一页" }));
  remove(store, "2026-11-12", "a");
  assert.equal(stampsByDate(store.state)["2026-11-12"].kind, "word");
  remove(store, "2026-11-12", "b");
  assert.equal(store.state.entries.some((e) => e.date === "2026-11-12"), false, "the day itself is gone");
  const face = stampsByDate(store.state)["2026-11-12"];
  assert.deepEqual(face, { kind: "empty" }, "date-only stamp, no photo of a deleted page");
  assert.equal(monthStamps(store.state, 2026, 11).count, 1);
  // A day that never had a page has no stamp at all.
  assert.equal(stampsByDate(store.state)["2026-11-11"], undefined);
});

test("H/I/J: moving a page from A to B — A keeps a full stamp while it has pages, else an empty one; B gets a stamp", () => {
  const store = fresh();
  add(store, "2026-11-03", page("x", { title: "要挪走的" }));
  add(store, "2026-11-03", page("y", { title: "留下的" }));
  move(store, "2026-11-03", "2026-11-09", "x");
  let s = stampsByDate(store.state);
  assert.equal(s["2026-11-03"].kind, "word", "A still has a page");
  assert.equal(s["2026-11-09"].kind, "word", "B got the page");
  move(store, "2026-11-03", "2026-11-10", "y");
  s = stampsByDate(store.state);
  assert.deepEqual(s["2026-11-03"], { kind: "empty" }, "A had pages, none now");
  assert.equal(s["2026-11-10"].kind, "word");
  assert.equal(totalStamps(store.state), 3);
});

test("a page moved before it was ever saved there leaves nothing behind (only kept pages count)", () => {
  const store = fresh();
  store.update((s) => (s.drafts["2026-11-04"] = day("2026-11-04", [page("q", { title: "x" })])));
  store.update((s) => {
    delete s.drafts["2026-11-04"];
    s.entries.push(day("2026-11-05", [page("q", { title: "x" })]));
  });
  assert.deepEqual(stampedDates(store.state), ["2026-11-05"]);
});

test("history: an existing journal without the map is stamped from its pages (journal date, not createdAt), without touching pages", () => {
  const storage = memory();
  const before = new Store(storage, { ...seed, sampleDays: [] }, "2026-11-17");
  // Write an older-style journal straight into storage (no recordedDays).
  const state = structuredClone(before.state);
  state.entries.push(day("2026-09-30", [page("s1", { title: "九月最后一天", createdAt: "2026-11-01T08:00:00.000Z" }), page("s2", { body: "同一天第二页" })]));
  state.entries.push(day("2026-10-15", [page("o1", { layers: [photo("media:22222222-2222-4222-8222-222222222222")] })]));
  delete state.recordedDays;
  storage.setItem("little-days.v1", JSON.stringify(state));
  const ids = JSON.stringify(state.entries.map((e) => [e.id, e.date, (e.moments || []).map((m) => [m.id, (m.layers || []).map((l) => [l.id, l.mediaRef || ""])])]));
  const store = new Store(storage, { ...seed, sampleDays: [] }, "2026-11-17");
  const text = JSON.stringify(store.state.entries); // as loaded (load-time defaults filled in)
  assert.deepEqual(stampedDates(store.state), ["2026-09-30", "2026-10-15"], "stamped at once, from the journal dates");
  assert.deepEqual(stampMonths(store.state).map((m) => [m.month, m.count]), [[10, 1], [9, 1]]);
  // The next change writes them down; pages, ids and media stay exactly as they were.
  store.update((s) => (s.plans = s.plans || {}));
  assert.deepEqual(Object.keys(ledger(store.state)), ["2026-09-30", "2026-10-15"]);
  assert.equal(ledger(store.state)["2026-09-30"].at, "2026-11-01T08:00:00.000Z");
  assert.equal(JSON.stringify(store.state.entries), text, "writing the stamps changes no page");
  assert.equal(JSON.stringify(store.state.entries.map((e) => [e.id, e.date, (e.moments || []).map((m) => [m.id, (m.layers || []).map((l) => [l.id, l.mediaRef || ""])])])), ids, "page ids, dates and media ids as before");
  // …so deleting that history afterwards keeps empty stamps.
  store.update((s) => (s.entries = s.entries.filter((e) => e.date !== "2026-10-15")));
  assert.deepEqual(stampsByDate(store.state)["2026-10-15"], { kind: "empty" });
});

test("sample days never count; writing on a sample day (it becomes yours) does", () => {
  const store = new Store(memory(), seed, "2026-11-17");
  assert.ok(store.state.entries.some((e) => e.isDemo));
  assert.equal(totalStamps(store.state), 0);
});

test("restore: the journal (and its stamps) is replaced; a backup without the map gets stamps from its pages", () => {
  const store = fresh();
  add(store, "2026-11-01", page("now", { title: "恢复前的" }));
  store.update((s) => (s.entries = []));
  assert.deepEqual(stampsByDate(store.state)["2026-11-01"], { kind: "empty" });
  // A backup made before this version: no recordedDays.
  const backup = structuredClone(store.state);
  delete backup.recordedDays;
  backup.entries = [day("2026-08-08", [page("b", { title: "备份里的" })])];
  store.update((draft) => {
    for (const key of Object.keys(draft)) delete draft[key];
    Object.assign(draft, structuredClone(backup));
  });
  assert.deepEqual(stampedDates(store.state), ["2026-08-08"], "the replaced journal's stamps do not carry over");
  // A backup made with this version brings its empty stamps back.
  const withMap = structuredClone(store.state);
  withMap.recordedDays["2026-07-07"] = { at: "2026-07-07T10:00:00.000Z" };
  store.update((draft) => {
    for (const key of Object.keys(draft)) delete draft[key];
    Object.assign(draft, structuredClone(withMap));
  });
  assert.deepEqual(stampsByDate(store.state)["2026-07-07"], { kind: "empty" });
});

test("a damaged map is repaired from the pages, never thrown on", () => {
  const state = { entries: [day("2026-11-02", [page("a", { title: "x" })])], recordedDays: ["bad"] };
  syncRecordedDays(state, "2026-11-17T00:00:00.000Z");
  assert.deepEqual(Object.keys(state.recordedDays), ["2026-11-02"]);
  state.recordedDays = { "not-a-date": { at: 1 }, "2026-11-03": null };
  syncRecordedDays(state);
  assert.deepEqual(Object.keys(ledger(state)).sort(), ["2026-11-02", "2026-11-03"]);
});

test("stamp faces: own photo first (hidden on the photo wall skipped), else the first letter, voice, drawing", () => {
  const store = fresh();
  const ref = "media:33333333-3333-4333-8333-333333333333";
  add(store, "2026-11-13", page("p", { title: "海边", layers: [L({ id: "lib", kind: "photo", mediaRef: "photo:latte-art" }), photo(ref)] }));
  assert.deepEqual(stampsByDate(store.state)["2026-11-13"], { kind: "photo", ref });
  store.update((s) => (s.wall = { version: 1, order: "time", hidden: { k: { at: "x", ref } }, pages: [], custom: [] }));
  assert.deepEqual(stampsByDate(store.state)["2026-11-13"], { kind: "word", ch: "海" });
  add(store, "2026-11-14", page("v", { layers: [L({ id: "a", kind: "audio", clipId: "c" })] }));
  assert.equal(stampsByDate(store.state)["2026-11-14"].kind, "voice");
  add(store, "2026-11-15", page("d", { layers: [L({ id: "dr", kind: "photo", drawing: true, mediaRef: "media:44444444-4444-4444-8444-444444444444" })] }));
  assert.equal(stampsByDate(store.state)["2026-11-15"].kind, "draw");
  add(store, "2026-11-16", page("e", { title: "hello" }));
  assert.equal(stampsByDate(store.state)["2026-11-16"].ch, "H");
});

test("K/L: months — November 2026 starts on a Sunday (Monday-first grid), October keeps its stamps", () => {
  const store = fresh();
  add(store, "2026-10-31", page("a", { title: "十月最后" }));
  add(store, "2026-11-01", page("b", { title: "十一月第一" }));
  const nov = monthStamps(store.state, 2026, 11);
  assert.equal(nov.lead, 6);
  assert.equal(nov.days.length, 30);
  assert.equal(nov.count, 1);
  const oct = monthStamps(store.state, 2026, 10);
  assert.equal(oct.days.length, 31);
  assert.equal(oct.count, 1);
  assert.ok(oct.days[30].stamp);
});

test("Q: this week counts only Monday–Sunday of the target week", () => {
  const store = fresh();
  add(store, "2026-11-15", page("sun-before", { title: "上周日" }));
  add(store, "2026-11-16", page("mon", { title: "周一", layers: [photo("media:55555555-5555-4555-8555-555555555555")] }));
  add(store, "2026-11-17", page("tue", { body: "周二写了一句话", layers: [L({ id: "au", kind: "audio", clipId: "c" })] }));
  add(store, "2026-11-23", page("next-mon", { title: "下周一" }));
  const w = weekReview(store.state, "2026-11-17");
  assert.equal(weekStartKey("2026-11-17"), "2026-11-16");
  assert.equal(w.start, "2026-11-16");
  assert.equal(w.end, "2026-11-22");
  assert.equal(w.recorded, 2);
  assert.equal(w.photoCount, 1);
  assert.equal(w.voices, 1);
  assert.deepEqual(w.days.map((d) => Boolean(d.stamp)), [true, true, false, false, false, false, false]);
  assert.ok(w.line && ["周一", "周二写了一句话"].includes(w.line.text));
});

test("contentDays and the app's own content rules agree (day.mjs)", async () => {
  const D = await import("../Public/js/day.mjs");
  const R = await import("../Public/js/recorded-days.mjs");
  const samples = [
    day("2026-11-01", [], { title: "x" }),
    day("2026-11-02", [page("a")]),
    day("2026-11-03", [page("a", { layers: [L({ id: "s", kind: "sticker" })] })]),
    day("2026-11-04", [], { fieldValues: { f: "" } }),
    day("2026-11-05", [], { fieldValues: { f: "v" } }),
  ];
  for (const e of samples) assert.equal(R.entryHasContent(e), D.hasDayPageContent(e) || e.moments.some(D.hasMomentContent), e.date);
  assert.ok(contentDays({ entries: samples }).size === 3);
});

// ---------- V10.84 · 首次盖章: the data event behind the stamp moment ----------
const watched = (options = {}) => {
  const heard = [];
  const store = new Store(memory(), { ...seed, sampleDays: [] }, "2026-11-17", { ...options, onNewDays: (dates) => heard.push(dates) });
  return { store, heard };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test("first stamp: announced once per new date, after the save is stored", async () => {
  const { store, heard } = watched();
  add(store, "2026-11-17", page("a", { title: "第一页" }));
  await tick();
  assert.deepEqual(heard, [["2026-11-17"]], "S1/S2 the first kept page of the day");
  add(store, "2026-11-17", page("b", { title: "第二页" }));
  store.update((s) => (s.entries.find((e) => e.date === "2026-11-17" && !e.isDemo).moments[0].title = "改过"));
  await tick();
  assert.equal(heard.length, 1, "S3/S4 a second page, an edit: nothing");
  add(store, "2026-11-02", page("c", { title: "补记" }));
  await tick();
  assert.deepEqual(heard[1], ["2026-11-02"], "S5 a past date kept for the first time");
  add(store, "2026-11-02", page("d", { title: "再补" }));
  remove(store, "2026-11-02", "c");
  remove(store, "2026-11-02", "d");
  add(store, "2026-11-02", page("e", { title: "又写" }));
  await tick();
  assert.equal(heard.length, 2, "S6/S11/S12 a stamped date, emptied, written again: never new");
});

test("first stamp: history and restores stay silent", async () => {
  const storage = memory();
  const old = new Store(storage, { ...seed, sampleDays: [] }, "2026-11-17");
  old.update((s) => s.entries.push(day("2026-10-01", [page("h", { title: "旧" })])));
  // An older journal: the page is there, the record is not.
  const raw = JSON.parse(storage.getItem("little-days.v1"));
  delete raw.recordedDays;
  storage.setItem("little-days.v1", JSON.stringify(raw));
  const heard = [];
  const store = new Store(storage, { ...seed, sampleDays: [] }, "2026-11-17", { onNewDays: (d) => heard.push(d) });
  store.update((s) => (s.plans = {}));
  await tick();
  assert.deepEqual(heard, [], "history written into the record is silent (S8 too)");
  assert.ok(store.state.recordedDays["2026-10-01"]);
  store.update(
    (s) => {
      s.entries.push(day("2026-09-09", [page("r", { title: "恢复来的" })]));
    },
    { quiet: true },
  );
  await tick();
  assert.deepEqual(heard, [], "S10 a restore (quiet) never announces");
  assert.ok(store.state.recordedDays["2026-09-09"], "…but its stamp is there");
});

test("first stamp: a failed save announces nothing", async () => {
  const fail = watched({ persist: () => Promise.reject(new Error("full")), onPersistError: () => {} });
  add(fail.store, "2026-11-17", page("x", { title: "存不进去" }));
  await tick();
  await tick();
  assert.deepEqual(fail.heard, [], "S7 the durable write failed: no stamp moment");
  const thrown = watched();
  assert.throws(() => thrown.store.update((s) => s.entries.push({ id: 1 })));
  await tick();
  assert.deepEqual(thrown.heard, [], "S7 a change that cannot be saved: nothing");
});
