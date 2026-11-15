// V10.78 · CAP-E003 (Founder: 杂志封面标题跟随所选字体).
// A magazine cover's title uses the chosen font when one was chosen
// (book.coverFontChosen — new books, or an older book once a font is picked).
// Older books that never picked one keep each magazine's own title type, so
// nothing on the shelf changes by itself. Synthetic data only.
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
const SONG = /Songti|STSong|SimSun|Noto Serif SC/;
const openLook = (page) => page.evaluate(() => { const d = document.querySelector('#dialog-form details[data-book-section="look"]'); if (d && !d.open) d.querySelector("summary").click(); });
const TEMPLATES = ["magazine-jp", "magazine-west", "magazine-mono", "magazine-film", "magazine-minimal", "magazine-collage"];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN", hasTouch: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    await page.evaluate((T) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const mk = (id, t, extra = {}) => ({ id, title: "字体测试", category: "Daily Life", color: "blush", coverTemplate: t, coverFont: "song", coverDecoration: "none", coverImage: "", fields: [], visibility: "private", ...extra });
      s.books = [...T.map((t, i) => mk("old" + i, t)), ...T.map((t, i) => mk("new" + i, t, { coverFontChosen: true }))];
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, TEMPLATES);
    await page.reload();
    await page.waitForSelector(".hero");
    const titleFont = async (id) => {
      await SS.openBookPage(page, id);
      await page.waitForSelector(".book-detail-showcase .book-cover .cover-title");
      return page.evaluate(() => getComputedStyle(document.querySelector(".book-detail-showcase .book-cover .cover-title")).fontFamily);
    };
    let follow = 0,
      kept = 0;
    for (let i = 0; i < TEMPLATES.length; i++) {
      if (SONG.test(await titleFont("new" + i))) follow++;
      if (!SONG.test(await titleFont("old" + i))) kept++;
    }
    check("选过字体的：6 种杂志封面的标题都用所选的宋体", follow === 6, `${follow}/6`);
    check("从没选过字体的旧手帐：6 种杂志封面保持原来的标题字体", kept === 6, `${kept}/6`);

    // Edit an older one: the note says the magazine keeps its type; cancel changes nothing.
    await SS.openBookPage(page, "old0");
    await page.locator('[data-action="edit-book"][data-book="old0"]').click();
    await page.waitForSelector("#form-dialog[open]");
    check("旧手帐编辑时：提示杂志封面用自己的标题字体", await page.evaluate(() => !document.querySelector("[data-cover-font-note]").hidden));
    await openLook(page);
    await page.waitForTimeout(200);
    await page.locator('#dialog-form .cover-font[data-font="hei"]').click();
    await page.waitForTimeout(200);
    check("选了字体：提示消失，预览标题立刻跟随", await page.evaluate(() => document.querySelector("[data-cover-font-note]").hidden) && /PingFang|Hiragino|YaHei|Noto Sans SC/.test(await page.evaluate(() => getComputedStyle(document.querySelector("#book-cover-preview .cover-title")).fontFamily)));
    await page.locator('#form-dialog [data-action="close-dialog"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"));
    const s1 = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.id === "old0"));
    check("取消：书没变（没有 coverFontChosen，字体仍是宋体）", !s1.coverFontChosen && s1.coverFont === "song", JSON.stringify({ c: s1.coverFontChosen, f: s1.coverFont }));

    // Pick 宋体 (the same font) and save: from now on the magazine title follows it.
    await page.locator('[data-action="edit-book"][data-book="old0"]').click();
    await page.waitForSelector("#form-dialog[open]");
    await openLook(page);
    await page.waitForTimeout(200);
    await page.locator('#dialog-form .cover-font[data-font="song"]').click();
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.id === "old0"));
    check("保存：记下 coverFontChosen", s2.coverFontChosen === true && s2.coverFont === "song");
    await page.reload();
    await page.waitForSelector(".hero");
    check("重新打开 App：这本的杂志封面标题用宋体", SONG.test(await titleFont("old0")));
    check("其他旧手帐没有被改", !SONG.test(await titleFont("old1")));
    check("没有页面错误", !errors.length, errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`\nv179: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
