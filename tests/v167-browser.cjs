// V10.71 · Alpha Stabilization Sprint 01 · CAP-014: a double tap on a text
// box must start typing in it, on a slow phone too. The App decides "double"
// itself (two taps on the same box, close together); every tap redraws the
// page. Chromium's CPU is slowed down 6× (like an older iPhone with a full
// page) and the two taps are 250 ms apart — a normal double tap.
// Also: one tap only selects; the bottom 编辑 does the same as a double tap;
// dragging, undo / redo and the box's look are not affected.
// Synthetic data only.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
const editing = (page) => page.evaluate(() => Boolean(document.activeElement?.matches?.("#journal-canvas .layer-text") && document.activeElement.isContentEditable));
const box = async (page) => {
  const b = await page.locator("#journal-canvas .text-layer").first().boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: "zh-CN" });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    // A page with photos and a text box (like the Founder's page 6).
    await page.locator('[data-action="today-write"]').first().click();
    await page.waitForSelector("#journal-canvas");
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.locator("#photos-input").setInputFiles(["latte-art", "corner-cafe", "frost", "bouquet"].map(photo));
    await page.waitForTimeout(1200);
    if (await page.locator("#photo-editor[open]").count()) await SS.skipPhotoEditor(page);
    await page.waitForFunction(() => document.querySelectorAll("#journal-canvas .photo-layer img").length >= 4);
    if (await page.locator('[data-action="layout-hint-close"]').count()) await page.locator('[data-action="layout-hint-close"]').click();
    await page.evaluate(() => document.querySelector('[data-action="layer-deselect"]')?.click());
    await page.locator('.tool-dock [data-action="add-text-layer"]').first().tap();
    await page.waitForTimeout(300);
    await page.keyboard.type("你猜");
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(400);
    const look0 = await page.evaluate(() => { const el = document.querySelector("#journal-canvas .text-layer"); return { style: el.getAttribute("style"), text: el.innerText.trim() }; });

    // Slow phone.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

    // One tap: selected, not typing.
    let p = await box(page);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(700);
    check("单击：选中文字框，不进入编辑", (await page.locator("#journal-canvas .text-layer.active, #journal-canvas .text-layer.selected").count()) >= 1 && !(await editing(page)));
    // The render a tap costs on this slow page (what pushed the old 400 ms window over).
    const renderMs = await page.evaluate(() => { const t0 = performance.now(); document.querySelector("#journal-canvas"); window.__ldRender?.(); return Math.round(performance.now() - t0); });
    // Double tap (250 ms apart) on the selected box.
    p = await box(page);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(250);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(900);
    check("选中后双击（慢手机，间隔 250 ms）：进入编辑", await editing(page), `render ${renderMs} ms`);
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(600);
    // Double tap on a box that was not selected yet (first tap selects, second edits).
    await page.evaluate(() => document.querySelector('[data-action="layer-deselect"]')?.click());
    await page.waitForTimeout(600);
    p = await box(page);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(250);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(900);
    check("未选中时直接双击（慢手机）：进入编辑", await editing(page));
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(600);
    // Two taps far apart in time: still only selected.
    p = await box(page);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(1200);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(700);
    check("两次轻点相隔 1.2 秒：不算双击", !(await editing(page)));
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    // 编辑 in the bottom bar does the same.
    await page.locator('.tool-dock [data-action="ctx-edit-text"]').first().click();
    await page.waitForTimeout(400);
    check("底部「编辑」：进入编辑", await editing(page));
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(500);
    const look1 = await page.evaluate(() => { const el = document.querySelector("#journal-canvas .text-layer"); return { style: el.getAttribute("style"), text: el.innerText.trim() }; });
    check("编辑后：文字、位置、样式不变", look1.text === look0.text && look1.style === look0.style, look1.style.slice(0, 60));

    // A drag still moves the box (not an edit) and undo puts it back.
    const top0 = await page.evaluate(() => document.querySelector("#journal-canvas .text-layer").style.top);
    p = await box(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(p.x, p.y + i * 15);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const top1 = await page.evaluate(() => document.querySelector("#journal-canvas .text-layer").style.top);
    check("拖动仍然是移动，不进入编辑", top1 !== top0 && !(await editing(page)), `${top0} → ${top1}`);
    await page.locator('[data-action="undo"]').first().click();
    await page.waitForTimeout(400);
    check("撤销：回到原位", (await page.evaluate(() => document.querySelector("#journal-canvas .text-layer").style.top)) === top0);
    await page.locator('[data-action="redo"]').first().click();
    await page.waitForTimeout(400);
    check("重做：再次移动", (await page.evaluate(() => document.querySelector("#journal-canvas .text-layer").style.top)) === top1);
    await context.close();
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv167: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
