// V10.72 · CAP-016 (P1): My Books「写一页」/ 书本页「添加一页」 must write a
// NEW page in that book. Before, both opened today's existing day and moved
// the whole day (and every page without a book of its own) into the book.
// 1. Writing from book A belongs to A;  2. writing from book B belongs to B;
// 3. today's existing day (in 我的手帐) is not opened as the page to write and
//    nothing of it changes (its book, its pages);  4. the saved page shows in
//    the right book (and not in the others);  5. leaving without writing
//    keeps no blank page and changes nothing (also on a blank day).
// Synthetic data only.
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
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
const todayDay = async (page) => {
  const key = today();
  const s = await read(page);
  return { entry: s.entries.find((e) => e.date === key) || null, draft: s.drafts?.[key] || null, books: s.books };
};
const strip = (x) => JSON.parse(JSON.stringify(x ?? null, (k, v) => (k === "updatedAt" ? undefined : v)));

async function newBook(page, title) {
  await SS.goTab(page, "books");
  await page.locator('[data-action="new-book"]').first().click();
  await page.waitForSelector("#form-dialog[open]");
  await page.locator('#form-dialog input[name="title"]').fill(title);
  await page.locator('#form-dialog [data-action="save-book"], #form-dialog button[type="submit"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  return (await read(page)).books.find((b) => b.title === title).id;
}
// From the shelf: pull the book out, 写一页.
async function shelfWrite(page, bookId) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
  if (!(await page.locator(`.pulled-book [data-action="shelf-write"][data-book="${bookId}"]`).count())) await page.locator(`[data-action="pull-book"][data-book="${bookId}"]`).first().click();
  await page.waitForSelector(".pulled-book");
  await page.locator('.pulled-book [data-action="shelf-write"]').click();
  await page.waitForSelector("#journal-canvas");
  await page.waitForTimeout(400);
}
// The book's own page: 添加一页.
async function bookAddPage(page, bookId) {
  await openBook(page, bookId);
  await page.locator('[data-action="book-new-entry"]').click();
  await page.waitForSelector("#journal-canvas");
  await page.waitForTimeout(400);
}
async function openBook(page, bookId) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
  // A second tap on a pulled-out book opens it.
  await page.locator(`[data-action="pull-book"][data-book="${bookId}"]`).first().click();
  await page.waitForSelector(".pulled-book, .book-detail-copy");
  if (!(await page.locator(".book-detail-copy").count())) await page.locator('.pulled-book [data-action="book"]').click();
  await page.waitForSelector(".book-detail-copy");
  await page.waitForTimeout(300);
}
async function typeText(page, words) {
  await page.evaluate(() => document.querySelector('[data-action="layer-deselect"]')?.click());
  await page.locator('.tool-dock [data-action="add-text-layer"]').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(words);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(400);
}
async function back(page) {
  await page.locator('[data-action="studio-back"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 8000 });
  await page.waitForTimeout(800);
}
const textOf = (m) => JSON.stringify([m?.title, m?.body, (m?.layers || []).map((l) => l.text || "")]);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    // A new journal: no sample days, so today starts blank.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("little-days.with-samples", "0");
      } catch {}
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    const A = await newBook(page, "毛孩子测试");
    const B = await newBook(page, "旅行测试");
    const daily = (await read(page)).books.find((b) => b.id === "daily")?.id || (await read(page)).books[0].id;

    // 5a. A blank day: 写一页 then ‹ without writing → nothing is kept.
    await shelfWrite(page, A);
    await back(page);
    let t0 = await todayDay(page);
    check("场景 5（空白的一天）：没写就返回，不留下空白日 / 空白页", !t0.entry && !t0.draft, JSON.stringify({ entry: Boolean(t0.entry), draft: Boolean(t0.draft) }));

    // Today already has a day in 我的手帐 (like the Founder's 6 pages).
    await SS.goTab(page, "home");
    await page.locator('[data-action="today-write"]').first().click();
    await page.waitForSelector("#journal-canvas");
    await typeText(page, "我的手帐原来的一页");
    await back(page);
    const before = await todayDay(page);
    check("准备：今天已经有一页写在「我的手帐」（书架写一页不改首页随手写的默认手帐）", before.entry && before.entry.bookId === daily && before.entry.moments.length >= 1 && before.entry.moments.every((m) => (m.bookId || before.entry.bookId) === daily), `book=${before.entry?.bookId} pages=${before.entry?.moments.map((m) => m.bookId || "-").join(",")}`);
    const oldPages = strip(before.entry.moments);

    // 1. From book A's own page: 添加一页.
    await bookAddPage(page, A);
    const ed1 = await page.evaluate(() => {
      return { canvasText: document.querySelector("#journal-canvas")?.innerText || "", texts: document.querySelectorAll("#journal-canvas .text-layer").length };
    });
    check("场景 3：打开的是一张新的空白页，不是今天原来那一页", !/我的手帐原来的一页/.test(ed1.canvasText) && ed1.texts === 0, JSON.stringify(ed1).slice(0, 80));
    const said = await page.evaluate(() => document.querySelector("#toast")?.textContent || "");
    check("提示写进来源手帐（写进「毛孩子测试」）", /毛孩子测试/.test(said), said);
    // 页面信息 → 记到: the new page is in the source book.
    const bookSel = await page.evaluate(() => {
      const b = document.createElement("button");
      b.dataset.action = "tool";
      b.dataset.tool = "details";
      document.querySelector("#app").append(b);
      b.click();
      b.remove();
      return new Promise((r) => setTimeout(() => r(document.querySelector('select[data-moment-field="bookId"]')?.value || ""), 400));
    });
    check("页面信息「记到」是来源手帐", bookSel === A, bookSel);
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.dataset.action = "tool";
      b.dataset.tool = "details";
      document.querySelector("#app").append(b);
      b.click();
      b.remove();
    });
    await page.waitForTimeout(300);
    if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
    await typeText(page, "毛孩子的新一页");
    await back(page);
    let now = await todayDay(page);
    const pageA = now.entry.moments.find((m) => /毛孩子的新一页/.test(textOf(m)));
    check("场景 1：从 A 写的一页属于 A", pageA?.bookId === A, pageA?.bookId);
    check("场景 3：今天这一天仍属于「我的手帐」", now.entry.bookId === daily, now.entry.bookId);
    check("场景 3：原来的页一页没变（内容、顺序、归属）", JSON.stringify(strip(now.entry.moments.filter((m) => m.id !== pageA.id))) === JSON.stringify(oldPages));
    check("日期是今天", now.entry.date === today());

    // 2. From the shelf: B 写一页.
    await shelfWrite(page, B);
    const ed2 = await page.evaluate(() => ({ canvasText: document.querySelector("#journal-canvas")?.innerText || "", texts: document.querySelectorAll("#journal-canvas .text-layer").length }));
    check("场景 3：书架「写一页」也是一张新的空白页", ed2.texts === 0 && !/毛孩子|原来/.test(ed2.canvasText));
    await typeText(page, "旅行的新一页");
    await back(page);
    now = await todayDay(page);
    const pageB = now.entry.moments.find((m) => /旅行的新一页/.test(textOf(m)));
    check("场景 2：从 B 写的一页属于 B", pageB?.bookId === B, pageB?.bookId);
    check("场景 3：A 的那一页和原来的页都没变", JSON.stringify(strip(now.entry.moments.filter((m) => m.id !== pageB.id))) === JSON.stringify(strip([...before.entry.moments, pageA])) && now.entry.bookId === daily);

    // 5b. Cancel on a day that already has pages: nothing changes, no blank page.
    const snap = strip({ entry: now.entry, draft: now.draft });
    await bookAddPage(page, A);
    await back(page);
    let after = await todayDay(page);
    check("场景 5：添加一页后不写就返回：没有空白页，旧数据不变", JSON.stringify(strip({ entry: after.entry, draft: after.draft })) === JSON.stringify(snap), `pages ${now.entry.moments.length} → ${after.entry.moments.length}`);
    await shelfWrite(page, B);
    await back(page);
    after = await todayDay(page);
    check("场景 5：书架写一页后不写就返回：同样什么都没变", JSON.stringify(strip({ entry: after.entry, draft: after.draft })) === JSON.stringify(snap));

    // 4. Each book shows its own page.
    await page.reload();
    await page.waitForSelector(".hero");
    const view = async (bookId) => {
      await openBook(page, bookId);
      return page.evaluate(() => ({ badge: document.querySelector(".book-detail-copy .badge")?.textContent || "", text: document.querySelector(".day-covers")?.innerText || document.querySelector(".empty")?.innerText || "" }));
    };
    const vA = await view(A);
    const vB = await view(B);
    const vD = await view(daily);
    if (process.env.DEBUG) console.log({ vA, vB, vD });
    check("场景 4：重新打开 App 后，A 里有 1 页（毛孩子的新一页）", /1 页/.test(vA.badge) && !/旅行的新一页|原来的一页/.test(vA.text), vA.badge);
    check("场景 4：B 里有 1 页（旅行的新一页）", /1 页/.test(vB.badge) && !/毛孩子的新一页|原来的一页/.test(vB.badge + vB.text), vB.badge);
    check("场景 4：「我的手帐」只有原来的页", new RegExp(`${before.entry.moments.length} 页`).test(vD.badge) && !/毛孩子的新一页|旅行的新一页/.test(vD.text), vD.badge);
    await context.close();

    // A blank day first written from A is A's day; then 写一页 from B adds
    // B's page and leaves A's day where it is.
    const c2 = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    await c2.addInitScript(() => {
      try {
        localStorage.setItem("little-days.with-samples", "0");
      } catch {}
    });
    const p2 = await c2.newPage();
    p2.on("pageerror", (e) => errors.push(e.message));
    await p2.goto(base);
    await p2.waitForSelector(".hero");
    const A2 = await newBook(p2, "毛孩子测试");
    const B2 = await newBook(p2, "旅行测试");
    await shelfWrite(p2, A2);
    await typeText(p2, "空白日从A写");
    await back(p2);
    const d1 = await todayDay(p2);
    check("空白的一天从 A 写：这一天和这一页都属于 A", d1.entry?.bookId === A2 && d1.entry.moments.every((m) => (m.bookId || d1.entry.bookId) === A2), d1.entry?.bookId);
    const keepA = strip(d1.entry);
    await shelfWrite(p2, B2);
    await typeText(p2, "再从B写");
    await back(p2);
    const d2 = await todayDay(p2);
    const pB = d2.entry.moments.find((m) => /再从B写/.test(textOf(m)));
    const rest = strip({ ...d2.entry, moments: d2.entry.moments.filter((m) => m.id !== pB?.id) });
    check("再从 B 写：新的一页属于 B，A 的这一天一点没变", pB?.bookId === B2 && JSON.stringify(rest) === JSON.stringify(keepA), pB?.bookId);
    await c2.close();
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv169: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
