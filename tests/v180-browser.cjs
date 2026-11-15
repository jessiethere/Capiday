// V10.78 · CAP-E004 · Reader ··· → this page as a PNG, shared, or as a PDF;
// the whole book as a PDF. Only the page (no reader bar / buttons / progress),
// 4:5, high definition (2160 × 2700), fonts loaded first, never blank; a photo
// that can't be read makes no file; the journal is not changed.
// Synthetic data only (library photo, built-in sticker, typed words).
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
const pngSize = (buf) => ({ sig: buf.slice(1, 4).toString(), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", acceptDownloads: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const L = (o) => ({ x: 50, y: 50, scale: 1, rotation: 0, text: "", ...o });
      s.books.push({ id: "exp", title: "导出测试", category: "Daily Life", color: "blush", coverTemplate: "minimal-linen", coverFont: "hei", coverDecoration: "none", coverImage: "", fields: [], visibility: "private" });
      s.entries.push({
        id: "e-exp", date: "2026-11-10", bookId: "exp", title: "", body: "", photo: "", mood: "", template: "cute", font: "serif", layers: [], media: [], isDemo: false,
        moments: [
          { id: "m-a", time: "09:30", title: "早上的咖啡", body: "中文 and English 混在一起的一句话。", bookId: "exp", tags: [], media: [], layoutTemplate: "scrapbook", layers: [L({ id: "p1", kind: "photo", mediaRef: "photo:coffee-cheers", x: 50, y: 40 }), L({ id: "s1", kind: "sticker", assetId: "bear", x: 80, y: 80 }), L({ id: "t1", kind: "text", text: "长长的文字 Long words · 第二行也要在", font: "handwritten", x: 50, y: 85 })] },
          { id: "m-b", time: "20:00", title: "读不到的照片", body: "", bookId: "exp", tags: [], media: [], layers: [L({ id: "p2", kind: "photo", mediaRef: "media:00000000-0000-4000-8000-0000000000aa" })] },
        ],
      });
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    const before = await page.evaluate(() => localStorage.getItem("little-days.v1"));

    await SS.openBookPage(page, "exp");
    await page.locator('[data-action="reader-open"][data-book="exp"]').first().click();
    await page.waitForSelector(".reader-page");
    for (let i = 0; i < 4 && !(await page.locator('[data-action="read-edit"]').count()); i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
    }
    const more = async () => {
      await page.locator('[data-action="reader-more"]').click();
      await page.waitForSelector("#choose-dialog[open] .reader-export");
    };
    await more();
    const rows = await page.$$eval("#choose-dialog .reader-export button", (b) => b.map((x) => x.textContent.trim()));
    check("··· 里有四项：图片 / 分享 / 这一页 PDF / 整本书 PDF", rows.length === 4 && /图片/.test(rows[0]) && /分享/.test(rows[1]) && /PDF/.test(rows[2]) && /整本书/.test(rows[3]), rows.join(" | "));

    // PNG
    let [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click()]);
    const png = fs.readFileSync(await dl.path());
    if (process.env.SHOTS) fs.writeFileSync(`${process.env.SHOTS}/v180-page.png`, png);
    const ihdr = pngSize(png);
    check("PNG：是一张 PNG", ihdr.sig === "PNG", dl.suggestedFilename());
    check("PNG：高清 2160 × 2700（4:5，不拉伸）", ihdr.w === 2160 && ihdr.h === 2700, `${ihdr.w}×${ihdr.h}`);
    check("PNG：不是空白（文件有实际内容）", png.length > 60000, `${Math.round(png.length / 1024)} KB`);
    check("PNG：文件名带日期", /^Capiday-2026-11-10-1\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    // Not blank, drawn: decode it in the page and compare colours.
    const varied = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 54;
      c.height = 68;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, 54, 68);
      const d = x.getImageData(0, 0, 54, 68).data;
      return new Set(Array.from({ length: d.length / 4 }, (_, i) => (d[i * 4] >> 4) * 256 + (d[i * 4 + 1] >> 4) * 16 + (d[i * 4 + 2] >> 4))).size;
    }, png.toString("base64"));
    check("PNG：照片、贴纸、文字都画上去了（颜色丰富）", varied > 40, `${varied} colours`);
    await page.waitForTimeout(500);

    // PDF
    await more();
    [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#choose-dialog [data-action="page-export"][data-kind="pdf"]').click()]);
    const pdf = fs.readFileSync(await dl.path()).toString("latin1");
    check("PDF：是 PDF", pdf.startsWith("%PDF"));
    check("PDF：只有一页", (pdf.match(/\/Type \/Page\b(?!s)/g) || []).length === 1);
    check("PDF：里面是高清的这一页（2160 × 2700）", /\/Width 2160 \/Height 2700/.test(pdf));
    await page.waitForTimeout(500);

    // Share (this browser cannot share files: it saves instead, as the app's fallback)
    await more();
    [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#choose-dialog [data-action="page-export"][data-kind="share"]').click()]);
    check("分享：不能分享文件的浏览器里改为保存图片", /\.png$/.test(dl.suggestedFilename()));
    await page.waitForTimeout(500);

    // A page whose photo can't be read: no file.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    await more();
    let downloaded = false;
    page.once("download", () => (downloaded = true));
    await page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click();
    await page.waitForFunction(() => /读不到/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 8000 });
    await page.waitForTimeout(800);
    check("照片读不到：提示，不生成文件", !downloaded);

    // Whole book PDF from the same menu.
    await more();
    [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.locator('#choose-dialog [data-action="book-share"][data-book="exp"]').click()]);
    check("整本书 PDF：从阅读器 ··· 也能做", /\.pdf$/.test(dl.suggestedFilename()));

    check("导出前后手帐数据完全一样", (await page.evaluate(() => localStorage.getItem("little-days.v1"))) === before);
    check("没有页面错误", !errors.length, errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`\nv180: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
