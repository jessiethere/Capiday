// V10.80 · 翻照片时能听，也能补一句 / Listen while looking back, add a thought.
// Pure helpers (no storage, no DOM): what a photo on a page "says" — its own
// words and voice notes — and where a thought added later goes on that page.
//
// A page can hold several photos, so what belongs to which photo is kept by
// id: a text or sound added for a photo is a normal layer on the same page
// with `forPhoto: <that photo layer's id>` (optional field; older readers just
// see a text / player on the page). Nothing is copied or moved; the page keeps
// its id, date and journal.
//
// What a photo shows in the photo wall viewer:
//   · its own caption (V10.19) and every text / sound added for it;
//   · when it is the only photo on its page: also the page's own words
//     (title, body) and the page's sounds that belong to no photo — a page
//     with one photo is about that photo.
// With several photos, page-wide words and sounds are not attached to any one
// photo, so nothing from one photo shows up on another.

const OWN = /^(media:[A-Za-z0-9-]+|data:image\/(jpeg|png|webp);base64,)/;

/** The person's own photos on a page (not drawings, not library pictures made by a layout). */
export function pagePhotos(page) {
  const layers = (page?.layers || []).filter((l) => l && l.kind === "photo" && !l.drawing && typeof l.mediaRef === "string" && OWN.test(l.mediaRef));
  const list = layers.map((l) => ({ layerId: l.id, ref: l.mediaRef }));
  if (typeof page?.backdrop === "string" && OWN.test(page.backdrop)) list.push({ layerId: "backdrop", ref: page.backdrop });
  if (typeof page?.photo === "string" && OWN.test(page.photo)) list.push({ layerId: "photo", ref: page.photo });
  return list;
}

/**
 * { words: [{ text, kind: "caption" | "page" | "note", layerId? }], clips: [clip] }
 * for the photo `layerId` on `page` (a Moment or a day page).
 */
export function photoNotes(page, layerId) {
  if (!page) return { words: [], clips: [] };
  const layers = page.layers || [];
  const only = pagePhotos(page).length <= 1;
  const words = [];
  const photo = layers.find((l) => l.id === layerId && l.kind === "photo");
  if (photo && String(photo.caption || "").trim()) words.push({ kind: "caption", text: String(photo.caption) });
  if (only) {
    for (const key of ["title", "body"]) if (String(page[key] || "").trim()) words.push({ kind: "page", text: String(page[key]) });
  }
  for (const l of layers) if (l.kind === "text" && l.forPhoto === layerId && String(l.text || "").trim()) words.push({ kind: "note", text: String(l.text), layerId: l.id });
  const clipOf = (clipId) => (page.media || []).find((c) => c && c.id === clipId && c.kind === "audio");
  const clips = [];
  const seen = new Set();
  for (const l of layers) {
    if (l.kind !== "audio" || !l.clipId) continue;
    const mine = l.forPhoto === layerId || (only && !l.forPhoto);
    const clip = mine ? clipOf(l.clipId) : null;
    if (clip && !seen.has(clip.id)) {
      seen.add(clip.id);
      clips.push(clip);
    }
  }
  return { words, clips };
}

// Where a thought added for a photo goes: right under that photo, as wide as
// it (a little wider for words), inside the paper. A photo that fills the
// page (background / day photo) gets it near the foot of the page.
export function noteSpot(page, layerId, kind = "text") {
  const photo = (page?.layers || []).find((l) => l.id === layerId && l.kind === "photo");
  const taken = (page?.layers || []).filter((l) => l.forPhoto === layerId).length;
  const shift = taken * (kind === "audio" ? 9 : 7);
  if (!photo) return { x: 50, y: Math.min(94, 84 + shift * 0.5), w: kind === "audio" ? 64 : 80 };
  const scale = Number(photo.scale) || 1;
  const bottom = (Number(photo.y) || 50) + ((Number(photo.h) || 30) * scale) / 2;
  const width = Math.max(kind === "audio" ? 46 : 40, Math.min(84, (Number(photo.w) || 42) * scale + (kind === "audio" ? 0 : 8)));
  const x = Math.max(width / 2 + 2, Math.min(98 - width / 2, Number(photo.x) || 50));
  return { x, y: Math.max(8, Math.min(94, bottom + 4 + shift)), w: width };
}

/** A text layer for words added to a photo (`forPhoto`), placed under it. */
export function noteTextLayer(page, layerId, text, makeId) {
  const spot = noteSpot(page, layerId, "text");
  return { id: makeId(), kind: "text", text: String(text).slice(0, 2000), forPhoto: layerId, ...spot, scale: 1, rotation: 0, fontId: "hei", fontSize: 13, color: "#2F2A26", weight: 400, spacing: 0, align: "center" };
}

/** A sound added to a photo: the clip for page.media and its player on the paper (`forPhoto`). */
export function noteAudio(page, layerId, clip, makeId) {
  const spot = noteSpot(page, layerId, "audio");
  const layer = { id: makeId(), kind: "audio", clipId: clip.id, text: clip.name || "voice", forPhoto: layerId, ...spot, scale: 1, rotation: 0 };
  return { clip, layer };
}
