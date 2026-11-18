// V10.81 · 添加照片 / 配文 / 编辑图片 in the iOS Simulator (via -LittleDaysCheck,
// driven by PhotoUITests.swift, which taps the real photo library picker:
// two photos, then 添加; later 取消). Synthetic data only (the Simulator's own
// sample photos). Runs the page's own buttons and measures the photo editor's
// top bar against the real env(safe-area-inset-top) of the iPhone shell.
// Publishes its progress as an accessibility label "LDSTATE:{json}" and
// returns the steps (printed as "LittleDaysCheck: …").
//
// First launch on a fresh install: signs in locally and returns "seeded".
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(200);
  }
  return null;
};
if (!localStorage.getItem("little-days.account")) {
  localStorage.setItem("little-days.account", JSON.stringify({ version: 1, method: "local", name: "", avatar: "🌷", createdAt: "2026-11-18T00:00:00.000Z", signedIn: true, onboarded: true }));
  localStorage.setItem("little-days.with-samples", "0");
  localStorage.setItem("little-days.onboarding", JSON.stringify({ v: 1, home: "skipped", firstPage: "done", at: "2026-11-18T00:00:00.000Z" }));
  localStorage.setItem("little-days.studio-guide", JSON.stringify({ tour: "skipped", tips: { dblTap: true } }));
  localStorage.setItem("little-days.language", "zh-CN");
  return "seeded";
}
const box = document.createElement("div");
box.setAttribute("role", "img");
box.style.cssText = "position:fixed;left:0;top:0;width:4px;height:4px;opacity:0.02;pointer-events:none;z-index:2147483647";
document.documentElement.append(box);
const steps = [];
let phase = "start";
const publish = () => {
  const host = document.querySelector("dialog[open]") || document.documentElement;
  if (box.parentNode !== host) host.append(box);
  box.setAttribute("aria-label", "LDSTATE:" + JSON.stringify({ phase, n: steps.length, steps }));
};
setInterval(publish, 300);
const setPhase = (p) => {
  phase = p;
  publish();
};
const click = (sel) => {
  const el = typeof sel === "string" ? document.querySelector(sel) : sel;
  el?.click();
  return Boolean(el);
};
// A tap on the paper (the Studio selects on pointer events).
const tap = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: "touch", isPrimary: true };
  el.dispatchEvent(new PointerEvent("pointerdown", o));
  el.dispatchEvent(new PointerEvent("pointerup", o));
  el.dispatchEvent(new MouseEvent("click", o));
  return true;
};
const rect = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
};
const draft = () => {
  const s = JSON.parse(localStorage.getItem("little-days.v1") || "{}");
  const d = Object.values(s.drafts || {})[0];
  return d ? [d, ...(d.moments || [])].flatMap((p) => p.layers || []) : [];
};
// The real safe area of this iPhone (as the page sees it).
const probe = document.createElement("div");
probe.style.cssText = "position:fixed;top:0;left:0;width:1px;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
document.body.append(probe);
const sat = Math.round(parseFloat(getComputedStyle(probe).paddingTop));
const sab = Math.round(parseFloat(getComputedStyle(probe).paddingBottom));

await until(() => document.querySelector(".hero"), 60000);
await wait(1500);
steps.push({ step: "0-start", sat, sab, vw: innerWidth, vh: innerHeight, shell: document.documentElement.dataset.shell, native: Boolean(window.capidayFiles?.photos) });

// 1. Journal Studio, 添加照片: the two ways in.
click('[data-action="today-write"]');
await until(() => document.querySelector('[data-action="jot-studio"]') || document.querySelector("#journal-canvas"));
click('[data-action="jot-studio"]');
await until(() => document.querySelector("#journal-canvas"));
await wait(800);
click('.tool-dock [data-action="add-photos"]');
await until(() => document.querySelector("#choose-dialog[open] .choose-ways"));
steps.push({ step: "1-sheet", ways: [...document.querySelectorAll(".choose-ways b")].map((b) => b.textContent) });

