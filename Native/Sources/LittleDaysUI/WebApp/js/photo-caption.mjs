// V10.81 · 配文 — a photo's own words, the V10.19 design ("magazine view: a
// line for each photo"), in one place so 今天的故事 and Journal Studio change
// them the same way.
//
// The words live on the photo layer itself (`caption`), found by the photo
// layer's id — never by time or by order. On the page they are shown by a text
// layer bound to that photo (`bind: "caption"`, `captionOf: <photo id>`); the
// page reads the words from the photo (scrapbook-layout `boundText`), so the
// bound layer only says where they sit. A page's own words (title / body) are
// separate fields on the page and are never touched here.

export const isCaptionPhoto = (layer) => Boolean(layer && layer.kind === "photo" && layer.mediaRef && !layer.gen && !layer.drawing && !layer.deco);

export const captionLayersOf = (page, photoId) => (page?.layers || []).filter((l) => l.kind === "text" && l.bind === "caption" && l.captionOf === photoId);

export function captionOf(page, photoId) {
  const photo = (page?.layers || []).find((l) => l.id === photoId);
  return isCaptionPhoto(photo) ? String(photo.caption || "") : "";
}

// Writes (or, when empty, removes) one photo's words. `makeLayer(photo)` gives
// the text layer that shows them when the page has none for this photo yet.
// Other photos, the page's title / body and every id stay as they are.
export function setPhotoCaption(page, photoId, value, { makeLayer = null } = {}) {
  const photo = (page?.layers || []).find((l) => l.id === photoId);
  if (!isCaptionPhoto(photo)) return { ok: false, reason: "no-photo" };
  const text = String(value ?? "");
  if (text.trim()) {
    photo.caption = text;
    const shown = captionLayersOf(page, photoId);
    for (const layer of shown) layer.text = text;
    if (shown.length || !makeLayer) return { ok: true, added: null };
    const layer = makeLayer(photo);
    if (!layer) return { ok: true, added: null };
    page.layers.push(layer);
    return { ok: true, added: layer.id };
  }
  delete photo.caption;
  const before = page.layers.length;
  page.layers = page.layers.filter((l) => !(l.kind === "text" && l.bind === "caption" && l.captionOf === photoId));
  return { ok: true, removed: before - page.layers.length };
}
