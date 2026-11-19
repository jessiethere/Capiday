// V10.96 · 今天怎么记？ photo entries.
// 选照片（可多选） opened WebKit's file menu (Photo Library / Take Photo /
// Choose Files) in the iPhone app: the quick record never asked for the
// photo library, it clicked the plain file input. Now 选照片 asks the iOS
// app's photo library (PHPicker, several photos) at once, 拍照 opens the
// camera at once, and the plain file menu is a quiet "From Files or
// elsewhere" line (the app only). Here the app is stood in for by a fake
// shell (window.webkit.messageHandlers.littleDaysPhotos + capidayFiles.photos)
// that answers like LittleDaysPhotoPicker.swift. Chromium — not an iPhone.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const fs = require("node:fs");
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

let passed = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`✗ ${name}${detail ? "  — " + detail : ""}`);
  }
};

// The fake shell: records each request; the test answers it like the app.
function fakeShell() {
  window.__picks = [];
  window.capidayFiles = { ...(window.capidayFiles || {}), photos: true };
  window.webkit = {
    messageHandlers: {
      littleDaysPhotos: { postMessage: (m) => window.__picks.push(m) },
      littleDaysHaptics: { postMessage() {} },
    },
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const jpeg = fs.readFileSync(photo("brunch")).toString("base64");
  const open = async ({ lang = "zh-CN", shell = true } = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: lang, userAgent: IPHONE });
    await context.addInitScript((l) => localStorage.setItem("little-days.language", l), lang === "en" ? "en" : "zh-CN");
    if (shell) await context.addInitScript(fakeShell);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => {
      errors.push("system dialog: " + d.message());
      d.dismiss();
    });
    // Any WebKit/Chromium file chooser that opens is recorded (the old menu).
    const choosers = [];
    page.on("filechooser", (c) => choosers.push(c));
    await page.goto(base);
    await page.waitForSelector(".hero");
    return { context, page, errors, choosers };
  };
  const sheet = async (page) => {
    await page.locator('.home-small [data-action="quick-open"]').first().tap();
    await page.waitForSelector("#choose-dialog[open] .quick-sheet");
    await page.locator('#choose-dialog [data-action="quick-way"][data-way="photo"]').tap();
    await page.waitForSelector('#choose-dialog .quick-start');
  };
  // Answer the app's photo library like LittleDaysPhotoPicker: files as URLs (or none = cancelled).
  const answer = (page, files) =>
    page.evaluate(
      ({ b64, files }) => {
        const req = window.__picks.at(-1);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const urls = Array.from({ length: files }, () => URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" })));
        window.capidayPhotosPicked({ id: req.id, ok: true, files: urls.map((url, i) => ({ url, name: `IMG_${i + 1}.jpg`, type: "image/jpeg" })) });
      },
      { b64: jpeg, files },
    );
  try {
    // ---------------- A · B · C · F · I : 选照片 in the app ----------------
    {
      const { context, page, errors, choosers } = await open();
      await sheet(page);
      const cta = await page.locator("#choose-dialog .quick-start").innerText();
      check("主按钮仍是「选照片（可多选）」", cta.trim() === "选照片（可多选）", cta);
      const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries || []));
      // F · cancel the library: back to the same sheet, nothing changed
      await page.locator("#choose-dialog .quick-start").tap();
      await page.waitForFunction(() => window.__picks.length === 1);
      let req = await page.evaluate(() => window.__picks[0]);
      check("A 选照片 → 直接请求 App 的相册（不是文件菜单）", req.type === "pick" && choosers.length === 0, JSON.stringify(req));
      check("B 相册可多选（limit 0 = 不限）", req.limit === 0, JSON.stringify(req));
      await page.evaluate(() => window.capidayPhotosPicked({ id: window.__picks[0].id, ok: true, files: [] }));
      await page.waitForSelector("#choose-dialog[open] .quick-sheet");
      const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries || []));
      check("F 取消相册 → 回到「今天怎么记？」，选择还在，没有留下空白页", (await page.locator('#choose-dialog [data-way="photo"][aria-pressed="true"]').count()) === 1 && after === before);
      // I · pick two photos: the usual flow (story page → save)
      await page.locator("#choose-dialog .quick-start").tap();
      await page.waitForFunction(() => window.__picks.length === 2);
      await answer(page, 2);
      await page.waitForSelector('[data-action="story-save"]', { timeout: 15000 });
      const kept = await page.evaluate(() => document.querySelectorAll(".story-canvas .layer img, .story-canvas img").length);
      check("C 没有出现系统的 Photo Library / Take Photo / Choose Files 菜单", choosers.length === 0, `${choosers.length} file chooser(s)`);
      check("I 相册的照片进入同一个「今天的故事」流程（两张都在）", kept >= 2, `${kept} photos on the page`);
      check("A–I · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ---------------- D · E · G · I : 拍照 ----------------
    {
      const { context, page, errors, choosers } = await open();
      await sheet(page);
      const cam = page.locator('#choose-dialog [data-action="quick-camera"]');
      check("D 「也可以」一行有独立的「拍照」", (await cam.count()) === 1 && (await cam.innerText()).includes("拍照"));
      // G · cancel the camera
      const [c1] = await Promise.all([page.waitForEvent("filechooser"), cam.tap()]);
      const capture = await page.evaluate(() => document.querySelector("#camera-input").getAttribute("capture"));
      check("D 拍照 → 直接打开相机（capture 输入，不先选来源）", capture === "environment" && (await c1.element().evaluate((el) => el.id)) === "camera-input" && (await page.evaluate(() => window.__picks.length)) === 0);
      await page.evaluate(() => document.querySelector("#camera-input").dispatchEvent(new Event("cancel")));
      await page.waitForSelector("#choose-dialog[open] .quick-sheet");
      check("G 取消拍照 → 回到「今天怎么记？」，没有留下空白页", (await page.evaluate(() => (JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries || []).length)) === 0);
      // E · take a photo
      const [c2] = await Promise.all([page.waitForEvent("filechooser"), page.locator('#choose-dialog [data-action="quick-camera"]').tap()]);
      await c2.setFiles(photo("latte-art"));
      await page.waitForSelector('[data-action="story-save"]', { timeout: 15000 });
      check("E 拍好的照片 → 进入同一个「今天的故事」流程", (await page.evaluate(() => document.querySelectorAll(".story-canvas img").length)) >= 1);
      await page.locator('[data-action="story-save"]').tap();
      await page.waitForSelector("#phone.in-reader", { timeout: 15000 });
      check("I 拍的照片和相册照片一样保存", (await page.evaluate(() => (JSON.parse(localStorage.getItem("little-days.v1")).entries || []).length)) >= 1);
      check("D–G · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ---------------- Files: a quiet secondary line, the app only ----------------
    {
      const { context, page, choosers } = await open();
      await sheet(page);
      const files = page.locator('#choose-dialog [data-action="quick-files"]');
      check("「从『文件』等其他位置选择」是选照片下方的一行小字（不和相册 / 相机同级）", (await files.count()) === 1 && (await page.evaluate(() => { const a = document.querySelector("#choose-dialog .quick-start").getBoundingClientRect(); const b = document.querySelector('#choose-dialog [data-action="quick-files"]').getBoundingClientRect(); return b.top >= a.bottom - 1 && b.height < a.height; })));
      const [c] = await Promise.all([page.waitForEvent("filechooser"), files.tap()]);
      check("其他位置 → 系统的文件菜单（只有这一处还会出现）", (await c.element().evaluate((el) => el.id)) === "attachment-image-input" && c.isMultiple());
      await context.close();
    }
    // ---------------- the online link / a browser: no app picker ----------------
    {
      const { context, page } = await open({ shell: false });
      await sheet(page);
      check("网页里没有 App 相册：不显示「其他位置」那一行（文件菜单本来就有）", (await page.locator('#choose-dialog [data-action="quick-files"]').count()) === 0);
      const [c] = await Promise.all([page.waitForEvent("filechooser"), page.locator("#choose-dialog .quick-start").tap()]);
      check("网页里选照片 → 浏览器自己的选择器（可多选）", c.isMultiple());
      await context.close();
    }
    // ---------------- Home 选今天的照片: the library too ----------------
    {
      const { context, page, choosers } = await open();
      await page.evaluate(() => {
        localStorage.setItem("little-days.onboarding", JSON.stringify({ home: "done", firstPage: "done" }));
      });
      await page.reload();
      await page.waitForSelector(".hero");
      await page.locator('.v9-home .v9-cta[data-action="today-photos"], [data-action="today-photos"]').first().tap();
      await page.waitForFunction(() => window.__picks.length === 1);
      check("首页「选今天的照片」也直接进 App 相册", choosers.length === 0 && (await page.evaluate(() => window.__picks[0].limit)) === 0);
      await context.close();
    }
    // ---------------- J · English ----------------
    {
      const { context, page, errors } = await open({ lang: "en" });
      await sheet(page);
      const ui = await page.evaluate(() => ({ cta: document.querySelector("#choose-dialog .quick-start").textContent.trim(), cam: document.querySelector('#choose-dialog [data-action="quick-camera"]').textContent.trim(), files: document.querySelector('#choose-dialog [data-action="quick-files"]').textContent.trim(), row: document.querySelector("#choose-dialog .quick-also").textContent }));
      check("J English: Choose photos · Take Photo · From Files or elsewhere, no Chinese", ui.cta === "Choose photos" && ui.cam.endsWith("Take Photo") && ui.files === "From Files or elsewhere" && !/[一-鿿]/.test(ui.row + ui.cta + ui.files), JSON.stringify(ui));
      const fit = await page.evaluate(() => { const r = document.querySelector("#choose-dialog .quick-also").getBoundingClientRect(); return [...document.querySelectorAll("#choose-dialog .quick-also button")].every((b) => { const x = b.getBoundingClientRect(); return x.left >= r.left - 1 && x.right <= r.right + 1 && b.scrollWidth <= b.clientWidth + 1; }); });
      check("J English: the 也可以 row fits at 390 (no clipped button)", fit);
      check("J · no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nv199: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
