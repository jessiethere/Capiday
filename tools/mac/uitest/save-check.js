// V10.82 · 把这一页存成图片 → Photos, in the iOS Simulator (Debug build, via
// -LittleDaysCheck). Driven by SaveUITests.swift (it answers the real iOS
// permission prompt and looks for a share sheet); afterwards the Simulator's
// own photo library is checked for the saved files. Synthetic
// data only (a page made of the app's library photos, a sticker and words).
// MODE is put in when the file is copied: seed | page | deny | allow.
const MODE = "__MODE__";
// Progress and results are published as an accessibility label
// "LDSTATE:{json}" (read by SaveUITests.swift, which also answers the iOS
// permission prompt and looks for a share sheet) and to console.warn.
let phase = "start";
const steps = [];
const box = document.createElement("div");
box.setAttribute("role", "img");
box.style.cssText = "position:fixed;left:0;top:0;width:4px;height:4px;opacity:0.02;pointer-events:none;z-index:2147483647";
const publish = () => {
  if (!document.documentElement) return;
  const host = document.querySelector("dialog[open]") || document.documentElement;
  if (box.parentNode !== host) host.append(box);
  box.setAttribute("aria-label", "LDSTATE:" + JSON.stringify({ mode: MODE, phase, steps }));
};
setInterval(publish, 300);
const setPhase = (p) => {
  phase = p;
  publish();
};
const done = (value) => {
  console.warn(`LDRESULT ${MODE} ${value}`);
  setPhase("done");
  return value;
};
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
const click = (sel) => {
  const el = document.querySelector(sel);
  el?.click();
  return Boolean(el);
};
if (MODE === "seed") {
  localStorage.setItem("little-days.account", JSON.stringify({ version: 1, method: "local", name: "", avatar: "🌷", createdAt: "2026-11-18T00:00:00.000Z", signedIn: true, onboarded: true }));
  localStorage.setItem("little-days.with-samples", "0");
  localStorage.setItem("little-days.onboarding", JSON.stringify({ v: 1, home: "skipped", firstPage: "done", at: "2026-11-18T00:00:00.000Z" }));
  localStorage.setItem("little-days.studio-guide", JSON.stringify({ tour: "skipped", tips: { dblTap: true } }));
  localStorage.setItem("little-days.language", "zh-CN");
  return done("seeded");
}
await until(() => document.querySelector(".hero"), 60000);
await wait(1500);
if (MODE === "page") {
  // The journal is written once (a plan added and removed), then the test page is added to it.
  if (!localStorage.getItem("little-days.v1")) {
    const input = document.querySelector("[data-plan-input]");
    input.value = "·";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    click('[data-action="plan-add"]');
    await wait(500);
    click('[data-action="plan-remove"]');
    await until(() => localStorage.getItem("little-days.v1"));
  }
  const s = JSON.parse(localStorage.getItem("little-days.v1"));
  const L = (o) => ({ x: 50, y: 50, scale: 1, rotation: 0, text: "", ...o });
  if (!s.books.some((b) => b.id === "exp")) s.books.push({ id: "exp", title: "导出测试", category: "Daily Life", color: "blush", coverTemplate: "minimal-linen", coverFont: "hei", coverDecoration: "none", coverImage: "", fields: [], visibility: "private" });
  s.entries = s.entries.filter((e) => e.id !== "e-exp");
  s.entries.push({
    id: "e-exp", date: "2026-11-17", bookId: "exp", title: "", body: "", photo: "", mood: "", template: "cute", font: "serif", layers: [], media: [], isDemo: false,
    moments: [{
      id: "m-a", time: "09:30", title: "两只猫的下午", body: "", bookId: "exp", tags: [], media: [], layoutTemplate: "scrapbook", backdrop: "photo:beach-sunset", template: "minimal",
      layers: [
        L({ id: "p1", kind: "photo", mediaRef: "photo:coffee-cheers", x: 30, y: 38, w: 40, h: 30, rotation: -4, caption: "第一张" }),
        L({ id: "p2", kind: "photo", mediaRef: "photo:brunch", x: 70, y: 40, w: 40, h: 30, rotation: 3 }),
        L({ id: "c1", kind: "text", bind: "caption", captionOf: "p1", x: 30, y: 57, w: 40, fontSize: 11 }),
        L({ id: "s1", kind: "sticker", assetId: "bear", x: 82, y: 80 }),
        L({ id: "t1", kind: "text", text: "长长的文字 Long words · 第二行也要在", font: "handwritten", x: 50, y: 86 }),
      ],
    }],
  });
  localStorage.setItem("little-days.v1", JSON.stringify(s));
  return done("page");
}
const before = localStorage.getItem("little-days.v1");
// Open the test page in the book reader.
click('#navigation [data-page="books"]');
await wait(800);
if (!document.querySelector('.pulled-book [data-action="book"][data-book="exp"]')) click('[data-action="pull-book"][data-book="exp"]');
await wait(600);
click('.pulled-book [data-action="book"][data-book="exp"]');
await until(() => document.querySelector('[data-action="reader-open"][data-book="exp"]'));
click('[data-action="reader-open"][data-book="exp"]');
await until(() => document.querySelector(".reader-page"));
for (let i = 0; i < 4 && !document.querySelector('[data-action="read-edit"]'); i++) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await wait(600);
}
await wait(1500);
// What iOS answers (the page's own handler still runs).
const answers = [];
const handler = window.capidayPhotoSaved;
window.capidayPhotoSaved = (r) => {
  answers.push(r);
  handler?.(r);
};
const toasts = [];
new MutationObserver(() => {
  const text = document.querySelector("#toast")?.textContent?.trim();
  if (text && toasts.at(-1) !== text) toasts.push(text);
}).observe(document.querySelector("#toast"), { childList: true, subtree: true, characterData: true });
const more = async () => {
  click('[data-action="reader-more"]');
  await until(() => document.querySelector("#choose-dialog[open] .reader-export"));
};
// One 存成图片: waits for iOS's answer (the UI test answers the permission prompt).
const savePng = async (name) => {
  toasts.length = 0;
  const n = answers.length;
  await more();
  click('#choose-dialog [data-action="page-export"][data-kind="png"]');
  setPhase(name);
  const answer = await until(() => answers[n], 90000);
  await wait(1500);
  const dialog = document.querySelector("#confirm-dialog[open]");
  steps.push({ step: name, answer, toasts: [...toasts], savedToast: toasts.some((x) => /已保存到照片/.test(x)), denyDialog: dialog ? document.querySelector("#confirm-message").textContent : "", okLabel: dialog ? document.querySelector("#confirm-ok").textContent : "" });
  setPhase(name + "-answered"); // the UI test looks for a share sheet here
  await wait(4000);
  if (dialog) click("#confirm-cancel");
  await wait(800);
};
if (MODE === "deny") {
  await savePng("save-denied"); // the UI test taps 不允许
  // 分享这一页: the share sheet (the UI test sees it and closes it).
  await more();
  click('#choose-dialog [data-action="page-export"][data-kind="share"]');
  setPhase("share");
  await wait(15000);
  steps.push({ step: "share", photosAsked: answers.length });
}
if (MODE === "allow") {
  await savePng("save-allowed"); // the UI test taps 允许
  await savePng("save-again"); // already allowed: no question
}
steps.push({ step: "end", unchanged: localStorage.getItem("little-days.v1") === before, stillOnPage: Boolean(document.querySelector(".reader-page") && document.querySelector('[data-action="read-edit"]')) });
return done(JSON.stringify(steps));
