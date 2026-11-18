// V10.79 · Two editing flows, synthetic journals only.
// Task 1 — which journal a page goes into:
//   A  two journals (B empty): Home 照片手帐 → 2 photos → choose B → saved;
//      B has the new page, A has nothing new and nothing overwritten.
//   B  choose A, then 放进 → B in the editor: photos, words, date, layout and
//      background stay; saved only into B.
//   C  closing the sheet keeps the photos, no editor, nothing written; the
//      next 照片手帐 brings the same photos back (no photo picker).
//   D  a new page from inside A's book page: A, no sheet; 放进 shows A.
//   E  an existing page of A edited and moved to B: the same page (id and
//      content) in B, not in A, not copied; A's other page and B's page as
//      they were. Closing the sheet changes nothing.
//   + one journal: straight into the editor, 放进 · its name; no journal:
//     the usual new-journal form, then the editor with the same photos;
//     closing the form keeps them. Shelf order. Long names keep the arrow
//     and the date in view.
// Task 2 — 页面背景: 自定义 → 页面背景 and 添加照片 → 换个页面背景 open the same
//   sheet; previews change nothing (draft, page, other pages); 取消 after
//   several previews leaves the page as it was; 应用 keeps it (and through
//   换个排版, save, reload); photos, words, date and layout stay; no
//   写字 · 改字体 or photo chooser opens from either entry.
// Chromium with touch, emulated phone — not a real iPhone.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const assert = require("node:assert/strict");
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");
const photos = (...names) => names.map((n) => path.join(lib, `LD-photo-${n}.jpg`));

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
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "null"));
const todayOf = (page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const dayOf = (s, date) => s.entries.find((e) => e.date === date) || null;
const bookOfPage = (entry, m) => m.bookId || entry.bookId;
const pagesIn = (s, date, book) => { const e = dayOf(s, date); return e ? e.moments.filter((m) => bookOfPage(e, m) === book) : []; };
const content = (m) => JSON.stringify({ id: m.id, title: m.title || "", layers: (m.layers || []).map((l) => [l.id, l.kind, l.mediaRef || "", l.x, l.y, l.w, l.h]), backdrop: m.backdrop || "", layoutStyle: m.layoutStyle || "", layoutVariant: m.layoutVariant || 0 });

const A = "book-a", B = "book-b";
const book = (id, title) => ({ id, title, description: "", category: "Daily Life", color: "blush", cover: "🌷", coverTemplate: "magazine-jp", coverFont: "hei", fields: [], kind: "mine" });
const layer = (id, text) => ({ id, kind: "text", text, x: 50, y: 40, w: 70, h: 20, scale: 1, rotation: 0 });

async function fresh(browser, { size = { width: 390, height: 844 }, lang = "zh-CN" } = {}) {
  const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, locale: lang });
  await context.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("v183")) {
        sessionStorage.setItem("v183", "1");
        localStorage.setItem("little-days.with-samples", "0");
        localStorage.setItem("little-days.language", l);
        localStorage.setItem("test.keepBookPick", "1");
      }
    } catch {}
  }, lang);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    errors.push(`native dialog: ${d.message()}`);
    d.dismiss();
  });
  await page.goto(base);
  await page.waitForSelector(".hero");
  return { page, context, errors };
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
async function pickPhotos(page, names) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-action="today-photos"]').first().tap()]);
  await chooser.setFiles(photos(...names));
}
const sheetOpen = (page) => page.locator("#choose-dialog[open] .book-pick").count();
const storyOpen = (page) => page.locator('[data-action="story-save"]').count();
async function saveStory(page) {
  await page.locator('[data-action="story-save"]').tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
  await page.waitForTimeout(400);
  await SS.leaveReader(page);
  await page.locator('#navigation [data-page="home"]').click();
  await page.waitForSelector(".hero");
}
async function openBook(page, id) {
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
  await page.locator(`[data-action="pull-book"][data-book="${id}"]`).first().click();
  await page.waitForSelector(".pulled-book, .book-detail-copy");
  if (!(await page.locator(".book-detail-copy").count())) await page.locator('.pulled-book [data-action="book"]').click();
  await page.waitForSelector(".book-detail-copy");
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ============================================================ C + A
    {
      const { page, errors, context } = await fresh(browser);
      const today = await todayOf(page);
      await seed(page, `(s) => {
        s.books = [${JSON.stringify(book(A, "手帐A"))}, ${JSON.stringify(book(B, "空本B"))}];
        s.entries = s.entries.filter((e) => e.date !== "${today}");
        s.entries.push({ id: "e-today", date: "${today}", bookId: "${A}", title: "", body: "", mood: "", layers: [], media: [], fieldValues: {}, status: "complete", createdAt: "2026-11-18T08:00:00.000Z", updatedAt: "2026-11-18T08:00:00.000Z",
          moments: [{ id: "m-a1", bookId: "${A}", title: "A 原有的一页", body: "", time: "08:00", layers: [${JSON.stringify(layer("t-a1", "A 的字"))}], media: [] }] });
        delete s.drafts["${today}"];
      }`);
      const before = await read(page);
      const aBefore = pagesIn(before, today, A).map(content);

      await pickPhotos(page, ["corner-cafe", "cookies"]);
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      check("C · 选完照片先问放进哪本，还没进编辑器", (await storyOpen(page)) === 0);
      const rows = await page.evaluate(() => [...document.querySelectorAll(".bp-book")].map((b) => b.dataset.book));
      check("A · 手帐按书架顺序列出", JSON.stringify(rows) === JSON.stringify([A, B]), JSON.stringify(rows));
      check("A · 没有替人选好（没有 ✓）", (await page.locator(".bp-book.selected").count()) === 0);
      check("C · 面板里有已选的 2 张照片", (await page.locator(".bp-photos img").count()) === 2);
      let s = await read(page);
      check("C · 选手帐之前什么都没写（没有草稿、没有新页）", !s.drafts[today] && dayOf(s, today).moments.length === 1);

      // C · close → photos kept, no editor; again → same photos, no file picker.
      await page.locator("#choose-dialog .book-pick .kp-x").tap();
      await page.waitForTimeout(500);
      check("C · 关掉面板：没有进编辑器", (await storyOpen(page)) === 0 && (await sheetOpen(page)) === 0);
      check("C · 关掉后提示照片还在", /2 张照片还在/.test(await page.locator("#toast").innerText()));
      s = await read(page);
      check("C · 关掉后仍然什么都没写", !s.drafts[today] && dayOf(s, today).moments.length === 1);
      let picker = false;
      page.once("filechooser", () => (picker = true));
      await page.locator('[data-action="today-photos"]').first().tap();
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      await page.waitForTimeout(300);
      check("C · 再点照片手帐：同样 2 张照片回来，不重新选照片", (await page.locator(".bp-photos img").count()) === 2 && !picker);
      check("C · 仍然没有自动进入编辑器", (await storyOpen(page)) === 0);

      // A · choose B (the empty one).
      await page.locator(`.bp-book[data-book="${B}"]`).tap();
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(400);
      check("A · 点了 B 才进编辑器，顶部是「放进 · 空本B」", /空本B/.test(await page.locator(".story-where .sb-name").innerText()));
      await saveStory(page);
      s = await read(page);
      const bNow = pagesIn(s, today, B);
      check("A · B 新增了这一页（2 张照片都在）", bNow.length >= 1 && bNow.flatMap((m) => m.layers.filter((l) => l.kind === "photo" && l.mediaRef && !l.gen)).length === 2, `${bNow.length} pages`);
      check("A · A 没有新增也没有被改", JSON.stringify(pagesIn(s, today, A).map(content)) === JSON.stringify(aBefore));
      check("A · 天的归属没被改（仍是 A）", dayOf(s, today).bookId === A);
      check("A · 记下「上次选的」= B", (await page.evaluate(() => localStorage.getItem("little-days.picked-book"))) === B);

      // The mark is only a mark: next time B is marked, nothing is chosen.
      await pickPhotos(page, ["cookies"]);
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      await page.waitForTimeout(400);
      check("上次选的只做标记：B 有标记，但没有自动进入", (await page.locator(`.bp-book[data-book="${B}"][data-mark="1"]`).count()) === 1 && (await storyOpen(page)) === 0);

      // ============================================================ B
      // choose A, write words, apply a background, then 放进 → B.
      await page.locator(`.bp-book[data-book="${A}"]`).tap();
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(400);
      await SS.storyLines(page, ["换本之前写的字"]);
      await page.waitForTimeout(450);
      await page.locator('.story-bar [data-action="story-custom"]').tap();
      await page.locator('#choose-dialog [data-action="story-bg"]').tap();
      await page.waitForSelector("#choose-dialog[open] .bg-sheet");
      await page.locator('.bg-options [data-backdrop="scene:color-mint"]').tap();
      await page.locator('[data-action="bg-apply"]').tap();
      await page.waitForTimeout(500);
      const draft0 = (await read(page)).drafts[today];
      const made0 = draft0.moments.filter((m) => m.id !== "m-a1" && !pagesIn(s, today, B).some((b) => b.id === m.id));
      check("B · 草稿里这一页先在 A", made0.length >= 1 && made0.every((m) => m.bookId === A));
      await page.locator('.story-where [data-action="story-book"]').tap();
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      check("B · 放进面板里 A 是当前选中（✓）", (await page.locator(`.bp-book.selected[data-book="${A}"] .bp-check`).count()) === 1);
      await page.locator(`.bp-book[data-book="${B}"]`).tap();
      await page.waitForTimeout(500);
      check("B · 顶部改成「放进 · 空本B」", /空本B/.test(await page.locator(".story-where .sb-name").innerText()));
      const draft1 = (await read(page)).drafts[today];
      const made1 = made0.map((m) => draft1.moments.find((x) => x.id === m.id));
      check("B · 换本后：同样的页（id、照片、字、排版、背景都没变）", made1.every(Boolean) && JSON.stringify(made1.map(content)) === JSON.stringify(made0.map(content)));
      check("B · 换本后：字还在、背景还在", made1.some((m) => /换本之前写的字/.test(m.title || "")) && made1.some((m) => m.backdrop === "scene:color-mint"));
      check("B · 换本后：这一页在 B", made1.every((m) => m.bookId === B));
      check("B · 日期没变", draft1.date === today && (await page.locator("[data-story-date]").inputValue()) === today);
      await saveStory(page);
      s = await read(page);
      check("B · 保存后只在 B 新增，A 没有新页", JSON.stringify(pagesIn(s, today, A).map(content)) === JSON.stringify(aBefore) && made0.every((m) => pagesIn(s, today, B).some((x) => x.id === m.id)));
      check("B · 每页只有一份（没有复制）", new Set(dayOf(s, today).moments.map((m) => m.id)).size === dayOf(s, today).moments.length);

      // Double tap on 保存 makes one set of pages.
      await pickPhotos(page, ["corner-cafe"]);
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      await page.locator(`.bp-book[data-book="${B}"]`).tap();
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(400);
      const countBefore = dayOf(await read(page), today).moments.length; // committed day (draft not saved yet)
      await page.evaluate(() => { const b = document.querySelector('[data-action="story-save"]'); b.click(); b.click(); });
      await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
      await page.waitForTimeout(600);
      s = await read(page);
      const ids = dayOf(s, today).moments.map((m) => m.id);
      check("连点两次保存：只多一页，没有重复", ids.length === countBefore + 1 && new Set(ids).size === ids.length, `${countBefore} → ${ids.length}`);
      check("C/A/B · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ============================================================ D + E
    {
      const { page, errors, context } = await fresh(browser);
      const today = await todayOf(page);
      await seed(page, `(s) => {
        s.books = [${JSON.stringify(book(A, "手帐A"))}, ${JSON.stringify(book(B, "手帐B"))}];
        s.entries = s.entries.filter((e) => e.date !== "${today}");
        s.entries.push({ id: "e-today", date: "${today}", bookId: "${A}", title: "", body: "", mood: "", layers: [], media: [], fieldValues: {}, status: "complete", createdAt: "2026-11-18T08:00:00.000Z", updatedAt: "2026-11-18T08:00:00.000Z",
          moments: [
            { id: "m-a1", bookId: "${A}", title: "A 第一页", body: "", time: "08:00", layers: [${JSON.stringify(layer("t-a1", "A1 的字"))}], media: [] },
            { id: "m-a2", title: "A 第二页（跟着天）", body: "", time: "09:00", layers: [${JSON.stringify(layer("t-a2", "A2 的字"))}], media: [] },
            { id: "m-b1", bookId: "${B}", title: "B 原有的页", body: "", time: "10:00", layers: [${JSON.stringify(layer("t-b1", "B1 的字"))}], media: [] }
          ] });
        delete s.drafts["${today}"];
      }`);
      await page.evaluate((b) => localStorage.setItem("little-days.picked-book", b), B); // a different "last chosen"
      const s0 = await read(page);
      const snap = Object.fromEntries(dayOf(s0, today).moments.map((m) => [m.id, content(m)]));

      // D · new page from inside A.
      await openBook(page, A);
      await page.locator('[data-action="book-new-entry"]').click();
      await page.waitForSelector("#journal-canvas");
      await page.waitForTimeout(400);
      check("D · 从 A 内部新建：没有弹出选择面板", (await sheetOpen(page)) === 0);
      check("D · 顶部「放进 · 手帐A」（不是上次选的 B）", /手帐A/.test(await page.locator(".sv-where .sb-name").innerText()));
      check("D · 新页属于 A", await page.evaluate(() => true) && (await page.locator(".sv-where .sb-name").innerText()) === "手帐A");
      // can still change it: open the sheet, close it → nothing changes.
      await page.locator('.sv-where [data-action="page-book"]').tap();
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      check("D · 顶部可以改：面板里 A 是当前（✓）", (await page.locator(`.bp-book.selected[data-book="${A}"]`).count()) === 1);
      await page.locator('#choose-dialog [data-action="book-pick-close"]').last().tap();
      await page.waitForTimeout(300);
      check("D · 关掉面板：仍然放进 A", (await page.locator(".sv-where .sb-name").innerText()) === "手帐A");
      await page.locator('[data-action="studio-back"]').first().click(); // blank page: dropped
      await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 8000 });
      await page.waitForTimeout(500);

      // E · edit A's first page from A's reader, move it to B.
      await page.locator('[data-action="reader-open"]').first().click();
      await page.waitForSelector(".reader-page");
      for (let i = 0; i < 6 && !(await page.locator('[data-action="read-edit"]').count()); i++) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(450);
      }
      await page.locator('[data-action="read-edit"]').first().click();
      await page.waitForSelector("#journal-canvas");
      await page.waitForTimeout(400);
      const editing = await page.evaluate(() => document.querySelector("[data-studio-title]")?.textContent || "");
      check("E · 编辑 A 的页：顶部读的是这页真实的手帐 A（不是上次选的 B）", (await page.locator(".sv-where .sb-name").innerText()) === "手帐A", editing);
      // cancel first: nothing changes
      await page.locator('.sv-where [data-action="page-book"]').tap();
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      await page.locator("#choose-dialog .book-pick .kp-x").tap();
      await page.waitForTimeout(400);
      const afterCancel = await read(page);
      const dCancel = afterCancel.drafts[today] || dayOf(afterCancel, today);
      check("E · 关掉面板（取消）：归属不变", dCancel.moments.every((m) => bookOfPage(dCancel, m) === bookOfPage(dayOf(s0, today), dayOf(s0, today).moments.find((x) => x.id === m.id))));
      const movedId = await page.evaluate(() => document.querySelector("[data-studio-title]") && null);
      // move
      await page.locator('.sv-where [data-action="page-book"]').tap();
      await page.waitForSelector("#choose-dialog[open] .book-pick");
      await page.locator(`.bp-book[data-book="${B}"]`).tap();
      await page.waitForTimeout(500);
      check("E · 改成 B：顶部「放进 · 手帐B」", (await page.locator(".sv-where .sb-name").innerText()) === "手帐B");
      check("E · 提示已放进手帐B", /手帐B/.test(await page.locator("#toast").innerText()));
      await page.locator('[data-action="save-entry"]').first().click();
      await page.waitForTimeout(600);
      if (await page.locator('.exit-sheet [data-action="studio-complete-exit"], .exit-sheet [data-action="studio-draft-exit"]').count())
        await page.locator('.exit-sheet [data-action="studio-complete-exit"], .exit-sheet [data-action="studio-draft-exit"]').first().click();
      await page.waitForFunction(() => !document.querySelector("#journal-canvas"), null, { timeout: 10000 });
      await page.waitForTimeout(600);
      const s1 = await read(page);
      const day1 = dayOf(s1, today);
      const moved = day1.moments.filter((m) => bookOfPage(day1, m) === B && m.id !== "m-b1");
      check("E · 移到 B 的是同一页（同一个 id、内容一样）", moved.length === 1 && moved[0].id === "m-a1" && content(moved[0]) === snap["m-a1"], JSON.stringify(moved.map((m) => m.id)));
      check("E · 没有复制：每个 id 只有一份，总页数不变", day1.moments.length === 3 && new Set(day1.moments.map((m) => m.id)).size === 3);
      check("E · A 不再显示这一页，A 的另一页还在 A", pagesIn(s1, today, A).map((m) => m.id).join() === "m-a2");
      check("E · A 的另一页和 B 原来的页内容不变", content(day1.moments.find((m) => m.id === "m-a2")) === snap["m-a2"] && content(day1.moments.find((m) => m.id === "m-b1")) === snap["m-b1"]);
      const counts = await page.evaluate(async (args) => {
        const P = await import("./js/pages.mjs");
        const st = JSON.parse(localStorage.getItem("little-days.v1"));
        return { a: P.visiblePages(st, { bookId: args.A }).map((p) => p.moment?.id || "cover"), b: P.visiblePages(st, { bookId: args.B }).map((p) => p.moment?.id || "cover") };
      }, { A, B });
      check("E · 书本里：A 只有 m-a2，B 有 m-b1 和 m-a1", counts.a.join() === "m-a2" && counts.b.includes("m-a1") && counts.b.includes("m-b1"), JSON.stringify(counts));

      // The day page (cover) moving never takes the day's other pages along (unit-level rule, in the app).
      const pinned = await page.evaluate(async () => {
        const M = await import("./js/model.mjs");
        const e = { bookId: "x", moments: [{ id: "1" }, { id: "2", bookId: "y" }] };
        M.setPageBook(e, null, "z");
        return JSON.stringify(e);
      });
      check("封面换本：跟着天的其他页留在原来的手帐", pinned === JSON.stringify({ bookId: "z", moments: [{ id: "1", bookId: "x" }, { id: "2", bookId: "y" }] }), pinned);
      check("D/E · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ============================================================ one journal / none / long name
    {
      const { page, errors, context } = await fresh(browser, { size: { width: 375, height: 667 } });
      const today = await todayOf(page);
      await seed(page, `(s) => { s.books = [${JSON.stringify(book(A, "我们一家三口的周末露营与城市散步小日记"))}]; }`);
      await pickPhotos(page, ["corner-cafe"]);
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(400);
      check("只有一本：不弹面板，直接进编辑器", (await sheetOpen(page)) === 0);
      const geo = await page.evaluate(() => {
        const btn = document.querySelector(".story-where .story-book-btn").getBoundingClientRect();
        const caret = document.querySelector(".story-where .sb-caret").getBoundingClientRect();
        const name = document.querySelector(".story-where .sb-name");
        const date = document.querySelector("[data-story-date]").getBoundingClientRect();
        return { caretIn: caret.right <= btn.right + 0.5 && caret.width > 0, cut: name.scrollWidth > name.clientWidth, dateIn: date.right <= innerWidth + 0.5 && date.width > 60, overlap: btn.right > date.left + 0.5 };
      });
      check("长名字：名字截断，选择箭头还在", geo.caretIn && geo.cut, JSON.stringify(geo));
      check("长名字：日期完整可见，不重叠", geo.dateIn && !geo.overlap, JSON.stringify(geo));
      await page.locator('[data-action="story-back"]').tap().catch(() => {});
      await page.waitForTimeout(300);
      if (await page.locator("#confirm-dialog[open] #confirm-ok").count()) await page.locator("#confirm-dialog[open] #confirm-ok").click();
      await context.close();

      // No journal at all.
      const second = await fresh(browser);
      await seed(second.page, `(s) => { s.books = []; }`);
      await pickPhotos(second.page, ["cookies", "corner-cafe"]);
      await second.page.waitForSelector("#form-dialog[open]");
      check("没有手帐：打开新建手帐表单", true);
      await second.page.evaluate(() => document.querySelector("#form-dialog").close());
      await second.page.waitForTimeout(400);
      check("没有手帐：取消新建，照片还在（提示）", /2 张照片还在/.test(await second.page.locator("#toast").innerText()) && (await storyOpen(second.page)) === 0);
      await second.page.locator('[data-action="today-photos"]').first().tap();
      await second.page.waitForSelector("#form-dialog[open]");
      await second.page.locator('#form-dialog input[name="title"]').fill("新手帐C");
      await second.page.locator('#form-dialog button[type="submit"]').first().click();
      await second.page.waitForSelector('[data-action="story-save"]', { timeout: 10000 });
      await second.page.waitForTimeout(400);
      check("没有手帐：建好后直接进编辑器，放进 · 新手帐C", (await second.page.locator(".story-where .sb-name").innerText()) === "新手帐C");
      const st = await read(second.page);
      const draft = st.drafts[await todayOf(second.page)];
      const newId = st.books.find((b) => b.title === "新手帐C")?.id;
      check("没有手帐：同样 2 张照片都在新手帐的页里", draft && draft.moments.filter((m) => m.bookId === newId).flatMap((m) => m.layers.filter((l) => l.kind === "photo" && l.mediaRef && !l.gen)).length === 2);
      check("一本 / 没有手帐 · 没有页面错误", errors.length === 0 && second.errors.length === 0, [...errors, ...second.errors].join(" | "));
      await second.context.close();
    }

    // ============================================================ Task 2 · 页面背景
    {
      const { page, errors, context } = await fresh(browser);
      const today = await todayOf(page);
      await pickPhotos(page, ["corner-cafe"]); // one journal: straight in
      await page.waitForSelector('[data-action="story-save"]');
      await page.waitForTimeout(400);
      await SS.storyLines(page, ["背景测试的字"]);
      await page.waitForTimeout(450);
      const pageNow = async () => {
        const st = await read(page);
        const d = st.drafts[today];
        return d.moments.at(-1);
      };
      const p0 = await pageNow();
      // 自定义 menu
      await page.locator('.story-bar [data-action="story-custom"]').tap();
      await page.waitForSelector("#choose-dialog[open] .story-menu");
      const items = await page.locator(".story-menu .sm-row b").allTextContents();
      check("自定义 菜单里有「页面背景」和「更多编辑」", items.join("|") === "页面背景|更多编辑", items.join("|"));
      await page.locator('#choose-dialog [data-action="story-bg"]').tap();
      await page.waitForSelector("#choose-dialog[open] .bg-sheet");
      await page.waitForTimeout(300);
      check("入口 1（自定义）打开页面背景面板，没有打开写字或照片面板", (await page.locator(".sw-head").count()) === 0 && (await page.locator("#choose-dialog .choose-backdrop[data-action='open-backdrops']").count()) === 0);
      check("应用按钮在没选之前不能点", await page.locator('[data-action="bg-apply"]').isDisabled());
      // preview two, the page itself stays
      await page.locator('.bg-options [data-backdrop="scene:color-peach"]').tap();
      await page.waitForTimeout(200);
      await page.locator('.bg-options [data-backdrop^="photo:"]').first().tap();
      await page.waitForTimeout(250);
      const previewBg = await page.evaluate(() => document.querySelector(".bg-paper .journal-canvas")?.getAttribute("style") || "");
      const p1 = await pageNow();
      check("预览：面板里的小页换了背景", /photo|LD-photo|url\(/.test(previewBg), previewBg.slice(0, 120));
      check("预览期间：真正的页面（草稿）一点没变", content(p1) === content(p0) && (p1.template || "") === (p0.template || ""));
      await page.locator('[data-action="bg-cancel"]').tap();
      await page.waitForTimeout(500);
      const p2 = await pageNow();
      check("连续预览后取消：背景恢复成打开前", content(p2) === content(p0) && (p2.backdrop || "") === (p0.backdrop || ""));
      check("取消后没有弹出「写字 · 改字体」", (await page.locator(".sw-head").count()) === 0);
      // click-through right after a sheet closed is ignored (the iPhone ghost click)
      await page.locator('.story-bar [data-action="story-custom"]').tap();
      await page.waitForSelector("#choose-dialog[open] .story-menu");
      // The made-up click arrives a moment after the tap that closed the sheet.
      await page.evaluate(() => document.querySelector('#choose-dialog [data-action="choose-close"]').click());
      await page.waitForTimeout(120);
      await page.evaluate(() => document.querySelector(".story-canvas").click());
      await page.waitForTimeout(400);
      check("关面板那一下点到页面上：不会误开「写字 · 改字体」", (await page.locator(".sw-head").count()) === 0);
      // apply
      await page.locator('.story-bar [data-action="story-custom"]').tap();
      await page.locator('#choose-dialog [data-action="story-bg"]').tap();
      await page.waitForSelector("#choose-dialog[open] .bg-sheet");
      await page.locator('.bg-options [data-backdrop="scene:color-lavender"]').tap();
      await page.locator('[data-action="bg-apply"]').tap();
      await page.waitForTimeout(500);
      const p3 = await pageNow();
      check("应用：这一页换成新背景", p3.backdrop === "scene:color-lavender");
      check("应用：照片、文字、排版没变", JSON.stringify(p3.layers.map((l) => [l.id, l.kind, l.mediaRef || ""])) === JSON.stringify(p0.layers.map((l) => [l.id, l.kind, l.mediaRef || ""])) && p3.title === p0.title && p3.layoutStyle === p0.layoutStyle);
      await SS.storyNextLayout(page);
      await page.waitForTimeout(400);
      check("换个排版后：选好的背景还在", (await pageNow()).backdrop === "scene:color-lavender");
      await saveStory(page);
      await page.reload();
      await page.waitForSelector(".hero");
      const saved = dayOf(await read(page), today);
      check("保存后重开：背景还在", saved.moments.at(-1).backdrop === "scene:color-lavender" && /背景测试的字/.test(saved.moments.at(-1).title || ""));

      // 入口 2 · Studio 添加照片 → 换个页面背景: the same sheet
      await SS.goTab(page, "studio");
      await page.waitForSelector("#journal-canvas");
      await page.waitForTimeout(300);
      await page.locator('.sv-tools [data-action="add-photos"]').tap();
      await page.waitForSelector('#choose-dialog[open] [data-action="open-backdrops"]');
      await page.locator('[data-action="open-backdrops"]').tap();
      await page.waitForSelector("#choose-dialog[open] .bg-sheet");
      await page.waitForTimeout(300);
      check("入口 2（添加照片 → 换个页面背景）打开同一个页面背景面板", (await page.locator("#choose-dialog .bg-sheet .bg-options .backdrop-picker").count()) === 1 && (await page.locator(".sw-head").count()) === 0 && (await page.locator('#choose-dialog [data-action="choose-photo"], #choose-dialog .photo-browser').count()) === 0);
      const studioPage = async () => { const st = await read(page); const d = st.drafts[today] || dayOf(st, today); return d; };
      const sBefore = JSON.stringify((await studioPage()).moments.map((m) => [m.id, m.backdrop || ""]));
      await page.locator('.bg-options [data-backdrop="scene:color-mint"]').tap();
      await page.locator('.bg-options [data-backdrop="scene:color-peach"]').tap();
      await page.locator('[data-action="bg-cancel"]').tap();
      await page.waitForTimeout(600);
      check("工作室里预览后取消：所有页的背景都没变", JSON.stringify((await studioPage()).moments.map((m) => [m.id, m.backdrop || ""])) === sBefore);
      await page.locator('.sv-tools [data-action="add-photos"]').tap();
      await page.locator('[data-action="open-backdrops"]').tap();
      await page.waitForSelector("#choose-dialog[open] .bg-sheet");
      await page.locator('.bg-options [data-backdrop="scene:color-mint"]').tap();
      await page.locator('[data-action="bg-apply"]').tap();
      await page.waitForTimeout(700);
      const after = await studioPage();
      const changed = after.moments.filter((m, i) => (m.backdrop || "") !== JSON.parse(sBefore)[i]?.[1]);
      check("工作室里应用：只有当前这一页换了背景", changed.length === 1 && changed[0].backdrop === "scene:color-mint", JSON.stringify(changed.map((m) => m.id)));
      await SS.leaveStudio(page);
      await page.reload();
      await page.waitForSelector(".hero");
      const kept = (await read(page));
      const d2 = kept.drafts[today] || dayOf(kept, today);
      check("工作室：退出、重开后背景还在", d2.moments.some((m) => m.id === changed[0]?.id && m.backdrop === "scene:color-mint"));
      check("页面背景 · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
  } catch (error) {
    failures.push(`crashed: ${error.message}`);
    console.log(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})();
