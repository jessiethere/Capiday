// V10.77 · Books Alpha Stability Review: the My Books lifecycle defects
// found by the code audit (CAP-023 … CAP-027). Synthetic data only.
//  CAP-023 (P1) after 我的手帐 is deleted, a new day's page belonged to no
//          journal on the shelf ("daily" was hard-coded for new days);
//  CAP-024 (P1) a book page said 「1 天 · 1 页」 over an empty list when the
//          day was still a draft (the list read saved days only);
//  CAP-025 (P2) ··· offered 删除 on a book showing 0 pages, then refused;
//  CAP-026 (P2) saving an edit from the ··· sheet left that sheet open with
//          the old name; editing from the reader's cover left the reader;
//  CAP-027 (P2) with a tag filter on, ‹ 往前 / 往后 › moved past a hidden book.
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
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "null"));
const visibleShelf = (page) => page.evaluate(() => [...document.querySelectorAll(".bookshelf .spine[data-book]")].map((s) => s.dataset.book));
async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", hasTouch: true });
  await context.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("v175")) {
        sessionStorage.setItem("v175", "1");
        localStorage.setItem("little-days.with-samples", "0");
      }
    } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero");
  return { page, errors, context };
}
async function newBook(page, title) {
  await SS.goTab(page, "books");
  await page.locator('[data-action="new-book"]').first().click();
  await page.waitForSelector("#form-dialog[open]");
  await page.locator('#form-dialog input[name="title"]').fill(title);
  await page.locator('#form-dialog button[type="submit"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  return (await read(page)).books.find((b) => b.title === title).id;
}
async function shelf(page) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').first().click();
}
async function pull(page, id) {
  if (!(await page.locator(`.pulled-book [data-action="shelf-menu"][data-book="${id}"]`).count())) await page.locator(`.bookshelf .spine[data-book="${id}"]`).click();
  await page.waitForSelector(`.pulled-book [data-action="shelf-menu"][data-book="${id}"]`);
}
// A synthetic journal written straight into this test browser's storage.
async function seed(page, fill) {
  await SS.touchStore(page);
  await page.evaluate((code) => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    new Function("s", code)(s);
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  }, `(${fill})(s)`);
  await page.reload();
  await page.waitForSelector(".hero");
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    // CAP-023 · delete the (empty) 我的手帐, then start a new day from the Calendar.
    {
      const { page, errors, context } = await fresh(browser);
      const X = await newBook(page, "新本X");
      await shelf(page);
      await pull(page, "daily");
      await page.locator('.pulled-book [data-action="shelf-menu"][data-book="daily"]').click();
      await page.locator('#choose-dialog [data-action="shelf-delete"]').click();
      await page.locator("#confirm-dialog[open] #confirm-ok").click();
      await page.waitForTimeout(500);
      check("CAP-023 · 空的「我的手帐」已删除", !(await read(page)).books.some((b) => b.id === "daily"));
      await SS.goTab(page, "calendar");
      await page.locator('[data-action="edit-date"]').first().click();
      await page.waitForSelector('#journal-canvas [data-inline="title"]');
      await page.locator('#journal-canvas [data-inline="title"]').click();
      await page.keyboard.type("新的一天");
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(1200);
      const s = await read(page);
      const day = [...s.entries, ...Object.values(s.drafts || {})].find((d) => /新的一天/.test(JSON.stringify(d)));
      const ids = s.books.map((b) => b.id);
      check("CAP-023 · 新的一天属于书架上存在的手帐（不是已删除的 daily）", day && ids.includes(day.bookId) && day.bookId !== "daily", JSON.stringify({ bookId: day?.bookId, ids }));
      check("CAP-023 · 它就是剩下的「新本X」", day.bookId === X);
      check("CAP-023 · 没有页面错误", !errors.length, errors.join(" | "));
      await context.close();
    }

    // CAP-024 · a page still a draft (the app closed while writing) is listed on its book's page.
    {
      const { page, errors, context } = await fresh(browser);
      const D = await newBook(page, "草稿本");
      await page.locator('[data-action="book-new-entry"]').click();
      await page.waitForSelector('#journal-canvas [data-inline="title"]', { timeout: 8000 });
      await page.locator('#journal-canvas [data-inline="title"]').click();
      await page.keyboard.type("还没写完");
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(1200);
      await page.reload(); // like the app being closed mid-page
      await page.waitForSelector(".hero");
      await SS.openBookPage(page, D);
      await page.waitForTimeout(500);
      const view = await page.evaluate(() => ({
        badge: document.querySelector(".book-detail-copy .badge")?.textContent || "",
        list: document.querySelector("#app")?.innerText || "",
      }));
      check("CAP-024 · 书本页写着 1 天 · 1 页", /1 天 · 1 页/.test(view.badge), view.badge);
      check("CAP-024 · 下面的列表里有这一页（不是「手帐本的第一页，等你来写」）", !/等你来写/.test(view.list), view.list.slice(0, 160));
      check("CAP-024 · 没有页面错误", !errors.length, errors.join(" | "));
      await context.close();
    }

    // CAP-025 / CAP-027 · a book that shows 0 pages but is still linked; a tag filter and ‹ 往前.
    {
      const { page, errors, context } = await fresh(browser);
      await seed(page, (s) => {
        s.entries = [];
        s.drafts = {};
        const mk = (id, title, tags) => ({ id, title, description: "", category: "Daily Life", color: "blush", cover: "", coverTemplate: "floral-notebook", coverFont: "hei", coverDecoration: "tulip", coverImage: "", fields: [], visibility: "private", tags });
        s.books = [mk("bA", "甲本", ["旅行"]), mk("bB", "乙本", []), mk("bC", "丙本", ["旅行"]), mk("bD", "丁本", []), mk("bE", "戊本", [])];
        const mom = (id, bookId, title) => ({ id, time: "", title, body: "x", tags: [], bookId, layers: [], media: [] });
        s.entries.push({ id: "e1", date: "2026-11-01", title: "", body: "", photo: "", bookId: "bD", mood: "", layers: [], media: [], isDemo: false, moments: [mom("m1", "bA", "a1"), mom("m2", "bB", "b1")] });
      });
      const before = JSON.stringify((await read(page)).entries);
      await shelf(page);
      await pull(page, "bD");
      await page.locator('.pulled-book [data-action="shelf-menu"][data-book="bD"]').click();
      await page.waitForSelector("#choose-dialog[open] .shelf-menu");
      const sheet = await page.evaluate(() => ({ del: !!document.querySelector('#choose-dialog [data-action="shelf-delete"]'), text: document.querySelector("#choose-dialog .shelf-menu-danger")?.textContent || "" }));
      check("CAP-025 · 0 页但还连着 1 天的书：不再给出「删除」按钮", !sheet.del, JSON.stringify(sheet));
      check("CAP-025 · 直接说明原因（连着 1 天的记录）", /连着 1 天/.test(sheet.text), sheet.text);
      await page.evaluate(() => document.querySelector("#choose-dialog").close());
      // An empty, unlinked book still offers 删除.
      await pull(page, "bE");
      await page.locator('.pulled-book [data-action="shelf-menu"][data-book="bE"]').click();
      await page.waitForSelector("#choose-dialog[open] .shelf-menu");
      check("CAP-025 · 真正空的书仍然可以删除", await page.locator('#choose-dialog [data-action="shelf-delete"][data-book="bE"]').count() === 1);
      await page.evaluate(() => document.querySelector("#choose-dialog").close());
      check("CAP-025 · 记录一点没变", JSON.stringify((await read(page)).entries) === before);

      // Tag filter #旅行 shows 甲本, 丙本: 丙本 ‹ 往前 puts it before 甲本 (visibly).
      await page.locator('[data-action="shelf-put-back"], [data-action="put-back"]').first().click().catch(() => {});
      await page.locator('[data-action="shelf-tag"][data-tag="旅行"]').first().click();
      await page.waitForTimeout(300);
      check("CAP-027 · 筛选 #旅行：只看到甲本、丙本", JSON.stringify(await visibleShelf(page)) === JSON.stringify(["bA", "bC"]), JSON.stringify(await visibleShelf(page)));
      await pull(page, "bC");
      await page.locator('.pulled-book [data-action="book-step"][data-book="bC"][data-dir="-1"]').click();
      await page.waitForTimeout(400);
      check("CAP-027 · ‹ 往前：看得见的顺序变成 丙本、甲本", JSON.stringify(await visibleShelf(page)) === JSON.stringify(["bC", "bA"]), JSON.stringify(await visibleShelf(page)));
      check("CAP-027 · 丙本在第一个时「往前」不可点", await page.locator('.pulled-book [data-action="book-step"][data-book="bC"][data-dir="-1"]').isDisabled());
      const order = (await read(page)).books.map((b) => b.id);
      check("CAP-027 · 存下的书架顺序：丙本排到甲本前面，其他书相对顺序不变", JSON.stringify(order) === JSON.stringify(["bC", "bA", "bB", "bD", "bE"]), JSON.stringify(order));
      check("CAP-025/027 · 没有页面错误", !errors.length, errors.join(" | "));
      await context.close();
    }

    // CAP-026 · edit from the ··· sheet: the sheet closes; edit from the reader's cover: stay in the reader.
    {
      const { page, errors, context } = await fresh(browser);
      const B = await newBook(page, "空本B");
      await shelf(page);
      await pull(page, B);
      await page.locator(`.pulled-book [data-action="shelf-menu"][data-book="${B}"]`).click();
      await page.locator(`#choose-dialog [data-action="edit-book"][data-book="${B}"]`).click();
      await page.waitForSelector("#form-dialog[open]");
      await page.locator('#form-dialog input[name="title"]').fill("B改");
      await page.locator('#form-dialog button[type="submit"]').first().click();
      await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
      await page.waitForTimeout(400);
      check("CAP-026 · ··· 里编辑保存后，旧的 ··· 弹层关掉了", !(await page.locator("#choose-dialog[open]").count()));
      check("CAP-026 · 书架上是新名字", (await page.locator(`.bookshelf .spine[data-book="${B}"]`).getAttribute("aria-label")).startsWith("B改"));
      // From the reader's cover.
      await SS.openBookPage(page, B);
      await page.locator(`.book-detail-showcase[data-book="${B}"]`).click();
      await page.waitForSelector(".reader .reader-edit[data-action='edit-book']");
      await page.locator(".reader .reader-edit[data-action='edit-book']").click();
      await page.waitForSelector("#form-dialog[open]");
      await page.locator('#form-dialog input[name="title"]').fill("B再改");
      await page.locator('#form-dialog button[type="submit"]').first().click();
      await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
      await page.waitForTimeout(400);
      check("CAP-026 · 在阅读器封面上编辑保存后，仍在阅读器", (await page.locator("#phone.in-reader .reader").count()) === 1);
      check("CAP-026 · 阅读器封面显示新名字", /B再改/.test(await page.locator(".reader-cover h2").innerText()));
      check("CAP-026 · 没有页面错误", !errors.length, errors.join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nv175: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
