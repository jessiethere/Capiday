// V10.73 · Alpha Stabilization · cover system.
// CAP-018 (P1): the cover chosen in 选择封面 is the cover the book gets — the
//   same example photo in the picker, the preview, the book page, the shelf
//   and after reopening; the sample photo is said to be an example.
// CAP-017 (P2): long titles fit every cover template (picker, preview, book
//   page, shelf): no character cut off, hidden or running into the cover's
//   other words or decorations; no single character left alone on a line.
// CAP-019 (P2): new books start with 黑体; books that exist keep their font.
// Synthetic titles and the App's own library photos only.
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
const HEI = /PingFang|Hiragino Sans|YaHei|Noto Sans SC|Source Han Sans/;
const TITLES = ["如果我的名字非常长", "我们一家三口的周末露营与城市散步小日记", "My Little Notebook", "The Very Long Summer Road Trip Journal", "2026 京都 Kyoto 旅行手帐", "猫"];

const photoOf = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((i) => i.getAttribute("src").split("/").pop()).join(","), sel);
// Every cover title in `sel`: fits (fully seen, touching nothing), its words,
// a lone last character, shortened with "…".
const titlesIn = (page, sel) =>
  page.evaluate(async (s) => {
    const fit = await import("./js/cover-fit.mjs");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return [...document.querySelectorAll(s)].map((cover) => {
      const el = cover.querySelector(".cover-title, .cv-title");
      const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode()))
        for (let i = 0; i < n.data.length; i++) {
          if (!n.data[i].trim()) continue;
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          rects.push({ c: n.data[i], t: Math.round(b.top) });
        }
      const lines = [];
      for (const q of rects) {
        const line = lines.find((L) => Math.abs(L.t - q.t) < 3);
        if (line) line.c.push(q.c);
        else lines.push({ t: q.t, c: [q.c] });
      }
      const last = lines.at(-1)?.c || [];
      const lone = !el.classList.contains("mag-vertical") && lines.length > 1 && last.length === 1 && /[㐀-鿿]/.test(last[0]);
      return { tpl: cover.closest("[data-template]")?.dataset.template || [...cover.classList].find((c) => c.startsWith("cover-") && c !== "cover-theme"), fits: fit.titleFits(el), text: el.textContent, lone, cut: el.classList.contains("fit-cut"), font: parseFloat(getComputedStyle(el).fontSize), family: getComputedStyle(el).fontFamily };
    });
  }, sel);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "null")?.books?.map((b) => [b.id, b.coverFont ?? null]) || null);

    // ── CAP-019: a new book starts with 黑体.
    await page.locator('[data-action="new-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    const startFont = await page.evaluate(() => ({ value: document.querySelector('#dialog-form [name="coverFont"]').value, checked: document.querySelector('#dialog-form .cover-font[aria-checked="true"]')?.dataset.font }));
    check("CAP-019：新建手帐默认字体是黑体", startFont.value === "hei" && startFont.checked === "hei", JSON.stringify(startFont));

    // ── CAP-018: choose 毛孩子名牌 in 选择封面.
    await page.locator('#form-dialog input[name="title"]').fill("如果我的名字非常长");
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('#cover-browser-grid [data-template="pet-tag"]').click();
    await page.waitForTimeout(400);
    const inGrid = await photoOf(page, '#cover-browser-grid [data-template="pet-tag"] img.cv-photo');
    const inBig = await photoOf(page, "#cover-browser-preview img.cv-photo");
    const note = await page.evaluate(() => [...document.querySelectorAll("[data-cover-sample-note]")].map((n) => !n.hidden));
    check("选择封面：网格和大预览是同一张示例照片", inGrid && inGrid === inBig, inGrid);
    check("示例照片有说明（是示例，创建后保持这一张）", note.length >= 1 && note.every(Boolean));
    // Titles in the picker grid fit.
    const gridTitles = await titlesIn(page, "#cover-browser-grid .cover-option .book-cover");
    check("CAP-017：选择封面里每个模板的长标题都完整显示", gridTitles.length >= 20 && gridTitles.every((x) => x.fits && x.text === "如果我的名字非常长" && !x.lone && !x.cut), gridTitles.filter((x) => !x.fits || x.lone || x.cut).map((x) => x.tpl).join(","));
    await page.locator(".cb-done").click();
    await page.waitForTimeout(300);
    const inForm = await photoOf(page, "#book-cover-preview img.cv-photo");
    check("回到表单：预览仍是同一张", inForm === inGrid, inForm);
    // Changing the title does not change the photo of a 毛孩子 cover.
    await page.locator('#form-dialog input[name="title"]').fill("如果我的名字非常长 ");
    await page.locator('#form-dialog input[name="title"]').fill("如果我的名字非常长");
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(800);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.at(-1));
    check("保存的是所选模板（pet-tag），没有被换成别的照片", saved.coverTemplate === "pet-tag" && !saved.coverImage, `${saved.coverTemplate} ${saved.coverImage || "(example)"}`);
    check("CAP-019：保存的字体是黑体", saved.coverFont === "hei", saved.coverFont);
    const inDetail = await photoOf(page, ".book-detail-showcase img.cv-photo");
    check("创建后书本页：和选择时同一张照片", inDetail === inGrid, `${inGrid} → ${inDetail}`);
    const detailTitle = (await titlesIn(page, ".book-detail-showcase .book-cover"))[0];
    check("书本页：标题完整、用黑体", detailTitle.fits && !detailTitle.lone && HEI.test(detailTitle.family), `${detailTitle.font}px ${detailTitle.family.slice(0, 30)}`);
    // Shelf.
    await page.locator('[data-action="all-books"]').click();
    await page.locator(`[data-action="pull-book"][data-book="${saved.id}"]`).first().click();
    await page.waitForSelector(".pulled-book");
    const inShelf = await photoOf(page, ".pulled-book img.cv-photo");
    check("书架：同一张照片", inShelf === inGrid, inShelf);
    const shelfTitle = (await titlesIn(page, ".pulled-book .book-cover"))[0];
    check("书架：标题完整、用黑体", shelfTitle.fits && HEI.test(shelfTitle.family));
    // Reopen the App.
    await page.reload();
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    await page.locator(`[data-action="pull-book"][data-book="${saved.id}"]`).first().click();
    await page.waitForSelector(".pulled-book");
    await page.locator('.pulled-book [data-action="book"]').click();
    await page.waitForSelector(".book-detail-showcase");
    check("重新打开 App：同一张照片", (await photoOf(page, ".book-detail-showcase img.cv-photo")) === inGrid);
    // Edit: the picker shows the same photo; choosing a library photo makes it the book's own.
    await page.locator('[data-action="edit-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    check("编辑：预览仍是同一张", (await photoOf(page, "#book-cover-preview img.cv-photo")) === inGrid);
    const fontEdit = await page.evaluate(() => document.querySelector('#dialog-form [name="coverFont"]').value);
    check("编辑：字体仍是黑体（不会被改掉）", fontEdit === "hei", fontEdit);
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(600);
    await page.waitForSelector('#cover-browser-photos [data-action="cover-library-photo"]', { timeout: 5000 });
    const pick = page.locator('#cover-browser-photos [data-action="cover-library-photo"]').first();
    {
      await pick.click();
      await page.waitForTimeout(300);
      const noteAfter = await page.evaluate(() => [...document.querySelectorAll("[data-cover-sample-note]")].some((n) => !n.hidden));
      check("选了自己的封面照片：不再标为示例", !noteAfter);
    }
    await page.locator(".cb-back").first().click();
    await page.locator('#form-dialog [data-action="close-dialog"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books);
    check("取消编辑：封面没有变", after.find((b) => b.id === saved.id).coverImage === saved.coverImage && after.find((b) => b.id === saved.id).coverTemplate === "pet-tag");
    // Books that existed before keep their font.
    if (before) check("CAP-019：已有手帐的字体没有被改", before.every(([id, font]) => (after.find((b) => b.id === id)?.coverFont ?? null) === font), JSON.stringify(before));

    // ── CAP-017: every title × every template, picker and form preview.
    await SS.goTab(page, "books");
    for (const title of TITLES) {
      await page.locator('[data-action="new-book"]').first().click();
      await page.waitForSelector("#form-dialog[open]");
      await page.locator('#form-dialog input[name="title"]').fill(title);
      await page.locator('[data-action="cover-browse"]').first().click();
      await page.waitForTimeout(700);
      const list = await titlesIn(page, "#cover-browser-grid .cover-option .book-cover");
      const bad = list.filter((x) => !x.fits || x.lone || x.cut || x.text !== title);
      check(`CAP-017：「${title}」在 ${list.length} 个模板里都完整、不碰到其他元素、没有单字一行`, list.length >= 20 && bad.length === 0, bad.map((x) => `${x.tpl}${x.fits ? "" : " cut"}${x.lone ? " lone" : ""}${x.cut ? " …" : ""}`).join(", "));
      const smallest = Math.min(...list.map((x) => x.font));
      if (process.env.DEBUG) console.log(title, "smallest", smallest);
      await page.locator(".cb-back").first().click();
      await page.waitForTimeout(200);
      const form = (await titlesIn(page, "#book-cover-preview .book-cover"))[0];
      check(`表单预览（日系杂志）：「${title}」完整`, form.fits && !form.cut, `${form.font.toFixed(1)}px`);
      await page.locator('#form-dialog [data-action="close-dialog"]').first().click();
      await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"));
    }
    // A 60-character title (the longest allowed): stays inside the cover, ends with "…".
    await page.locator('[data-action="new-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    const huge = "我们".repeat(30);
    await page.locator('#form-dialog input[name="title"]').fill(huge);
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("#cover-browser-grid .cover-option .book-cover")].filter((cover) => {
        const c = cover.getBoundingClientRect();
        const t = cover.querySelector(".cover-title, .cv-title");
        const r = t.getBoundingClientRect();
        const clip = getComputedStyle(t).overflow !== "visible";
        return !clip && (r.right > c.right + 1 || r.bottom > c.bottom + 1);
      }).length,
    );
    check("60 个字的标题：不会跑到封面外面", overflow === 0, `${overflow}`);
    await page.locator(".cb-back").first().click();
    await page.locator('#form-dialog [data-action="close-dialog"]').first().click();
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv170: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
