// V10.95 · CAP-012 (reopened on a device 2026-11-19): typing in 写字 · 改字体
// when nothing measures the keyboard. The Founder's iPhone screenshots showed
// the "no keyboard" layout while the keyboard was up: the big preview stayed,
// the field sat under the keyboard, and scrolling up took the title and Done
// off screen. Here the keyboard is never reported (no visual-viewport change,
// no shell message) — the case the earlier tests (v166) did not cover.
// iPhone 17 size (402 × 874) with its safe area given to the CSS. The keyboard
// line on the device is 477 (397 pt keyboard incl. the candidate row and
// iOS's ⌃ ⌄ ✓ bar, measured in the Simulator). Chromium — not an iPhone.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SAT = 62, H = 874, W = 402, KB_LINE = 477;

// The iPhone app: the shell's message handlers exist (no keyboard message is sent).
function inShell() {
  window.webkit = { messageHandlers: { littleDaysHaptics: { postMessage() {} } } };
}
function safeArea() {
  const safe = () => {
    document.documentElement.style.setProperty("--sat", "62px");
    document.documentElement.style.setProperty("--sab", "34px");
  };
  if (document.documentElement) safe();
  else document.addEventListener("DOMContentLoaded", safe);
}

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
const state = (app) =>
  app.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) };
    };
    const root = document.documentElement;
    return {
      open: root.classList.contains("kb-open"),
      est: root.classList.contains("kb-est"),
      vvh: root.style.getPropertyValue("--vv-h"),
      kb: root.style.getPropertyValue("--kb"),
      sheet: r("#choose-dialog[open]"),
      head: r("#choose-dialog[open] .sw-head"),
      done: r('#choose-dialog[open] [data-action="story-text-done"]'),
      preview: r("#choose-dialog[open] .sw-preview"),
      field: r("#choose-dialog[open] [data-sw-text]"),
      focused: document.activeElement?.matches?.("[data-sw-text]") || false,
      debug: document.getElementById("kb-debug")?.textContent || "",
    };
  });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const open = async ({ shell = false, embedded = false, debug = false } = {}) => {
    const context = await browser.newContext({ viewport: { width: W, height: H }, screen: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: "en-US", userAgent: IPHONE });
    await context.addInitScript(safeArea);
    if (shell) await context.addInitScript(inShell);
    await context.addInitScript((d) => {
      localStorage.setItem("little-days.language", "en");
      if (d) localStorage.setItem("little-days.kb-debug", "1");
    }, debug);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    let app = page;
    if (embedded) {
      // Like the pinned link inside the Claude app: the app in a frame.
      await page.route(`${base}/__wrap198`, (route) => route.fulfill({ contentType: "text/html", body: `<body style="margin:0"><iframe src="${base}" style="border:0;width:${W}px;height:${H}px;display:block"></iframe></body>` }));
      await page.goto(`${base}/__wrap198`);
      await page.waitForTimeout(500);
      app = page.frames().find((f) => f !== page.mainFrame());
    } else await page.goto(base);
    await app.waitForSelector(".hero");
    // The Founder's steps: one photo → Words & type → the field for photo 1.
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), app.locator('[data-action="today-photos"]').first().click()]);
    await chooser.setFiles([photo("brunch")]);
    await app.waitForSelector('[data-action="story-save"]');
    await app.waitForTimeout(500);
    await app.locator('.qe-tools [data-action="story-text"]').click();
    await app.waitForSelector("#choose-dialog[open] [data-sw-text]");
    await app.evaluate(() => document.activeElement?.blur?.());
    await app.waitForTimeout(300);
    return { context, page, app };
  };
  const type = async (app) => {
    await app.locator("#choose-dialog[open] [data-sw-text]").tap();
    await app.waitForTimeout(150);
    await app.locator("#choose-dialog[open] [data-sw-text]").pressSequentially("cheesecake");
    await app.waitForTimeout(500);
  };
  try {
    // ---------- 1 · the iPhone app, the keyboard is never reported ----------
    {
      const { context, app } = await open({ shell: true });
      const before = await state(app);
      check("before typing: the full sheet (big preview), no keyboard layout", !before.open && before.preview.height > 160, JSON.stringify(before.preview));
      await type(app);
      let s = await state(app);
      check("iPhone app, keyboard not reported: the field with the caret counts as keyboard up (estimated)", s.focused && s.open && s.est && parseInt(s.vvh) > 0, JSON.stringify({ open: s.open, est: s.est, vvh: s.vvh, kb: s.kb }));
      check("the estimated keyboard line is not lower than the real one (477)", parseInt(s.vvh) <= KB_LINE, s.vvh);
      check("the field is above the real keyboard line — you can see what you type", s.field.bottom <= KB_LINE && s.field.top >= SAT, `field ${s.field.top}–${s.field.bottom}, keyboard ${KB_LINE}`);
      check("the big preview steps aside (short live window)", s.preview == null || s.preview.height <= 160, JSON.stringify(s.preview));
      check("title and Done stay on screen, below the status bar", s.head.top >= SAT && s.done.top >= SAT && s.done.bottom <= KB_LINE, `head ${s.head.top}, done ${s.done.top}–${s.done.bottom}`);
      // Scrolling the sheet's contents never takes the title and Done away.
      await app.evaluate(() => {
        const b = document.querySelector("#choose-dialog .sw-body");
        b.scrollTop = b.scrollHeight;
        document.querySelector("#choose-dialog").scrollTop = 9999;
      });
      await app.waitForTimeout(200);
      s = await state(app);
      check("after scrolling the sheet: title and Done still at the top", s.head.top >= SAT && s.done.top >= SAT && s.done.top < s.field.top + 400, `head ${s.head.top}, done ${s.done.top}`);
      check("no diagnostics line unless it is turned on", s.debug === "");
      // The shell's measurement arrives: it replaces the estimate.
      await app.evaluate((top) => window.capidayKeyboard(top), KB_LINE);
      await app.waitForTimeout(300);
      s = await state(app);
      check("the shell's real keyboard line replaces the estimate", s.open && !s.est && s.vvh === `${KB_LINE}px`, JSON.stringify({ open: s.open, est: s.est, vvh: s.vvh }));
      check("with the real line the field is still above the keyboard", s.field.bottom <= KB_LINE, `field ${s.field.bottom}`);
      // Done: the keyboard layout goes away at once.
      await app.evaluate(() => window.capidayKeyboard(0));
      await app.locator('#choose-dialog [data-action="story-text-done"]').click();
      await app.waitForTimeout(400);
      s = await state(app);
      check("Done: no keyboard layout is left behind", !s.open && !s.est && !s.vvh && !s.kb, JSON.stringify({ open: s.open, est: s.est, vvh: s.vvh, kb: s.kb }));
      // Once the keyboard has been measured, only measurements count (CAP-011).
      await app.locator('.qe-tools [data-action="story-text"]').click();
      await app.waitForSelector("#choose-dialog[open] [data-sw-text]");
      await app.locator("#choose-dialog[open] [data-sw-text]").tap();
      await app.waitForTimeout(500);
      s = await state(app);
      check("after a real measurement this session, no more guessing (a closed keyboard leaves no gap)", !s.est && !s.open, JSON.stringify({ open: s.open, est: s.est }));
      check("iPhone app · no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ---------- 2 · the pinned link inside another page (Claude app) ----------
    {
      const { context, app } = await open({ embedded: true });
      await type(app);
      const s = await state(app);
      check("pinned link in a frame: keyboard up (estimated), field above the keyboard line", s.open && s.est && s.field.bottom <= KB_LINE, `field ${s.field.top}–${s.field.bottom}`);
      check("pinned link: title and Done on screen", s.head.top >= SAT && s.done.bottom <= KB_LINE, `head ${s.head.top}, done ${s.done.bottom}`);
      await context.close();
    }
    // ---------- 3 · Safari / a desktop browser: measurement only, unchanged ----------
    {
      const { context, app } = await open();
      await type(app);
      const s = await state(app);
      check("a page opened directly (Safari): no guessing — the browser measures the keyboard itself", !s.est && !s.open, JSON.stringify({ open: s.open, est: s.est }));
      await context.close();
    }
    // ---------- 4 · 键盘诊断 (developer switch) ----------
    {
      const { context, app } = await open({ shell: true, debug: true });
      await type(app);
      const s = await state(app);
      check("键盘诊断 on: one line with what the layout used", /kb-open 1 · estimate · shell 0 · vv \d+@\d+ · inner \d+ · est \d+ · app/.test(s.debug), s.debug);
      const ui = await app.evaluate(() => {
        const box = document.getElementById("kb-debug");
        const cs = getComputedStyle(box);
        return { events: cs.pointerEvents, hidden: box.getAttribute("aria-hidden"), top: Math.round(box.getBoundingClientRect().top) };
      });
      check("the line cannot be tapped, is hidden from VoiceOver and sits below the status bar", ui.events === "none" && ui.hidden === "true" && ui.top >= SAT, JSON.stringify(ui));
      // The switch in Settings › Test log turns it off.
      await app.evaluate(() => document.activeElement?.blur?.());
      await SS.tapHidden(app, { action: "kb-debug-toggle" });
      await app.waitForTimeout(300);
      check("the switch turns it off", (await app.evaluate(() => [localStorage.getItem("little-days.kb-debug"), Boolean(document.getElementById("kb-debug"))])).join() === ",false");
      await context.close();
    }
  } finally {
    await browser.close();
  }
  check("no page errors", errors.length === 0, errors.join(" | "));
  console.log(`\nv198: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
