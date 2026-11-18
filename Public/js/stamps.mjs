// V10.84 · 集章卡 and 这一周: what each stamp looks like, a month of stamps,
// and the week in review. Pure logic over the journal; app.js draws it.
//
// A stamp (recorded-days.mjs says which dates have one):
// - "photo": the first photo of your own on that day's first page (the photo
//   wall's rules: only your own pictures; one you hid on the photo wall is
//   never used);
// - "word": no photo — the first letter / character of what you wrote;
// - "voice" / "draw": only a voice note / only a drawing;
// - "mark": something else (a sticker, a template);
// - "empty": the date had pages once, none now — shown as a date-only stamp,
//   never a photo of a page that is gone, never a link to it.
// A date that never had a page has no stamp at all.
import { applyWall, OWN_PHOTO } from "./photo-wall.mjs";
import { contentDays, ledger, stampedDates } from "./recorded-days.mjs";

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export function addDaysKey(key, n) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
// Monday of the week of `key`.
export function weekStartKey(key) {
  const day = new Date(`${key}T12:00:00`).getDay();
  return addDaysKey(key, -((day + 6) % 7));
}

const pagesOf = (entry) => [entry, ...(entry.moments || []).filter((m) => !m.isDemo)];
const LETTER = /[\p{L}\p{N}]/u;

function hiddenRefs(state) {
  try {
    return new Set(applyWall(state).hidden.map((c) => c.ref));
  } catch {
    return new Set();
  }
}

// What the stamp of one date shows.
export function stampFace(entry, hidden = new Set()) {
  if (!entry) return { kind: "empty" };
  const pages = pagesOf(entry);
  for (const page of pages) {
    const refs = [];
    if (page === entry && entry.photo) refs.push(entry.photo);
    for (const layer of page.layers || []) if (layer?.kind === "photo" && !layer.drawing && layer.mediaRef) refs.push(layer.mediaRef);
    const ref = refs.find((r) => typeof r === "string" && OWN_PHOTO.test(r) && !hidden.has(r));
    if (ref) return { kind: "photo", ref };
  }
  for (const page of pages) {
    const words = [page.title, page.body, ...(page.layers || []).filter((l) => l?.kind === "text" && !l.bind && !l.gen).map((l) => l.text), ...(page.layers || []).filter((l) => l?.kind === "photo").map((l) => l.caption)];
    for (const w of words) {
      const m = String(w || "").match(LETTER);
      if (m) return { kind: "word", ch: m[0].toUpperCase() };
    }
  }
  const all = pages.flatMap((p) => p.layers || []);
  if (pages.some((p) => (p.media || []).some((c) => c?.kind === "audio")) || all.some((l) => l?.kind === "audio")) return { kind: "voice" };
  if (all.some((l) => l?.drawing)) return { kind: "draw" };
  return { kind: "mark" };
}

// All stamps, keyed by date: { date: face }.
export function stampsByDate(state) {
  const pages = contentDays(state);
  const hidden = hiddenRefs(state);
  const out = {};
  for (const date of stampedDates(state)) out[date] = pages.has(date) ? stampFace(pages.get(date), hidden) : { kind: "empty" };
  return out;
}

// One month (month 1–12): every day with its stamp (or none).
export function monthStamps(state, year, month, stamps = stampsByDate(state)) {
  const days = new Date(year, month, 0).getDate();
  const list = [];
  for (let d = 1; d <= days; d++) {
    const date = dayKey(year, month, d);
    list.push({ date, day: d, stamp: stamps[date] || null });
  }
  // Monday-first: blank cells before the 1st.
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  return { year, month, lead, days: list, count: list.filter((x) => x.stamp).length };
}

// Months that have at least one stamp, newest first: [{ year, month, count }].
export function stampMonths(state, stamps = stampsByDate(state)) {
  const counts = new Map();
  for (const date of Object.keys(stamps)) {
    const key = date.slice(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, count]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), count }));
}

export function totalStamps(state) {
  return stampedDates(state).length;
}

// The week (Monday–Sunday) that contains `today`, in review: the days with a
// stamp, your own photos kept on those days (photo wall rules), one line you
// wrote, voice notes. Only dates inside this week count.
export function weekReview(state, today) {
  const start = weekStartKey(today);
  const end = addDaysKey(start, 6);
  const inWeek = (d) => d >= start && d <= end;
  const stamps = stampsByDate(state);
  const pages = contentDays(state);
  const hidden = hiddenRefs(state);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(start, i);
    return { date, stamp: stamps[date] || null, future: date > today };
  });
  const photos = [];
  let voices = 0;
  let line = null;
  for (const date of [...pages.keys()].filter(inWeek).sort()) {
    const entry = pages.get(date);
    for (const page of pagesOf(entry)) {
      const refs = [];
      if (page === entry && entry.photo) refs.push(entry.photo);
      for (const layer of page.layers || []) {
        if (layer?.kind === "photo" && !layer.drawing && layer.mediaRef) refs.push(layer.mediaRef);
        if (layer?.kind === "audio") voices++;
      }
      for (const ref of refs) if (typeof ref === "string" && OWN_PHOTO.test(ref) && !hidden.has(ref) && !photos.some((p) => p.ref === ref)) photos.push({ ref, date });
      const said = [page.title, page.body].map((x) => String(x || "").trim()).find((x) => x.length >= 2);
      // The shortest real line of the week reads best on the card.
      if (said && (!line || said.length < line.text.length)) line = { text: said.length > 60 ? `${said.slice(0, 58)}…` : said, date };
    }
  }
  const recorded = days.filter((d) => d.stamp).length;
  return { start, end, days, recorded, photoCount: photos.length, photos, voices, line };
}

export { ledger };
