// V10.64 · 照片分组第二阶段 (docs/PHOTO_GROUPING_PLAN.md §5, approved):
// merge pages, split a page, move a photo to another page (or to a page of
// its own), and the order of the photos on a page. Pure functions on a day
// (an editor copy); app.js runs each one inside a single changeEditor, so
// one undo brings everything back.
//
// Nothing is lost and nothing is copied: layer objects move whole (a photo
// keeps its mediaRef, crop, frame and words; its caption text goes with it);
// a sound / video moves with its clip; no media: record is made or removed.
// A page's title that is merged into another becomes a text box on it.
import { createMoment, findMoment } from "./day.mjs";

export const isPhoto = (layer) => layer?.kind === "photo" && !layer.drawing && !layer.gen && !layer.deco && Boolean(layer.mediaRef);

// The page's photos in their story order: photoOrder where it is set, the
// stacking order otherwise (older pages have no photoOrder).
export function photoSequence(page) {
  const photos = (page?.layers || []).map((layer, index) => ({ layer, index })).filter(({ layer }) => isPhoto(layer));
  photos.sort((a, b) => (Number.isFinite(a.layer.photoOrder) ? a.layer.photoOrder : 1e6 + a.index) - (Number.isFinite(b.layer.photoOrder) ? b.layer.photoOrder : 1e6 + b.index) || a.index - b.index);
  return photos.map(({ layer }) => layer);
}

// The photo and everything that belongs to it (its caption text boxes).
function withCaptions(page, photoIds) {
  const ids = new Set(photoIds);
  return page.layers.filter((layer) => ids.has(layer.id) || (layer.captionOf && ids.has(layer.captionOf)));
}

function renumber(page) {
  photoSequence(page).forEach((layer, i) => (layer.photoOrder = i));
}

// Moves layers (and the clips they play) from one page to another; returns
// how many layers moved.
function carry(from, to, layers) {
  const moving = new Set(layers);
  const clipIds = new Set(layers.map((layer) => layer.clipId).filter(Boolean));
  from.layers = from.layers.filter((layer) => !moving.has(layer));
  to.layers = to.layers || [];
  to.media = to.media || [];
  // The page's own photos keep their order (older pages get numbered first), the newcomers follow.
  renumber(to);
  const start = photoSequence(to).length;
  let n = 0;
  for (const layer of layers) {
    if (isPhoto(layer)) layer.photoOrder = start + n++;
    to.layers.push(layer);
  }
  if (clipIds.size) {
    to.media.push(...(from.media || []).filter((clip) => clipIds.has(clip.id)));
    from.media = (from.media || []).filter((clip) => !clipIds.has(clip.id));
  }
  return layers.length;
}

// A new, empty page right after `page`, in the same book with the same look.
function pageAfter(entry, page, makeMoment = createMoment) {
  const values = { time: page.time || "", bookId: page.bookId };
  for (const key of ["layoutStyle", "typeStyle", "font", "template", "paper"]) if (page[key] !== undefined) values[key] = structuredClone(page[key]);
  if (page.layoutTemplate && page.layoutTemplate !== "text" && page.layoutTemplate !== "line") values.layoutTemplate = page.layoutTemplate;
  const next = makeMoment(entry, values);
  const index = entry.moments.indexOf(page);
  entry.moments.splice(index + 1, 0, next);
  return next;
}

// Merge: the later pages' photos, words, stickers, sounds and drawings join
// the first one (in the day's order). Their titles become text boxes, their
// words are added after the first page's words; their tags join.
// Returns the merged page's id, or null (fewer than two pages).
export function mergeMoments(entry, ids, { makeId = () => crypto.randomUUID(), titleY = 88 } = {}) {
  const pages = (entry?.moments || []).filter((moment) => ids.includes(moment.id));
  if (pages.length < 2) return null;
  const [target, ...rest] = pages;
  let y = titleY;
  for (const page of rest) {
    // Words the layout made from that page's own title / time go: the title is kept below.
    const layers = (page.layers || []).filter((layer) => !(layer.gen && (layer.bind === "title" || layer.bind === "time")));
    carry(page, target, layers);
    if (String(page.title || "").trim()) {
      target.layers.push({ id: makeId(), kind: "text", text: page.title.trim(), x: 50, y: Math.min(94, y), w: 80, scale: 1, rotation: 0 });
      y += 4;
    }
    if (String(page.body || "").trim()) target.body = [String(target.body || "").trim(), page.body.trim()].filter(Boolean).join("\n\n");
    target.tags = [...new Set([...(target.tags || []), ...(page.tags || [])])];
    if (!target.mood && page.mood) target.mood = page.mood;
    entry.moments = entry.moments.filter((moment) => moment !== page);
  }
  renumber(target);
  target.updatedAt = new Date().toISOString();
  return target.id;
}

// Split: from this photo on (in the photo order), the photos and their words
// go to a new page right after. Returns the new page's id, or null.
export function splitAt(entry, momentId, photoId, { makeMoment } = {}) {
  const page = findMoment(entry, momentId);
  const order = photoSequence(page);
  const at = order.findIndex((layer) => layer.id === photoId);
  if (!page || at <= 0) return null;
  const next = pageAfter(entry, page, makeMoment);
  carry(page, next, withCaptions(page, order.slice(at).map((l) => l.id)));
  renumber(page);
  return next.id;
}

// One photo (with its words) to another page — or, with toId null, to a
// page of its own right after. Returns the page it went to, or null.
export function movePhoto(entry, fromId, photoId, toId = null, { makeMoment } = {}) {
  const from = findMoment(entry, fromId);
  const photo = from?.layers.find((layer) => layer.id === photoId && isPhoto(layer));
  if (!photo) return null;
  const to = toId ? findMoment(entry, toId) : pageAfter(entry, from, makeMoment);
  if (!to || to === from) return null;
  carry(from, to, withCaptions(from, [photoId]));
  renumber(from);
  return to.id;
}

// The order of the photos on a page (only photoOrder; the stacking stays).
export function setPhotoOrder(page, ids) {
  const order = photoSequence(page);
  const known = ids.filter((id) => order.some((l) => l.id === id));
  const rest = order.filter((l) => !known.includes(l.id)).map((l) => l.id);
  [...known, ...rest].forEach((id, i) => (page.layers.find((l) => l.id === id).photoOrder = i));
}

// Every media reference on a day (pages, clips, backdrop), for the "nothing
// lost, nothing added" checks.
export function mediaRefs(entry) {
  const refs = [];
  for (const page of [entry, ...(entry?.moments || [])]) {
    for (const layer of page?.layers || []) if (layer.mediaRef) refs.push(layer.mediaRef);
    for (const clip of page?.media || []) refs.push(clip.source);
    if (page?.photo) refs.push(page.photo);
  }
  return refs.sort();
}
