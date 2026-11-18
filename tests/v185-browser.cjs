// V10.81 · 照片添加（从相册选择 / 拍一张照片）· 照片配文 · 编辑图片顶部安全区.
// Synthetic data only (the app's own sample photos). Chromium with an emulated
// phone — not a real iPhone. The iPhone photo library (PHPicker, Swift:
// LittleDaysPhotoPicker.swift) is a stand-in here that answers the page the way
// the app does; the iPhone camera is the page's own file input with `capture`.
// The iOS safe area is simulated (html[data-shell="ios"] with --sat / --sab set
// to the real iPhone values); env(safe-area-inset-*) itself needs a device or
// the Simulator (tools/mac/uitest/PhotoEditorUITests.swift).
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");
const photo = (n) => path.join(lib, `LD-photo-${n}.jpg`);
const b64 = (n) => fs.readFileSync(photo(n)).toString("base64");

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
const draftOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "{}").drafts || {});

// iPhone sizes: [width, height, status bar / Dynamic Island, home indicator].
const PHONES = {
  "iPhone SE": [375, 667, 20, 0],
  "iPhone 13/14": [390, 844, 47, 34],
  "iPhone 15/16/17": [393, 852, 59, 34],
  "iPhone 15/16 Pro Max": [430, 932, 59, 34],
  "iPhone 17 Pro Max": [440, 956, 62, 34],
};

async function fresh(browser, { lang = "zh-CN", size = { width: 390, height: 844 }, native = false, ios = null } = {}) {
  const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, locale: lang });
  await context.addInitScript(
    ({ l, native, ios }) => {
      try {
        if (!sessionStorage.getItem("v185")) {
          sessionStorage.setItem("v185", "1");
          localStorage.setItem("little-days.with-samples", "0");
          localStorage.setItem("little-days.language", l);
          localStorage.setItem("little-days.studio-guide", JSON.stringify({ tour: "skipped", tips: { dblTap: true } }));
        }
      } catch {}
      if (native) {
        // A stand-in for LittleDaysPhotoPicker.swift: answers the page as the app does.
        window.capidayFiles = { photos: 1 };
        window.__pick = { asked: [], done: [], next: null };
        window.webkit = {
          messageHandlers: {
            littleDaysPhotos: {
              postMessage: (m) => {
                if (m.type === "done") return window.__pick.done.push(m.id);
                window.__pick.asked.push(m);
                const plan = window.__pick.next || { files: [] };
                window.__pick.next = null;
                setTimeout(() => {
                  if (plan.fail) return window.capidayPhotosPicked({ id: m.id, ok: false, error: "read", files: [] });
                  const files = plan.files.map((f) => {
                    const bin = atob(f.b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    return { url: URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" })), name: f.name, type: "image/jpeg" };
                  });
                  window.capidayPhotosPicked({ id: m.id, ok: true, error: "", files });
                }, 30);
              },
            },
          },
        };
      }
    },
    { l: lang, native, ios },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    errors.push(`native dialog: ${d.message()}`);
    d.dismiss();
  });
  const choosers = [];
  page.on("filechooser", (c) => choosers.push(c));
  // The iOS shell opens the page with ?shell=ios (and marks html[data-shell="ios"]);
  // the iPhone's safe area is set as the app's --sat / --sab.
  await page.goto(ios ? `${base}/?shell=ios` : base);
  await page.waitForSelector(".hero");
  if (ios) await page.addStyleTag({ content: `:root{--sat:${ios.sat}px !important;--sab:${ios.sab}px !important}` });
  return { page, context, errors, choosers };
}
// Journal Studio on today's page (自己写 → 到手帐工作室里继续).
async function studio(page) {
  await page.locator('[data-action="today-write"]').first().click();
  await page.waitForSelector("#journal-canvas");
  await page.evaluate(() => document.activeElement?.blur?.());
}
async function openAddPhotos(page) {
  if (await page.locator(".tool-dock.ctx").count()) await page.locator('[data-action="layer-deselect"]').click();
  await page.locator('.tool-dock [data-action="add-photos"]').click();
  await page.waitForSelector("#choose-dialog[open] .choose-ways");
}
async function skipEditor(page) {
  await page.waitForSelector("#photo-editor[open] .pe-frame");
  await page.locator('#photo-editor [data-pe-action="cancel"]').click();
  await page.waitForSelector("#photo-editor:not([open])", { state: "attached" });
}
const photoLayers = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("little-days.v1") || "{}");
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const e = s.drafts?.[key] || s.entries?.find((x) => x.date === key);
    const pages = e ? [e, ...(e.moments || [])] : [];
    return pages.flatMap((p) => (p.layers || []).filter((l) => l.kind === "photo" && l.mediaRef && !l.gen).map((l) => ({ id: l.id, ref: l.mediaRef, name: l.text, caption: l.caption || "", page: p.id || "day" })));
  });
