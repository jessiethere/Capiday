// V10.78 · DS-02 · The `.capiday` backup file (docs/CAPIDAY_BACKUP_FORMAT.md 1.0).
// A plain ZIP with every entry STORED (no compression), so any platform can
// read it: `mimetype` first, then `header.json`, `state.json` (the journal,
// exactly as kept in the app), `media/<id>.<ext>` (each file's own bytes —
// no base64, so no 100 MB ceiling from encoding), and `manifest.json` last
// with every size and SHA-256. Writing never changes the journal; reading
// checks three layers (container CRC-32, content SHA-256, journal shape)
// before anything may be restored.
//
// Not in 1.0 of this writer: ZIP64 (a file over 4 GB is refused with a clear
// error instead of being written wrong), encryption, incremental backups.
import { mediaReferences } from "./media.mjs";
import { validateStateSnapshot } from "./model.mjs";

export const MIMETYPE = "application/vnd.capiday.backup+zip";
export const FORMAT_VERSION = "1.0";
export const EXTENSION = ".capiday";
const MAX_ZIP32 = 0xffffffff;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- CRC-32 / SHA-256 ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fail = (code, detail = "") => Object.assign(new Error(code), { code, detail });

// ---------- ZIP (stored) ----------
function u16(view, at, v) {
  view.setUint16(at, v, true);
}
function u32(view, at, v) {
  view.setUint32(at, v >>> 0, true);
}
class StoreZip {
  constructor() {
    this.parts = [];
    this.offset = 0;
    this.entries = [];
  }
  add(name, bytes) {
    const nameBytes = enc.encode(name);
    const crc = crc32(bytes);
    if (this.offset + 30 + nameBytes.length + bytes.length > MAX_ZIP32) throw fail("too-large");
    const head = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(head.buffer);
    u32(v, 0, 0x04034b50);
    u16(v, 4, 20); // version needed
    u16(v, 6, 0x0800); // UTF-8 names
    u16(v, 8, 0); // stored
    u16(v, 10, 0);
    u16(v, 12, 0x21); // 1980-01-01 (times live in the manifest)
    u32(v, 14, crc);
    u32(v, 18, bytes.length);
    u32(v, 22, bytes.length);
    u16(v, 26, nameBytes.length);
    u16(v, 28, 0);
    head.set(nameBytes, 30);
    this.entries.push({ nameBytes, crc, size: bytes.length, offset: this.offset });
    this.parts.push(head, bytes);
    this.offset += head.length + bytes.length;
  }
  finish(type = MIMETYPE) {
    const start = this.offset;
    let size = 0;
    for (const e of this.entries) {
      const rec = new Uint8Array(46 + e.nameBytes.length);
      const v = new DataView(rec.buffer);
      u32(v, 0, 0x02014b50);
      u16(v, 4, 20);
      u16(v, 6, 20);
      u16(v, 8, 0x0800);
      u16(v, 10, 0);
      u16(v, 12, 0);
      u16(v, 14, 0x21);
      u32(v, 16, e.crc);
      u32(v, 20, e.size);
      u32(v, 24, e.size);
      u16(v, 28, e.nameBytes.length);
      u32(v, 42, e.offset);
      rec.set(e.nameBytes, 46);
      this.parts.push(rec);
      size += rec.length;
    }
    if (start + size + 22 > MAX_ZIP32 || this.entries.length > 0xffff) throw fail("too-large");
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    u32(v, 0, 0x06054b50);
    u16(v, 8, this.entries.length);
    u16(v, 10, this.entries.length);
    u32(v, 12, size);
    u32(v, 16, start);
    this.parts.push(end);
    return new Blob(this.parts, { type });
  }
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "audio/mp4": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const extOf = (mime) => EXT[String(mime || "").split(";")[0].toLowerCase()] || "bin";
const MEDIA_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)(;.*)?$/i;
const kindOf = (mime, kind) => (/^video\//i.test(mime) ? "video" : /^audio\//i.test(mime) ? "audio" : kind === "drawing" ? "drawing" : "photo");

// The journal's counts for the manifest (days with something, pages, books…).
function counts(state) {
  const days = (state.entries || []).filter((e) => e && e.isDemo !== true);
  return {
    books: (state.books || []).length,
    days: days.length,
    pages: days.reduce((n, e) => n + (e.moments || []).length, 0),
    drafts: Object.keys(state.drafts || {}).length,
    habits: (state.habits || []).length,
  };
}

/**
 * Build a `.capiday` file from the journal.
 * readMedia(id) → a media record ({ bytes: ArrayBuffer | blob, mime, kind, … }) or null.
 * Returns { blob, manifest }. Media that can't be read are listed in
 * manifest.missing (complete: false); remembered-only references (covers'
 * memo, the wall's hidden list) go in when present and are never "missing".
 */
export async function buildCapiday(state, readMedia, { app = "Capiday", version = "", platform = "web", now = new Date(), onProgress = null } = {}) {
  const zip = new StoreZip();
  const backupId = crypto.randomUUID();
  const createdAt = now.toISOString();
  const writer = { app, version, platform };
  zip.add("mimetype", enc.encode(MIMETYPE));
  zip.add("header.json", enc.encode(JSON.stringify({ format: "capiday-backup", formatVersion: FORMAT_VERSION, backupId, createdAt, writer })));
  const stateBytes = enc.encode(JSON.stringify(state));
  zip.add("state.json", stateBytes);
  const required = mediaReferences(state);
  const remembered = [...mediaReferences(state, null, { memo: true })].filter((id) => !required.has(id));
  const media = [];
  const missing = [];
  let mediaBytes = 0;
  const ids = [...required, ...remembered];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const optional = !required.has(id);
    let record = null;
    try {
      record = await readMedia(id);
    } catch {}
    let bytes = null;
    try {
      const raw = record?.bytes ?? record?.blob ?? null;
      bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw && typeof raw.arrayBuffer === "function" ? new Uint8Array(await raw.arrayBuffer()) : raw instanceof Uint8Array ? raw : null;
    } catch {}
    const mime = String(record?.mime || record?.blob?.type || "");
    if (!record || !bytes || !bytes.length || !MEDIA_MIME.test(mime) || !/^[A-Za-z0-9-]{1,64}$/.test(id)) {
      if (!optional) missing.push({ id, kind: record?.kind || "", reason: record ? "unreadable" : "not-found" });
      continue;
    }
    const path = `media/${id}.${extOf(mime)}`;
    zip.add(path, bytes);
    const { bytes: _b, blob: _l, ...rest } = record;
    media.push({ id, path, kind: kindOf(mime, record.kind), mime, size: bytes.length, sha256: await sha256Hex(bytes), record: rest });
    mediaBytes += bytes.length;
    onProgress?.(i + 1, ids.length);
  }
  const manifest = {
    format: "capiday-backup",
    formatVersion: FORMAT_VERSION,
    minReaderVersion: FORMAT_VERSION,
    requires: [],
    backupId,
    createdAt,
    writer,
    complete: missing.length === 0,
    state: { path: "state.json", size: stateBytes.length, sha256: await sha256Hex(stateBytes), schemaVersion: state.schemaVersion, counts: counts(state) },
    media,
    missing,
    totals: { mediaCount: media.length, mediaBytes, referencedCount: required.size },
  };
  zip.add("manifest.json", enc.encode(JSON.stringify(manifest)));
  return { blob: zip.finish(), manifest };
}

