// V10.55 · 照片墙 (Phase 1): every photo the person kept in their journal,
// as one wall — no calendar grid. Pure logic here (which photos, in which
// order, which column), the view and the viewer are in app.js.
//
// Which photos: the person's own pictures on saved pages — photo layers
// (Journal Studio, 今天的故事 and every other way of making a page), an older
// day photo, and a page background made from their own photo. Only their own
// files count (`media:` in the media store, or an older inline `data:` image):
// library photos, scenes, cover templates, stickers and hand drawings are not
// "a photo of my life". Sample days (isDemo) and unsaved drafts are left out.
//
// Nothing is copied: each item points at the same media reference the page
// uses, plus where it lives (date, book, page, layer), so the wall follows the
// journal — a new page adds its photos, a deleted page takes them away.
//
// Phase 2 (not built): a collage wall (polaroids, tilt, overlap, stickers,
// tickets, free placement) would keep its own layout per item id, next to
// these references — never inside the pages.
import { dayPageShown } from "./pages.mjs";

export const OWN_PHOTO = /^(media:[A-Za-z0-9-]+|data:image\/(jpeg|png|webp);base64,)/;

// [{ id, ref, date, bookId, momentId, layerId }], newest day first; within a
// day, newest page first (a day cover's copies count once, for the Moment page).
export function wallPhotos(state, { bookId = null } = {}) {
  const seen = new Map();
  const entries = (state.entries || []).filter((entry) => entry && entry.isDemo !== true && entry.date);
  entries.sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of entries) {
    // Newest page of the day first (Moments are kept oldest first).
    const pages = [...(entry.moments || [])].reverse().map((moment) => ({ page: moment, momentId: moment.id, book: moment.bookId || entry.bookId || "" }));
    // The day's own page after its Moments: a day cover repeats their photos.
    if (dayPageShown(entry)) pages.push({ page: entry, momentId: "", book: entry.bookId || "", day: true });
    for (const { page, momentId, book, day } of pages) {
      if (bookId && book !== bookId) continue;
      const refs = [];
      if (day && entry.photo) refs.push({ ref: entry.photo, layerId: "" });
      for (const layer of page.layers || []) if (layer?.kind === "photo" && !layer.drawing && layer.mediaRef) refs.push({ ref: layer.mediaRef, layerId: layer.id || "" });
      if (page.backdrop) refs.push({ ref: page.backdrop, layerId: "backdrop" });
      for (const { ref, layerId } of refs) {
        if (typeof ref !== "string" || !OWN_PHOTO.test(ref) || seen.has(ref)) continue;
        seen.set(ref, { id: ref.startsWith("media:") ? ref.slice(6) : `inline-${seen.size}`, ref, date: entry.date, bookId: book, momentId, layerId });
      }
    }
  }
  return [...seen.values()];
}

// Months, newest first: [{ month: "2026-11", items }].
export function wallMonths(items) {
  const months = [];
  for (const item of items) {
    const month = item.date.slice(0, 7);
    if (months.at(-1)?.month !== month) months.push({ month, items: [] });
    months.at(-1).items.push(item);
  }
  return months;
}

// Masonry: each photo goes to the shortest column, by its shape (height /
// width; 1 until known). Items keep their place once given, so a photo that
// loads later never jumps to another column.
export function wallColumns(items, count, ratioOf = () => 1) {
  const columns = Array.from({ length: Math.max(1, count) }, () => ({ height: 0, items: [] }));
  for (const item of items) {
    const ratio = Math.min(3, Math.max(0.33, Number(ratioOf(item)) || 1));
    const shortest = columns.reduce((best, col) => (col.height < best.height - 0.01 ? col : best), columns[0]);
    shortest.items.push(item);
    shortest.height += ratio;
  }
  return columns.map((col) => col.items);
}

// Photos from the same day (the viewer's strip).
export function sameDay(items, item) {
  return items.filter((other) => other.date === item.date);
}

// ---------- V10.78 · Memory Wall v1.0 (MW-01…MW-05) ----------
// Auto + Curate: the wall is still worked out from the journal each time
// (wallPhotos); a small optional setting on top of it says what the person
// hid, which whole pages they put up, and their own order:
//   state.wall = { version: 1, order: "time" | "custom",
//     hidden: { [cardKey]: { at, ref } }, pages: [{ key, addedAt }],
//     custom: [cardKey…], updatedAt }
// Keys name WHERE a card comes from (page id + layer id, or the day), never
// a date or a file id, so they survive a date change and a restore. Nothing
// here changes a page, a photo, a book or a date. A setting that is missing
// or damaged is ignored (the wall is as it was before v1.0).
export const WALL_PAGE_LIMIT = 50;
const where = (momentId, date) => (momentId ? momentId : `day:${date}`);
export const photoKey = (item) => `photo:${where(item.momentId, item.date)}:${item.layerId || "photo"}`;
export const pageKeyOf = (momentId, date) => `page:${where(momentId, date)}`;

export function wallSettings(state) {
  const w = state?.wall;
  const object = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!object(w)) return { version: 1, order: "time", hidden: {}, pages: [], custom: [] };
  return {
    version: 1,
    order: w.order === "custom" ? "custom" : "time",
    hidden: object(w.hidden) ? w.hidden : {},
    pages: Array.isArray(w.pages) ? w.pages.filter((p) => object(p) && typeof p.key === "string") : [],
    custom: Array.isArray(w.custom) ? w.custom.filter((k) => typeof k === "string") : [],
    updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : "",
  };
}

