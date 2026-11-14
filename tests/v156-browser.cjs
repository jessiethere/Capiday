// V10.60 · 页面管理与自由排序 (design round V10.52 §1, approved).
//  1. The reader's ··· starts with 管理页面 (Captain is no longer there); the
//     shelf card's ··· has 管理页面与顺序. One full-screen manager.
//  2. Older books stay in date order; 日期倒序 and 自定义 (↑ ↓ and long-press
//     drag) are saved with 完成 and used by the reader; 取消 changes nothing.
//  3. Switching back to date keeps the custom order for later; a new page
//     joins the end of a custom order without moving the others.
//  4. 选择 → 删除 asks first, removes only those pages and keeps media files.
//  5. A Calendar day: its own pages; 按时间排一次; 完成 reorders that day.
// zh at 390 (iPhone 13). Synthetic pages; library photos as pictures.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const { menu, touchStore } = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await touchStore(page);
    // Three days in the book "daily": d1 (2 pages), d2 (1), d3 (1).
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const photo = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
      const m = (id, time, title, ref) => ({ id, time, title, body: "", tags: [], bookId: "daily", layers: ref ? [photo("p-" + id, ref)] : [], media: [], layoutTemplate: "scrapbook" });
      const day = (date, moments) => ({ id: "e-" + date, date, title: "", body: "", photo: "", bookId: "daily", mood: "", layers: [], media: [], moments, isDemo: false });
      s.entries = s.entries.filter((e) => !["2026-10-01", "2026-10-02", "2026-10-03"].includes(e.date));
      s.entries.push(day("2026-10-01", [m("a", "18:00", "晚饭", "photo:pizza"), m("b", "08:00", "早晨", "photo:latte-art")]), day("2026-10-02", [m("c", "12:00", "午后", "photo:waves")]), day("2026-10-03", [m("d", "09:00", "只写字", "")]));
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
    const keys = () => page.$$eval("#page-manager [data-pm-grid] .pm-card", (els) => els.map((e) => e.dataset.key));
    const mine = (list) => list.filter((k) => k.startsWith("2026-10-0"));
    const openReader = async () => {
      await page.evaluate(() => { const b = document.createElement("button"); b.dataset.action = "home-book-read"; b.dataset.book = "daily"; b.id = "t-read"; document.body.append(b); });
      await page.locator("#t-read").click();
      await page.waitForSelector(".flip-page");
    };

    // 1 · Entries.
    await openReader();
    await page.locator('[data-action="reader-more"]').first().tap();
    await page.waitForSelector('#choose-dialog[open] [data-action="pm-open"]');
    const first = await page.locator("#choose-dialog .s2-more-row").first().getAttribute("data-action");
    assert.equal(first, "pm-open", "管理页面 is the first row");
    // Captain stays, as the last group (after the book's own actions).
    const groups = await page.$$eval("#choose-dialog .reader-menu-group", (els) => els.map((el) => el.classList.contains("reader-keeper")));
    assert.ok(!groups.slice(0, -1).includes(true), "Captain (when shown) is the last group");
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.waitForSelector("#page-manager[open] .pm-card");
    assert.deepEqual(mine(await keys()), ["2026-10-01|a", "2026-10-01|b", "2026-10-02|c", "2026-10-03|d"], "date order (days, then each day's own order)");
    assert.equal(await page.locator('#page-manager [data-order="date"].selected').count(), 1);
    passed.push("reader ··· → 管理页面 first, Captain last; full-screen grid in date order");

    // 2 · 取消 changes nothing; 日期倒序 + 完成 is used by the reader.
    await page.locator('#page-manager [data-order="date-desc"]').tap();
    assert.deepEqual(mine(await keys()).slice(0, 2), ["2026-10-03|d", "2026-10-02|c"]);
    await page.locator('#page-manager [data-action="pm-cancel"]').tap();
    assert.equal((await stored()).books.find((b) => b.id === "daily").pageOrder, undefined, "取消 keeps nothing");
    await page.locator('[data-action="reader-more"]').first().tap();
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.locator('#page-manager [data-order="date-desc"]').tap();
    await page.locator('#page-manager [data-action="pm-done"]').tap();
    await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
    assert.equal((await stored()).books.find((b) => b.id === "daily").pageOrder, "date-desc");
    const readerOrder = await page.evaluate(async () => {
      const mod = await import("./js/pages.mjs");
      return mod.visiblePages(JSON.parse(localStorage.getItem("little-days.v1")), { bookId: "daily" }).map(mod.pageKey).filter((k) => k.startsWith("2026-10-0"));
    });
    assert.deepEqual(readerOrder, ["2026-10-03|d", "2026-10-02|c", "2026-10-01|a", "2026-10-01|b"]);
    passed.push("取消 changes nothing; 日期倒序 + 完成 is saved and the reader follows it");

    // 3 · Custom with ↓ and a long-press drag; switch back to date keeps it.
    await page.locator('[data-action="reader-more"]').first().tap();
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.locator('#page-manager [data-order="date"]').tap();
    await page.locator('#page-manager .pm-card[data-key="2026-10-01|a"] [data-dir="1"]').tap();
    assert.match(await page.locator("#page-manager .pm-notice").innerText(), /自定义/);
    assert.equal(await page.locator('#page-manager [data-order="custom"].selected').count(), 1);
    assert.deepEqual(mine(await keys()), ["2026-10-01|b", "2026-10-01|a", "2026-10-02|c", "2026-10-03|d"]);
    // Drag d before b.
    const from = await page.locator('#page-manager .pm-card[data-key="2026-10-03|d"] .pm-thumb').boundingBox();
    const to = await page.locator('#page-manager .pm-card[data-key="2026-10-01|b"] .pm-thumb').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.move(to.x + 6, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const custom = mine(await keys());
    assert.deepEqual(custom, ["2026-10-03|d", "2026-10-01|b", "2026-10-01|a", "2026-10-02|c"], `long-press drag: ${custom}`);
    await page.locator('#page-manager [data-action="pm-done"]').tap();
    await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
    let book = (await stored()).books.find((b) => b.id === "daily");
    assert.equal(book.pageOrder, "custom");
    assert.deepEqual(mine(book.customOrder), custom);
    // Back to date, then custom again: the custom order is still there.
    await page.locator('[data-action="reader-more"]').first().tap();
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.locator('#page-manager [data-order="date"]').tap();
    await page.locator('#page-manager [data-action="pm-done"]').tap();
    await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
    book = (await stored()).books.find((b) => b.id === "daily");
    assert.equal(book.pageOrder, "date");
    assert.deepEqual(mine(book.customOrder), custom, "the custom order is kept for later");
    await page.locator('[data-action="reader-more"]').first().tap();
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.locator('#page-manager [data-order="custom"]').tap();
    assert.deepEqual(mine(await keys()), custom);
    await page.locator('#page-manager [data-action="pm-done"]').tap();
    await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
    passed.push("↓ switches to 自定义 with a note; long-press drag; saved; date ↔ custom keeps the custom order");

    // A new page joins the end of the custom order.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.entries.find((e) => e.date === "2026-10-02").moments.push({ id: "e", time: "20:00", title: "新的一页", body: "", tags: [], bookId: "daily", layers: [], media: [], layoutTemplate: "scrapbook" });
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    const after = await page.evaluate(async () => {
      const mod = await import("./js/pages.mjs");
      return mod.visiblePages(JSON.parse(localStorage.getItem("little-days.v1")), { bookId: "daily" }).map(mod.pageKey).filter((k) => k.startsWith("2026-10-0"));
    });
    assert.deepEqual(after, [...custom, "2026-10-02|e"], "a new page goes last; the others keep their places");
    passed.push("a new page joins the end of the custom order; nothing else moves");

    // 4 · 选择 → 删除 (asks first; media kept).
    await menu(page, "books");
    await page.locator('[data-action="pull-book"][data-book="daily"]').first().tap();
    await page.locator('.pulled-book [data-action="shelf-menu"]').tap();
    await page.waitForSelector('#choose-dialog[open] [data-action="pm-open"][data-book="daily"]');
    await page.locator('#choose-dialog [data-action="pm-open"]').tap();
    await page.waitForSelector("#page-manager[open] .pm-card");
    await page.locator('#page-manager [data-action="pm-select"]').first().tap();
    await page.locator('#page-manager .pm-card[data-key="2026-10-01|a"] .pm-open').tap();
    assert.match(await page.locator('#page-manager [data-action="pm-delete"]').innerText(), /删除（1）/);
    await page.locator('#page-manager [data-action="pm-delete"]').tap();
    await page.waitForSelector("#confirm-dialog[open]");
    assert.match(await page.locator("#confirm-message").innerText(), /不会被删除/);
    await page.locator("#confirm-ok").tap();
    await page.waitForFunction(() => !document.querySelector('#page-manager .pm-card[data-key="2026-10-01|a"]'));
    const s1 = await stored();
    const d1 = s1.entries.find((e) => e.date === "2026-10-01");
    assert.deepEqual(d1.moments.map((m) => m.id), ["b"], "only that page is gone");
    await page.locator('#page-manager [data-action="pm-cancel"]').tap();
    passed.push("shelf ··· → 管理页面与顺序; 选择 → 删除（1） asks first and removes only that page");

    // 5 · A Calendar day: its pages, 按时间排一次, 完成.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.entries.find((e) => e.date === "2026-10-02").moments.unshift({ id: "f", time: "21:30", title: "晚上", body: "", tags: [], bookId: "daily", layers: [], media: [], layoutTemplate: "scrapbook" });
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    await page.evaluate(() => { const b = document.createElement("button"); b.dataset.action = "pm-open"; b.dataset.date = "2026-10-02"; b.id = "t-day"; document.body.append(b); });
    await page.locator("#t-day").click();
    await page.waitForSelector("#page-manager[open] .pm-card");
    assert.deepEqual(await keys(), ["2026-10-02|f", "2026-10-02|c", "2026-10-02|e"]);
    await page.locator('#page-manager [data-action="pm-bytime"]').tap();
    assert.deepEqual(await keys(), ["2026-10-02|c", "2026-10-02|e", "2026-10-02|f"]);
    await page.locator('#page-manager [data-action="pm-done"]').tap();
    await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
    assert.deepEqual((await stored()).entries.find((e) => e.date === "2026-10-02").moments.map((m) => m.id), ["c", "e", "f"]);
    passed.push("a Calendar day: its own pages; 按时间排一次 + 完成 reorders that day");

    assert.deepEqual(errors, [], errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`V10.60 page manager E2E passed (${passed.length} groups):\n - ${passed.join("\n - ")}`);
  console.log("No page errors.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