// ---------- reading ----------
const readU16 = (v, at) => v.getUint16(at, true);
const readU32 = (v, at) => v.getUint32(at, true);
async function bytesOf(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}
const SAFE_PATH = /^(mimetype|header\.json|state\.json|manifest\.json|manifest\.sig\.json|media\/[A-Za-z0-9-]{1,64}\.[a-z0-9]{1,8})$/;

// Is this file a `.capiday`? (its first bytes: a ZIP whose first entry is `mimetype`)
export async function looksLikeCapiday(blob) {
  if (!blob || blob.size < 30 + 8 + MIMETYPE.length) return false;
  const head = await bytesOf(blob, 0, 30 + 8 + MIMETYPE.length);
  return head[0] === 0x50 && head[1] === 0x4b && dec.decode(head.slice(30, 38)) === "mimetype" && dec.decode(head.slice(38)) === MIMETYPE;
}

/**
 * Read and check a `.capiday` file (all three layers when verify is true).
 * Returns the shape the app's restore already understands (the JSON backup's):
 * { format: "little-days-backup", version: 1, createdAt, complete, missing,
 *   state, media: [{ ...record, id, kind, mime, blob }], capiday: { manifest } }
 * Throws { code }: not-capiday · damaged · newer-format · checksum · bad-state.
 */
