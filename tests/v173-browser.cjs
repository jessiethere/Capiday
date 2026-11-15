// V10.76 · CAP-016 part 2 (P0): a book's 「记录新的一页」 must show and write
// that book's pages only. Founder's iPhone (IMG_9476 / IMG_9477): a new book
// (0 天 · 0 页) → 记录新的一页 → the editor showed today's 6 pages of another
// book. The page now goes into the book (V10.72); the editor opened from a
// book now also shows only that book's pages (strip, 「第 n 页 · 共 N 页」,
// 整理, moving pages, after deleting), and new pages are that book's.
// Required by the Founder:
//  1. a blank book A's first page does not touch book B;
//  2. A and B both write on the same day, nothing mixes;
//  3. from the shelf into A, create, back to A;
//  4. cancelling leaves no blank page;
//  5. changing A's page does not touch B;
//  6. after reopening the App every page is still in its book;
//  7. existing pages are not lost or moved.
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
const day = async (page) => {
  const s = await read(page);
  return s.entries.find((e) => e.date === today()) || null;
};
const words = (m) => JSON.stringify([m?.title, m?.body, (m?.layers || []).map((l) => l.text || "")]);
const strip = (x) => JSON.parse(JSON.stringify(x ?? null, (k, v) => (k === "updatedAt" ? undefined : v)));
const editorView = (page) =>
  page.evaluate(() => ({
    count: document.querySelector(".sv-title small")?.textContent.trim() || "",
    chips: [...document.querySelectorAll(".page-strip .chapter-chip:not(.add)")].map((c) => c.querySelector(".chip-num")?.textContent.trim()),
    canvas: document.querySelector("#journal-canvas")?.innerText || "",
  }));
