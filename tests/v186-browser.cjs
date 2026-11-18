// V10.82 · 把这一页存成图片 → straight into Photos; 分享这一页 keeps the share sheet.
// Synthetic data only (library photos, a built-in sticker, typed words, a
// photo background). Chromium, not an iPhone: the iOS shell's Photos bridge
// (LittleDaysPhotoSaver.swift) is a stand-in here that answers like iOS
// (authorized / denied / a write error) and keeps the PNG it was given; the
// real Photos library is checked in the Simulator (tools/mac/uitest).
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const crypto = require("node:crypto");
const fs = require("node:fs");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

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
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const pngSize = (buf) => ({ sig: buf.slice(1, 4).toString(), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

async function open(browser, { native = true, share = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", acceptDownloads: true, hasTouch: true });
  await context.addInitScript(
    ({ native, share }) => {
      window.__photos = { asked: [], saved: [], plan: "authorized", settings: 0 };
      window.__shared = [];
      if (native) {
        window.capidayFiles = { saveBackup: 1, icloud: 1, photos: 1, savePhoto: 1 };
        window.webkit = {
          messageHandlers: {
            littleDaysSavePhoto: {
              postMessage: (m) => {
                if (m.type === "settings") return window.__photos.settings++;
                window.__photos.asked.push({ id: m.id, name: m.name, length: m.data.length });
                const plan = window.__photos.plan;
                setTimeout(() => {
                  if (plan === "denied") return window.capidayPhotoSaved({ id: m.id, ok: false, reason: "denied", status: "denied", detail: "" });
                  if (plan === "write") return window.capidayPhotoSaved({ id: m.id, ok: false, reason: "write", status: "authorized", detail: "磁盘已满" });
                  window.__photos.saved.push({ name: m.name, data: m.data });
                  window.capidayPhotoSaved({ id: m.id, ok: true, reason: "", status: "authorized", detail: "", bytes: Math.floor((m.data.length * 3) / 4) });
                }, 400);
              },
            },
          },
        };
      }
      if (share) {
        // The system share sheet (navigator.share) — records what it was given.
        navigator.canShare = () => true;
        navigator.share = async ({ files }) => {
          const f = files[0];
          const buf = new Uint8Array(await f.arrayBuffer());
          let s = "";
          for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          window.__shared.push({ name: f.name, type: f.type, data: btoa(s) });
        };
      }
    },
    { native, share },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.goto(base);
  await page.waitForSelector(".hero");
  await SS.touchStore(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const L = (o) => ({ x: 50, y: 50, scale: 1, rotation: 0, text: "", ...o });
    s.books.push({ id: "exp", title: "导出测试", category: "Daily Life", color: "blush", coverTemplate: "minimal-linen", coverFont: "hei", coverDecoration: "none", coverImage: "", fields: [], visibility: "private" });
    s.entries.push({
      id: "e-exp", date: "2026-11-17", bookId: "exp", title: "", body: "", photo: "", mood: "", template: "cute", font: "serif", layers: [], media: [], isDemo: false,
      moments: [
        {
          id: "m-a", time: "09:30", title: "两只猫的下午", body: "中文 and English 混在一起的一句话。", bookId: "exp", tags: [], media: [], layoutTemplate: "scrapbook", backdrop: "photo:beach-sunset", template: "minimal",
          layers: [
            L({ id: "p1", kind: "photo", mediaRef: "photo:coffee-cheers", x: 30, y: 38, w: 40, h: 30, rotation: -4, caption: "第一张" }),
            L({ id: "p2", kind: "photo", mediaRef: "photo:brunch", x: 70, y: 40, w: 40, h: 30, rotation: 3 }),
            L({ id: "c1", kind: "text", bind: "caption", captionOf: "p1", x: 30, y: 57, w: 40, fontSize: 11 }),
            L({ id: "s1", kind: "sticker", assetId: "bear", x: 82, y: 80 }),
            L({ id: "t1", kind: "text", text: "长长的文字 Long words · 第二行也要在", font: "handwritten", x: 50, y: 86 }),
          ],
        },
      ],
    });
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector(".hero");
  await SS.openBookPage(page, "exp");
  await page.locator('[data-action="reader-open"][data-book="exp"]').first().click();
  await page.waitForSelector(".reader-page");
  for (let i = 0; i < 4 && !(await page.locator('[data-action="read-edit"]').count()); i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  return { page, context, errors, downloads: () => downloads };
}
const more = async (page) => {
  await page.locator('[data-action="reader-more"]').click();
  await page.waitForSelector("#choose-dialog[open] .reader-export");
};
const toastText = (page) => page.locator("#toast").innerText().catch(() => "");
const store = (page) => page.evaluate(() => localStorage.getItem("little-days.v1"));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ---------- In the iPhone app (with the Photos bridge) ----------
    {
      const { page, context, errors, downloads } = await open(browser);
      const before = await store(page);
      // A · 存成图片: no share sheet, no download; the PNG goes to the Photos bridge.
      await more(page);
      await page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click();
      await page.waitForTimeout(150);
      const early = await toastText(page);
      await page.waitForFunction(() => window.__photos.saved.length === 1, null, { timeout: 20000 });
      // C · "已保存到照片" only after iOS has answered (the stand-in answers 400 ms later).
      check("C 回答之前不显示「已保存到照片」", !/已保存到照片/.test(early), early);
      await page.waitForFunction(() => /已保存到照片/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 5000 });
      check("C iOS 确认保存后才显示「已保存到照片」", true);
      const shared = await page.evaluate(() => window.__shared.length);
      check("A 存成图片：不打开分享面板，也不下载文件", shared === 0 && downloads() === 0, JSON.stringify({ shared, downloads: downloads() }));
      const saved = await page.evaluate(() => window.__photos.saved[0]);
      const png = Buffer.from(saved.data, "base64");
      const ihdr = pngSize(png);
      check("B 交给照片的是 PNG（无损，不是 JPEG）", ihdr.sig === "PNG" && saved.name === "Capiday-2026-11-17.png", saved.name);
      check("B 清晰度不降低：2160 × 2700（和以前导出一样）", ihdr.w === 2160 && ihdr.h === 2700, `${ihdr.w}×${ihdr.h}`);
      if (process.env.SHOTS) fs.writeFileSync(`${process.env.SHOTS}/v186-page.png`, png);

      // H · the PNG looks like the page in the reader (photos, background, words, sticker).
      const compare = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const grid = (src, w, h) => {
          const c = document.createElement("canvas");
          c.width = 27;
          c.height = 34;
          const x = c.getContext("2d");
          x.drawImage(src, 0, 0, w, h, 0, 0, 27, 34);
          return x.getImageData(0, 0, 27, 34).data;
        };
        const a = grid(img, img.width, img.height);
        const colours = new Set(Array.from({ length: a.length / 4 }, (_, i) => (a[i * 4] >> 4) * 256 + (a[i * 4 + 1] >> 4) * 16 + (a[i * 4 + 2] >> 4))).size;
        return { colours };
      }, saved.data);
      check("H 照片、背景、文字、贴纸都画上去了（颜色丰富）", compare.colours > 60, `${compare.colours} colours`);
      const shot = await page.locator(".reader-page .flip-canvas .journal-canvas, .reader-page .flip-canvas > *").first().screenshot();
      const diff = await page.evaluate(
        async ({ a, b }) => {
          const load = async (s) => {
            const i = new Image();
            i.src = "data:image/png;base64," + s;
            await i.decode();
            return i;
          };
          const [x, y] = [await load(a), await load(b)];
          const grid = (src) => {
            const c = document.createElement("canvas");
            c.width = 24;
            c.height = 30;
            const g = c.getContext("2d");
            g.drawImage(src, 0, 0, 24, 30);
            return g.getImageData(0, 0, 24, 30).data;
          };
          const [p, q] = [grid(x), grid(y)];
          let sum = 0;
          for (let i = 0; i < p.length; i += 4) sum += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
          return Math.round(sum / (p.length / 4) / 3);
        },
        { a: saved.data, b: shot.toString("base64") },
      );
      check("H 导出的图和阅读器里看到的这一页一致（缩小比较，平均差 < 24/255）", diff < 24, `average difference ${diff}`);

      // F · 分享这一页: the share sheet, with the same PNG.
      await page.waitForTimeout(600);
      await more(page);
      await page.locator('#choose-dialog [data-action="page-export"][data-kind="share"]').click();
      await page.waitForFunction(() => window.__shared.length === 1, null, { timeout: 20000 });
      const sharedFile = await page.evaluate(() => window.__shared[0]);
      const sharedPng = Buffer.from(sharedFile.data, "base64");
      const asked = await page.evaluate(() => window.__photos.asked.length);
      check("F 分享这一页：打开分享面板，不经过「照片」保存", asked === 1, `photos asked ${asked}`);
      check("F 分享的是同一张 PNG（同样的字节）", sha(sharedPng) === sha(png) && sharedFile.type === "image/png", `${sharedPng.length} vs ${png.length}`);

      // D · no access: nothing saved, no "saved", a way to Settings.
      await page.waitForTimeout(600);
      await page.evaluate(() => (window.__photos.plan = "denied"));
      await more(page);
      await page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click();
      await page.waitForSelector("#confirm-dialog[open]", { timeout: 20000 });
      const msg = await page.locator("#confirm-message").innerText();
      const okLabel = await page.locator("#confirm-ok").innerText();
      check("D 拒绝权限：不显示「已保存」，说清楚没有保存", /没有保存/.test(msg) && !/已保存到照片/.test(await toastText(page)) && (await page.evaluate(() => window.__photos.saved.length)) === 1, msg);
      check("D 提供「去设置」", okLabel === "去设置");
      await page.locator("#confirm-ok").click();
      await page.waitForTimeout(300);
      check("D 点「去设置」请 App 打开系统设置", (await page.evaluate(() => window.__photos.settings)) === 1);
      // E · allowed again: saves.
      await page.evaluate(() => (window.__photos.plan = "authorized"));
      await page.waitForTimeout(400);
      await more(page);
      await page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click();
      await page.waitForFunction(() => window.__photos.saved.length === 2, null, { timeout: 20000 });
      await page.waitForFunction(() => /已保存到照片/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 5000 });
      check("E 再次允许后可以正常保存", true);
      // Photos refuses (e.g. no space): said, never "saved".
      await page.waitForTimeout(3500);
      await page.evaluate(() => (window.__photos.plan = "write"));
      await more(page);
      await page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click();
      await page.waitForFunction(() => /没能保存到照片/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 20000 });
      const failMsg = await toastText(page);
      check("保存失败：说明失败原因，不显示「已保存」", /磁盘已满/.test(failMsg) && !/已保存到照片/.test(failMsg), failMsg);
      // G · nothing in the journal changed.
      check("G 保存和分享都不改手帐数据", (await store(page)) === before);
      check("仍在阅读器的这一页上", (await page.locator(".reader-page").count()) > 0 && (await page.locator('[data-action="read-edit"]').count()) > 0);
      check("没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ---------- The online link / a browser (no iPhone app): as before ----------
    {
      const { page, context, errors } = await open(browser, { native: false, share: false });
      await more(page);
      const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#choose-dialog [data-action="page-export"][data-kind="png"]').click()]);
      check("在线链接 / 浏览器：存成图片照旧下载 PNG", /\.png$/.test(dl.suggestedFilename()));
      check("在线链接：没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
  } catch (error) {
    failures.push(`crashed: ${error.message}`);
    console.log(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
})();