// 2. 从相册选择: the real photo library (the UI test picks two and taps 添加).
click('#choose-dialog [data-action="choose-album"]');
setPhase("library");
const editor = await until(() => document.querySelector("#photo-editor[open] .pe-frame"), 120000);
await wait(1200);
const bar = { skip: rect('#photo-editor [data-pe-action="cancel"]'), title: rect("#photo-editor .pe-top b"), done: rect('#photo-editor [data-pe-action="done"]'), dialog: rect("#photo-editor"), strip: document.querySelectorAll("#photo-editor .pe-strip button").length };
steps.push({ step: "2-editor", opened: Boolean(editor), sat, bar, belowStatusBar: Boolean(bar.skip && bar.skip.top >= sat && bar.done.top >= sat && bar.title.top >= sat), centred: bar.title ? Math.abs((bar.title.left + bar.title.right) / 2 - innerWidth / 2) <= 2 : false });
setPhase("editor"); // the UI test takes a screenshot here
await wait(2500);
click('#photo-editor [data-pe-action="done"]');
await until(() => !document.querySelector("#photo-editor[open]"), 30000);
await until(() => document.querySelectorAll("#journal-canvas .photo-layer img").length >= 2, 20000);
await wait(1500);
click('[data-action="layout-hint-close"]');
const photos = draft().filter((l) => l.kind === "photo" && l.mediaRef && !l.gen);
steps.push({ step: "3-imported", photos: photos.length, names: photos.map((l) => l.text), media: photos.map((l) => l.mediaRef.slice(0, 6)) });

// 3. 配文 on the first photo.
tap(document.querySelector("#journal-canvas .photo-layer"));
await until(() => document.querySelector('.tool-dock.ctx [data-action="photo-caption"]'));
const firstTool = document.querySelector('.tool-dock.ctx[data-ctx="photo"] .sv-tool:not(.ctx-back) small')?.textContent || "";
click('.tool-dock.ctx [data-action="photo-caption"]');
const field = await until(() => document.querySelector("#choose-dialog [data-cap-text]"));
if (field) {
  field.value = "模拟器里的配文";
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
await wait(600);
setPhase("caption"); // screenshot
await wait(2000);
click('#choose-dialog [data-action="cap-done"]');
await wait(1500);
const captioned = draft().filter((l) => l.kind === "photo" && (l.caption || "").trim());
steps.push({ step: "4-caption", firstTool, captioned: captioned.length, caption: captioned[0]?.caption || "", onPaper: [...document.querySelectorAll("#journal-canvas .bound-text")].map((e) => e.textContent.trim()) });

// 4. 从相册选择 then 取消 (the UI test taps 取消): nothing changes.
const before = JSON.stringify(draft());
click('[data-action="layer-deselect"]');
await wait(500);
click('.tool-dock [data-action="add-photos"]');
await until(() => document.querySelector("#choose-dialog[open] .choose-ways"));
// What the app's photo library answers (the page's own handler still runs).
let answer = null;
const handler = window.capidayPhotosPicked;
window.capidayPhotosPicked = (r) => {
  answer = r;
  handler?.(r);
};
click('#choose-dialog [data-action="choose-album"]');
setPhase("library-cancel");
await until(() => answer, 90000);
await wait(2000);
steps.push({ step: "5-cancel", answer: answer && { ok: answer.ok, files: answer.files?.length }, unchanged: JSON.stringify(draft()) === before, editorOpen: Boolean(document.querySelector("#photo-editor[open]")) });

// 5. Save; the reader shows the words.
click('[data-action="save-entry"]');
await until(() => document.querySelector("#phone.in-reader"), 30000);
await wait(2500);
steps.push({ step: "6-saved", reader: Boolean(document.querySelector("#phone.in-reader")), readerHasCaption: (document.querySelector(".reader-stage")?.innerText || "").includes("模拟器里的配文") });
setPhase("done");
return JSON.stringify(steps);
