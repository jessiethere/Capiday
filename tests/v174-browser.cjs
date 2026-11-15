// V10.77 · CAP-021 (P1) Home's 「我的手帐」 follows the shelf's order, and
// CAP-022 (P1) its 「X 月 X 日更新」 is the day on this phone's calendar.
// Founder: Home led with the journal written in most recently, not the
// shelf's first; and at 23:37 on 14 Nov (iPhone, evening) the card said
// 「11 月 15 日更新」 — the UTC date of updatedAt.
// Runs in America/New_York with the clock fixed at 23:37 on 14 Nov 2026
// (04:37 on 15 Nov in UTC). Synthetic data only.
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
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
const shelfOrder = async (page) => (await read(page)).books.map((b) => b.title);
const homeCard = async (page) => {
  await SS.goTab(page, "home");
  await page.waitForSelector(".home-books");
  return page.evaluate(() => ({
    lead: document.querySelector(".lib-now b")?.textContent.trim() || "",
    meta: document.querySelector(".lib-now span")?.textContent.trim() || "",
    others: [...document.querySelectorAll(".lib-others .lib-mini")].map((b) => b.getAttribute("aria-label")),
    empty: !!document.querySelector(".home-books .lib-empty"),
  }));
};
async function newBook(page, title) {
  await SS.goTab(page, "books");
  await page.locator('[data-action="new-book"]').first().click();
  await page.waitForSelector("#form-dialog[open]");
  await page.locator('#form-dialog input[name="title"]').fill(title);
  await page.locator('#form-dialog button[type="submit"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  return (await read(page)).books.find((b) => b.title === title).id;
}
async function openBook(page, id) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').first().click();
  await page.locator(`.bookshelf .spine[data-book="${id}"]`).click();
  await page.locator(`.pulled-book [data-action="book"][data-book="${id}"]`).click();
  await page.waitForSelector(`[data-action="edit-book"][data-book="${id}"]`);
}
async function writeIn(page, id, text) {
  await openBook(page, id);
  await page.locator('[data-action="book-new-entry"]').click();
  await page.waitForSelector("#journal-canvas");
  await page.locator('.tool-dock [data-action="add-text-layer"]').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(400);
  await page.locator('[data-action="studio-back"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 8000 });
  await page.waitForTimeout(700);
}
async function step(page, id, dir) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').first().click();
  if (!(await page.locator(`.pulled-book [data-action="book-step"][data-book="${id}"]`).count())) await page.locator(`.bookshelf .spine[data-book="${id}"]`).click();
  const button = page.locator(`.pulled-book [data-action="book-step"][data-book="${id}"][data-dir="${dir}"]`);
  if (await button.isDisabled()) return;
  await button.click();
  await page.waitForTimeout(400);
}