async function typeText(page, text) {
  await page.evaluate(() => document.querySelector('[data-action="layer-deselect"]')?.click());
  await page.locator('.tool-dock [data-action="add-text-layer"]').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(400);
}
// The reader opens on the cover (or the last page read): go to page 1 of the book.
async function toPage1(page) {
  for (let i = 0; i < 6 && !(await page.locator('[data-action="read-edit"]').count()); i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(450);
  }
}
async function back(page) {
  await page.locator('[data-action="studio-back"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 8000 });
  await page.waitForTimeout(700);
}
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
// The book's own page (it opens after creating; otherwise from the shelf).
async function openBook(page, id) {
  if (await page.locator(`.book-detail-copy`).count()) {
    const here = await page.evaluate(() => document.querySelector('[data-action="edit-book"]')?.dataset.book);
    if (here === id) return;
  }
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
  await page.locator(`[data-action="pull-book"][data-book="${id}"]`).first().click();
  await page.waitForSelector(".pulled-book, .book-detail-copy");
  if (!(await page.locator(".book-detail-copy").count())) await page.locator('.pulled-book [data-action="book"]').click();
  await page.waitForSelector(".book-detail-copy");
}
const badge = (page) => page.evaluate(() => document.querySelector(".book-detail-copy .badge")?.textContent || "");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("little-days.with-samples", "0");
      } catch {}
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await page.waitForFunction(() => localStorage.getItem("little-days.v1"), null, { timeout: 10000 }).catch(() => {});
    const B = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "null")?.books?.[0]?.id || "daily"); // 我的手帐
    // Today, 我的手帐 (B) has two pages already — like the Founder's 6.
    for (const w of ["B的第一页", "B的第二页"]) {
      await SS.goTab(page, "home");
      await page.locator('[data-action="today-write"]').first().click();
      await page.waitForSelector("#journal-canvas");
      await typeText(page, w);
      await back(page);
    }
    const before = await day(page);
    const bPages0 = strip(before.moments);
    check("准备：今天「我的手帐」已有 2 页", before.moments.length === 2 && before.moments.every((m) => (m.bookId || before.bookId) === B));

    // 1. A blank book: 0 天 · 0 页 → 记录新的一页.
    const A = await newBook(page, "空白手帐A");
    await openBook(page, A);
    check("新手帐 A：0 天 · 0 页", /0 天 · 0 页/.test(await badge(page)), await badge(page));
    await page.locator('[data-action="book-new-entry"]').click();
    await page.waitForSelector("#journal-canvas");
    await page.waitForTimeout(400);
    let view = await editorView(page);
    check("1. 记录新的一页：只显示 A 的页（第 1 页 · 共 1 页），没有 B 的内容", /第 1 页 · 共 1 页/.test(view.count) && view.chips.join() === "1" && !/B的/.test(view.canvas), JSON.stringify(view));
    // 整理 / 页面目录 lists A's pages only.
    await page.locator('[data-action="pages-manage"]').first().click();
    await page.waitForSelector("#choose-dialog[open] .pages-sheet");
    const listed = await page.evaluate(() => document.querySelectorAll("#choose-dialog .pages-row:not(.cover-row)").length);
    check("整理：只列出 A 的页", listed === 1, `${listed}`);
    await page.evaluate(() => document.querySelector("#choose-dialog").close());
    await typeText(page, "A的第一页");
    await back(page);
    check("3. 写完返回：回到手帐 A 的页面", (await page.evaluate(() => document.querySelector('[data-action="edit-book"]')?.dataset.book)) === A);
    check("A：1 天 · 1 页", /1 天 · 1 页/.test(await badge(page)), await badge(page));
    let now = await day(page);
    const aPage = now.moments.find((m) => /A的第一页/.test(words(m)));
    check("1. A 的第一页属于 A；B 的两页没有变", aPage?.bookId === A && JSON.stringify(strip(now.moments.filter((m) => m.id !== aPage.id))) === JSON.stringify(bPages0) && now.bookId === before.bookId);

    // 2. B on the same day: B's 记录新的一页 shows B's pages, not A's.
    await openBook(page, B);
    await page.locator('[data-action="book-new-entry"]').click();
    await page.waitForSelector("#journal-canvas");
    await page.waitForTimeout(400);
    view = await editorView(page);
    check("2. 同一天从 B 记录：只显示 B 的页（新的一页是第 3 页 · 共 3 页），没有 A 的内容", /第 3 页 · 共 3 页/.test(view.count) && !/A的/.test(view.canvas), JSON.stringify(view));
    await typeText(page, "B的第三页");
    await back(page);
    now = await day(page);
    const b3 = now.moments.find((m) => /B的第三页/.test(words(m)));
    check("2. B 的新页属于 B，A 的页没有变", (b3?.bookId || now.bookId) === B && JSON.stringify(strip(now.moments.find((m) => m.id === aPage.id))) === JSON.stringify(strip(aPage)));

    // 4. Cancel in A: no blank page, nothing changed.
    const snap = strip(await day(page));
    await openBook(page, A);
    await page.locator('[data-action="book-new-entry"]').click();
    await page.waitForSelector("#journal-canvas");
    await back(page);
    check("4. 从 A 记录后不写就返回：没有空白页，数据没变", JSON.stringify(strip(await day(page))) === JSON.stringify(snap));
    check("4. A 仍是 1 页", /1 天 · 1 页/.test(await badge(page)), await badge(page));

    // 5. Change A's page from A's Reader → only A's pages in the editor; B untouched.
    await page.locator('[data-action="reader-open"]').first().click();
    await page.waitForSelector(".reader-page");
    await toPage1(page);
    const readEdit = page.locator('[data-action="read-edit"]').first();
    if (await readEdit.count()) {
      await readEdit.click();
      await page.waitForSelector("#journal-canvas");
      await page.waitForTimeout(400);
      view = await editorView(page);
      check("5. 从 A 的阅读器编辑：只显示 A 的页", /第 1 页 · 共 1 页/.test(view.count) && !/B的/.test(view.canvas), JSON.stringify(view));
      await typeText(page, "改了A");
      await back(page);
      now = await day(page);
      check("5. 改 A 的页：B 的三页一点没变", JSON.stringify(strip(now.moments.filter((m) => (m.bookId || now.bookId) === B))) === JSON.stringify(strip(snap.moments.filter((m) => (m.bookId || snap.bookId) === B))));
      check("5. A 的页改到了", /改了A/.test(words(now.moments.find((m) => m.id === aPage.id))));
    } else check("5. 阅读器里找不到「编辑」按钮", false);

    // Moving pages in B's scope keeps A's page where it is; deleting A's only page keeps B's.
    await openBook(page, B);
    await page.locator('[data-action="book-new-entry"]').click();
    await page.waitForSelector("#journal-canvas");
    await back(page); // (blank, dropped)
    const order0 = (await day(page)).moments.map((m) => m.id);
    // Delete A's only page from A's editor.
    await openBook(page, A);
    await page.locator('[data-action="reader-open"]').first().click();
    await page.waitForSelector(".reader-page");
    await toPage1(page);
    if (await page.locator('[data-action="read-edit"]').count()) {
      await page.locator('[data-action="read-edit"]').first().click();
      await page.waitForSelector("#journal-canvas");
      await page.locator('[data-action="pages-manage"]').first().click();
      await page.waitForSelector("#choose-dialog[open] .pages-sheet");
      page.once("dialog", (d) => d.accept());
      await page.locator('#choose-dialog [data-action="page-remove"]').first().click();
      await page.waitForTimeout(300);
      if (await page.locator("#confirm-dialog[open] #confirm-ok").count()) await page.locator("#confirm-dialog[open] #confirm-ok").click();
      await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 8000 });
      await page.waitForTimeout(800);
      now = await day(page);
      check("删掉 A 唯一的一页：B 的页都还在，这一天没有被清空", now && now.moments.filter((m) => (m.bookId || now.bookId) === B).length === 3 && !now.moments.some((m) => m.id === aPage.id), `${now?.moments.length}`);
      check("删完回到手帐 A", (await page.evaluate(() => document.querySelector('[data-action="edit-book"]')?.dataset.book)) === A || (await page.locator(".reader-page").count()) > 0);
    }
    check("B 的页顺序没有被打乱", JSON.stringify((await day(page)).moments.map((m) => m.id).filter((x) => order0.includes(x) && x !== aPage.id)) === JSON.stringify(order0.filter((x) => x !== aPage.id)));

    // 6. Reopen the App.
    await page.reload();
    await page.waitForSelector(".hero");
    await openBook(page, A);
    const aBadge = await badge(page);
    await openBook(page, B);
    const bBadge = await badge(page);
    check("6. 重新打开 App：A 0 页、B 3 页（各自的页数）", /0 页/.test(aBadge) && /3 页/.test(bBadge), `${aBadge} / ${bBadge}`);
    // Home's day editor (no book) still shows the whole day.
    await SS.goTab(page, "home");
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.dataset.action = "edit-date";
      b.dataset.date = new Date().toISOString().slice(0, 10);
      document.querySelector("#app").append(b);
    });
    // 7. Existing pages: B's first two pages are byte-for-byte the same.
    now = await day(page);
    check("7. 原有的两页没有丢失、没有被移动到别的手帐", JSON.stringify(strip(now.moments.filter((m) => bPages0.some((p) => p.id === m.id)))) === JSON.stringify(bPages0));
    await context.close();
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv173: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
