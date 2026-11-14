// V10.61 · 日历单日：阅读优先，整理按需 (design round V10.52 §2, approved).
//  1. A day with 4 pages: the first page's content is on the first screen —
//     no list of pages in front of it; 这一天的故事 + a small stats line.
//  2. 目录 (2+ pages) opens a sheet: 01–04, a picture or a paper swatch, time,
//     photos, book; a row jumps to that page; ↗ opens it full screen.
//  3. 整理这一天 opens the page manager for that day.
//  4. Pages of different books carry a small book label (one book: none).
//  5. A day with one page: no 目录; its ··· has 全屏阅读; a draft stays a draft.
// zh at 375×667, en at 430×932. Synthetic pages, library photos as pictures.
// Chromium, emulated phones — not a real iPhone.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const { menu, touchStore, leaveReader } = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    for (const run of [{ lang: "zh", w: 375, h: 667 }, { lang: "en", w: 430, h: 932 }]) {
      const zh = run.lang === "zh";
      const context = await browser.newContext({ viewport: { width: run.w, height: run.h }, isMobile: true, hasTouch: true });
      await context.addInitScript((lang) => localStorage.setItem("little-days.language", lang), zh ? "zh-CN" : "en");
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await touchStore(page);
      // This month, so the Calendar shows them without paging.
      const [dayA, dayB] = await page.evaluate(() => {
        const d = new Date();
        const key = (n) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
        return d.getDate() > 3 ? [key(2), key(3)] : [key(26), key(27)];
      });
      await page.evaluate(([a, b]) => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        const base = s.books.find((book) => book.id === "daily") || s.books[0];
        s.books = s.books.filter((book) => book.id !== "v157-trip");
        s.books.push({ ...base, id: "v157-trip", title: "Kyoto 2026", coverPhoto: "", tags: [] });
        const photo = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
        const words = (id, text) => ({ id, kind: "text", text, x: 50, y: 50, w: 70, h: 20, rotation: 0, scale: 1 });
        const m = (id, time, title, layers, bookId = base.id) => ({ id, time, title, body: "", tags: [], bookId, layers, media: [], layoutTemplate: "scrapbook" });
        const day = (date, moments, extra = {}) => ({ id: "e-" + date, date, title: "", body: "", photo: "", bookId: base.id, mood: "", layers: [], media: [], moments, isDemo: false, ...extra });
        s.entries = s.entries.filter((e) => e.date !== a && e.date !== b);
        delete s.drafts[a];
        delete s.drafts[b];
        s.entries.push(
          day(a, [
            m("v157-1", "08:10", "Morning coffee", [photo("p1", "photo:latte-art")]),
            m("v157-2", "12:30", "", [photo("p2", "photo:brunch"), photo("p2b", "photo:corner-cafe")]),
            m("v157-3", "16:00", "Only words", [words("w3", "A quiet afternoon.")]),
            m("v157-4", "19:45", "Temple at dusk", [photo("p4", "photo:waves")], "v157-trip"),
          ]),
          day(b, [m("v157-5", "21:00", "One page", [photo("p5", "photo:pizza")])], { status: "draft" }),
        );
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      }, [dayA, dayB]);
      await page.reload();
      await page.waitForSelector(".hero");
      const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
      const openDay = async (date) => {
        await menu(page, "calendar");
        await page.locator(`[data-action="select-date"][data-date="${date}"]`).first().tap();
        await page.waitForSelector(".day-detail .moment-chapter");
      };

      // 1 · Reading first.
      await openDay(dayA);
      assert.equal(await page.locator(".day-detail .day-contents, .day-detail .day-pages-head").count(), 0, "no list of pages before the pages");
      assert.equal((await page.locator(".day-story-title").innerText()).trim(), zh ? "这一天的故事" : "The story of this day");
      assert.match(await page.locator(".day-detail .day-stats").innerText(), zh ? /4 页/ : /4 pages/);
      const firstTop = await page.evaluate(() => {
        const scroller = document.getElementById("app-scroll");
        scroller.scrollTop = 0;
        const box = document.querySelector("#moment-v157-1 .chapter-title").getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, h: innerHeight };
      });
      assert.ok(firstTop.bottom < firstTop.h - 40, `page 1's title is on the first screen (${Math.round(firstTop.top)} of ${firstTop.h})`);
      const firstPhoto = await page.evaluate(() => document.querySelector("#moment-v157-1 img")?.getBoundingClientRect().top ?? 9999);
      assert.ok(firstPhoto < firstTop.h, `page 1's photo starts on the first screen (${Math.round(firstPhoto)})`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/v157-day-${run.lang}-${run.w}.png` });
      passed.push(`${run.lang} ${run.w}: a 4-page day opens on page 1 (title at ${Math.round(firstTop.top)} px, photo at ${Math.round(firstPhoto)} px of ${firstTop.h}); 这一天的故事 + a small stats line; no list in front`);

      // 4 · Book labels, as the pages belong to two books.
      const labels = await page.$$eval(".day-detail .chapter-book", (els) => els.map((e) => e.innerText.trim()));
      assert.equal(labels.length, 4, JSON.stringify(labels));
      assert.equal(labels[3], "Kyoto 2026");
      assert.notEqual(labels[0], "Kyoto 2026");
      passed.push(`${run.lang} ${run.w}: pages of two books carry their book's name (${labels.join(" / ")})`);

      // 2 · 目录.
      await page.locator('.day-detail [data-action="day-toc"]').tap();
      await page.waitForSelector("#choose-dialog[open] .day-toc-row");
      const nos = await page.$$eval(".day-toc-no", (els) => els.map((e) => e.innerText.trim()));
      assert.deepEqual(nos, ["01", "02", "03", "04"]);
      assert.equal(await page.locator(".day-toc-thumb img").count(), 3, "three pages with photos have a picture");
      assert.equal(await page.locator(".day-toc-thumb.words").count(), 1, "the words-only page has a paper swatch");
      const lines = await page.$$eval(".day-toc-copy small", (els) => els.map((e) => e.innerText.trim()));
      assert.match(lines[1], zh ? /^12:30 · 2 张照片 · / : /^12:30 · 2 photos · /, lines[1]);
      assert.match(lines[3], /Kyoto 2026$/, lines[3]);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/v157-toc-${run.lang}-${run.w}.png` });
      await page.locator(".day-toc-row").nth(2).tap();
      await page.waitForFunction(() => !document.querySelector("#choose-dialog").open);
      await page.waitForFunction(() => {
        const top = document.querySelector("#moment-v157-3").getBoundingClientRect().top;
        return top > -10 && top < 160;
      }, null, { timeout: 4000 });
      passed.push(`${run.lang} ${run.w}: 目录 lists 01–04 with pictures (a paper swatch for words), time · photos · book; a row jumps to page 03`);

      // ↗ opens the trip page in its own book's reader.
      await page.locator('.day-detail [data-action="day-toc"]').tap();
      await page.locator(".day-toc-read").nth(3).tap();
      await page.waitForSelector("#phone.in-reader");
      await leaveReader(page);
      passed.push(`${run.lang} ${run.w}: ↗ opens a page full screen in its book`);

      // 3 · 整理这一天.
      await openDay(dayA);
      await page.locator('.day-detail [data-action="day-toc"]').tap();
      await page.locator('#choose-dialog [data-action="pm-open"]').tap();
      await page.waitForSelector("#page-manager[open] .pm-card");
      const cards = await page.$$eval("#page-manager .pm-card", (els) => els.map((e) => e.dataset.key));
      assert.deepEqual(cards, ["v157-1", "v157-2", "v157-3", "v157-4"].map((id) => `${dayA}|${id}`));
      await page.locator('#page-manager [data-action="pm-cancel"]').tap();
      await page.waitForFunction(() => !document.querySelector("#page-manager[open]"));
      passed.push(`${run.lang} ${run.w}: 整理这一天 opens the page manager with that day's 4 pages`);

      // 5 · One page, a draft.
      await openDay(dayB);
      assert.equal(await page.locator('.day-detail [data-action="day-toc"]').count(), 0, "one page: no 目录");
      assert.equal(await page.locator(".day-detail .chapter-book").count(), 0, "one book: no label");
      assert.equal(await page.locator(".day-detail .draft-banner.is-draft").count(), 1, "the draft says so");
      await page.locator(".day-detail .chapter-more").tap();
      await page.locator('#choose-dialog [data-action="toc-read"]').tap();
      await page.waitForSelector("#phone.in-reader");
      await leaveReader(page);
      const after = (await stored()).entries.find((e) => e.date === dayB);
      assert.equal(after.status, "draft", "reading does not mark it done");
      passed.push(`${run.lang} ${run.w}: one page — no 目录, no book label; ··· → 全屏阅读 opens it; the draft stays a draft`);

      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