// The clock moved to 23:37 on 14 Nov in New York and still running (a fixed
// clock would stop Date.now(), which the app's saving relies on).
const shiftClock = (target) => {
  const offset = target - Date.now();
  const Real = Date;
  class Shifted extends Real {
    constructor(...args) {
      super(...(args.length ? args : [Real.now() + offset]));
    }
    static now() {
      return Real.now() + offset;
    }
  }
  globalThis.Date = Shifted;
};
const AT = Date.parse("2026-11-15T04:37:00.000Z");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", timezoneId: "America/New_York" });
  await context.addInitScript(() => {
    try {
      if (localStorage.getItem("little-days.with-samples") === null) localStorage.setItem("little-days.with-samples", "0");
      localStorage.setItem("little-days.celebrated", "2026-11-14");
    } catch {}
  });
  await context.addInitScript(shiftClock, AT);
  const page = await context.newPage();
  // 23:37 on Saturday 14 Nov 2026 in New York = 04:37 on 15 Nov in UTC.
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(base);
    await page.waitForSelector(".hero");
    check("准备：浏览器在纽约时区，现在是 11 月 14 日 23:37", (await page.evaluate(() => [new Date().getDate(), new Date().getHours(), new Date().getMinutes() >= 37, new Date().toISOString().slice(0, 10)].join("|"))) === "14|23|true|2026-11-15");
    const A = await newBook(page, "测试A");
    const mine = (await read(page)).books.find((b) => b.title !== "测试A");
    const B = await newBook(page, "测试B");
    const order = await shelfOrder(page);
    let card = await homeCard(page);
    check("1. 首页第一本 = 书架第一本", card.lead === order[0], JSON.stringify({ order, lead: card.lead }));

    // Writing in another journal does not move it to the front on Home.
    await writeIn(page, B, "B的一页");
    card = await homeCard(page);
    check("2. 在别的手帐写一页：首页仍然是书架第一本", card.lead === order[0], JSON.stringify({ order, lead: card.lead, others: card.others }));
    check("2. 其他手帐按书架顺序排在旁边", JSON.stringify(card.others) === JSON.stringify(order.slice(1, 3)), JSON.stringify(card.others));

    // CAP-022: the page written at 23:37 belongs to 14 Nov; Home says 「今天」, never 15 Nov.
    const s1 = await read(page);
    const bDay = s1.entries.find((e) => (e.moments || []).some((m) => m.bookId === B) || e.bookId === B);
    const bPage = (bDay.moments || []).find((m) => m.bookId === B) || bDay;
    check("CAP-022 · 记录日期是本地的 11 月 14 日", bDay.date === "2026-11-14", bDay.date);
    check("CAP-022 · 保存的修改时间是 UTC（04:37Z），没有改格式", String(bPage.updatedAt || "").startsWith("2026-11-15T04:37"), String(bPage.updatedAt));

    // Put B first on the shelf: Home follows; after reopening the App too.
    for (let i = 0; i < 6; i++) await step(page, B, -1);
    const order2 = await shelfOrder(page);
    check("3. 书架上把「测试B」移到第一本", order2[0] === "测试B", JSON.stringify(order2));
    card = await homeCard(page);
    check("3. 首页跟着变成「测试B」", card.lead === "测试B", card.lead);
    check("CAP-022 · 首页写「今天」，不是「11月15日」", /今天/.test(card.meta) && !/15/.test(card.meta), card.meta);
    await page.reload();
    await page.waitForSelector(".hero");
    card = await homeCard(page);
    check("4. 重新打开 App：书架顺序和首页都不变", card.lead === "测试B" && JSON.stringify(await shelfOrder(page)) === JSON.stringify(order2), JSON.stringify({ lead: card.lead }));

    // Editing the cover of another journal does not move it.
    await openBook(page, A);
    await page.locator(`[data-action="edit-book"][data-book="${A}"]`).click();
    await page.waitForSelector("#form-dialog[open]");
    await page.locator('#form-dialog input[name="title"]').fill("测试A改名");
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(400);
    card = await homeCard(page);
    check("5. 改另一本的名字 / 封面：首页仍然是「测试B」", card.lead === "测试B", card.lead);

    // An empty journal first, then deleted: the next one on the shelf leads.
    const C = await newBook(page, "测试C");
    for (let i = 0; i < 7; i++) await step(page, C, -1);
    card = await homeCard(page);
    check("6. 空手帐「测试C」在第一本：首页是它（0 天 · 0 页，从这本开始）", card.lead === "测试C" && /0 天/.test(card.meta), JSON.stringify(card));
    await SS.goTab(page, "books");
    if (!(await page.locator(`.pulled-book [data-action="shelf-menu"][data-book="${C}"]`).count())) await page.locator(`.bookshelf .spine[data-book="${C}"]`).click();
    await page.locator(`.pulled-book [data-action="shelf-menu"][data-book="${C}"]`).click();
    await page.locator(`#choose-dialog [data-action="shelf-delete"][data-book="${C}"]`).click();
    await page.locator("#confirm-dialog[open] #confirm-ok").click();
    await page.waitForTimeout(500);
    card = await homeCard(page);
    const order3 = await shelfOrder(page);
    check("7. 删除第一本：首页自动换成新的第一本", !order3.includes("测试C") && card.lead === order3[0], JSON.stringify({ order3, lead: card.lead }));

    // Nothing about any page changed: dates, books, words.
    const s2 = await read(page);
    const pages = (s) => s.entries.flatMap((e) => (e.moments || []).map((m) => `${e.date}|${m.bookId || e.bookId}|${m.id}`)).sort();
    check("8. 排序和首页的变化没有改动任何一页的日期和归属", JSON.stringify(pages(s2)) === JSON.stringify(pages(s1)), `${pages(s2).length}`);
    check("8. 「我的手帐」还在", s2.books.some((b) => b.id === mine.id));
    check("没有页面错误", errors.length === 0, errors.join(" | "));

    // Empty shelf: Home shows the empty state (a fresh profile without books).
    const p2 = await context.newPage();
      await p2.goto(base);
    await p2.waitForSelector(".hero");
    await p2.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      // Only for this check: a journal state without books (synthetic, this test's own browser).
      s.books = [];
      s.entries = [];
      s.drafts = {};
      localStorage.setItem("little-days.v1", JSON.stringify(s));
      localStorage.setItem("little-days.v1-mirror", "on");
    });
    await p2.evaluate(async () => {
      const req = indexedDB.open("little-days-meta");
      await new Promise((ok) => (req.onsuccess = ok));
      const db = req.result;
      await new Promise((ok) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(localStorage.getItem("little-days.v1"), "little-days.v1");
        tx.oncomplete = ok;
      });
      db.close();
    });
    await p2.reload();
    await p2.waitForSelector(".hero");
    const emptyCard = await homeCard(p2);
    check("9. 书架为空：首页显示空状态，没有错误", emptyCard.empty, JSON.stringify(emptyCard));
    await p2.close();
  } finally {
    await browser.close();
  }
  console.log(`\nv174: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
