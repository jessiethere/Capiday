// V10.78 · DS-10 (R4): references a cover only remembers — a day cover's
// coverPhotos[page].reference and a book's coverSample.own / photos — are
// renamed on restore with everything else, but never make a backup
// incomplete or block the restore of an older backup without them.
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { mediaReferences, visitMediaReferences } from "../Public/js/media.mjs";
import * as RS from "../Public/js/restore-safety.mjs";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const layer = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, scale: 1, rotation: 0 });
const state = () => ({
  schemaVersion: 1,
  books: [{ id: "pets", title: "毛孩子", category: "pet", coverTemplate: "pet-badge", coverImage: `media:${uuid(9)}`, coverSample: { template: "pet-badge", own: `media:${uuid(9)}`, photos: [`media:${uuid(9)}`, "photo:dog-1"] } }],
  entries: [
    {
      id: "e1",
      date: "2026-11-01",
      bookId: "pets",
      title: "",
      body: "",
      layoutTemplate: "scrapbook",
      // The cover shows page m1's photo (uuid 1); it also remembers uuid 7, a photo no longer on any page.
      coverPhotos: { m1: { reference: `media:${uuid(1)}`, name: "", aspect: 1 }, m2: { reference: `media:${uuid(7)}`, name: "", aspect: 1 } },
      moments: [{ id: "m1", title: "早", body: "", layers: [layer("l1", `media:${uuid(1)}`)], media: [] }],
      layers: [layer("c1", `media:${uuid(1)}`)],
      media: [],
    },
  ],
  drafts: {},
  habits: [],
  checks: [],
});

test("remembered-only references are not required (counts, missing, completeness unchanged)", () => {
  assert.deepEqual([...mediaReferences(state())].sort(), [uuid(1), uuid(9)]);
  assert.deepEqual([...mediaReferences(state(), null, { memo: true })].sort(), [uuid(1), uuid(7), uuid(9)]);
});

test("restore renames remembered references too (the cover keeps finding its photos)", () => {
  const s = state();
  const map = new Map([[uuid(1), uuid(101)], [uuid(7), uuid(107)], [uuid(9), uuid(109)]]);
  visitMediaReferences(s, (ref) => (map.has(ref.slice(6)) ? "media:" + map.get(ref.slice(6)) : ref));
  assert.equal(s.entries[0].coverPhotos.m1.reference, `media:${uuid(101)}`);
  assert.equal(s.entries[0].coverPhotos.m2.reference, `media:${uuid(107)}`);
  assert.equal(s.books[0].coverImage, `media:${uuid(109)}`);
  assert.equal(s.books[0].coverSample.own, `media:${uuid(109)}`, "CAP-018: the kept sample still matches the own photo");
  assert.deepEqual(s.books[0].coverSample.photos, [`media:${uuid(109)}`, "photo:dog-1"], "library photos untouched");
});

test("an older backup without the remembered-only photo still restores (not 'incomplete')", () => {
  const backup = {
    format: "little-days-backup",
    version: 1,
    createdAt: "2026-11-14T08:00:00.000Z",
    state: state(),
    media: [
      { id: uuid(1), kind: "photo", data: png },
      { id: uuid(9), kind: "photo", data: png },
    ],
  };
  const a = RS.analyzeBackup(backup);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.complete, true);
});

test("DS-09: the restore file limit the backup now checks against is the one restore uses", () => {
  assert.equal(RS.MAX_RESTORE_FILE_BYTES, 150 * 1024 * 1024);
});
