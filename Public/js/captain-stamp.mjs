// V10.85 · When Captain joins a first stamp (Visual Direction v1, Founder-approved).
//
// Captain is a surprise, not a ritual:
// - the first new stamp of a month (by the stamp's journal date): Captain
//   always comes;
// - after that, at most 2 more times in a week (Monday–Sunday of the day it
//   happens), and only on dates whose fixed "luck" says so (about 1 in 3);
// - every other first stamp is just the stamp, the line and the light tap.
//
// Nothing here is random: the same stamp on the same day always gives the same
// answer, so it can be tested. It only decides; it never touches the journal.
// The caller (app.js stampMoment) asks only for a date's *first* stamp — an
// event the journal's store sends once, after the save is stored, and never
// for a restore, history, a re-render or a restart — and keeps a small
// device-only log of when Captain came (so the weekly limit holds).

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EXTRA_PER_WEEK = 2;

// FNV-1a over the date text: a fixed number per date.
export function luck(date) {
  let h = 0x811c9dc5;
  for (const ch of String(date)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
export const lucky = (date) => luck(date) % 3 === 0;

const pad = (n) => String(n).padStart(2, "0");
// Monday of the week of a YYYY-MM-DD date.
export function weekOf(key) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// date: the date that just got its first stamp. before: every date that had
// a stamp before this one. today: the day it happens. log: { date: { role, on } }
// of earlier times Captain came. Returns "first", "extra" or "" (not this time).
export function captainRole({ date, before = [], today, log = {} }) {
  if (!DATE.test(date || "") || !DATE.test(today || "")) return "";
  if (log[date]) return ""; // already came for this date
  const month = date.slice(0, 7);
  if (!before.some((d) => d !== date && String(d).startsWith(month))) return "first";
  const week = weekOf(today);
  const extras = Object.values(log).filter((x) => x?.role === "extra" && DATE.test(x.on || "") && weekOf(x.on) === week).length;
  if (extras >= EXTRA_PER_WEEK) return "";
  return lucky(date) ? "extra" : "";
}

// The log is kept small: the newest 90 dates.
export function remember(log, date, role, today) {
  const next = { ...(log || {}), [date]: { role, on: today } };
  const keys = Object.keys(next).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 90))) delete next[k];
  return next;
}
