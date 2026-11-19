// V10.68 · Every place you can type: is the field above the iPhone keyboard?
// Chromium cannot show the iPhone keyboard, so window.visualViewport is
// replaced by one that shrinks the way it does in the iPhone app (WKWebView:
// the keyboard covers the page, the layout does not shrink; the visible area
// does). The app's own keyboard code (updateVisibleArea / keepFieldInView)
// then reacts exactly as on the phone. Keyboard heights include the Chinese
// candidate bar. Worst case: iOS's own panning is not counted.
// Synthetic data only. AUDIT=1 prints the table without failing.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;

function fakeKeyboard() {
  let kb = 0;
  const vv = new EventTarget();
  Object.defineProperties(vv, {
    width: { get: () => innerWidth },
    height: { get: () => innerHeight - kb },
    offsetTop: { get: () => 0 },
    offsetLeft: { get: () => 0 },
    pageTop: { get: () => 0 },
    pageLeft: { get: () => 0 },
    scale: { get: () => 1 },
  });
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
  window.__kb = (px) => {
    kb = px;
    vv.dispatchEvent(new Event("resize"));
  };
}

// Each place: how to get there, and the field to type in.
// Captain switched on (as after 认识 Captain), for the places that need it.
async function withCaptain(p) {
  await SS.touchStore(p); // a new journal is stored on its first change
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    s.keeper = { ...(s.keeper || {}), enabled: true, animal: "cat", name: "", mode: "interactive", invite: "shown", since: "2026-11-01" };
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  });
  await p.reload();
  await p.waitForSelector(".hero");
}
// A Studio page with photos (free layout): its 详情 has the page name, words and tags.
async function photoPage(p) {
  await p.locator('[data-action="today-write"]').first().click();
  await p.waitForSelector("#journal-canvas");
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.locator("#photos-input").setInputFiles([photo("latte-art"), photo("corner-cafe")]);
  await p.waitForTimeout(1200);
  if (await p.locator("#photo-editor[open]").count()) await SS.skipPhotoEditor(p);
  await p.waitForFunction(() => document.querySelectorAll("#journal-canvas .photo-layer img").length >= 2);
  if (await p.locator('[data-action="layout-hint-close"]').count()) await p.locator('[data-action="layout-hint-close"]').click();
  await SS.studioDetails(p);
}
const PLACES = [
  // V10.84: 今天的计划 is no longer on Home.
  { name: "首页 · 我的称呼", open: async (p) => p.locator('[data-action="greeting-name"]').first().click(), field: "[data-greeting-name]" },
  { name: "搜索", open: async (p) => p.locator('[data-action="open-search"]').first().click(), field: "[data-search-input]" },
  { name: "Captain · 聊天", open: async (p) => { await withCaptain(p); await p.locator('[data-action="keeper-tap"]').first().click(); }, field: "[data-keeper-say]" },
  // V10.93: Captain's first meeting has no name field (renamed in Settings: "设置 · Captain 名字" below).
  { name: "新建手帐本 · 名字", open: async (p) => { await SS.goTab(p, "books"); await p.locator('[data-action="new-book"]').first().click(); }, field: '#form-dialog[open] input[name="title"]' },
  { name: "新建手帐本 · 介绍", open: async (p) => { await SS.goTab(p, "books"); await p.locator('[data-action="new-book"]').first().click(); await p.evaluate(() => document.querySelectorAll("#form-dialog details").forEach((d) => (d.open = true))); }, field: '#form-dialog[open] textarea[name="description"]' },
  { name: "Studio · 页面标题（纸上）", open: async (p) => { await p.locator('[data-action="today-write"]').first().click(); await p.waitForSelector("#journal-canvas"); }, field: '#journal-canvas [data-inline="title"]', leave: SS.leaveStudio },
  { name: "Studio · 文字框（纸上）", open: async (p) => { await p.locator('[data-action="today-write"]').first().click(); await p.waitForSelector("#journal-canvas"); await p.evaluate(() => document.activeElement?.blur?.()); await p.locator('.tool-dock [data-action="add-text-layer"]').first().click(); await p.waitForTimeout(400); }, field: "#journal-canvas .text-layer .layer-text", focused: true, leave: SS.leaveStudio },
  { name: "Studio · 详情里的页名", open: photoPage, field: ".write-title" },
  { name: "Studio · 详情里的正文", open: photoPage, field: ".write-body" },
  { name: "Studio · 详情里的标签", open: photoPage, field: ".write-tags" },
  { name: "今天的故事 · 写字", open: async (p) => { const [c] = await Promise.all([p.waitForEvent("filechooser"), p.locator('[data-action="today-photos"]').first().click()]); await c.setFiles([photo("frost"), photo("bouquet")]); await p.waitForSelector('[data-action="story-save"]'); await p.locator('.qe-tools [data-action="story-text"]').click(); }, field: "#choose-dialog [data-sw-text]" },
  { name: "设置 · 我的资料名字", open: async (p) => { await p.locator(".settings-gear").first().click(); await p.locator('[data-action="settings-sheet"][data-sheet="profile"], [data-action="open-profile"]').first().click(); }, field: "[data-profile-name]" },
  { name: "设置 · Captain 名字", open: async (p) => { await withCaptain(p); await p.locator(".settings-gear").first().click(); await p.locator('[data-sheet="keeper"]').first().click(); }, field: "[data-keeper-rename]" },
  { name: "成长 · 新习惯（Labs）", open: async (p) => { await SS.goTab(p, "growth"); await p.locator('[data-action="new-habit"]').first().click(); }, field: '#form-dialog[open] input[name="title"]' },
  { name: "成长 · 打卡感想（Labs）", open: async (p) => { await SS.goTab(p, "growth"); await p.locator('[data-action="check-note"]').first().click(); }, field: '#form-dialog[open] textarea[name="note"]' },
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const rows = [];
  try {
    for (const [label, size, kb] of [["390×844", { width: 390, height: 844 }, 350], ["375×667", { width: 375, height: 667 }, 300]]) {
      for (const place of PLACES) {
        const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: "zh-CN", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" });
        await context.addInitScript(fakeKeyboard);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const row = { size: label, place: place.name };
        try {
          await page.goto(base);
          await page.waitForSelector(".hero");
          await place.open(page);
          const field = page.locator(place.field).first();
          await field.waitFor({ state: "visible", timeout: 6000 });
          if (!place.focused) await field.click();
          await page.waitForTimeout(600); // the app's own focus timers
          await page.evaluate((kb) => window.__kb(kb), kb);
          await page.waitForTimeout(700); // sheets slide (0.18 s), panels scroll
          const m = await page.evaluate(([sel, kb]) => {
            const el = document.activeElement?.matches?.(sel) ? document.activeElement : document.querySelector(sel);
            const r = el.getBoundingClientRect();
            // The text bar that sits on the keyboard while typing on paper covers too.
            const bar = document.querySelector("#type-bar:not([hidden])")?.getBoundingClientRect();
            const kbTop = Math.min(innerHeight - kb, bar && bar.top > 0 && bar.top < innerHeight - kb + 4 ? bar.top : Infinity);
            const line = Math.min(r.bottom, r.top + 44); // the line being typed
            return { focused: el === document.activeElement, top: Math.round(r.top), bottom: Math.round(r.bottom), line: Math.round(line), kbTop, ok: r.top >= 0 && line <= kbTop - 2, whole: r.bottom <= kbTop - 2 };
          }, [place.field, kb]);
          Object.assign(row, m, { errors: errors.length });
        } catch (error) {
          row.ok = null;
          row.note = "not reached: " + String(error.message || error).split("\n")[0].slice(0, 80);
        }
        rows.push(row);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const r of rows) console.log(`${r.ok === true ? "✓" : r.ok === false ? "✗" : "·"} ${r.size} ${r.place}${r.ok == null ? "  — " + r.note : `  field ${r.top}–${r.bottom}, typing line ${r.line}, keyboard top ${r.kbTop}${r.whole ? "" : " (lower part under the keyboard)"}${r.focused ? "" : " [not focused]"}`}`);
  const bad = rows.filter((r) => r.ok === false);
  const missed = rows.filter((r) => r.ok == null);
  console.log(`\n${rows.length - bad.length - missed.length} above the keyboard · ${bad.length} covered · ${missed.length} not reached`);
  if (!process.env.AUDIT) {
    assert.deepEqual(bad.map((r) => `${r.size} ${r.place}`), [], "every field is above the keyboard");
    assert.deepEqual(missed.map((r) => `${r.size} ${r.place}: ${r.note}`), [], "every place was reached");
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
