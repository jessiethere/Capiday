// V10.65 · S1-1 恢复安全 — pure helpers + the event-name regression (synthetic data only).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as RS from "../Public/js/restore-safety.mjs";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const mp4 = 'data:video/mp4;codecs="avc1.42E01E,mp4a.40.2";base64,AAAAGGZ0eXBtcDQy';
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const layer = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, scale: 1, rotation: 0 });
const state = () => ({
  schemaVersion: 1,
  books: [{ id: "daily", title: "测试本", category: "daily", coverImage: `media:${uuid(9)}` }],
  entries: [
    { id: "e1", date: "2026-11-01", bookId: "daily", title: "一", body: "合成", moments: [{ id: "m1", title: "早", body: "", layers: [layer("l1", `media:${uuid(1)}`)], media: [] }], layers: [], media: [] },
    { id: "e2", date: "2026-11-02", bookId: "daily", title: "二", body: "", moments: [], layers: [], media: [{ id: "c1", kind: "video", name: "海", mime: "video/mp4", source: `media:${uuid(2)}` }] },
    { id: "demo", date: "2026-10-01", bookId: "daily", title: "", body: "", isDemo: true, moments: [], layers: [], media: [] },
  ],
  drafts: {},
  habits: [{ id: "h1", title: "喝水", theme: "sage", kind: "completion", target: 7, minutes: 0 }],
  checks: [],
  plans: { "2026-11-02": [{ id: "p1", text: "买纸" }] },
  keeper: { name: "Captain", memories: [] },
});
const backup = (over = {}) => ({
  format: "little-days-backup",
  version: 1,
  createdAt: "2026-11-14T08:00:00.000Z",
  state: state(),
  media: [
    { id: uuid(1), kind: "photo", data: png },
    { id: uuid(2), kind: "video", data: mp4 },
    { id: uuid(9), kind: "photo", data: png },
  ],
  ...over,
});

test("analyzeBackup counts what the file really holds (not what it claims)", () => {
  const b = backup({ summary: { days: 999, pages: 999 } }); // a lying header is ignored
  const a = RS.analyzeBackup(b);
  assert.equal(a.ok, true);
  assert.equal(a.summary.days, 2, "sample (isDemo) days are not counted");
  assert.deepEqual(a.summary.dates, ["2026-11-01", "2026-11-02"]);
  assert.equal(a.summary.books, 1);
  assert.equal(a.summary.habits, 1);
  assert.equal(a.summary.plans, 1);
  assert.equal(a.summary.keeper, true);
  assert.equal(a.summary.mediaRefs, 3);
  assert.equal(a.media.length, 3);
  assert.deepEqual(a.kinds, { photo: 2, video: 1, audio: 0 });
  assert.equal(a.complete, true);
});

test("analyzeBackup refuses damaged, foreign, newer and incomplete files before anything is written", () => {
  assert.equal(RS.analyzeBackup(null).error, "not-backup");
  assert.equal(RS.analyzeBackup([]).error, "not-backup");
  assert.equal(RS.analyzeBackup({ format: "other" }).error, "not-backup");
  assert.equal(RS.analyzeBackup(backup({ version: 2 })).error, "newer-format");
  const newer = backup();
  newer.state.schemaVersion = 3;
  assert.equal(RS.analyzeBackup(newer).error, "newer-format");
  const broken = backup();
  broken.state.books[0].title = 7;
  assert.equal(RS.analyzeBackup(broken).error, "damaged");
  assert.equal(RS.analyzeBackup(backup({ media: "x" })).error, "damaged");
  const dup = backup();
  dup.media.push({ ...dup.media[0] });
  assert.equal(RS.analyzeBackup(dup).error, "damaged");
  const bad = backup();
  bad.media[0].data = "data:text/html;base64,PHNjcmlwdD4=";
  assert.equal(RS.analyzeBackup(bad).error, "bad-media");
  const gap = backup();
  gap.media.pop();
  assert.equal(RS.analyzeBackup(gap).error, "incomplete");
  // …unless the backup itself lists the file it could not include (C2)
  const listed = backup({ complete: false, missing: [{ id: uuid(9) }] });
  listed.media.pop();
  const ok = RS.analyzeBackup(listed);
  assert.equal(ok.ok, true);
  assert.equal(ok.complete, false);
  assert.deepEqual(ok.missing, [uuid(9)]);
  const many = backup({ media: Array.from({ length: RS.MAX_RESTORE_FILES + 1 }, (_, i) => ({ id: "x" + i, data: png })) });
  assert.equal(RS.analyzeBackup(many).error, "too-many");
});

test("media data: codecs with commas are accepted; size is computed without decoding", () => {
  assert.equal(RS.validMediaData(mp4), true);
  assert.equal(RS.mimeOfData(mp4), 'video/mp4;codecs="avc1.42e01e,mp4a.40.2"');
  assert.equal(RS.validMediaData("data:image/svg+xml;base64,PHN2Zz4="), false, "SVG (scriptable) is not a photo");
  assert.equal(RS.dataBytes("data:image/png;base64,AAAA"), 3);
  assert.equal(RS.dataBytes("data:image/png;base64,AAA="), 2);
  const big = "data:video/mp4;base64," + "A".repeat(Math.ceil(((RS.MAX_RESTORE_MEDIA_BYTES + 3) * 4) / 3));
  const b = backup();
  b.media[1].data = big;
  assert.equal(RS.analyzeBackup(b).error, "media-too-large");
});

