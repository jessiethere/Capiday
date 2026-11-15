// V10.74 · CAP-018 (P1, second part): one cover configuration.
// Founder's iPhone (IMG_9467): new book 「看看」, 植物标本 selected — the
// style thumbnail showed a bouquet, the large preview cherry blossoms. The
// thumbnails had kept the photo picked before the name was typed, and the
// example photo of some templates followed the name. Now every view takes
// its photos from one place (coverPhotos), drafts' photos do not follow the
// name, and the photos are kept with the book when it is created or saved.
//  1. choosing a style: the large preview matches the thumbnail at once;
//  2. switching styles: no photo of the previous style stays;
//  3. after 创建 the cover is the same (book page, shelf);
//  4. after reopening the App the cover is the same;
//  5. editing the name never changes the photo (new book and existing book);
//  6. the person's own photo is never replaced by a template's example;
//  + books that existed before keep their covers.
// Synthetic titles and the App's own library photos only.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const image = `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-frost.jpg`;

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
// The photos a cover shows (library id or "own" for an uploaded one).
const photos = (page, sel) =>
  page.evaluate((s) => {
    const cover = document.querySelector(s);
    if (!cover) return null;
    return [...cover.querySelectorAll("img.cv-photo, img.mag-photo, img.cover-photo")].map((i) => {
      const src = i.getAttribute("src") || "";
      return src.includes("LD-photo-") ? src.split("LD-photo-").pop().replace(".jpg", "") : src.startsWith("blob:") || src.startsWith("data:") ? "own" : src;
    }).join("+");
  }, sel);
