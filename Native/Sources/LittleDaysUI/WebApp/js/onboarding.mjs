// V10.62 · 新手引导 (design round V10.52 §3, approved): pure helpers.
//
// Home: a welcome card, three highlighted places on the real Home (the photo
// card, the other ways to record, Calendar + My Books), then an invitation to
// make the first page. After the first page is really saved, one small card.
//
// Whether it has been seen is a preference of this device (localStorage
// "little-days.onboarding"), not journal data: not in the journal store, not
// in backups, not in the Swift model. Reading or changing it never touches a
// page, and the guide itself never makes one (no sample journal).
//
// { v: 1, home: "new" | "done" | "skipped", firstPage: "new" | "done", at }
//   home "new"  = the guide was started and not finished; on the next start
//                 it counts as skipped (it never pops up a second time).

export const ONBOARDING_KEY = "little-days.onboarding";

export const STEPS = [
  { id: "welcome", captain: true },
  // V10.90: the photo step is done by tapping the real button — it opens the
  // photo picker, and the guide carries on (no separate 下一步).
  { id: "photos", target: ".v9-home .v9-cta", tap: "today-photos" },
  { id: "ways", target: ".v9-home .today-tiles" },
  { id: "nav", target: '#navigation [data-page="calendar"], #navigation [data-page="books"]' },
  { id: "invite", captain: true },
];

export function load(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(ONBOARDING_KEY) || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return {
      v: 1,
      home: ["new", "done", "skipped"].includes(value.home) ? value.home : "skipped",
      firstPage: value.firstPage === "new" ? "new" : "done",
      at: typeof value.at === "string" ? value.at : "",
    };
  } catch {
    return null;
  }
}

function save(next, storage) {
  try {
    storage?.setItem(ONBOARDING_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

// Anything of one's own: a saved day that is not a sample, or a draft.
export function hasOwnContent(journal) {
  const own = (journal?.entries || []).some((entry) => entry && entry.isDemo !== true);
  const drafts = Object.keys(journal?.drafts || {}).length > 0;
  return own || drafts;
}

// A page of one's own that is kept (not only a draft).
export function hasSavedPage(journal) {
  return (journal?.entries || []).some(
    (entry) => entry && entry.isDemo !== true && entry.status !== "draft" && ((entry.moments || []).length > 0 || (entry.layers || []).length > 0 || entry.photo || String(entry.body || "").trim()),
  );
}

// At start: "start" (someone new), or "none". Someone who already has pages
// of their own (an update from an older version) is marked done and never
// shown it; a guide left half-way last time counts as skipped.
export function decide(storage, journal, now = new Date()) {
  const record = load(storage);
  if (record) {
    if (record.home === "new") save({ ...record, home: "skipped", at: now.toISOString() }, storage);
    return "none";
  }
  if (hasOwnContent(journal)) {
    save({ v: 1, home: "done", firstPage: "done", at: now.toISOString() }, storage);
    return "none";
  }
  return "start";
}

export function begin(storage = globalThis.localStorage, now = new Date()) {
  const record = load(storage);
  // A replay from Settings keeps what was there (and never asks for the first-page card again).
  if (record) return record;
  return save({ v: 1, home: "new", firstPage: "new", at: now.toISOString() }, storage);
}

// outcome: "done" | "skipped"
export function finishHome(outcome, storage = globalThis.localStorage, now = new Date()) {
  const record = load(storage) || { v: 1, firstPage: "new" };
  if (record.home === "done" && outcome !== "done") return record; // a replay skipped half-way
  return save({ ...record, home: outcome === "done" ? "done" : "skipped", at: now.toISOString() }, storage);
}

// The "first page done" card: once, for someone this guide met as new.
export function shouldShowFirstPage(record, journal) {
  return Boolean(record && record.firstPage === "new" && hasSavedPage(journal));
}

export function markFirstPage(storage = globalThis.localStorage, now = new Date()) {
  const record = load(storage) || { v: 1, home: "skipped" };
  return save({ ...record, firstPage: "done", at: now.toISOString() }, storage);
}