test("sameJournal names what differs after a restore", () => {
  const a = RS.summarize(state());
  assert.deepEqual(RS.sameJournal(a, RS.summarize(state())), []);
  const s = state();
  s.entries[1].date = "2026-11-03";
  s.keeper = {};
  const diff = RS.sameJournal(RS.summarize(s), a);
  assert.ok(diff.includes("dates"));
  assert.ok(diff.includes("keeper"));
});

test("sameBytes decides by content, never by name", () => {
  const a = new Uint8Array([1, 2, 3]).buffer;
  assert.equal(RS.sameBytes(a, new Uint8Array([1, 2, 3]).buffer), true);
  assert.equal(RS.sameBytes(a, new Uint8Array([1, 2, 4]).buffer), false);
  assert.equal(RS.sameBytes(a, new Uint8Array([1, 2]).buffer), false);
});

test("daily snapshots: 3 days, 14 days, 60 MB in all, a huge newest one alone", () => {
  const k = (d) => RS.SNAPSHOT_PREFIX + d;
  const mb = 1024 * 1024;
  // more than 3 → the oldest go
  assert.deepEqual(RS.planSnapshots([k("2026-11-10"), k("2026-11-11"), k("2026-11-12"), k("2026-11-13")].map((key) => ({ key, bytes: mb })), "2026-11-14").sort(), [k("2026-11-10")]);
  // older than 14 days → gone even if few
  assert.deepEqual(RS.planSnapshots([{ key: k("2026-10-20"), bytes: mb }, { key: k("2026-11-13"), bytes: mb }], "2026-11-14"), [k("2026-10-20")]);
  // 60 MB in all
  assert.deepEqual(RS.planSnapshots([{ key: k("2026-11-12"), bytes: 25 * mb }, { key: k("2026-11-13"), bytes: 25 * mb }, { key: k("2026-11-14"), bytes: 25 * mb }], "2026-11-14"), [k("2026-11-12")]);
  // newest larger than 30 MB → only the newest
  assert.deepEqual(RS.planSnapshots([{ key: k("2026-11-13"), bytes: mb }, { key: k("2026-11-14"), bytes: 31 * mb }], "2026-11-14"), [k("2026-11-13")]);
  // never touches other keys
  assert.deepEqual(RS.planSnapshots([{ key: "little-days.v1", bytes: 99 * mb }], "2026-11-14"), []);
});

test("pre-restore snapshots keep the newest 2 and nothing older than 14 days; undo lasts 7 days", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const day = 86_400_000;
  const list = [0, 1, 2, 20].map((d) => ({ key: "s" + d, at: now - d * day }));
  assert.deepEqual(RS.planBeforeRestore(list, now).sort(), ["s2", "s20"]);
  assert.equal(RS.undoDaysLeft({ at: new Date(now).toISOString(), snapshotKey: "s" }, now), 7);
  assert.equal(RS.undoDaysLeft({ at: new Date(now - 6.5 * day).toISOString(), snapshotKey: "s" }, now), 1);
  assert.equal(RS.undoDaysLeft({ at: new Date(now - 7.01 * day).toISOString(), snapshotKey: "s" }, now), 0);
  assert.equal(RS.undoDaysLeft(null, now), 0);
  assert.equal(RS.undoDaysLeft({ at: new Date(now).toISOString() }, now), 0, "no snapshot → no undo");
});

// The rescue screen's event was logged as "journal-blocked", which the event
// log silently refuses (names are [a-z_]). Every literal event name in the
// app must pass the same rule, or it is never recorded.
test("every logged event name is one the event log accepts (journal_blocked regression)", async () => {
  const { logEvent, readEvents } = await import("../Public/js/events.mjs");
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  logEvent("journal-blocked", {}, storage);
  assert.equal(readEvents(storage).length, 0, "a hyphenated name is dropped — why the bug was silent");
  logEvent("journal_blocked", { reason: "x" }, storage);
  assert.equal(readEvents(storage).at(-1).e, "journal_blocked");

  const files = ["Public/app.js", ...readdirSync("Public/js").filter((f) => f.endsWith(".mjs")).map((f) => "Public/js/" + f)];
  const bad = [];
  let seen = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\b(?:logEvent|onEvent|report)\(\s*["'`]([^"'`]+)["'`]/g)) {
      seen++;
      if (!/^[a-z_]{2,32}$/.test(m[1])) bad.push(`${file}: ${m[1]}`);
    }
  }
  assert.ok(seen > 20, "the scan found the app's events");
  assert.deepEqual(bad, []);
  assert.match(readFileSync("Public/app.js", "utf8"), /logEvent\("journal_blocked"/);
});
