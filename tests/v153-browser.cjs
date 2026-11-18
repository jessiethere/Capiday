// V10.56 · Home order: Hero (+ Captain + quick ways) → 今天的小计划 →
// 今天的故事 → 我的手帐; a plan added and deleted stays that way after a
// reload; nothing overflows at 375 / 430. zh and en.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    for (const run of [{ lang: "zh", w: 375, h: 667 }, { lang: "en", w: 430, h: 932 }]) {
      const where = `${run.lang} ${run.w}`;
      const context = await browser.newContext({ viewport: { width: run.w, height: run.h }, isMobile: true, hasTouch: true });
      await context.addInitScript((lang) => localStorage.setItem("little-days.language", lang), run.lang === "zh" ? "zh-CN" : "en");
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      const order = await page.evaluate(() => {
        const at = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top + document.querySelector("#app-scroll").scrollTop : -1; };
        return { hero: at(".v9-hero"), quick: at(".today-tiles"), plans: at(".today-planner"), stamps: at(".stamp-strip"), week: at(".week-card"), books: at(".hs-collect") };
      });
      assert.ok(order.hero >= 0 && order.hero < order.quick && order.plans === -1 && order.quick < order.stamps && order.stamps < order.books, `${where}: order ${JSON.stringify(order)}`);
      passed.push(`${where}: Hero → quick ways → 集章卡 → 我的手帐 (no 今天的小计划, V10.84)`);
      // V10.84: no planner on Home in either language (nothing to add plans with).
      assert.equal(await page.locator("[data-plan-input], .today-planner, .today-habits-link").count(), 0, `${where}: no planner`);
      passed.push(`${where}: no 今天的小计划 / My habits on Home`);
      const fit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector(".app-scroll").scrollWidth <= document.querySelector(".app-scroll").clientWidth);
      assert.ok(fit, `${where}: no sideways scroll`);
      assert.deepEqual(errors, [], where);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`V10.56 home E2E passed (${passed.length} groups):\n - ${passed.join("\n - ")}`);
  console.log("No page errors.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
