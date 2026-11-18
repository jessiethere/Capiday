// V10.81 · 配文: a photo's own words (the V10.19 design) set from one place.
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { setPhotoCaption, captionOf, captionLayersOf, isCaptionPhoto } from "../Public/js/photo-caption.mjs";
import { boundText } from "../Public/js/scrapbook-layout.mjs";

const page = () => ({
  id: "m1",
  title: "页面标题",
  body: "页面正文",
  layers: [
    { id: "p1", kind: "photo", mediaRef: "media:a", x: 30, y: 30, w: 40, h: 30 },
    { id: "p2", kind: "photo", mediaRef: "media:b", x: 70, y: 30, w: 40, h: 30, caption: "旧的配文" },
    { id: "t2", kind: "text", bind: "caption", captionOf: "p2", text: "旧的配文", gen: true },
    { id: "deco", kind: "photo", mediaRef: "photo:x", deco: true },
  ],
});
const make = (photo) => ({ id: `cap-${photo.id}`, kind: "text", bind: "caption", captionOf: photo.id, text: photo.caption, gen: true });

test("only real photos take words (not decorations, drawings or laid-out copies)", () => {
  const p = page();
  assert.equal(isCaptionPhoto(p.layers[0]), true);
  assert.equal(isCaptionPhoto(p.layers[3]), false);
  assert.equal(isCaptionPhoto({ kind: "photo", mediaRef: "m", drawing: true }), false);
  assert.equal(isCaptionPhoto({ kind: "text" }), false);
  assert.deepEqual(setPhotoCaption(p, "deco", "x", { makeLayer: make }), { ok: false, reason: "no-photo" });
  assert.deepEqual(setPhotoCaption(p, "nope", "x", { makeLayer: make }), { ok: false, reason: "no-photo" });
});

test("new words: on the photo, one line added under it; the page's words untouched", () => {
  const p = page();
  const r = setPhotoCaption(p, "p1", "第一杯拿铁", { makeLayer: make });
  assert.equal(r.added, "cap-p1");
  assert.equal(p.layers.find((l) => l.id === "p1").caption, "第一杯拿铁");
  assert.equal(captionLayersOf(p, "p1").length, 1);
  assert.equal(boundText(captionLayersOf(p, "p1")[0], p), "第一杯拿铁");
  assert.equal(p.title, "页面标题");
  assert.equal(p.body, "页面正文");
  assert.equal(captionOf(p, "p2"), "旧的配文");
});

test("editing reuses the line (no second one); other photos keep theirs", () => {
  const p = page();
  setPhotoCaption(p, "p1", "一", { makeLayer: make });
  setPhotoCaption(p, "p1", "一二", { makeLayer: make });
  setPhotoCaption(p, "p1", "一二三", { makeLayer: make });
  assert.equal(captionLayersOf(p, "p1").length, 1);
  assert.equal(captionOf(p, "p1"), "一二三");
  assert.equal(captionOf(p, "p2"), "旧的配文");
  // An older page's line (V10.19) is reused too, with its id.
  setPhotoCaption(p, "p2", "改过的配文", { makeLayer: make });
  assert.deepEqual(captionLayersOf(p, "p2").map((l) => l.id), ["t2"]);
  assert.equal(boundText(captionLayersOf(p, "p2")[0], p), "改过的配文");
});

test("empty words remove that photo's words and only its line", () => {
  const p = page();
  setPhotoCaption(p, "p1", "要删的", { makeLayer: make });
  const r = setPhotoCaption(p, "p2", "   ", { makeLayer: make });
  assert.equal(r.removed, 1);
  assert.equal("caption" in p.layers.find((l) => l.id === "p2"), false);
  assert.equal(captionLayersOf(p, "p2").length, 0);
  assert.equal(captionOf(p, "p1"), "要删的");
  assert.equal(captionLayersOf(p, "p1").length, 1);
  assert.deepEqual(p.layers.filter((l) => l.kind === "photo").map((l) => [l.id, l.mediaRef]), [["p1", "media:a"], ["p2", "media:b"], ["deco", "photo:x"]]);
});

test("long words are kept whole (never cut)", () => {
  const p = page();
  const long = "很长的一句".repeat(300);
  setPhotoCaption(p, "p1", long, { makeLayer: make });
  assert.equal(captionOf(p, "p1"), long);
});
