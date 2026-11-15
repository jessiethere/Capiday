// Sprint 1 · S1-1 恢复安全 — pure helpers (no storage, no DOM).
// docs/SPRINT1_BACKUP_RESTORE_PLAN.md (S1-1) · docs/CAPIDAY_BACKUP_FORMAT.md
//
// - analyzeBackup: checks a parsed backup file and describes what it REALLY
//   holds (counted from the parsed journal and media list, never from what
//   the file says about itself), before anything is written.
// - summarize: the same counts for any journal (the current one, or the
//   journal as written after a restore, to verify it).
// - planSnapshots: which daily journal snapshots to keep (3 days, 60 MB,
//   14 days). These are copies of the journal JSON only — no photo, video or
//   sound files — and are never presented as a backup.
import { validateStateSnapshot } from "./model.mjs";
import { mediaReferences } from "./media.mjs";
import { visiblePages } from "./pages.mjs";

export const MAX_RESTORE_FILE_BYTES = 150 * 1024 * 1024;
export const MAX_RESTORE_MEDIA_BYTES = 50 * 1024 * 1024; // one file
export const MAX_RESTORE_FILES = 2000;
export const UNDO_DAYS = 7;
export const BEFORE_RESTORE_KEEP = 2;
export const BEFORE_RESTORE_DAYS = 14;
export const SNAPSHOT_PREFIX = "little-days.v1.snap.";
export const BEFORE_RESTORE_PREFIX = "little-days.v1.before-restore.";
export const SNAPSHOT_RULES = { keep: 3, maxDays: 14, totalBytes: 60 * 1024 * 1024, singleBytes: 30 * 1024 * 1024 };

// A media data URL from a backup: image / audio / video, any parameters
// (codecs lists may contain commas, e.g. "avc1,mp4a.40.2"), base64.
// V10 refused any codecs with a comma — a backup could be made but not restored.
const DATA_URL = /^data:(image\/(jpeg|png|webp|gif|heic|heif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)((;[a-z0-9-]+=("[^"]*"|[^;"]*))*);base64,/i;
const BLOB_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)((;[a-z0-9-]+=("[^"]*"|[^;"]*))*)$/i;
export function validMediaData(data) {
  return typeof data === "string" && DATA_URL.test(data);
}
export function mimeOfData(data) {
  const m = DATA_URL.exec(data || "");
  return m ? (m[1] + (m[3] || "")).toLowerCase() : "";
}
// Decoded size of a base64 data URL, without decoding it.
export function dataBytes(data) {
  const comma = data.indexOf(",");
  const b64 = data.length - comma - 1;
  const pad = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64 * 3) / 4) - pad);
}

