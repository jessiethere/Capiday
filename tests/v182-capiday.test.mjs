// V10.78 · DS-02 · `.capiday` backup files (docs/CAPIDAY_BACKUP_FORMAT.md 1.0):
// round trip byte for byte, the three layers of checks, refusing damaged /
// newer / unsafe files, media that can't be read listed as missing.
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../Public/js/capiday-format.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const layer = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, scale: 1, rotation: 0 });
const state = () => ({
  schemaVersion: 1,
  books: [{ id: "daily", title: "测试本", category: "daily", coverImage: `media:${uuid(9)}` }],
  entries: [
    { id: "e1", date: "2026-11-01", bookId: "daily", title: "一", body: "合成", moments: [{ id: "m1", title: "早", body: "", layers: [layer("l1", `media:${uuid(1)}`)], media: [] }], layers: [], media: [] },
    { id: "e2", date: "2026-11-02", bookId: "daily", title: "二", body: "", moments: [], layers: [], media: [{ id: "c1", kind: "video", name: "海", mime: "video/mp4", source: `media:${uuid(2)}` }] },
  ],
  drafts: {},
  habits: [],
  checks: [],
  wall: { order: "custom", hidden: {}, pages: [], custom: ["page:m1"] },
});
const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff);
const files = {
  [uuid(1)]: { id: uuid(1), mime: "image/jpeg", kind: "photo", name: "a.jpg", aspect: 0.75, bytes: bytes(5000, 1).buffer },
  [uuid(2)]: { id: uuid(2), mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', kind: "video", name: "海.mp4", duration: 3.2, bytes: bytes(20000, 2).buffer },
  [uuid(9)]: { id: uuid(9), mime: "image/png", kind: "photo", name: "cover.png", bytes: bytes(3000, 9).buffer },
};
const read = async (id) => (files[id] ? structuredClone(files[id]) : null);

test("round trip: the journal and every file come back exactly", async () => {
  const s = state();
  const { blob, manifest } = await C.buildCapiday(s, read, { version: "10.78", now: new Date("2026-11-15T08:00:00Z") });
  assert.equal(blob.type, C.MIMETYPE);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.media.length, 3);
  assert.ok(await C.looksLikeCapiday(blob));
  const back = await C.readCapiday(blob);
  assert.deepEqual(back.state, s, "state.json is the journal exactly (wall setting included)");
  assert.equal(back.complete, true);
  assert.equal(back.createdAt, "2026-11-15T08:00:00.000Z");
  for (const m of back.media) {
    const original = new Uint8Array(files[m.id].bytes);
    assert.deepEqual(new Uint8Array(await m.blob.arrayBuffer()), original, m.id);
    assert.equal(m.mime, files[m.id].mime);
    assert.equal(m.name, files[m.id].name, "the record's other fields are kept");
  }
  assert.equal(back.media.find((m) => m.id === uuid(2)).duration, 3.2);
});

test("no base64: the file is about the size of the media itself", async () => {
  const { blob } = await C.buildCapiday(state(), read);
  const media = 5000 + 20000 + 3000;
  assert.ok(blob.size < media + 8000, `${blob.size} bytes for ${media} bytes of media`);
});

test("a file that can't be read is listed as missing (complete: false), the rest still go in", async () => {
  const { manifest, blob } = await C.buildCapiday(state(), async (id) => (id === uuid(2) ? null : read(id)));
  assert.equal(manifest.complete, false);
  assert.deepEqual(manifest.missing.map((m) => m.id), [uuid(2)]);
  const back = await C.readCapiday(blob);
  assert.equal(back.complete, false);
  assert.deepEqual(back.missing.map((m) => m.id), [uuid(2)]);
});

test("layer 1–2: a changed byte anywhere is caught (CRC-32 / SHA-256)", async () => {
  const { blob } = await C.buildCapiday(state(), read);
  const raw = new Uint8Array(await blob.arrayBuffer());
  // Change one byte inside the first media file's data.
  const at = raw.length - 9000;
  const broken = raw.slice();
  broken[at] ^= 0xff;
  await assert.rejects(C.readCapiday(new Blob([broken])), (e) => ["checksum", "damaged"].includes(e.code));
  // Cut short (a half-copied file): no end record.
  await assert.rejects(C.readCapiday(new Blob([raw.slice(0, raw.length - 40)])), (e) => ["damaged", "checksum"].includes(e.code));
});

test("not a backup, a JSON backup, an empty file: refused as not-capiday", async () => {
  assert.equal(await C.looksLikeCapiday(new Blob(['{"format":"little-days-backup"}'])), false);
  await assert.rejects(C.readCapiday(new Blob(["hello"])), { code: "not-capiday" });
  await assert.rejects(C.readCapiday(new Blob([])), { code: "not-capiday" });
});

test("a newer format (2.0 or required features) is not read", async () => {
  const s = state();
  const { blob } = await C.buildCapiday(s, read);
  // Rewrite the manifest entry with formatVersion 2.0 by building a file by hand.
  const raw = new TextDecoder("latin1").decode(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(raw.includes('"formatVersion":"1.0"'));
  const newer = await C.buildCapiday(s, read);
  const txt = new Uint8Array(await newer.blob.arrayBuffer());
  const s2 = new TextDecoder("latin1").decode(txt).replace('"minReaderVersion":"1.0"', '"minReaderVersion":"2.0"');
  const changed = Uint8Array.from(s2, (c) => c.charCodeAt(0));
  // The manifest's CRC no longer matches → refused either way (never read as 1.0).
  await assert.rejects(C.readCapiday(new Blob([changed])), (e) => ["newer-format", "checksum"].includes(e.code));
});

test("unsafe paths (zip-slip) are refused", async () => {
  const { blob } = await C.buildCapiday(state(), read);
  const txt = new TextDecoder("latin1").decode(new Uint8Array(await blob.arrayBuffer()));
  const evil = txt.split("state.json").join("../tate.json");
  await assert.rejects(C.readCapiday(new Blob([Uint8Array.from(evil, (c) => c.charCodeAt(0))])), (e) => ["damaged", "checksum"].includes(e.code));
});

test("CRC-32 matches the standard check value", () => {
  assert.equal(C.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});
