// V10.78 · Memory Wall v1.0 (MW-01…MW-05) in the app. Synthetic data only:
// four small generated pictures on two days, in one journal.
//  MW-01 the wall is still made from the journal (as before);
//  MW-02 管理: pick, hide, the hidden list, restore; kept after reopening;
//  MW-03 a whole page put on the wall from the reader (same drawing as the
//        page), opens that page; gone (no broken card) when the page is deleted;
//  MW-04 my order: move a card, kept after reopening; 时间排序 and back;
//  MW-05 nothing in the journal changes at any step.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
// What the journal holds (days, their books, pages, photos, words) — not the
// default fields the app fills in on its first save of a hand-written test state.
const journal = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const pg = (m) => ({ id: m.id, bookId: m.bookId || "", title: m.title || "", body: m.body || "", layers: (m.layers || []).map((l) => [l.id, l.kind, l.mediaRef || "", l.text || ""]) });
    return JSON.stringify({ e: s.entries.map((e) => ({ id: e.id, date: e.date, bookId: e.bookId, photo: e.photo || "", moments: (e.moments || []).map(pg) })), b: s.books.map((b) => [b.id, b.title, b.coverTemplate]), d: Object.keys(s.drafts || {}) });
  });
const wall = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).wall || null);
const tiles = (page) => page.$$eval(".photo-wall .pw-tile", (els) => els.map((e) => ({ key: e.dataset.key, page: e.classList.contains("pw-page") })));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN", hasTouch: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    await page.evaluate(() => {
      const pic = (color) => { const c = document.createElement("canvas"); c.width = 60; c.height = 80; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 60, 80); x.fillStyle = "#fff"; x.fillRect(10, 10, 20, 20); return c.toDataURL("image/png"); };
      const [a, b, c, d] = ["#c96", "#69c", "#9c6", "#c69"].map(pic);
      const ph = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 40, scale: 1, rotation: 0 });
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.books.push({ id: "w", title: "照片墙测试", category: "Daily Life", color: "blush", coverTemplate: "minimal-linen", coverFont: "hei", coverDecoration: "none", coverImage: "", fields: [], visibility: "private" });
      s.entries.push(
        { id: "w1", date: "2026-10-05", bookId: "w", title: "", body: "", photo: "", mood: "", layers: [], media: [], isDemo: false, moments: [{ id: "wm1", time: "09:00", title: "十月的早上", body: "", bookId: "w", tags: [], media: [], layers: [ph("a", a), ph("b", b)] }] },
        { id: "w2", date: "2026-11-02", bookId: "w", title: "", body: "", photo: "", mood: "", layers: [], media: [], isDemo: false, moments: [{ id: "wm2", time: "18:00", title: "十一月的傍晚", body: "", bookId: "w", tags: [], media: [], layers: [ph("c", c), ph("d", d)] }] },
      );
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    await page.waitForTimeout(1500);
    const before = await journal(page);
    const openWall = async () => {
      await SS.goTab(page, "calendar");
      await page.locator('[data-action="calendar-mode"][data-mode="wall"]').click();
      if (await page.locator('.calendar-book-chips [data-book="w"], [data-action="calendar-book"][data-book="w"]').count()) await page.locator('.calendar-book-chips [data-book="w"], [data-action="calendar-book"][data-book="w"]').first().click();
      await page.waitForSelector(".photo-wall .pw-tile");
    };
    await openWall();
    let t0 = await tiles(page);
    check("MW-01 · 照片墙照常从手帐生成：4 张照片，新的在前", t0.length >= 4 && t0.filter((x) => !x.page).length >= 4, String(t0.length));
    check("MW-01 · 正常浏览时没有管理按钮以外的操作", (await page.locator(".pw-manage-bar, .pw-actions").count()) === 0);

    // MW-02 hide two, then restore one.
    await page.locator('[data-action="wall-manage"]').click();
    await page.waitForSelector(".pw-manage-bar");
    const keys = (await tiles(page)).map((x) => x.key);
    await page.locator(`.pw-tile[data-key="${keys[0]}"]`).click();
    await page.locator(`.pw-tile[data-key="${keys[1]}"]`).click();
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/v181-manage.png` });
    await page.locator('[data-action="wall-hide"]').click();
    await page.waitForTimeout(300);
    let now = (await tiles(page)).map((x) => x.key);
    check("MW-02 · 隐藏两张：照片墙上少了这两张", !now.includes(keys[0]) && !now.includes(keys[1]) && now.length === keys.length - 2);
    check("MW-02 · 「已隐藏 2」", /已隐藏 2/.test(await page.locator(".pw-hidden-btn").innerText()));
    check("MW-05 · 隐藏后手帐一点没变", (await journal(page)) === before);
    await page.reload();
    await page.waitForSelector(".hero");
    await openWall();
    now = (await tiles(page)).map((x) => x.key);
    check("MW-02 · 重新打开 App：仍然隐藏", !now.includes(keys[0]) && !now.includes(keys[1]));
    await page.locator('[data-action="wall-manage"]').click();
    await page.locator('[data-action="wall-hidden-list"]').click();
    await page.waitForSelector("#choose-dialog[open] .wall-hidden-sheet");
    check("MW-02 · 已隐藏列表里有 2 张", (await page.locator("#choose-dialog .wh-item").count()) === 2);
    await page.locator(`#choose-dialog [data-action="wall-unhide"][data-key="${keys[0]}"]`).click();
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector("#choose-dialog")?.open && document.querySelector("#choose-dialog").close());
    now = (await tiles(page)).map((x) => x.key);
    check("MW-02 · 恢复一张：回到照片墙", now.includes(keys[0]) && !now.includes(keys[1]));

    // MW-04 my order: move the last card to the front.
    const last = now.at(-1);
    await page.locator(`.pw-tile[data-key="${last}"]`).click();
    await page.locator('[data-action="wall-move"][data-dir="first"]').click();
    await page.waitForTimeout(300);
    now = (await tiles(page)).map((x) => x.key);
    check("MW-04 · 放到最前：顺序变了，变成自定义排序", now[0] === last && (await wall(page)).order === "custom");
    check("MW-04 · 自定义排序不分月份", (await page.locator(".pw-month-label").count()) === 0);
    check("MW-05 · 排序不改任何日期", (await journal(page)) === before);
    await page.reload();
    await page.waitForSelector(".hero");
    await openWall();
    check("MW-04 · 重新打开 App：顺序还在", (await tiles(page))[0].key === last);
    await page.locator('[data-action="wall-manage"]').click();
    await page.locator('[data-action="wall-order"][data-order="time"]').click();
    await page.waitForTimeout(300);
    check("MW-04 · 切回时间排序：按日期（有月份）", (await tiles(page))[0].key !== last && (await page.locator(".pw-month-label").count()) >= 2);
    await page.locator('[data-action="wall-order"][data-order="custom"]').click();
    await page.waitForTimeout(300);
    check("MW-04 · 再切回自定义：之前的顺序还在", (await tiles(page))[0].key === last);
    await page.locator('[data-action="wall-manage"]').click(); // 完成

    // MW-03 put a whole page on the wall from the reader.
    await SS.openBookPage(page, "w");
    await page.locator('[data-action="reader-open"][data-book="w"]').first().click();
    await page.waitForSelector(".reader-page");
    for (let i = 0; i < 4 && !(await page.locator('[data-action="read-edit"]').count()); i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
    }
    await page.locator('[data-action="reader-more"]').click();
    await page.locator('#choose-dialog [data-action="wall-pin"]').click();
    await page.waitForTimeout(300);
    const pinned = (await wall(page)).pages.map((p) => p.key);
    check("MW-03 · 贴到照片墙：记下的是来源（页 id），不是复制的页面", pinned.length === 1 && /^page:wm[12]$/.test(pinned[0]), pinned.join());
    check("MW-05 · 贴墙后手帐没变", (await journal(page)) === before);
    await page.locator('[data-action="reader-back"]').click();
    await openWall();
    check("MW-03 · 照片墙上出现整页卡片（标着「整页」）", (await page.locator(".pw-tile.pw-page .pw-badge").count()) === 1);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/v181-page-card.png` });
    const words = await page.locator(".pw-tile.pw-page .pw-paper").innerText();
    check("MW-03 · 整页卡片用的是同一套页面绘制（有这一页的照片）", (await page.locator(".pw-tile.pw-page .pw-paper img").count()) >= 2, words.slice(0, 30));
    await page.locator(".pw-tile.pw-page").click();
    await page.waitForSelector(".reader-page");
    check("MW-03 · 点整页卡片：打开这一页（阅读器）", (await page.locator('[data-action="read-edit"]').count()) === 1);
    await page.locator('[data-action="reader-back"]').click();

    // Edge 3: the page is deleted → no card, no error; the setting stays harmless.
    await page.evaluate((key) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const id = key.replace("page:", "");
      for (const e of s.entries) e.moments = (e.moments || []).filter((m) => m.id !== id);
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, pinned[0]);
    await page.reload();
    await page.waitForSelector(".hero");
    await openWall();
    check("边界 3 · 原来的页删掉了：照片墙上没有坏卡片", (await page.locator(".pw-tile.pw-page").count()) === 0);
    check("没有页面错误", !errors.length, errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`\nv181: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
