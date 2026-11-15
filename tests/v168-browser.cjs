// V10.71 · Alpha Stabilization Sprint 01 · fonts (CAP-E001, CAP-E002) and
// sheet buttons (CAP-015). The cover's title font: 黑体 and 宋体 are there,
// every choice is written in its own face, the preview follows at once,
// 取消 keeps the book as it was, the choice is saved and comes back on
// reopening and on the shelf. Main buttons in dialogs match 取消 in size.
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
const openLook = (page) => page.evaluate(() => { const d = document.querySelector('#dialog-form details[data-book-section="look"]'); if (d && !d.open) d.querySelector("summary").click(); });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    await page.locator('[data-action="new-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    const btn = await page.evaluate(() => { const p = document.querySelector('#form-dialog[open] .book-actions .primary, #form-dialog[open] .dialog-actions .primary, #form-dialog[open] button[type="submit"].primary'); return p ? getComputedStyle(p).fontSize : ""; });
    check("CAP-015：新建手帐本的「创建」16px", btn === "16px", btn);
    await page.locator('#form-dialog input[name="title"]').fill("字体测试本");
    await openLook(page);
    await page.waitForTimeout(300);
    const list = await page.evaluate(() => [...document.querySelectorAll("#dialog-form .cover-font")].map((b) => ({ id: b.dataset.font, name: b.querySelector("small").textContent, sample: b.querySelector(".cf-sample").textContent, family: getComputedStyle(b.querySelector(".cf-sample")).fontFamily })));
    check("字体列表里有黑体、宋体（排在最前）", list[0]?.id === "hei" && list[1]?.id === "song" && list[0].name === "黑体" && list[1].name === "宋体", list.slice(0, 2).map((x) => x.name).join(" / "));
    if (process.env.DEBUG) console.log(list.map((x) => x.id + " " + x.family.slice(0, 30)));
    check("每个选项用它自己的字体显示", list.length >= 13 && list.every((x) => (x.id === "hei" ? /PingFang|Hiragino|YaHei|Noto Sans SC/.test(x.family) : x.id === "song" ? /Songti|STSong|SimSun|Noto Serif SC/.test(x.family) : new RegExp(`^"?LD-${x.id}"?,`).test(x.family))), `${list.length} choices`);
    check("中文字体写中文示例，英文字体写英文示例", list.find((x) => x.id === "zh-wenkai")?.sample === "开铺手帐" && list.find((x) => x.id === "elegant")?.sample === "Capiday" && list.find((x) => x.id === "song")?.sample === "开铺手帐");
    // Loading state: never stuck.
    await page.waitForFunction(() => !document.querySelector("#dialog-form .cover-font[data-loading]"), null, { timeout: 15000 });
    check("打包字体加载完后不再显示「加载中」", true);
    // V10.78 · CAP-E003 (Founder): a new book's magazine cover follows the chosen font too,
    // so the old 「用固定的标题字体」 note is not shown for it (older books never picked keep it — tests/v179).
    const tpl0 = await page.evaluate(() => document.querySelector('#dialog-form [name="coverTemplate"]').value);
    const note0 = await page.evaluate(() => !document.querySelector("[data-cover-font-note]").hidden);
    check("新手帐的杂志封面跟随字体：不再提示「用固定的标题字体」", !note0, `${tpl0} note=${note0}`);
    const magFont = await page.evaluate(() => getComputedStyle(document.querySelector("#book-cover-preview .cover-title")).fontFamily);
    check("新手帐的杂志封面标题就是所选的黑体", /PingFang|Hiragino|YaHei|Noto Sans SC/.test(magFont), magFont.slice(0, 40));
    // A style that uses the font (极简亚麻): the note goes away.
    await page.evaluate(() => document.querySelector('#dialog-form .cover-option[data-template="minimal-linen"]')?.click() || document.querySelector('#dialog-form .cover-option:not([data-template^="magazine-"])')?.click());
    await page.waitForTimeout(200);
    const note1 = await page.evaluate(() => ({ hidden: document.querySelector("[data-cover-font-note]").hidden, tpl: document.querySelector('#dialog-form [name="coverTemplate"]').value }));
    check("换成会跟随字体的封面样式：提示消失", note1.hidden && !/^magazine-/.test(note1.tpl), JSON.stringify(note1));
    // Choose 宋体: preview follows.
    await page.locator('#dialog-form .cover-font[data-font="song"]').click();
    await page.waitForTimeout(200);
    // The title on the cover preview (templates place it differently; find it by its words).
    const preview = await page.evaluate(() => { const els = [...document.querySelectorAll("#book-cover-preview *")].filter((e) => e.childElementCount === 0 && e.textContent.trim() === "字体测试本"); return els.map((e) => getComputedStyle(e).fontFamily).join(" | ") || getComputedStyle(document.querySelector("#book-cover-preview .book-cover")).fontFamily; });
    check("选宋体：封面预览立刻变成宋体", /Songti|STSong|SimSun/.test(preview), preview.slice(0, 40));
    const sel = await page.evaluate(() => [...document.querySelectorAll('#dialog-form .cover-font[aria-checked="true"]')].map((b) => b.dataset.font));
    check("只有一个被选中", sel.length === 1 && sel[0] === "song", sel.join(","));
    // Create.
    await page.locator('#form-dialog [data-action="save-book"], #form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(800);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.title === "字体测试本")?.coverFont);
    check("创建后保存的是宋体（只存字体 ID）", saved === "song", saved);
    // Reopen to edit: 宋体 is selected; choose 黑体 then 取消 → still 宋体.
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.title === "字体测试本").id);
    // 编辑 (the same action as the book page's 编辑 and the shelf's ··· → 编辑).
    await page.evaluate((bookId) => {
      const b = document.createElement("button");
      b.dataset.action = "edit-book";
      b.dataset.book = bookId;
      document.querySelector("#app").append(b);
      b.click();
      b.remove();
    }, id);
    await page.waitForSelector("#form-dialog[open]");
    await openLook(page);
    await page.waitForTimeout(200);
    const reopened = await page.evaluate(() => document.querySelector('#dialog-form .cover-font[aria-checked="true"]')?.dataset.font);
    check("重新打开编辑：选中的仍是宋体", reopened === "song", reopened);
    await page.locator('#dialog-form .cover-font[data-font="hei"]').click();
    await page.waitForTimeout(200);
    await page.locator('#form-dialog [value="cancel"], #form-dialog [data-action="dialog-cancel"], #form-dialog .book-actions .secondary').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 5000 });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.title === "字体测试本")?.coverFont);
    check("编辑时换成黑体再取消：仍是宋体", after === "song", after);
    // The shelf / cover uses it.
    await SS.goTab(page, "books");
    await page.waitForTimeout(400);
    const shelf = await page.evaluate(() => { const el = [...document.querySelectorAll(".book-cover *, .spine *, .spine-title")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "字体测试本"); return el ? getComputedStyle(el).fontFamily : "(not on screen)"; });
    check("书架 / 封面上的这本书用宋体", /Songti|STSong|SimSun/.test(shelf), shelf.slice(0, 40));
    await page.reload();
    await page.waitForSelector(".hero");
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.title === "字体测试本")?.coverFont);
    check("重新打开 App：仍是宋体", persisted === "song");
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv168: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