async function settle(page, n) {
  await page.waitForFunction((n) => document.querySelectorAll("#journal-canvas .photo-layer img").length >= n, n, { timeout: 15000 });
  await page.waitForTimeout(500);
  if (await page.locator('[data-action="layout-hint-close"]').count()) await page.locator('[data-action="layout-hint-close"]').click();
}
async function selectPhoto(page, index) {
  const layer = page.locator("#journal-canvas .photo-layer").nth(index);
  await layer.click({ force: true });
  await page.waitForSelector('.tool-dock.ctx[data-ctx="photo"]');
}
async function captionSheet(page) {
  await page.locator('.tool-dock.ctx [data-action="photo-caption"]').click();
  await page.waitForSelector("#choose-dialog[open] .cap-sheet [data-cap-text]");
}
// The draft is written a moment after a change (as in the app): wait for it.
async function saved(page) {
  await page.waitForFunction(() => document.querySelector("#draft-status")?.dataset.state !== "saving", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
}
async function type(page, text) {
  const field = page.locator("#choose-dialog [data-cap-text]");
  await field.fill(text);
  await page.waitForTimeout(250);
  await saved(page);
}
async function capDone(page) {
  await page.locator('#choose-dialog [data-action="cap-done"]').click();
  await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
  await page.waitForTimeout(300);
}
const captionsOnPaper = (page) => page.evaluate(() => [...document.querySelectorAll("#journal-canvas .bound-text .layer-text")].map((el) => el.textContent.trim()).filter(Boolean));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ---------- A · 添加照片 ----------
    {
      const { page, context, errors, choosers } = await fresh(browser, { native: true });
      await studio(page);
      await openAddPhotos(page);
      const sheet = await page.evaluate(() => {
        const s = document.querySelector("#choose-dialog .choose-sheet");
        const ways = [...s.querySelectorAll(".choose-ways button")].map((b) => [b.dataset.action, b.querySelector("b").textContent]);
        const order = [...s.children].map((c) => c.className || c.tagName);
        return { ways, picks: Boolean(s.querySelector(".choose-picks button")), library: Boolean(s.querySelector(".choose-collections button")), bg: Boolean(s.querySelector('[data-action="open-backdrops"]')), firstIsWays: order.indexOf("choose-ways") < order.findIndex((c) => c === "H3"), text: s.innerText };
      });
      check("A0 添加照片: 从相册选择 and 拍一张照片 at the top", JSON.stringify(sheet.ways) === JSON.stringify([["choose-album", "从相册选择"], ["choose-camera", "拍一张照片"]]) && sheet.firstIsWays, JSON.stringify(sheet.ways));
      check("A0 今日推荐, 照片素材 and 换个页面背景 are still there", sheet.picks && sheet.library && sheet.bg);
      if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, "v185-add-photo.png") });
      check("A0 no English system words in the sheet", !/Photo Library|Take Photo|Choose Files/.test(sheet.text));

      // A1 · 从相册选择, one photo: straight to the photo library (no file menu).
      await page.evaluate((f) => (window.__pick.next = { files: [f] }), { name: "latte.jpg", b64: b64("latte-art") });
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await skipEditor(page);
      await settle(page, 1);
      let layers = await photoLayers(page);
      const asked = await page.evaluate(() => window.__pick.asked);
      check("A1 从相册选择 asks the app's photo library (several allowed), not the file menu", asked.length === 1 && asked[0].limit === 0 && choosers.length === 0, JSON.stringify({ asked, choosers: choosers.length }));
      check("A1 one picked photo is on the page", layers.length === 1, JSON.stringify(layers));
      check("A1 the picked files are let go afterwards", (await page.evaluate(() => window.__pick.done.length)) === 1);

      // A2 · several at once, in the order picked.
      await openAddPhotos(page);
      await page.evaluate((files) => (window.__pick.next = { files }), [
        { name: "a-corner.jpg", b64: b64("corner-cafe") },
        { name: "b-brunch.jpg", b64: b64("brunch") },
        { name: "c-bouquet.jpg", b64: b64("bouquet") },
      ]);
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      const strip = await page.locator("#photo-editor .pe-strip button").count();
      await page.locator('#photo-editor [data-pe-action="cancel"]').click();
      await settle(page, 4);
      layers = await photoLayers(page);
      check("A2 three photos at once go into the photo editor together", strip === 3, String(strip));
      check("A2 three more photos, in the order they were picked", layers.length === 4 && layers.slice(1).map((l) => l.name).join() === "a-corner.jpg,b-brunch.jpg,c-bouquet.jpg", JSON.stringify(layers.map((l) => l.name)));
      check("A2 every photo has its own media", new Set(layers.map((l) => l.ref)).size === 4);

      // A4 · cancel the photo library: nothing changes.
      const beforeCancel = JSON.stringify(await draftOf(page));
      await openAddPhotos(page);
      await page.evaluate(() => (window.__pick.next = { files: [] }));
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForTimeout(800);
      check("A4 cancelling the photo library keeps the draft as it was", JSON.stringify(await draftOf(page)) === beforeCancel && !(await page.locator("#photo-editor[open]").count()));

      // The photo library could not read a photo: said, nothing added (no false success).
      await openAddPhotos(page);
      await page.evaluate(() => (window.__pick.next = { fail: true }));
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForSelector(".toast.visible");
      const failToast = await page.locator(".toast").innerText();
      check("A4 a photo that can't be read says so and adds nothing", /没能读进来/.test(failToast) && JSON.stringify(await draftOf(page)) === beforeCancel, failToast);

      // A3 · 拍一张照片: the camera input (capture), then the same import.
      await page.waitForTimeout(400);
      await openAddPhotos(page);
      const cameraAttr = await page.evaluate(() => [document.querySelector("#camera-input").getAttribute("capture"), document.querySelector("#camera-input").accept, document.querySelector("#camera-input").multiple]);
      const chooserNow = choosers.length;
      await page.locator('#choose-dialog [data-action="choose-camera"]').click();
      await page.waitForTimeout(300);
      const cam = choosers[chooserNow];
      check("A3 拍一张照片 opens the camera input (capture=environment, one photo)", Boolean(cam) && cameraAttr[0] === "environment" && cameraAttr[1] === "image/*" && cameraAttr[2] === false && (await cam.element().evaluate((el) => el.id)) === "camera-input", JSON.stringify(cameraAttr));
      await cam.setFiles(photo("beach-day"));
      await skipEditor(page);
      await settle(page, 5);
      layers = await photoLayers(page);
      check("A3 the photo from the camera is on the page", layers.length === 5);

      // A5 · cancel the camera (or no camera permission: no photo comes back).
      const beforeCam = JSON.stringify(await draftOf(page));
      await openAddPhotos(page);
      const n2 = choosers.length;
      await page.locator('#choose-dialog [data-action="choose-camera"]').click();
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector("#camera-input").dispatchEvent(new Event("cancel")));
      await page.waitForTimeout(500);
      check("A5 cancelling the camera keeps the draft as it was", choosers.length === n2 + 1 && JSON.stringify(await draftOf(page)) === beforeCam);

      // A6 · then edit, lay out and save.
      await selectPhoto(page, 0);
      await page.locator('.tool-dock.ctx [data-action="photo-edit"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      await page.locator('#photo-editor [data-pe-action="filter"][data-filter]').nth(2).click();
      await page.locator('#photo-editor [data-pe-action="done"]').click();
      await page.waitForSelector("#photo-editor:not([open])", { state: "attached" });
      await page.waitForTimeout(800);
      layers = await photoLayers(page);
      check("A6 an imported photo can be edited again (调整)", layers.length === 5);
      await page.locator('[data-action="save-entry"]').click();
      await page.waitForSelector("#phone.in-reader", { timeout: 15000 });
      const saved = await read(page);
      const day = saved.entries.find((e) => e.date === saved.entries.at(-1).date) || saved.entries[0];
      const savedPhotos = [day, ...(day.moments || [])].flatMap((p) => (p.layers || []).filter((l) => l.kind === "photo" && l.mediaRef && !l.gen));
      check("A6 saved: all five photos are in the journal", savedPhotos.length === 5, String(savedPhotos.length));
      check("A no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // The online link / a browser: 从相册选择 opens the page's file input as before.
    {
      const { page, context, choosers } = await fresh(browser, { native: false });
      await studio(page);
      await openAddPhotos(page);
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForTimeout(300);
      check("A outside the iPhone app 从相册选择 opens the file input (several photos)", choosers.length === 1 && (await choosers[0].element().evaluate((el) => el.id)) === "photos-input" && choosers[0].isMultiple());
      await context.close();
    }
    // English: the two ways read in English.
    {
      const { page, context } = await fresh(browser, { lang: "en", native: true });
      await studio(page);
      await openAddPhotos(page);
      const ways = await page.locator("#choose-dialog .choose-ways b").allInnerTexts();
      check("A English: From your photos / Take a photo", ways.join("|") === "From your photos|Take a photo", ways.join("|"));
      await context.close();
    }

    // ---------- B · 照片配文 ----------
    {
      const { page, context, errors } = await fresh(browser, { native: true });
      await studio(page);
      await openAddPhotos(page);
      await page.evaluate((files) => (window.__pick.next = { files }), [
        { name: "one.jpg", b64: b64("latte-art") },
        { name: "two.jpg", b64: b64("brunch") },
      ]);
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      await page.locator('#photo-editor [data-pe-action="cancel"]').click();
      await settle(page, 2);
      // A page title of its own, to see it is never touched by the photo words.
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        return s;
      });
      const ids0 = await photoLayers(page);
      await selectPhoto(page, 0);
      const tools = await page.locator(".tool-dock.ctx[data-ctx=\"photo\"] .sv-tool small").allInnerTexts();
      if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, "v185-photo-tools.png") });
      const dockFit = await page.evaluate(() => [...document.querySelectorAll('.tool-dock.ctx[data-ctx="photo"] .sv-tool')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.width >= 34; }));
      check("B1 all nine photo tools (删除 too) stay in sight, none narrower than 34px", dockFit);
      check("B1 the selected photo's tools start with 配文", tools[1] === "配文" && tools.includes("形状") && tools.includes("删除"), tools.join(" "));
      await captionSheet(page);
      const sheet = await page.evaluate(() => ({ title: document.querySelector(".cap-sheet h2").textContent, strip: document.querySelectorAll(".cap-sheet .sw-item").length, now: document.querySelector(".cap-sheet .sw-now b").textContent }));
      check("B1 配文 opens on this photo (照片 1 / 2), both photos to switch between", sheet.title === "照片配文" && sheet.strip === 2 && sheet.now === "照片 1 / 2", JSON.stringify(sheet));
      await type(page, "第一杯拿铁");
      if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, "v185-caption-sheet.png") });
      let layers = await photoLayers(page);
      let paper = await captionsOnPaper(page);
      check("B1 the words go on that photo and show on the page", layers.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁" && paper.includes("第一杯拿铁"), JSON.stringify({ layers, paper }));
      const under = await page.evaluate((pid) => {
        const p = document.querySelector(`#journal-canvas [data-layer="${pid}"]`).getBoundingClientRect();
        const cap = [...document.querySelectorAll("#journal-canvas .bound-text")].find((el) => el.textContent.includes("第一杯拿铁")).getBoundingClientRect();
        return { below: cap.top >= p.bottom - 8, near: cap.top - p.bottom < 60, overlapX: cap.left < p.right && cap.right > p.left };
      }, ids0[0].id);
      check("B1 the words sit right under their photo", under.below && under.near && under.overlapX, JSON.stringify(under));
      await type(page, "第一杯拿铁，很烫");
      layers = await photoLayers(page);
      check("B1 editing changes the words", layers.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁，很烫");
      // B2 · the second photo, its own words.
      await page.locator('#choose-dialog .cap-sheet [data-action="cap-target"]').nth(1).click();
      await page.waitForSelector('#choose-dialog .cap-sheet .sw-now b:text("照片 2 / 2")');
      check("B2 switching photos shows that photo's (empty) words", (await page.locator("#choose-dialog [data-cap-text]").inputValue()) === "");
      await type(page, "早午餐");
      await capDone(page);
      layers = await photoLayers(page);
      paper = await captionsOnPaper(page);
      check("B2 two photos keep their own words", layers.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁，很烫" && layers.find((l) => l.id === ids0[1].id)?.caption === "早午餐" && paper.length === 2, JSON.stringify({ layers, paper }));
      check("D2 photo ids and media stay the same", JSON.stringify(layers.map((l) => [l.id, l.ref])) === JSON.stringify(ids0.map((l) => [l.id, l.ref])));
      // D4 · open and close again quickly: still one line per photo.
      for (let i = 0; i < 3; i++) {
        await selectPhoto(page, 0);
        await captionSheet(page);
        await capDone(page);
      }
      paper = await captionsOnPaper(page);
      const capLayers = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        const d = Object.values(s.drafts || {})[0];
        return [d, ...(d.moments || [])].flatMap((p) => p.layers.filter((l) => l.bind === "caption")).map((l) => l.captionOf);
      });
      check("D4 opening 配文 again and again adds no second line", paper.length === 2 && capLayers.length === 2 && new Set(capLayers).size === 2, JSON.stringify({ paper, capLayers }));
      // Undo goes back one opening.
      await selectPhoto(page, 1);
      await captionSheet(page);
      await type(page, "早午餐 + 咖啡");
      await capDone(page);
      await page.locator('[data-action="undo"]').click();
      await page.waitForTimeout(400);
      await saved(page);
      layers = await photoLayers(page);
      check("B1 undo brings back the words from before that opening", layers.find((l) => l.id === ids0[1].id)?.caption === "早午餐", JSON.stringify(layers));
      // B4 · lay the page out again: the words stay, one line each.
      await page.locator('[data-action="layer-deselect"]').click().catch(() => {});
      const layoutBtn = page.locator('[data-action="layout-hint-open"]');
      await page.evaluate(() => {
        const b = document.createElement("button");
        b.dataset.action = "apply-smart";
        b.hidden = true;
        document.querySelector("#app").append(b);
        b.click();
      });
      await page.waitForTimeout(900);
      layers = await photoLayers(page);
      paper = await captionsOnPaper(page);
      check("B4 after 自动排版 every photo keeps its words, shown once", layers.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁，很烫" && layers.find((l) => l.id === ids0[1].id)?.caption === "早午餐" && paper.filter((x) => x === "早午餐").length === 1 && paper.filter((x) => x === "第一杯拿铁，很烫").length === 1, JSON.stringify({ paper, n: await layoutBtn.count() }));
      // Delete one photo's words: only that line goes.
      await selectPhoto(page, 1);
      await captionSheet(page);
      await page.locator('#choose-dialog [data-action="cap-remove"]').click();
      await page.waitForTimeout(250);
      await capDone(page);
      layers = await photoLayers(page);
      paper = await captionsOnPaper(page);
      check("B1 删除配文 removes that photo's words and its line only", !layers.find((l) => l.id === ids0[1].id)?.caption && layers.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁，很烫" && paper.length === 1, JSON.stringify({ layers, paper }));
      // B3 · replace a photo (with another photo already here): same place and id, words kept.
      await selectPhoto(page, 0);
      await page.locator('.tool-dock.ctx [data-action="replace-photo"]').click();
      await page.waitForSelector("#choose-dialog[open] .ps-sheet");
      await page.locator('#choose-dialog .ps-thumb:not([disabled])').first().click();
      await page.waitForTimeout(800);
      layers = await photoLayers(page);
      const replaced = layers.find((l) => l.id === ids0[0].id);
      check("B3 replacing a photo keeps its place (same id) and its words (the V10.29 rule)", replaced && replaced.ref !== ids0[0].ref && replaced.caption === "第一杯拿铁，很烫", JSON.stringify(replaced));
      // B5 · save, leave, open again.
      await page.locator('[data-action="save-entry"]').click();
      await page.waitForSelector("#phone.in-reader", { timeout: 15000 });
      const readerText = await page.locator(".reader-stage").innerText();
      check("B5 the saved page shows the photo's words in the reader", readerText.includes("第一杯拿铁，很烫"));
      await page.reload();
      await page.waitForSelector(".hero, #phone.in-reader");
      const after = await read(page);
      const entry = after.entries[0];
      const all = [entry, ...(entry.moments || [])].flatMap((p) => p.layers || []);
      check("B5 after reopening the words are still on that photo", all.find((l) => l.id === ids0[0].id)?.caption === "第一杯拿铁，很烫" && all.filter((l) => l.bind === "caption").length === 1);
      check("B no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // B6 · a page saved by V10.19–V10.80 (今天的故事 words): read and changed in Journal Studio.
    {
      const { page, context, errors } = await fresh(browser, { native: true });
      await SS.touchStore(page);
      const d = new Date();
      d.setDate(d.getDate() - 3);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await page.evaluate(
        ({ date }) => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          const book = s.books[0].id;
          s.entries.push({
            id: "entry-v185-old", date, bookId: book, title: "", body: "", template: "minimal", layers: [], media: [], mood: "", tags: [], createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z`,
            moments: [{
              id: "moment-v185-old", time: "09:00", title: "旧的一页标题", body: "旧的正文", template: "minimal", layoutTemplate: "scrapbook", layoutStyle: "editorial", createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z`, media: [],
              layers: [
                { id: "p-old-1", kind: "photo", text: "old-1", mediaRef: "photo:latte-art", x: 30, y: 35, w: 40, h: 30, scale: 1, rotation: 0, caption: "老照片的配文一" },
                { id: "p-old-2", kind: "photo", text: "old-2", mediaRef: "photo:brunch", x: 70, y: 35, w: 40, h: 30, scale: 1, rotation: 0, caption: "老照片的配文二" },
                { id: "t-old-1", kind: "text", bind: "caption", captionOf: "p-old-1", text: "老照片的配文一", x: 30, y: 54, w: 40, scale: 1, rotation: 0, fontSize: 10.5, gen: true },
                { id: "t-old-2", kind: "text", bind: "caption", captionOf: "p-old-2", text: "老照片的配文二", x: 70, y: 54, w: 40, scale: 1, rotation: 0, fontSize: 10.5, gen: true },
              ],
            }],
          });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
        { date },
      );
      await page.reload();
      await page.waitForSelector(".hero");
      await page.evaluate((date) => {
        const b = document.createElement("button");
        b.dataset.action = "edit-date";
        b.dataset.date = date;
        b.hidden = true;
        document.querySelector("#app").append(b);
        b.click();
      }, date);
      await page.waitForSelector("#journal-canvas");
      if (await page.locator('[data-action="layout-hint-close"]').count()) await page.locator('[data-action="layout-hint-close"]').click();
      const shown = await captionsOnPaper(page);
      check("B6 an older page's photo words show in Journal Studio", shown.includes("老照片的配文一") && shown.includes("老照片的配文二"), JSON.stringify(shown));
      const n = await page.locator("#journal-canvas .photo-layer").count();
      if (n) {
        await page.locator('#journal-canvas .photo-layer[data-layer="p-old-2"]').click({ force: true });
        await page.waitForSelector('.tool-dock.ctx[data-ctx="photo"]');
        await captionSheet(page);
        const value = await page.locator("#choose-dialog [data-cap-text]").inputValue();
        check("B6 配文 reads the older words of that photo", value === "老照片的配文二", value);
        await type(page, "老照片的配文二（补一句）");
        await capDone(page);
      }
      const draft = Object.values(await draftOf(page))[0];
      const m = draft?.moments?.find((x) => x.id === "moment-v185-old");
      const L = (id) => m?.layers.find((l) => l.id === id);
      check("B6 changing one older photo's words keeps the other's and the page's own words", L("p-old-2")?.caption === "老照片的配文二（补一句）" && L("p-old-1")?.caption === "老照片的配文一" && m.title === "旧的一页标题" && m.body === "旧的正文" && L("t-old-1") && L("t-old-2"), JSON.stringify(m?.layers?.map((l) => [l.id, l.caption || l.text])));
      const saved = await read(page);
      const other = saved.entries.filter((e) => e.id !== "entry-v185-old");
      check("D1 other pages are untouched", other.every((e) => !(e.moments || []).some((x) => x.id === "moment-v185-old")));
      check("B6 no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ---------- C · 编辑图片 (and the other full-screen editors) ----------
    const measure = (page) =>
      page.evaluate(() => {
        const r = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) };
        };
        const dialog = document.querySelector("dialog[open]");
        const cs = getComputedStyle(dialog);
        return { vw: innerWidth, vh: innerHeight, dialog: r("dialog[open]"), padTop: parseFloat(cs.paddingTop), padBottom: parseFloat(cs.paddingBottom), skip: r('#photo-editor [data-pe-action="cancel"]'), done: r('#photo-editor [data-pe-action="done"]'), title: r("#photo-editor .pe-top b"), stage: r("#photo-editor .pe-stage"), tabs: r("#photo-editor .pe-tabs"), controls: r("#photo-editor .pe-controls"), focus: document.activeElement?.matches?.(".pe-top b") };
      });
    const topBarOK = (m, sat, sab) => {
      const bar = [m.skip, m.done, m.title];
      return {
        ok:
          m.dialog.top === 0 &&
          m.dialog.h === m.vh &&
          bar.every((b) => b.top >= sat && b.top <= sat + 22 && b.bottom <= sat + 64) &&
          m.skip.left >= 0 && m.done.right <= m.vw &&
          Math.abs((m.title.left + m.title.right) / 2 - m.vw / 2) <= 2 &&
          m.stage.top >= m.done.bottom &&
          m.controls.bottom <= m.vh - sab + 1 &&
          m.padTop === sat,
        detail: JSON.stringify({ sat, dialog: m.dialog, padTop: m.padTop, skip: m.skip, done: m.done, title: m.title, stage: m.stage.top, controls: m.controls.bottom, vh: m.vh }),
      };
    };
    const shots = {};
    for (const [name, [w, h, sat, sab]] of Object.entries(PHONES)) {
      const { page, context, errors } = await fresh(browser, { size: { width: w, height: h }, native: true, ios: { sat, sab } });
      // Entry 1 · a new page from Home (自己写 → Journal Studio → 添加照片).
      await studio(page);
      await openAddPhotos(page);
      await page.evaluate((f) => (window.__pick.next = { files: [f] }), { name: "x.jpg", b64: b64("latte-art") });
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      await page.waitForTimeout(400);
      const m1 = await measure(page);
      const r1 = topBarOK(m1, sat, sab);
      check(`C1/C2 ${name}: 跳过 / 编辑图片 / 完成 below the status bar, title centred, nothing cut off`, r1.ok, r1.detail);
      check(`C1 ${name}: opens with the title focused (no ring on 跳过)`, m1.focus === true);
      if (name === "iPhone 15/16/17") shots.add = await page.screenshot();
      // C3 · 跳过 works.
      await page.locator('#photo-editor [data-pe-action="cancel"]').click();
      await page.waitForSelector("#photo-editor:not([open])", { state: "attached" });
      await settle(page, 1);
      // Entry 2 · the same photo from its tools (调整) — edit mode.
      await selectPhoto(page, 0);
      await page.locator('.tool-dock.ctx [data-action="photo-edit"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      await page.waitForTimeout(400);
      const m2 = await measure(page);
      const r2 = topBarOK(m2, sat, sab);
      check(`C6 ${name}: 调整 (an existing photo) has the same top bar`, r2.ok && m2.skip.top === m1.skip.top && m2.done.top === m1.done.top && m2.title.top === m1.title.top, r2.detail);
      // Typing a title (文字): keyboard up — the box follows the visible area, the status bar is not added twice.
      await page.locator('#photo-editor [data-pe-action="tab"][data-tab="text"]').click();
      await page.evaluate(() => {
        document.documentElement.classList.add("kb-open");
        document.documentElement.style.setProperty("--vv-h", Math.round(innerHeight * 0.58) + "px");
        document.documentElement.style.setProperty("--vv-top", "0px");
      });
      const kb = await page.evaluate(() => {
        const d = document.querySelector("#photo-editor").getBoundingClientRect();
        const b = document.querySelector('#photo-editor [data-pe-action="done"]').getBoundingClientRect();
        return { top: Math.round(d.top), h: Math.round(d.height), done: Math.round(b.top) };
      });
      check(`C2 ${name}: with the keyboard up the bar stays just under the status bar (not pushed down twice)`, kb.top === 0 && kb.done >= sat && kb.done <= sat + 22 && kb.h === Math.round(h * 0.58), JSON.stringify(kb));
      await page.evaluate(() => {
        document.documentElement.classList.remove("kb-open");
        document.documentElement.style.removeProperty("--vv-h");
      });
      await page.locator('#photo-editor [data-pe-action="cancel"]').click();
      await page.waitForSelector("#photo-editor:not([open])", { state: "attached" });
      // The other full-screen editors: 裁剪画面 and 照片素材 own the same safe area.
      await selectPhoto(page, 0);
      await page.locator('.tool-dock.ctx [data-action="crop-open"]').click();
      await page.waitForSelector("dialog.crop-editor[open] .ce-top");
      const ce = await page.evaluate(() => {
        const d = document.querySelector("dialog.crop-editor[open]");
        const b = d.querySelector('[data-ce="done"]').getBoundingClientRect();
        return { top: Math.round(d.getBoundingClientRect().top), done: Math.round(b.top), pad: parseFloat(getComputedStyle(d).paddingTop) };
      });
      check(`C6 ${name}: 裁剪画面 bar below the status bar, safe area added once`, ce.top === 0 && ce.pad === sat && ce.done >= sat && ce.done <= sat + 22, JSON.stringify(ce));
      await page.locator('dialog.crop-editor [data-ce="cancel"]').click();
      await page.waitForTimeout(300);
      check(`C ${name}: no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // C4 / C5 · the editor's tools work and Done goes back to the draft as it was.
    {
      const { page, context, errors } = await fresh(browser, { native: true, ios: { sat: 59, sab: 34 }, size: { width: 393, height: 852 } });
      await studio(page);
      await page.evaluate(() => {
        const t = document.querySelector('#journal-canvas [data-inline-layer], #journal-canvas .canvas-title');
        return Boolean(t);
      });
      await openAddPhotos(page);
      await page.evaluate((files) => (window.__pick.next = { files }), [
        { name: "one.jpg", b64: b64("latte-art") },
        { name: "two.jpg", b64: b64("brunch") },
      ]);
      await page.locator('#choose-dialog [data-action="choose-album"]').click();
      await page.waitForSelector("#photo-editor[open] .pe-frame");
      const tabs = await page.locator('#photo-editor [data-pe-action="tab"]').allInnerTexts();
      await page.locator('#photo-editor [data-pe-action="filter"]').nth(1).click();
      await page.locator('#photo-editor [data-pe-action="tab"][data-tab="crop"]').click();
      await page.locator('#photo-editor [data-pe-action="ratio"][data-ratio="1:1"]').click();
      await page.locator('#photo-editor [data-pe-action="tab"][data-tab="adjust"]').click();
      await page.locator('#photo-editor [data-pe="brightness"]').fill("20");
      await page.locator('#photo-editor [data-pe-action="tab"][data-tab="text"]').click();
      await page.locator('#photo-editor [data-pe-text="value"]').fill("周末");
      await page.waitForTimeout(300);
      await page.locator('#photo-editor [data-pe-action="done"]').click();
      await page.waitForSelector("#photo-editor:not([open])", { state: "attached", timeout: 20000 }).catch(async (e) => {
        console.log("DEBUG", await page.evaluate(() => ({ done: document.querySelector('#photo-editor [data-pe-action="done"]')?.outerHTML, open: document.querySelector("#photo-editor").open, active: document.activeElement?.outerHTML?.slice(0, 120) })), errors);
        throw e;
      });
      await settle(page, 2);
      const layers = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        const d = Object.values(s.drafts || {})[0];
        return [d, ...(d.moments || [])].flatMap((p) => p.layers.filter((l) => l.kind === "photo" && l.mediaRef)).map((l) => ({ edit: l.edit || null, source: Boolean(l.sourceRef) }));
      });
      check("C4 滤镜 / 裁剪 / 调节 / 文字 tabs are all there", tabs.join("|") === "滤镜|裁剪|调节|文字", tabs.join("|"));
      check("C4/C5 Done keeps the edit (filter, 1:1, brightness, words) on the first photo and goes back to the page", layers.length === 2 && layers[0].edit?.filter && layers[0].edit?.ratio === "1:1" && layers[0].edit?.brightness === 20 && layers[0].edit?.text?.value === "周末" && layers[0].source && !(await page.locator("#photo-editor[open]").count()), JSON.stringify(layers));
      check("C5 back in Journal Studio with both photos (draft complete)", (await page.locator("#journal-canvas .photo-layer img").count()) >= 2);
      check("C no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    if (shots.add) fs.writeFileSync(path.join(process.env.SHOTS_DIR || "/tmp", "v185-photo-editor-393.png"), shots.add);
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