const kindOfMime = (mime, kind) => {
  if (["photo", "video", "audio", "voice", "drawing"].includes(kind)) return kind === "voice" ? "audio" : kind === "drawing" ? "photo" : kind;
  if (/^video\//.test(mime)) return "video";
  if (/^audio\//.test(mime)) return "audio";
  return "photo";
};

/** What a journal holds, counted from the journal itself. */
export function summarize(state) {
  const own = (state.entries || []).filter((e) => e && e.isDemo !== true);
  const ownState = { ...state, entries: own };
  let pages = 0;
  try {
    pages = visiblePages(ownState).length;
  } catch {
    pages = own.reduce((n, e) => n + (e.moments || []).length, 0);
  }
  const plans = Object.values(state.plans || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
  return {
    books: (state.books || []).length,
    days: own.length,
    dates: own.map((e) => e.date).sort(),
    pages,
    drafts: Object.keys(state.drafts || {}).length,
    plans,
    habits: (state.habits || []).length,
    checks: (state.checks || []).length,
    keeper: Boolean(state.keeper && Object.keys(state.keeper).length),
    mediaRefs: mediaReferences(state).size,
  };
}

/** The parts of two summaries that must be equal after a restore. */
export function sameJournal(a, b) {
  const keys = ["books", "days", "pages", "drafts", "plans", "habits", "checks", "keeper", "mediaRefs"];
  const diff = keys.filter((k) => a[k] !== b[k]);
  if (a.dates.join() !== b.dates.join()) diff.push("dates");
  return diff;
}

/**
 * Checks a parsed backup without writing anything.
 * Returns { ok, error?, summary?, media?, missing?, complete, createdAt }.
 * `media` is the list to write: [{ id, kind, mime, bytes (decoded size), record }].
 */
export function analyzeBackup(backup) {
  const fail = (error) => ({ ok: false, error });
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) return fail("not-backup");
  if (backup.format !== "little-days-backup") return fail("not-backup");
  if (backup.version !== 1) return fail("newer-format");
  const state = backup.state;
  if (!state || typeof state !== "object") return fail("damaged");
  if (state.schemaVersion !== 1) return fail(Number.isFinite(state.schemaVersion) && state.schemaVersion > 1 ? "newer-format" : "damaged");
  if (!["entries", "books", "habits", "checks"].every((k) => Array.isArray(state[k])) || !state.drafts || typeof state.drafts !== "object" || !Array.isArray(backup.media)) return fail("damaged");
  try {
    validateStateSnapshot(state);
  } catch {
    return fail("damaged");
  }
  if (backup.media.length > MAX_RESTORE_FILES) return fail("too-many");
  const references = mediaReferences(state);
  const byId = new Map();
  for (const record of backup.media) {
    if (!record || typeof record.id !== "string") return fail("damaged");
    if (!references.has(record.id)) continue; // unused file in the backup: ignored
    if (byId.has(record.id)) return fail("damaged");
    // V10.78: from a `.capiday` the file's bytes come as a Blob (already
    // checked by size and SHA-256 there), not as a base64 data URL.
    const fromBlob = record.blob && typeof record.blob.size === "number" && typeof record.blob.arrayBuffer === "function";
    if (fromBlob ? !BLOB_MIME.test(String(record.mime || "")) : !validMediaData(record.data)) return fail("bad-media");
    const size = fromBlob ? record.blob.size : dataBytes(record.data);
    if (size > MAX_RESTORE_MEDIA_BYTES) return fail("media-too-large");
    const mime = fromBlob ? String(record.mime).toLowerCase() : mimeOfData(record.data);
    byId.set(record.id, { id: record.id, mime, size, kind: kindOfMime(mime, record.kind), record });
  }
  // A backup that lists the files it could not include (C2) may leave them out;
  // any other gap means the file is damaged or incomplete.
  const listed = new Set(backup.complete === false && Array.isArray(backup.missing) ? backup.missing.map((m) => m?.id).filter((x) => typeof x === "string") : []);
  const missing = [...references].filter((id) => !byId.has(id));
  if (missing.some((id) => !listed.has(id))) return fail("incomplete");
  const media = [...byId.values()];
  const kinds = { photo: 0, video: 0, audio: 0 };
  for (const m of media) kinds[m.kind] = (kinds[m.kind] || 0) + 1;
  return {
    ok: true,
    createdAt: typeof backup.createdAt === "string" ? backup.createdAt : "",
    complete: missing.length === 0,
    missing,
    media,
    mediaBytes: media.reduce((n, m) => n + m.size, 0),
    kinds,
    summary: summarize(state),
  };
}

/** Byte-for-byte equality (decides "same file" — never the file name). */
export function sameBytes(a, b) {
  if (!a || !b || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

const dayMs = 86_400_000;
const dateOf = (key, prefix) => key.slice(prefix.length);

/**
 * Daily snapshots: [{ key, bytes }] (key = SNAPSHOT_PREFIX + "YYYY-MM-DD").
 * Returns the keys to delete so that at most `keep` days remain, none older
 * than `maxDays`, at most `totalBytes` in all, and — when the newest alone is
 * larger than `singleBytes` — only the newest.
 */
export function planSnapshots(list, today, rules = SNAPSHOT_RULES) {
  const items = list.filter((s) => s.key.startsWith(SNAPSHOT_PREFIX)).sort((a, b) => (dateOf(b.key, SNAPSHOT_PREFIX) < dateOf(a.key, SNAPSHOT_PREFIX) ? -1 : 1));
  const remove = new Set();
  const now = Date.parse(`${today}T12:00:00Z`);
  for (const s of items) {
    const age = (now - Date.parse(`${dateOf(s.key, SNAPSHOT_PREFIX)}T12:00:00Z`)) / dayMs;
    if (!(age <= rules.maxDays)) remove.add(s.key);
  }
  const kept = items.filter((s) => !remove.has(s.key));
  if (kept[0] && kept[0].bytes > rules.singleBytes) kept.slice(1).forEach((s) => remove.add(s.key));
  let total = 0;
  kept.forEach((s, i) => {
    if (remove.has(s.key)) return;
    if (i >= rules.keep || total + s.bytes > rules.totalBytes) remove.add(s.key);
    else total += s.bytes;
  });
  return [...remove];
}

/** Pre-restore snapshots ([{ key, at }]): keep the newest 2, drop any older than 14 days. */
export function planBeforeRestore(list, now = Date.now()) {
  const items = [...list].sort((a, b) => b.at - a.at);
  return items.filter((s, i) => i >= BEFORE_RESTORE_KEEP || now - s.at > BEFORE_RESTORE_DAYS * dayMs).map((s) => s.key);
}

/** Days left to undo a restore (0 = no longer). */
export function undoDaysLeft(last, now = Date.now()) {
  if (!last?.at || !last.snapshotKey) return 0;
  const left = UNDO_DAYS - (now - Date.parse(last.at)) / dayMs;
  return left > 0 ? Math.ceil(left) : 0;
}