// The page a whole-page key points at, if it is still there (saved, not a sample).
export function pageForKey(state, key) {
  const id = String(key).replace(/^page:/, "");
  for (const entry of state.entries || []) {
    if (!entry || entry.isDemo === true) continue;
    if (id === `day:${entry.date}`) return dayPageShown(entry) ? { date: entry.date, entry, moment: null, bookId: entry.bookId || "" } : null;
    const moment = (entry.moments || []).find((m) => m.id === id);
    if (moment) return { date: entry.date, entry, moment, bookId: moment.bookId || entry.bookId || "" };
  }
  return null;
}

// Is a photo card hidden? Hidden by its place while that place still shows
// the same photo (a replaced photo shows again — the new one wasn't hidden),
// and wherever the same photo appears (it is one card on the wall).
function hiddenSet(wall) {
  const refs = new Set();
  for (const value of Object.values(wall.hidden)) if (value && typeof value.ref === "string") refs.add(value.ref);
  return refs;
}
export function isHidden(wall, card, refs = hiddenSet(wall)) {
  if (card.type !== "photo") return false;
  const h = wall.hidden[card.key];
  if (h && (!h.ref || h.ref === card.ref)) return true;
  return refs.has(card.ref);
}

// The cards on the wall, in order: { shown: [...], hidden: [...] }.
// time:   by date, newest first (whole pages among the photos of their day);
// custom: the person's order; cards not placed yet (new photos) come first,
//         newest first; no month headings.
export function applyWall(state, { bookId = null } = {}) {
  const wall = wallSettings(state);
  const refs = hiddenSet(wall);
  const photos = wallPhotos(state, { bookId }).map((item) => ({ ...item, type: "photo", key: photoKey(item) }));
  const pages = [];
  for (const p of wall.pages) {
    const at = pageForKey(state, p.key);
    if (!at || (bookId && at.bookId !== bookId)) continue;
    pages.push({ type: "page", key: p.key, id: p.key, date: at.date, bookId: at.bookId, momentId: at.moment?.id || "", addedAt: p.addedAt || "" });
  }
  const all = [...pages, ...photos].map((card, i) => ({ card, i }));
  all.sort((a, b) => b.card.date.localeCompare(a.card.date) || a.i - b.i);
  let cards = all.map((x) => x.card);
  const shown = cards.filter((c) => !isHidden(wall, c, refs));
  const hidden = cards.filter((c) => isHidden(wall, c, refs));
  if (wall.order === "custom") {
    const at = new Map(wall.custom.map((k, i) => [k, i]));
    const placed = shown.filter((c) => at.has(c.key)).sort((a, b) => at.get(a.key) - at.get(b.key));
    const fresh = shown.filter((c) => !at.has(c.key));
    return { shown: [...fresh, ...placed], hidden, order: "custom" };
  }
  return { shown, hidden, order: "time" };
}

// --- changes (each returns the new wall setting; the caller stores it) ---
const touched = (wall, now) => ({ ...wall, updatedAt: now || new Date().toISOString() });
export function hideCards(state, cards, now) {
  const wall = wallSettings(state);
  const hidden = { ...wall.hidden };
  for (const c of cards) if (c.type === "photo") hidden[c.key] = { at: now || new Date().toISOString(), ref: c.ref };
  return touched({ ...wall, hidden }, now);
}
export function unhideCards(state, cards, now) {
  const wall = wallSettings(state);
  const hidden = { ...wall.hidden };
  const refs = new Set(cards.map((c) => c.ref));
  for (const [key, value] of Object.entries(hidden)) if (cards.some((c) => c.key === key) || refs.has(value?.ref)) delete hidden[key];
  return touched({ ...wall, hidden }, now);
}
export function addPage(state, key, now) {
  const wall = wallSettings(state);
  if (wall.pages.some((p) => p.key === key)) return wall;
  if (wall.pages.length >= WALL_PAGE_LIMIT) {
    const error = new Error("wall-full");
    error.code = "wall-full";
    throw error;
  }
  return touched({ ...wall, pages: [...wall.pages, { key, addedAt: now || new Date().toISOString() }] }, now);
}
export function removePage(state, key, now) {
  const wall = wallSettings(state);
  return touched({ ...wall, pages: wall.pages.filter((p) => p.key !== key), custom: wall.custom.filter((k) => k !== key) }, now);
}
export function setOrder(state, order, now) {
  // Back to time order keeps the person's own order for later (custom stays).
  return touched({ ...wallSettings(state), order: order === "custom" ? "custom" : "time" }, now);
}
// Move one card past its neighbour in the order shown now (the whole order
// becomes the person's own from here).
export function moveCard(state, shownKeys, key, dir, now) {
  const wall = wallSettings(state);
  const keys = [...shownKeys];
  const from = keys.indexOf(key);
  const to = dir === "first" ? 0 : from + (dir < 0 ? -1 : 1);
  if (from < 0 || to < 0 || to >= keys.length || to === from) return { ...wall, order: "custom", custom: wall.order === "custom" ? wall.custom : keys };
  keys.splice(from, 1);
  keys.splice(to, 0, key);
  // Keys of cards not shown right now (another book's filter, hidden) keep their place after.
  const rest = wall.custom.filter((k) => !keys.includes(k));
  return touched({ ...wall, order: "custom", custom: [...keys, ...rest] }, now);
}
