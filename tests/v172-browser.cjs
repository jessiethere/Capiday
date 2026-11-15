// V10.75 · CAP-020 (spines) and CAP-017 (long names, cards and book page).
// Founder's iPhone (IMG_9468): five books on a shelf row, titles with
// Chinese punctuation (「一个书架放五本！」, 「？，3」): marks in odd places,
// cut marks, odd breaks. Spines are now one vertical line (vertical marks,
// "!?" upright, short digits across), cut after a whole character with "…".
// Checked: 1, 3 and 5 books on a row; 320 / 375 / 393 / 430 wide; Chinese,
// English, digits, full- and half-width marks, very long names; after
// creating, saving and reopening. Cards: two lines at most; book page: the
// whole name. Synthetic titles only.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
const TITLES = [
  ["一个书架放五本！", "minimal-linen"],
  ["？", "magazine-jp"],
  ["测试！？", "magazine-jp"],
  ["我的手帐：第一本", "minimal-linen"],
  ["如果我的名字非常长", "magazine-jp"],
  ["第3本!?", "minimal-linen"],
  ["2026 京都 Kyoto 旅行手帐", "magazine-jp"],
  ["The Very Long Summer Road Trip Journal", "minimal-linen"],
  ["「周末」—— 小日子……", "magazine-jp"],
  ["我们一家三口的周末露营与城市散步小日记", "minimal-linen"],
];

// Every spine on the shelf: its words fit, no glyph is cut, the words shown
// are the start of the title (and "…" when cut).
const spines = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".bookshelf .spine[data-book]")].map((spine) => {
      const el = spine.querySelector(".spine-title");
      const box = el.getBoundingClientRect();
      const sb = spine.getBoundingClientRect();
      const shown = el.textContent;
      const full = el.dataset.title;
      let cutGlyph = "";
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode()))
        for (let i = 0; i < n.data.length; i++) {
          if (!n.data[i].trim()) continue;
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const q = r.getBoundingClientRect();
          if (!q.width && !q.height) continue;
          if (q.top < box.top - 1 || q.bottom > box.bottom + 1 || q.left < sb.left - 1 || q.right > sb.right + 1) cutGlyph += n.data[i];
        }
      const cut = el.classList.contains("sp-cut");
      const start = cut ? shown.replace(/…$/, "") : shown;
      const shelf = spine.closest(".shelf-books").getBoundingClientRect();
      return {
        full,
        shown,
        cut,
        prefix: full.startsWith(start) && (!cut || shown.endsWith("…")) && (cut || shown === full),
        cutGlyph,
        fits: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
        onShelf: sb.right <= document.documentElement.clientWidth + 1 && sb.left >= shelf.left - 1,
        font: parseFloat(getComputedStyle(el).fontSize),
        width: Math.round(sb.width),
        mag: spine.classList.contains("mag-spine"),
      };
    }),
  );

