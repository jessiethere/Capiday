// V10.73 (CAP-017) · Cover titles that always fit.
// Each cover template has its own title box (a receipt line, a pet tag, a
// postcard back …). A long title — 「如果我的名字非常长」, a 20-character
// Chinese title, a long English title — was cut off by the box, hidden by a
// line clamp or ellipsis, or left one character alone on the last line.
// Here, after a cover is drawn (anywhere: the cover picker, the preview, the
// book page, the shelf, Home), its title is checked; when it does not fit,
// its type is made smaller step by step, down to MIN_SCALE of the template's
// size. Only a title that still does not fit at that size (a very long one)
// is shortened with "…" — the full title is always written under the cover.
// Line breaks are balanced in CSS (text-wrap: balance), so no single
// character is left alone on a line. Nothing is stored: it is drawing only.
export const MIN_SCALE = 0.55;
const TITLE = ".book-cover .cover-title, .book-cover .cv-title";

// The box the title can be seen in: the cover and every box around the
// title that hides what overflows it.
function clipBox(title, cover) {
  const r = cover.getBoundingClientRect();
  let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
  for (let el = title; el && el !== cover; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.overflowX !== "visible" || s.overflowY !== "visible") {
      const q = el.getBoundingClientRect();
      box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) };
    }
  }
  return box;
}
// What a title must not run into: the cover's other words (date, issue,
// "CAPIDAY", the receipt's ORDER line …) and its decorations (sticker, film
// holes, stamp, bar code). Photos are not on this list: magazine covers set
// their titles on the photo on purpose.
const OBSTACLE = ".cover-decoration, .cv-deco, .film-holes, .cv-stamp, .cv-bars, .cv-postmark, .mag-barcode";
const PHOTO = "img.cv-photo, img.mag-photo, img.cover-photo, img.spine-photo";
function drawnRect(el) {
  const r = el.getBoundingClientRect();
  // A sticker drawn with object-fit: contain covers only part of its box.
  if (el.tagName === "IMG" && el.naturalWidth && getComputedStyle(el).objectFit === "contain") {
    const k = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
    const w = el.naturalWidth * k;
    const h = el.naturalHeight * k;
    const l = r.left + (r.width - w) / 2;
    const t = r.top + (r.height - h) / 2;
    return { left: l, top: t, right: l + w, bottom: t + h };
  }
  return r;
}
function obstacles(title, cover) {
  const list = [];
  for (const el of cover.querySelectorAll("*")) {
    if (el === title || title.contains(el) || el.contains(title) || el.matches(PHOTO)) continue;
    const words = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
    if (!words && !el.matches(OBSTACLE)) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
    const r = el.matches(OBSTACLE) ? drawnRect(el) : textRect(el);
    if (r && r.right - r.left > 0 && r.bottom - r.top > 0) list.push(r);
  }
  return list;
}
// The box of an element's own words (not its padding or background).
function textRect(el) {
  const range = document.createRange();
  let box = null;
  for (const n of el.childNodes) {
    if (n.nodeType !== 3 || !n.data.trim()) continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  return box;
}
function overlap(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}
// true: every character can be seen; false: some are cut; null: not drawn yet.
export function titleFits(title, cover = title.closest(".book-cover")) {
  if (!cover || !cover.isConnected) return null;
  const size = cover.getBoundingClientRect();
  if (!size.width || !size.height) return null;
  const s = getComputedStyle(title);
  if (s.webkitLineClamp && s.webkitLineClamp !== "none" && title.scrollHeight > title.clientHeight + 1) return false;
  if (s.textOverflow === "ellipsis" && title.scrollWidth > title.clientWidth + 1) return false;
  const box = clipBox(title, cover);
  const blocks = obstacles(title, cover);
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node;
  while ((node = walker.nextNode())) {
    for (let i = 0; i < node.data.length; i++) {
      if (!node.data[i].trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const q = range.getBoundingClientRect();
      if (!q.width && !q.height) continue;
      const x = q.left + q.width / 2;
      const y = q.top + q.height / 2;
      if (x < box.l - 1 || x > box.r + 1 || y < box.t - 1 || y > box.b + 1) return false;
      // Running into another word or a decoration (more than a sliver of the character).
      const area = q.width * q.height;
      if (blocks.some((b) => overlap(q, b) > area * 0.12)) return false;
    }
  }
  return true;
}
const pending = new Set();
// The largest size (to about a quarter pixel, not below MIN_SCALE) at which
// the title fits; null when it does not fit even at the smallest size.
function largestFit(title, base) {
  let lo = base * MIN_SCALE;
  let hi = base;
  title.style.fontSize = `${lo}px`;
  if (!titleFits(title)) return null;
  for (let k = 0; k < 7 && hi - lo > 0.25; k++) {
    const mid = (lo + hi) / 2;
    title.style.fontSize = `${mid}px`;
    if (titleFits(title)) lo = mid;
    else hi = mid;
  }
  title.style.fontSize = `${lo}px`;
  return lo;
}
export function fitCoverTitle(title) {
  title.style.removeProperty("font-size");
  title.style.removeProperty("-webkit-line-clamp");
  title.classList.remove("fit-cut");
  title.style.removeProperty("--fit-lines");
  const fits = titleFits(title);
  if (fits === null) {
    pending.add(title);
    return;
  }
  pending.delete(title);
  if (fits) return;
  const base = parseFloat(getComputedStyle(title).fontSize) || 12;
  if (largestFit(title, base) != null) return;
  // A template that keeps its title to N lines may take one more line when
  // that line has room (it still must not touch anything else).
  const clamp = parseInt(getComputedStyle(title).webkitLineClamp, 10);
  if (clamp > 0) {
    title.style.setProperty("-webkit-line-clamp", String(clamp + 1));
    if (largestFit(title, base) != null) return;
    title.style.removeProperty("-webkit-line-clamp");
  }
  // Still too long at the smallest size: keep that size and end with "…"
  // (line clamp on as many lines as the box shows).
  const lo = base * MIN_SCALE;
  title.style.fontSize = `${lo}px`;
  const vertical = getComputedStyle(title).writingMode.startsWith("vertical");
  if (!vertical) {
    const box = clipBox(title, title.closest(".book-cover"));
    const top = title.getBoundingClientRect().top;
    const lineHeight = parseFloat(getComputedStyle(title).lineHeight) || lo * 1.25;
    const lines = Math.max(1, Math.floor((box.b - Math.max(top, box.t)) / lineHeight));
    title.style.setProperty("--fit-lines", String(lines));
  }
  title.classList.add("fit-cut");
}
// V10.75 (CAP-020) · Book spines on the shelf: one vertical line.
// A spine is narrow (about 40–58 px), so its title is set as real vertical
// text (writing-mode: vertical-rl, one column, no line breaks):
//  · Chinese characters upright; Latin words lie sideways, as on a printed
//    spine (text-orientation: mixed);
//  · Chinese punctuation takes its vertical form (「，。！？：」 → the
//    vertical glyphs), set in a system font that has those forms
//    (the bundled handwriting fonts may not);
//  · "!" "?" next to Chinese stand upright; one or two digits sit side by
//    side across the line (纵中横, text-combine-upright);
//  · when the title is longer than the spine, it is cut after a whole
//    character (never half a character or half a mark) and ends with "…".
// The full title stays in the button's label (and on the cover).
const SPINE = ".spine .spine-title[data-title]";
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const WIDE_MARK = /[\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\u2010-\u2027\u00b7\ufe10-\ufe19\ufe30-\ufe4f]/;
const NARROW_MARK = /^[!?]+$/;
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function graphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) return [...new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  return [...text];
}
export function spineIsLatin(title) {
  return !CJK.test(title || "") && !WIDE_MARK.test(title || "");
}
// The spine's words as HTML: marks in a font with vertical forms, short
// digit runs and "!?" upright in a Chinese title.
export function spineTitleHTML(title, cut = false) {
  const parts = graphemes(String(title || ""));
  const latin = spineIsLatin(title);
  let html = "";
  for (let i = 0; i < parts.length; ) {
    const ch = parts[i];
    if (!latin && /\d/.test(ch)) {
      let j = i;
      while (j < parts.length && /\d/.test(parts[j])) j++;
      const run = parts.slice(i, j).join("");
      html += run.length <= 2 ? `<span class="sp-tcy">${run}</span>` : esc(run);
      i = j;
      continue;
    }
    if (!latin && NARROW_MARK.test(ch)) html += `<span class="sp-mark sp-up">${esc(ch)}</span>`;
    else if (WIDE_MARK.test(ch)) html += `<span class="sp-mark">${esc(ch)}</span>`;
    else html += esc(ch);
    i++;
  }
  if (cut) html += `<span class="sp-mark sp-more">…</span>`;
  return html;
}
// Fits: nothing overflows, and the last glyph (a vertical "…" or mark can
// reach past the line box) ends inside the spine's words area.
function spineFits(el) {
  if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return false;
  const box = el.getBoundingClientRect();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last = null;
  let n;
  while ((n = walker.nextNode())) if (n.data.trim()) last = n;
  if (!last) return true;
  const range = document.createRange();
  range.setStart(last, last.data.length - 1);
  range.setEnd(last, last.data.length);
  const q = range.getBoundingClientRect();
  return q.bottom <= box.bottom + 1 && q.top >= box.top - 1;
}
export function fitSpineTitle(el) {
  const title = el.dataset.title || "";
  el.innerHTML = spineTitleHTML(title);
  el.classList.remove("sp-cut");
  if (!el.isConnected || !el.clientHeight) {
    if (el.isConnected) pending.add(el);
    return;
  }
  pending.delete(el);
  if (spineFits(el)) return;
  // Longest start (in whole characters) that fits with "…" after it.
  const parts = graphemes(title);
  let lo = 0;
  let hi = parts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    el.innerHTML = spineTitleHTML(parts.slice(0, mid).join("").replace(/[\s\u3000、，。,.·:：;；]+$/, ""), true);
    if (spineFits(el)) lo = mid;
    else hi = mid - 1;
  }
  el.innerHTML = spineTitleHTML(parts.slice(0, lo).join("").replace(/[\s\u3000、，。,.·:：;；]+$/, ""), true);
  el.classList.add("sp-cut");
}
export function fitCoverTitles(root = document) {
  const titles = root.matches?.(TITLE) ? [root] : [...root.querySelectorAll(TITLE)];
  titles.forEach(fitCoverTitle);
}
// Watch the page: covers drawn or redrawn, a title typed in the dialog,
// fonts that finish loading, a new screen size.
let queued = new Set();
let frame = 0;
function queue(el) {
  queued.add(el);
  if (!frame) frame = requestAnimationFrame(flush);
}
function flush() {
  frame = 0;
  const list = [...queued, ...pending];
  queued = new Set();
  const seen = new Set();
  for (const el of list) {
    if (!el.isConnected) {
      pending.delete(el);
      continue;
    }
    const titles = el.matches?.(TITLE) ? [el] : [...(el.querySelectorAll?.(TITLE) || [])];
    const inside = el.closest?.(TITLE);
    if (inside) titles.push(inside);
    for (const title of titles) {
      if (seen.has(title)) continue;
      seen.add(title);
      fitCoverTitle(title);
    }
    const spines = el.matches?.(SPINE) ? [el] : [...(el.querySelectorAll?.(SPINE) || [])];
    for (const spine of spines) {
      if (seen.has(spine)) continue;
      seen.add(spine);
      fitSpineTitle(spine);
    }
  }
}
export function watchCoverTitles() {
  if (typeof MutationObserver === "undefined") return;
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        const el = record.target.parentElement;
        if (el?.closest?.(TITLE)) queue(el);
        continue;
      }
      // A hidden part shown again (the cover picker opening) gives the
      // titles that could not be measured another try. (Not the titles'
      // own class changes: fitting itself sets those.)
      if (record.type === "attributes") {
        if (pending.size && !record.target.closest?.(TITLE) && !record.target.closest?.(SPINE)) queue(record.target);
        continue;
      }
      // (A spine's own words are rewritten by fitSpineTitle: not watched.)
      if (record.target.closest?.(SPINE)) continue;
      if (record.target.closest?.(TITLE)) queue(record.target);
      for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches(TITLE) || node.querySelector(TITLE) || node.closest?.(TITLE) || node.matches(SPINE) || node.querySelector(SPINE))) queue(node);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "open", "class"] });
  addEventListener("resize", () => queue(document.documentElement));
  document.fonts?.addEventListener?.("loadingdone", () => queue(document.documentElement));
  document.fonts?.ready?.then(() => queue(document.documentElement));
  queue(document.documentElement);
}