const thumb = (tpl) => `#dialog-form .cover-option[data-template="${tpl}"] .book-cover`;
const BIG = "#book-cover-preview .book-cover";
const BROWSER_BIG = "#cover-browser-preview .book-cover";
const pick = async (page, tpl) => {
  await page.locator(`#dialog-form .cover-option[data-template="${tpl}"]`).first().click();
  await page.waitForTimeout(250);
};
const typeName = async (page, name) => {
  await page.locator('#form-dialog input[name="title"]').fill(name);
  await page.waitForTimeout(250);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    // Existing books: their covers now (to compare at the end).
    const existing = await page.evaluate(() => [...document.querySelectorAll("[data-action='pull-book']")].map((b) => b.dataset.book));
    const coverOf = async (id) => {
      await SS.goTab(page, "books");
      if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();
      await page.locator(`[data-action="pull-book"][data-book="${id}"]`).first().click();
      await page.waitForSelector(".pulled-book, .book-detail-copy");
      return photos(page, ".pulled-book .book-cover, .book-detail-showcase .book-cover");
    };
    const before = {};
    for (const id of existing) before[id] = await coverOf(id);
    await SS.goTab(page, "books");
    if (await page.locator('[data-action="all-books"]').count()) await page.locator('[data-action="all-books"]').click();

    // ── The Founder's case: 「看看」, 植物标本.
    await page.locator('[data-action="new-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    await typeName(page, "看看");
    await pick(page, "botanical-herbarium");
    const t1 = await photos(page, thumb("botanical-herbarium"));
    const b1 = await photos(page, BIG);
    check("1. 选择「植物标本」：大预览和缩略图是同一张（IMG_9467）", t1 && t1 === b1, `${t1} / ${b1}`);
    // Every featured style: choose it → the large preview equals its thumbnail.
    const featured = await page.evaluate(() => [...document.querySelectorAll("#dialog-form .cover-featured .cover-option")].map((o) => o.dataset.template));
    let same = 0;
    const off = [];
    for (const tpl of featured) {
      const t = await photos(page, thumb(tpl));
      await pick(page, tpl);
      const b = await photos(page, BIG);
      if (t === b) same++;
      else off.push(`${tpl}: ${t} ≠ ${b}`);
    }
    check(`1. 封面风格里每个样式：选中后大预览立即和缩略图一致（${featured.length} 个）`, same === featured.length, off.join("; "));

    // 2. Switching styles: no photo of the previous style stays.
    await pick(page, "pet-tag").catch(() => {});
    if (!(await page.locator(thumb("pet-tag")).count())) {
      await page.locator('[data-action="cover-browse"]').first().click();
      await page.waitForTimeout(500);
      await page.locator('#cover-browser-grid [data-template="pet-tag"]').click();
      await page.waitForTimeout(300);
      await page.locator(".cb-done").click();
      await page.waitForTimeout(300);
    }
    const dog = await photos(page, BIG);
    await pick(page, "botanical-herbarium");
    const flower = await photos(page, BIG);
    check("2. 从「毛孩子名牌」切到「植物标本」：不再是狗狗的照片", flower === t1 && flower !== dog, `${dog} → ${flower}`);

    // 5. Typing names never changes the photos (thumbnails and preview).
    const snap = async () => JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("#dialog-form .cover-option")].map((o) => o.dataset.template)).then(async (tpls) => Promise.all([...tpls.map((tpl) => photos(page, thumb(tpl))), photos(page, BIG)])));
    const s0 = await snap();
    for (const name of ["我家的猫", "去旅行", "Weekend Food Diary", "看看"]) await typeName(page, name);
    check("5. 依次输入「我家的猫」「去旅行」等名字：缩略图和大预览的照片都没变", (await snap()) === s0);
    // In 选择封面 too.
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('#cover-browser-grid [data-template="magazine-jp"]').click();
    await page.waitForTimeout(300);
    const g = await photos(page, '#cover-browser-grid [data-template="magazine-jp"] .book-cover');
    const gb = await photos(page, BROWSER_BIG);
    check("1. 「查看更多封面」：选中的样式和大预览一致", g === gb, `${g} / ${gb}`);
    await page.locator('#cover-browser-grid [data-template="botanical-herbarium"]').click();
    await page.waitForTimeout(300);
    await page.locator(".cb-done").click();
    await page.waitForTimeout(300);
    check("回到表单：仍是「植物标本」那张", (await photos(page, BIG)) === t1);

    // 3. Create: the book page and the shelf show the same.
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(800);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).books.at(-1));
    check("3. 保存的是植物标本，示例照片随书保存", saved.coverTemplate === "botanical-herbarium" && !saved.coverImage && saved.coverSample?.template === "botanical-herbarium" && saved.coverSample.photos[0] === `photo:${t1}`, JSON.stringify(saved.coverSample));
    check("草稿标记没有被保存", !("coverDraft" in saved) && !("pendingId" in saved));
    check("3. 创建后书本页：同一张", (await photos(page, ".book-detail-showcase .book-cover")) === t1);
    const shelf = await coverOf(saved.id);
    check("3. 书架：同一张", shelf === t1, shelf);

    // 4. Reopen the App.
    await page.reload();
    await page.waitForSelector(".hero");
    check("4. 重新打开 App：书架上同一张", (await coverOf(saved.id)) === t1);

    // 5. Editing an existing book's name keeps its photo.
    await page.locator('.pulled-book [data-action="book"]').click();
    await page.waitForSelector(".book-detail-copy");
    await page.locator('[data-action="edit-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    check("编辑：大预览、缩略图都是同一张", (await photos(page, BIG)) === t1 && (await photos(page, thumb("botanical-herbarium"))) === t1);
    await typeName(page, "看看我家的猫");
    check("5. 编辑时改名字：照片不变", (await photos(page, BIG)) === t1);
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
    await page.waitForTimeout(600);
    check("5. 改名保存后：书本页仍是同一张", (await photos(page, ".book-detail-showcase .book-cover")) === t1);

    // 6. The person's own photo: never replaced by an example.
    await page.locator('[data-action="edit-book"]').first().click();
    await page.waitForSelector("#form-dialog[open]");
    await page.locator('[data-action="cover-browse"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('#cover-browser-photos [data-action="cover-photo"]').first().click();
    await page.locator("#attachment-image-input").setInputFiles(image);
    await page.waitForFunction(() => (document.querySelector("#cover-browser-preview img.cv-photo")?.getAttribute("src") || "").match(/^(blob|data):/), null, { timeout: 10000 });
    let ownEverywhere = true;
    const notOwn = [];
    for (const tpl of ["pet-tag", "magazine-jp", "everyday-polaroid", "magazine-collage", "cafe-receipt"]) {
      await page.locator(`#cover-browser-grid [data-template="${tpl}"]`).click();
      await page.waitForTimeout(250);
      const p = await photos(page, BROWSER_BIG);
      const t = await photos(page, `#cover-browser-grid [data-template="${tpl}"] .book-cover`);
      if (!p.split("+").includes("own") || t !== p) {
        ownEverywhere = false;
        notOwn.push(`${tpl}: ${p} / ${t}`);
      }
    }
    check("6. 上传自己的照片后换样式：每个样式都用自己的照片，缩略图和大预览一致", ownEverywhere, notOwn.join("; "));
    await page.locator('#cover-browser-grid [data-template="pet-tag"]').click();
    await page.waitForTimeout(250);
    await page.locator(".cb-done").click();
    await page.locator('#form-dialog button[type="submit"]').first().click();
    await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const withOwn = await page.evaluate((id) => JSON.parse(localStorage.getItem("little-days.v1")).books.find((b) => b.id === id), saved.id);
    check("6. 保存：封面是自己的照片（media:），没有示例照片要保存", withOwn.coverImage?.startsWith("media:") && withOwn.coverTemplate === "pet-tag" && !withOwn.coverSample, `${withOwn.coverImage} ${JSON.stringify(withOwn.coverSample)}`);
    check("6. 书本页：自己的照片", (await photos(page, ".book-detail-showcase .book-cover")) === "own");
    await page.reload();
    await page.waitForSelector(".hero");
    await SS.goTab(page, "books");
    check("6. 重新打开 App：仍是自己的照片", (await coverOf(saved.id)).startsWith("own"));

    // + Existing books keep their covers (also after being opened and saved unchanged).
    const after = {};
    for (const id of existing) after[id] = await coverOf(id);
    check("已有手帐本的封面没有变", existing.every((id) => after[id] === before[id]), JSON.stringify({ before, after }));
    if (existing[0]) {
      await page.locator(".pulled-book [data-action='book'], .book-detail-showcase").first().click().catch(() => {});
      await page.waitForSelector(".book-detail-copy");
      await page.locator('[data-action="edit-book"]').first().click();
      await page.waitForSelector("#form-dialog[open]");
      await page.locator('#form-dialog button[type="submit"]').first().click();
      await page.waitForFunction(() => !document.querySelector("#form-dialog[open]"), null, { timeout: 10000 });
      await page.waitForTimeout(500);
      const reopened = await coverOf(existing.at(-1));
      check("已有手帐本打开编辑、不改直接保存：封面不变", reopened === before[existing.at(-1)], `${before[existing.at(-1)]} → ${reopened}`);
    }
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv171: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