async function newBook(page, title, template) {
  await page.locator('[data-action="new-book"]').first().click();
  await page.waitForSelector("#form-dialog[open]");
  await page.locator('#form-dialog input[name="title"]').fill(title);
  if (template !== "magazine-jp") {
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(300);
    await page.locator(`#cover-browser-grid [data-template="${template}"]`).click();
    await page.locator(".cb-done").click();
  }
  await page.locator('#form-dialog button[type="submit"]').first().click();
  await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await SS.goTab(page, "books");
  if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
}
const putBack = async (page) => {
  if (await page.locator('[data-action="put-back"]').count()) await page.locator('[data-action="put-back"]').click();
  await page.waitForTimeout(300);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    // A new journal (only 我的手帐), so the rows are ours to count.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("little-days.with-samples", "0");
      } catch {}
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    const rowCounts = async () => page.evaluate(() => [...document.querySelectorAll(".bookshelf .shelf-books")].map((r) => r.querySelectorAll(".spine[data-book]").length));
    // Some Linux Chromium builds lay out vertical Chinese with almost no
    // advance per character (they overlap). Then spine sizes cannot be
    // measured here: the geometry is checked in the iOS Simulator instead
    // (tools/mac/ios-shelf-check.sh, the iPhone's own fonts).
    const verticalOK = await page.evaluate(() => {
      const el = document.createElement("span");
      el.style.cssText = "writing-mode:vertical-rl;font-size:20px;white-space:nowrap;position:absolute;left:-999px;font-family:-apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif";
      el.textContent = "一个书架放五本";
      document.body.append(el);
      const h = el.getBoundingClientRect().height;
      el.remove();
      return h >= 7 * 20 * 0.9;
    });
    if (!verticalOK) console.log("· 这个浏览器的竖排中文度量不可用：书脊尺寸检查只在 iOS 模拟器里做（tools/mac/ios-shelf-check.sh）");
    const verify = async (label) => {
      await page.waitForTimeout(250);
      const list = await spines(page);
      if (!verticalOK) {
        const marked = list.every((s) => s.full && (s.cut ? s.shown.endsWith("…") : s.shown === s.full) && s.onShelf);
        check(`${label}：${list.length} 本书脊在书架上、文字来自书名（尺寸检查见 iOS 模拟器）`, list.length > 0 && marked);
        return list;
      }
      const bad = list.filter((s) => !s.fits || s.cutGlyph || !s.prefix || !s.onShelf);
      check(`${label}：${list.length} 本书脊，字都完整、在书架上、从开头显示，放不下才用「…」`, list.length > 0 && bad.length === 0, bad.map((s) => `${s.full} → ${s.shown}${s.cutGlyph ? ` cut[${s.cutGlyph}]` : ""}${s.onShelf ? "" : " off-shelf"}${s.fits ? "" : " overflow"}`).join("; "));
      return list;
    };
    // 1 book (我的手帐) + 2 → 3 on the row.
    await verify("1 本");
    for (const [title, tpl] of TITLES.slice(0, 2)) await newBook(page, title, tpl);
    await putBack(page);
    check("一层 3 本", (await rowCounts())[0] === 3, JSON.stringify(await rowCounts()));
    await verify("3 本");
    for (const [title, tpl] of TITLES.slice(2)) await newBook(page, title, tpl);
    await putBack(page);
    const rows = await rowCounts();
    check("5 本一层（满层）", rows[0] === 5 && rows[1] === 5, JSON.stringify(rows));
    const all = await verify("5 本 · 393 宽");
    fs.mkdirSync(process.env.SHOTS || "/tmp", { recursive: true });
    await page.locator(".bookshelf").screenshot({ path: `${process.env.SHOTS || "/tmp"}/shelf-393.png` });
    if (process.env.DEBUG) console.log(await page.evaluate(() => [...document.querySelectorAll(".spine-title")].map((e) => [e.dataset.title.slice(0, 6), e.clientHeight, e.scrollHeight, e.clientWidth, e.scrollWidth, e.closest(".spine").clientHeight].join(" "))));
    // The founder's titles.
    const by = Object.fromEntries(all.map((s) => [s.full, s]));
    if (verticalOK) {
      check("「一个书架放五本！」完整显示（含「！」）", by["一个书架放五本！"].shown === "一个书架放五本！", by["一个书架放五本！"].shown);
      check("「？」「测试！？」完整显示", by["？"].shown === "？" && by["测试！？"].shown === "测试！？");
      check("长名字截断时用「…」", by["我们一家三口的周末露营与城市散步小日记"].cut);
    }
    check("字号没有整体缩小（书脊 13～14px）", all.every((s) => s.font >= 13), all.map((s) => s.font).join(","));
    // Vertical marks: the full-width marks are set vertically (taller than wide
    // or centred in the column), "!?" upright, digits across.
    const marks = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll(".bookshelf .spine-title")) {
        const m = el.querySelector(".sp-up");
        const tcy = el.querySelector(".sp-tcy");
        if (m) out.upright = getComputedStyle(m).textOrientation;
        if (tcy) out.tcy = getComputedStyle(tcy).textCombineUpright;
        out.mode = getComputedStyle(el).writingMode;
      }
      return out;
    });
    check("书脊是竖排；「!?」直立；1～2 位数字纵中横", marks.mode === "vertical-rl" && marks.upright === "upright" && marks.tcy === "all", JSON.stringify(marks));
    // Other phone widths.
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 852 });
      await page.waitForTimeout(400);
      await verify(`5 本 · ${width} 宽`);
      if (width === 320) await page.locator(".bookshelf").screenshot({ path: `${process.env.SHOTS || "/tmp"}/shelf-320.png` });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    // Reopen: the same.
    await page.reload();
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    const again = await verify("重新打开 App");
    check("重新打开后显示一致", JSON.stringify(again.map((s) => s.shown)) === JSON.stringify(all.map((s) => s.shown)));
    check("书脊数据：完整书名保存在 data-title，按钮的无障碍标签里也是完整书名", await page.evaluate(() => [...document.querySelectorAll(".bookshelf .spine[data-book]")].every((s) => s.getAttribute("aria-label").startsWith(s.querySelector(".spine-title").dataset.title))));

    // Cards: two lines at most; book page: the whole name.
    const longId = await page.evaluate(() => [...document.querySelectorAll(".spine[data-book]")].find((s) => s.querySelector(".spine-title").dataset.title.startsWith("我们一家三口")).dataset.book);
    await page.locator(`[data-action="pull-book"][data-book="${longId}"]`).click();
    await page.waitForSelector(".pulled-book");
    const card = await page.evaluate(() => {
      const h = document.querySelector(".pulled-copy h2");
      const lh = parseFloat(getComputedStyle(h).lineHeight);
      const more = document.querySelector(".pulled-more").getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(h);
      const r = [...range.getClientRects()].reduce((a, q) => ({ right: Math.max(a.right, q.right), top: Math.min(a.top, q.top), bottom: Math.max(a.bottom, q.bottom) }), { right: 0, top: 1e9, bottom: 0 });
      return { lines: Math.round(h.clientHeight / lh), clamp: getComputedStyle(h).webkitLineClamp, overlapMore: r.right > more.left && r.top < more.bottom && r.bottom > more.top };
    });
    check("书架卡片：长名字最多两行（超出用「…」），不压到「···」", card.lines <= 2 && card.clamp === "2" && !card.overlapMore, JSON.stringify(card));
    await page.locator('.pulled-book [data-action="book"]').click();
    await page.waitForSelector(".book-detail-copy h2");
    const detail = await page.evaluate(() => {
      const h = document.querySelector(".book-detail-copy h2");
      return { text: h.textContent, full: h.scrollHeight <= h.clientHeight + 1 && h.scrollWidth <= h.clientWidth + 1, inside: h.getBoundingClientRect().right <= document.documentElement.clientWidth };
    });
    check("书本页：完整显示名字，自然换行", detail.text === "我们一家三口的周末露营与城市散步小日记" && detail.full && detail.inside, JSON.stringify(detail));
    // English long name on the book page.
    await SS.goTab(page, "books");
    if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
    const enId = await page.evaluate(() => [...document.querySelectorAll(".spine[data-book]")].find((s) => s.querySelector(".spine-title").dataset.title.startsWith("The Very")).dataset.book);
    await page.locator(`[data-action="pull-book"][data-book="${enId}"]`).click();
    await page.locator(`[data-action="pull-book"][data-book="${enId}"]`).click();
    await page.waitForSelector(".book-detail-copy h2");
    const en = await page.evaluate(() => {
      const h = document.querySelector(".book-detail-copy h2");
      return { text: h.textContent, inside: h.scrollWidth <= h.clientWidth + 1 };
    });
    check("书本页：长英文名完整、不超出宽度", en.text === "The Very Long Summer Road Trip Journal" && en.inside, JSON.stringify(en));
    // Home card.
    await SS.goTab(page, "home");
    const home = await page.evaluate(() => {
      const b = document.querySelector(".lib-now b");
      if (!b) return null;
      return { lines: Math.round(b.clientHeight / parseFloat(getComputedStyle(b).lineHeight)), clamp: getComputedStyle(b).webkitLineClamp };
    });
    if (home) check("首页手帐卡片：名字最多两行", home.lines <= 2 && home.clamp === "2", JSON.stringify(home));
    await context.close();
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv172: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