export async function readCapiday(blob, { verify = true } = {}) {
  if (!(await looksLikeCapiday(blob))) throw fail("not-capiday");
  const tailLen = Math.min(blob.size, 22 + 0xffff);
  const tail = await bytesOf(blob, blob.size - tailLen, blob.size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--)
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw fail("damaged", "no-end");
  const ev = new DataView(tail.buffer, tail.byteOffset + eocd, 22);
  const count = readU16(ev, 10);
  const cdSize = readU32(ev, 12);
  const cdStart = readU32(ev, 16);
  if (cdStart + cdSize > blob.size) throw fail("damaged", "cd-range");
  const cd = await bytesOf(blob, cdStart, cdStart + cdSize);
  const cv = new DataView(cd.buffer);
  const entries = new Map();
  let at = 0;
  for (let n = 0; n < count; n++) {
    if (at + 46 > cd.length || readU32(cv, at) !== 0x02014b50) throw fail("damaged", "cd-entry");
    const method = readU16(cv, at + 10);
    const crc = readU32(cv, at + 16);
    const csize = readU32(cv, at + 20);
    const size = readU32(cv, at + 24);
    const nameLen = readU16(cv, at + 28);
    const extraLen = readU16(cv, at + 30);
    const commentLen = readU16(cv, at + 32);
    const offset = readU32(cv, at + 42);
    const name = dec.decode(cd.slice(at + 46, at + 46 + nameLen));
    if (method !== 0 || csize !== size) throw fail("damaged", "not-stored");
    if (!SAFE_PATH.test(name) || entries.has(name)) throw fail("damaged", "path");
    entries.set(name, { name, crc, size, offset });
    at += 46 + nameLen + extraLen + commentLen;
  }
  const dataStart = async (e) => {
    const lh = await bytesOf(blob, e.offset, e.offset + 30);
    const lv = new DataView(lh.buffer);
    if (readU32(lv, 0) !== 0x04034b50) throw fail("damaged", "local");
    return e.offset + 30 + readU16(lv, 26) + readU16(lv, 28);
  };
  const read = async (name) => {
    const e = entries.get(name);
    if (!e) throw fail("damaged", "missing-" + name);
    const s = await dataStart(e);
    const bytes = await bytesOf(blob, s, s + e.size);
    if (bytes.length !== e.size || (verify && crc32(bytes) !== e.crc)) throw fail("checksum", name);
    return bytes;
  };
  if (dec.decode(await read("mimetype")) !== MIMETYPE) throw fail("not-capiday");
  let manifest, header;
  try {
    manifest = JSON.parse(dec.decode(await read("manifest.json")));
    header = JSON.parse(dec.decode(await read("header.json")));
  } catch (error) {
    if (error?.code) throw error;
    throw fail("damaged", "json");
  }
  if (manifest?.format !== "capiday-backup") throw fail("not-capiday");
  const major = (v) => Number(String(v || "0").split(".")[0]);
  if (major(manifest.formatVersion) > 1 || major(manifest.minReaderVersion) > 1 || (Array.isArray(manifest.requires) && manifest.requires.length)) throw fail("newer-format");
  if (header?.backupId !== manifest.backupId) throw fail("damaged", "backup-id");
  const stateBytes = await read("state.json");
  if (stateBytes.length !== manifest.state?.size || (verify && (await sha256Hex(stateBytes)) !== manifest.state?.sha256)) throw fail("checksum", "state.json");
  let state;
  try {
    state = JSON.parse(dec.decode(stateBytes));
    validateStateSnapshot(state);
  } catch {
    throw fail("bad-state");
  }
  const list = Array.isArray(manifest.media) ? manifest.media : [];
  if (manifest.totals && manifest.totals.mediaCount !== list.length) throw fail("damaged", "count");
  const media = [];
  for (const item of list) {
    const e = entries.get(item?.path);
    if (!e || e.size !== item.size || !MEDIA_MIME.test(item.mime || "")) throw fail("damaged", "media-entry");
    const s = await dataStart(e);
    const part = blob.slice(s, s + e.size, item.mime);
    if (verify) {
      const bytes = new Uint8Array(await part.arrayBuffer());
      if (crc32(bytes) !== e.crc || (await sha256Hex(bytes)) !== item.sha256) throw fail("checksum", item.path);
    }
    media.push({ ...(item.record || {}), id: item.id, kind: item.kind, mime: item.mime, size: item.size, blob: part });
  }
  return {
    format: "little-days-backup",
    version: 1,
    createdAt: manifest.createdAt || header.createdAt || "",
    complete: manifest.complete === true,
    ...(Array.isArray(manifest.missing) && manifest.missing.length ? { missing: manifest.missing } : {}),
    state,
    media,
    capiday: { manifest },
  };
}
