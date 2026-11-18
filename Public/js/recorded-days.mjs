// V10.84 · 集章 — which days have a stamp.
//
// A stamp means "something was kept on this date" (the journal date of a
// page, never the day it was made). It is NOT the same as "this date has
// pages now": once a date has had a kept page, its stamp stays, even after
// every page of that day is deleted or moved to another date — it then
// shows as an empty (date-only) stamp. So the dates that ever had a page are
// remembered in the journal itself:
//
//   state.recordedDays = { "2026-11-05": { at: "2026-11-17T09:12:00.000Z" }, … }
//
// - key: the journal date (YYYY-MM-DD) of a saved, non-sample page with
//   something on it; `at`: when this date was first seen with a page.
// - Kept up to date in one place: Store.update (model.mjs) runs
//   syncRecordedDays before and after every change, so a page deleted or moved
//   in that change was already counted. Nothing else writes it.
// - History needs no migration step: dates that have pages now always count,
//   and are written into the map with the next change.
// - It is part of the journal, so it is in every backup and comes back with a
//   restore (a restore replaces it, like the rest of the journal). An older
//   app keeps the field untouched (unknown fields are kept).
// - Unsaved drafts and sample days never count. Pages, photos and ids are
//   never touched here.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Same rules as day.mjs hasDayPageContent / hasMomentContent (kept here so the
// store needs no other module).
const filled = (v) => v !== "" && v !== false && v != null;
export function dayHasContent(entry) {
  return Boolean(entry && (entry.title?.trim() || entry.body?.trim() || entry.photo || entry.layers?.length || entry.media?.length || Object.values(entry.fieldValues || {}).some(filled)));
}
export function momentHasContent(moment) {
  return Boolean(moment && !moment.isDemo && (moment.title?.trim() || moment.body?.trim() || moment.layers?.length || moment.media?.length));
}
// A saved day with something kept on it (sample days never count).
export function entryHasContent(entry) {
  return Boolean(entry && entry.isDemo !== true && DATE.test(entry.date || "") && (dayHasContent(entry) || (entry.moments || []).some(momentHasContent)));
}

// Dates that have a kept page right now: Map date → entry.
export function contentDays(state) {
  const days = new Map();
  for (const entry of state?.entries || []) if (entryHasContent(entry) && !days.has(entry.date)) days.set(entry.date, entry);
  return days;
}

// The remembered dates, cleaned (a damaged value is never trusted or thrown on).
export function ledger(state) {
  const raw = state?.recordedDays;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [date, value] of Object.entries(raw)) if (DATE.test(date)) out[date] = { at: typeof value?.at === "string" ? value.at : "" };
  return out;
}

// When a day was first kept, as well as the journal can tell (for history).
function firstSeen(entry, now) {
  const times = [entry.createdAt, ...(entry.moments || []).map((m) => m.createdAt), entry.updatedAt].filter((x) => typeof x === "string" && x);
  times.sort();
  return times[0] || now;
}

// Adds every date that has a kept page now. Returns true when something was added.
export function syncRecordedDays(state, now = new Date().toISOString()) {
  if (!state || typeof state !== "object") return false;
  const current = ledger(state);
  let added = false;
  for (const [date, entry] of contentDays(state)) {
    if (current[date]) continue;
    current[date] = { at: firstSeen(entry, now) };
    added = true;
  }
  const before = state.recordedDays;
  const shapeChanged = !before || typeof before !== "object" || Array.isArray(before) || Object.keys(before).length !== Object.keys(current).length;
  if (added || shapeChanged) {
    // Sorted by date: the same journal always writes the same text.
    state.recordedDays = Object.fromEntries(Object.keys(current).sort().map((d) => [d, current[d]]));
  }
  return added;
}

// Every stamped date (remembered or with a page now), sorted.
export function stampedDates(state) {
  const set = new Set([...Object.keys(ledger(state)), ...contentDays(state).keys()]);
  return [...set].sort();
}
