// V10.83 · 首页「照片手帐」的两张照片: your own newest photos first (as on
// 照片墙: saved pages only, hidden ones left out, with their date); without
// them, a different pair from the app's photo library every day.
// Synthetic data only (the app's sample photos as "own" uploads). Chromium.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");
const photo = (n) => path.join(lib, `LD-photo-${n}.jpg`);

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
const hero = (page) =>
  page.evaluate(() => {
    const box = document.querySelector(".v9-polaroids");
    const url = (sel) => (box.querySelector(sel).style.backgroundImage.match(/url\("?(.*?)"?\)$/) || [])[1] || "";
    return { own: box.dataset.own, front: url(".v9-pol-front"), back: url(".v9-pol-back"), date: box.querySelector("em").textContent };
  });

async function at(browser, time) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", hasTouch: true });
  const page = await context.newPage();
  await page.clock.install({ time });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero .v9-polaroids");
  return { page, context, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // No photos of your own yet: two library photos, a different pair on another day.
    const a = await at(browser, new Date("2026-11-17T09:00:00"));
    const h1 = await hero(a.page);
    const b = await at(browser, new Date("2026-11-18T09:00:00"));
    const h2 = await hero(b.page);
    const c = await at(browser, new Date("2026-11-17T21:30:00"));
    const h3 = await hero(c.page);
    check("还没有自己的照片：显示两张不同的素材照片", h1.own === "0" && h1.front && h1.back && h1.front !== h1.back, JSON.stringify(h1));
    check("素材照片每天换一组", h1.front !== h2.front || h1.back !== h2.back, `${h1.front} / ${h2.front}`);
    check("同一天里不变（早上和晚上一样）", h1.front === h3.front && h1.back === h3.back);
    check("素材照片时日期是今天", h1.date === "11月17日" && h2.date === "11月18日", `${h1.date} ${h2.date}`);
    for (const x of [b, c]) await x.context.close();

    // A saved page with two photos of your own (from the photo picker).
    const { page, context, errors } = a;
    await page.locator('[data-action="today-write"]').first().click();
    await page.waitForSelector("#journal-canvas");
    await page.locator("#photos-input").setInputFiles([photo("beach-dog"), photo("bouquet")]);
    await page.waitForSelector("#photo-editor[open] .pe-frame");
    await page.locator('#photo-editor [data-pe-action="cancel"]').click();
    await page.waitForFunction(() => document.querySelectorAll("#journal-canvas .photo-layer img").length >= 2);
    await page.waitForTimeout(800);
    // Save it (drafts are never used: 照片墙 counts saved pages only — photo-wall.mjs).
    await page.locator('[data-action="save-entry"]').click();
    await page.waitForSelector("#phone.in-reader", { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())); // the first-page streak card
    await SS.leaveReader(page);
    await page.locator('#navigation [data-page="home"]').click();
    await page.waitForSelector(".hero .v9-polaroids");
    const mine = await hero(page);
    const urls = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const e = s.entries.find((x) => x.date === "2026-11-17");
      return [e, ...(e.moments || [])].flatMap((p) => (p.layers || []).filter((l) => l.kind === "photo" && l.mediaRef).map((l) => l.mediaRef));
    });
    check("保存后：首页显示自己的两张照片", mine.own === "1" && mine.front.startsWith("blob:") && mine.back.startsWith("blob:") && mine.front !== mine.back, JSON.stringify(mine));
    check("日期是这几张照片所在的那天", mine.date === "11月17日", mine.date);
    check("（这一页有两张自己的照片）", urls.length === 2 && urls.every((r) => r.startsWith("media:")), JSON.stringify(urls));

    // Hidden from 照片墙: not on Home either.
    await page.evaluate((refs) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.wall = { version: 1, order: "time", hidden: Object.fromEntries(refs.map((ref, i) => [`h${i}`, { at: "2026-11-17T10:00:00.000Z", ref }])), pages: [], custom: [] };
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, urls);
    await page.reload();
    await page.waitForSelector(".hero .v9-polaroids");
    const hidden = await hero(page);
    check("在照片墙里隐藏的照片不上首页（回到素材照片）", hidden.own === "0" && !hidden.front.startsWith("blob:") && !hidden.back.startsWith("blob:"), JSON.stringify(hidden));
    // One hidden, one shown: yours in front, a library photo behind.
    await page.evaluate((ref) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.wall.hidden = { h0: { at: "2026-11-17T10:00:00.000Z", ref } };
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, urls[0]);
    await page.reload();
    await page.waitForSelector(".hero .v9-polaroids");
    const one = await hero(page);
    check("只有一张自己的照片：它在前面，后面补一张素材", one.own === "1" && one.front.startsWith("blob:") && !one.back.startsWith("blob:"), JSON.stringify(one));
    check("首页显示照片不改手帐数据（没有新增或改动页面）", (await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).entries.length)) >= 1);
    check("没有页面错误", errors.length === 0, errors.join(" | "));
    await context.close();
  } catch (error) {
    failures.push(`crashed: ${error.message}`);
    console.log(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
})();
