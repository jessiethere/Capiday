// V10.70 · Beta 2 · Editor Layout & Interaction Stability.
// iPhone 17 size (402 × 874) with the iPhone's safe area (status bar 62 pt,
// home indicator 34 pt, given to the CSS as --sat / --sab because Chromium has
// no notch) and a keyboard that shrinks the visual viewport like WKWebView
// (397 pt incl. the Chinese candidate row and iOS's own ⌃ ⌄ ✓ bar).
// Checks the coordinator (html.kb-open, --vv-h, --kb) and every place the
// Founder's iPhone screenshots showed: 新建手帐本 under the status bar
// (CAP-010), the dialog keeping its keyboard size after the keyboard closed
// (CAP-011), 写字 · 改字体 cut off while typing (CAP-012), the Quick Edit bar
// floating mid-page (CAP-013), and the scroll position after the sheet.
// Synthetic data only.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SAT = 62, SAB = 34, KB = 397, H = 874;

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
  // quiet = true: the keyboard goes away without a resize event (as on iOS,
  // where the last update could be the one at the start of the slide).
  window.__kb = (px, quiet = false) => {
    kb = px;
    if (!quiet) vv.dispatchEvent(new Event("resize"));
  };
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
const rect = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; }, sel);
const vars = (page) => page.evaluate(() => ({ open: document.documentElement.classList.contains("kb-open"), kb: document.documentElement.style.getPropertyValue("--kb"), vvh: document.documentElement.style.getPropertyValue("--vv-h") }));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const fresh = async () => {
    const context = await browser.newContext({ viewport: { width: 402, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: "zh-CN", userAgent: IPHONE });
    await context.addInitScript(fakeKeyboard);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    return { context, page };
  };
  try {
    // ---------- 新建手帐本 (CAP-010, CAP-011) ----------
    {
      const { context, page } = await fresh();
      await SS.goTab(page, "books");
      await page.locator('[data-action="new-book"]').first().click();
      await page.waitForSelector("#form-dialog[open]");
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(300);
      let h2 = await rect(page, "#form-dialog[open] h2");
      let dlg = await rect(page, "#form-dialog[open]");
      check("新建手帐本：没有键盘时，标题在状态栏下面", h2.top >= SAT, `title ${h2.top}, safe ${SAT}`);
      check("新建手帐本：弹窗在安全区内", dlg.top >= SAT && dlg.bottom <= H - SAB, `dialog ${dlg.top}–${dlg.bottom}`);
      // keyboard up on the name
      await page.locator('#form-dialog[open] input[name="title"]').click();
      await page.waitForTimeout(300);
      await page.evaluate((kb) => window.__kb(kb), KB);
      await page.waitForTimeout(500);
      h2 = await rect(page, "#form-dialog[open] h2");
      dlg = await rect(page, "#form-dialog[open]");
      const name = await rect(page, '#form-dialog[open] input[name="title"]');
      let v = await vars(page);
      check("键盘弹出：协调器标记 kb-open 并给出可见高度", v.open && v.vvh === `${H - KB}px`, JSON.stringify(v));
      check("键盘弹出：标题仍在状态栏下面", h2.top >= SAT, `title ${h2.top}`);
      check("键盘弹出：弹窗底部在键盘上方，名字输入框可见", dlg.bottom <= H - KB && name.bottom <= H - KB && name.top >= SAT, `dialog ${dlg.top}–${dlg.bottom}, name ${name.top}–${name.bottom}, keyboard ${H - KB}`);
      // 查看更多封面 while the keyboard is up; the keyboard goes away with no resize event
      if (process.env.DEBUG) {
        page.on("console", (m) => console.log("console:", m.text()));
        await page.evaluate(() => { for (const t of ["pointerdown", "pointerup", "click", "focusout"]) document.addEventListener(t, (e) => console.log(t, e.target.className || e.target.tagName, document.activeElement?.tagName, document.querySelector("#cover-browser")?.hidden), true); });
      }
      await page.locator("#form-dialog[open] .cover-more-link").click();
      await page.evaluate((kb) => window.__kb(0, true), KB);
      await page.waitForTimeout(400);
      v = await vars(page);
      dlg = await rect(page, "#form-dialog[open]");
      check("键盘收起（没有 resize 事件）：键盘高度被清掉", !v.open && !v.kb && !v.vvh, JSON.stringify(v));
      check("键盘收起：弹窗不再停在键盘时的高度", dlg.height > H - KB, `dialog height ${dlg.height}`);
      const tiles = await page.evaluate(() => { const d = document.querySelector("#form-dialog[open]").getBoundingClientRect(); return [...document.querySelectorAll("#cover-browser-grid .cover-option")].filter((t) => { const b = t.getBoundingClientRect(); return b.height && b.top >= d.top && b.bottom <= d.bottom; }).length; });
      if (process.env.DEBUG) console.log(await page.evaluate(() => { const d = document.querySelector("#form-dialog[open]"); const g = document.querySelector("#cover-browser-grid"); return { hidden: document.querySelector("#cover-browser")?.hidden, st: d.scrollTop, sh: d.scrollHeight, ch: d.clientHeight, d: JSON.stringify(d.getBoundingClientRect()), g0: JSON.stringify(g?.firstElementChild?.getBoundingClientRect()), n: g?.children.length }; }));
      check("封面浏览器：不滚动就能看到多个封面", tiles >= 3, `${tiles} covers in view`);
      // back to the first view keeps the chosen style
      const chosen = await page.evaluate(() => { const b = [...document.querySelectorAll("#cover-browser-grid .cover-option")][2]; b?.click(); return b?.dataset.template; });
      await page.locator('#form-dialog[open] [data-action="cover-browser-close"], #form-dialog[open] .cover-browser-head button').first().click();
      await page.waitForTimeout(300);
      const kept = await page.evaluate(() => ({ main: !document.querySelector("#dialog-form .book-main")?.hidden, tpl: document.querySelector('#dialog-form input[name="coverTemplate"]')?.value }));
      check("返回上一级：回到第一屏，刚选的封面还在", kept.main && kept.tpl === chosen, JSON.stringify({ chosen, ...kept }));
      await context.close();
    }
    // ---------- iOS 27 path: the shell gives the keyboard top, the page scrolls itself ----------
    {
      const { context, page } = await fresh();
      await SS.goTab(page, "books");
      await page.locator('[data-action="new-book"]').first().click();
      await page.waitForSelector("#form-dialog[open]");
      await page.locator('#form-dialog[open] input[name="title"]').click();
      await page.evaluate(() => window.capidayKeyboard(477));
      await page.waitForTimeout(300);
      let v = await vars(page);
      check("外壳给出键盘位置（量不到 resize 时）：同样标记 kb-open", v.open && v.vvh === "477px", JSON.stringify(v));
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(200);
      v = await vars(page);
      check("外壳路径：失去焦点后立刻清掉", !v.open && !v.vvh, JSON.stringify(v));
      await context.close();
    }
    // ---------- 今天的故事 · 写字 · 改字体 (CAP-012, CAP-013, CAP-003) ----------
    {
      const { context, page } = await fresh();
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-action="today-photos"]').first().click()]);
      await chooser.setFiles([photo("frost"), photo("bouquet"), photo("latte-art")]);
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(500);
      const bar0 = await rect(page, ".qe-bar");
      const scroll0 = await page.evaluate(() => document.querySelector("#app-scroll").scrollTop);
      check("故事页：操作栏在屏幕底部", bar0.bottom <= H && bar0.top > H * 0.6, `bar ${bar0.top}–${bar0.bottom}`);
      await page.locator('.qe-tools [data-action="story-text"]').click();
      await page.waitForSelector("#choose-dialog[open] [data-sw-text]");
      await page.keyboard.type("今天吃了韩餐");
      await page.waitForTimeout(300);
      await page.evaluate((kb) => window.__kb(kb), KB);
      await page.waitForTimeout(600);
      if (process.env.DEBUG) console.log(await page.evaluate(() => [...document.querySelectorAll("#choose-dialog .choose-sheet.sw > *, #choose-dialog .sw-body > *, #choose-dialog .sw-edit > *")].map((e) => `${e.className || e.tagName}:${Math.round(e.getBoundingClientRect().top)}+${Math.round(e.getBoundingClientRect().height)}`).join(" | ") + " || sheet pad " + getComputedStyle(document.querySelector("#choose-dialog .choose-sheet.sw")).padding + " gap " + getComputedStyle(document.querySelector("#choose-dialog .choose-sheet.sw")).gap));
      const sheet = await rect(page, "#choose-dialog[open]");
      const field = await rect(page, "#choose-dialog[open] [data-sw-text]");
      const more = await rect(page, "#choose-dialog[open] .sw-more > summary");
      check("写字（键盘弹出）：面板顶部在状态栏下面", sheet.top >= SAT, `sheet top ${sheet.top}`);
      check("写字（键盘弹出）：输入框在键盘上方", field.bottom <= H - KB && field.top >= sheet.top, `field ${field.top}–${field.bottom}`);
      check("写字（键盘弹出）：「字体与样式 ›」完整可见", more && more.bottom <= H - KB, `summary ${more?.top}–${more?.bottom}, keyboard ${H - KB}`);
      const barHidden = await page.evaluate(() => getComputedStyle(document.querySelector(".qe-bar")).visibility);
      check("写字面板打开时，故事页操作栏让开", barHidden === "hidden", barHidden);
      // Aa 字体: the keyboard goes away with no resize event
      await page.locator('#choose-dialog [data-action="sw-compact"]').click();
      await page.evaluate(() => window.__kb(0, true));
      await page.waitForTimeout(700);
      const compact = await rect(page, "#choose-dialog[open]");
      const bar1 = await page.evaluate(() => { const b = document.querySelector(".qe-bar"); const r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).visibility, top: Math.round(r.top) }; });
      check("改字体：操作栏不浮在页面中间", bar1.vis === "hidden" || bar1.top >= compact.top, JSON.stringify(bar1));
      const v = await vars(page);
      check("改字体：键盘高度已清掉，面板贴底", !v.open && compact.bottom === H, `${JSON.stringify(v)} sheet ${compact.top}–${compact.bottom}`);
      const words = await page.evaluate(() => { const el = [...document.querySelectorAll(".story-canvas .layer")].find((x) => x.textContent.trim() === "今天吃了韩餐"); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
      check("改字体：正在改的字在面板上方、状态栏下方", words && words.bottom <= compact.top && words.top >= SAT, `${JSON.stringify(words)} sheet top ${compact.top}`);
      await page.locator('#choose-dialog [data-action="sw-font"]').nth(2).click();
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => { const el = [...document.querySelectorAll(".story-canvas .layer")].find((x) => x.textContent.trim() === "今天吃了韩餐"); return el ? getComputedStyle(el).fontFamily : ""; });
      check("换字体：页面上的字实时变化", /Songti|STSong|SimSun|Noto Serif/.test(after), after.slice(0, 40));
      // 完成: the bar comes back at the bottom and the page goes back where it was
      await page.locator('#choose-dialog [data-action="story-text-done"]').click();
      await page.waitForTimeout(600);
      const bar2 = await page.evaluate(() => { const b = document.querySelector(".qe-bar"); const r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).visibility, top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
      check("完成后：操作栏回到底部且可见，没有残留", bar2.vis === "visible" && bar2.top > H * 0.6 && bar2.bottom <= H, JSON.stringify(bar2));
      const scroll1 = await page.evaluate(() => document.querySelector("#app-scroll").scrollTop);
      check("完成后：页面回到打开面板前的位置", Math.abs(scroll1 - scroll0) <= 2, `${scroll0} → ${scroll1}`);
      // 撤销 / 保存 still work
      await page.locator('[data-action="story-save"]').click();
      await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries || {}).length >= 0, null, { timeout: 5000 });
      await page.waitForTimeout(1200);
      const saved = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("little-days.v1") || "{}")).includes("今天吃了韩餐"));
      check("保存后：文字在手帐里", saved);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv166: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
