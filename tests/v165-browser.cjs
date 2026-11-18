// V10.69 · iPhone feedback (2026-11-14, pinned link on a real iPhone):
//  1. a new text box could not be moved until something was typed in it;
//  2. 只写几句话: the title and words could never be moved;
//  3. Return on Captain's name field did not put the keyboard away;
//  4. while typing on the paper the type bar (字体) was behind the keyboard
//     in the pinned link (the app runs in a frame there; no keyboard measure);
//  5. a new text box starts in 黑体, a little bolder.
// Synthetic data only.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};
async function drag(page, box, dx, dy) {
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(250);
}
const layerTop = (page) => page.evaluate(() => document.querySelector("#journal-canvas .text-layer")?.style.top || "");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  try {
    // ---------- 1 + 5: a new text box ----------
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.locator('[data-action="today-write"]').first().click();
      await page.waitForSelector("#journal-canvas");
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.locator('.tool-dock [data-action="add-text-layer"]').first().click();
      await page.waitForTimeout(400);
      const look = await page.evaluate(() => {
        const el = document.querySelector("#journal-canvas .text-layer");
        const cs = getComputedStyle(el);
        return { family: cs.fontFamily, weight: cs.fontWeight, editing: document.activeElement?.matches?.(".layer-text") };
      });
      check("新文字框默认黑体", /PingFang SC/.test(look.family), look.family.slice(0, 40));
      check("新文字框加粗一档（600）", look.weight === "600", look.weight);
      check("新文字框进入输入状态", look.editing);
      const top0 = await layerTop(page);
      await drag(page, await page.locator("#journal-canvas .text-layer .layer-text").boundingBox(), 0, 150);
      const after = await page.evaluate(() => ({ top: document.querySelector("#journal-canvas .text-layer")?.style.top, editing: document.activeElement?.matches?.(".layer-text"), count: document.querySelectorAll("#journal-canvas .text-layer").length }));
      check("空的新文字框不用先打字就能拖动", after.top !== top0 && parseFloat(after.top) > parseFloat(top0), `${top0} → ${after.top}`);
      check("拖动后仍在输入、没有多出或丢掉文字框", after.editing && after.count === 1);
      await page.keyboard.type("今天看了比赛");
      await page.waitForTimeout(200);
      check("拖完直接打字，字在这个框里", (await page.locator("#journal-canvas .text-layer .layer-text").innerText()).includes("今天看了比赛"));
      // A tap (no travel) still only places the caret.
      const top1 = await layerTop(page);
      await page.locator("#journal-canvas .text-layer .layer-text").click();
      await page.waitForTimeout(200);
      check("轻点不移动文字框", (await layerTop(page)) === top1);
      // Undo puts it back where it was before the drag.
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(200);
      await context.close();
    }
    // ---------- 2: 只写几句话 ----------
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.locator('[data-action="quick-open"]').first().click();
      await page.locator('[data-action="quick-way"][data-way="write"]').click();
      await page.locator(".quick-start").click();
      await page.waitForSelector('#journal-canvas.text-only [data-inline="title"]');
      await page.waitForTimeout(400);
      check("只写几句话：标题获得焦点", await page.evaluate(() => document.activeElement?.dataset?.inline === "title"));
      await page.keyboard.type("测试");
      await page.locator('#journal-canvas [data-inline="body"]').click();
      await page.keyboard.type("这两个对话框不能移动");
      await page.waitForTimeout(300);
      // A tap on the title: still just typing (no box made).
      await page.locator('#journal-canvas [data-inline="title"]').click();
      await page.waitForTimeout(200);
      check("轻点标题仍是打字", await page.evaluate(() => document.querySelector("#journal-canvas.text-only") && document.activeElement?.dataset?.inline === "title"));
      // Drag the words down.
      await drag(page, await page.locator('#journal-canvas [data-inline="body"]').boundingBox(), 0, 220);
      const moved = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll("#journal-canvas .text-layer")].map((el) => ({ text: el.innerText.trim(), top: parseFloat(el.style.top) }));
        return { note: Boolean(document.querySelector("#journal-canvas.text-only")), boxes };
      });
      const body = moved.boxes.find((b) => b.text.includes("这两个对话框不能移动"));
      check("正文可以拖动（变成文字框）", !moved.note && body && body.top > 60, JSON.stringify(moved.boxes));
      check("标题也成为文字框、字都还在", moved.boxes.some((b) => b.text === "测试"));
      // The title box moves like any box.
      const titleBox = page.locator("#journal-canvas .text-layer", { hasText: "测试" });
      const tTop0 = await titleBox.evaluate((el) => parseFloat(el.style.top));
      await drag(page, await titleBox.boundingBox(), 0, 90);
      check("标题文字框也能拖", (await titleBox.evaluate((el) => parseFloat(el.style.top))) > tTop0 + 5);
      // Undo twice: the note comes back with both texts on it.
      await page.locator('[data-action="undo"]').first().click();
      await page.locator('[data-action="undo"]').first().click();
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => ({ note: Boolean(document.querySelector("#journal-canvas.text-only")), title: document.querySelector('[data-inline="title"]')?.innerText, body: document.querySelector('[data-inline="body"]')?.innerText }));
      check("撤销后回到原来的样子，文字不丢", back.note && back.title === "测试" && back.body === "这两个对话框不能移动", JSON.stringify(back));
      // An empty title can be dragged too (right after opening the page).
      await page.locator('[data-action="redo"]').first().click();
      await page.waitForTimeout(200);
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.locator('[data-action="quick-open"]').first().click();
      await page.locator('[data-action="quick-way"][data-way="write"]').click();
      await page.locator(".quick-start").click();
      await page.waitForSelector('#journal-canvas.text-only [data-inline="title"]');
      await page.waitForTimeout(400);
      await drag(page, await page.locator('#journal-canvas [data-inline="title"]').boundingBox(), 0, 200);
      const r = await page.evaluate(() => ({ note: Boolean(document.querySelector("#journal-canvas.text-only")), boxes: [...document.querySelectorAll("#journal-canvas .text-layer")].map((el) => parseFloat(el.style.top)) }));
      check("还没打字的标题也能直接拖", !r.note && r.boxes.length === 1 && r.boxes[0] > 30, JSON.stringify(r));
      await context.close();
    }
    // ---------- 3: Return puts the keyboard away ----------
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await SS.touchStore(page);
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        s.keeper = { ...(s.keeper || {}), enabled: false, invite: "" };
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero");
      await page.locator('[data-action="keeper-onboard"]').first().click();
      const name = page.locator("[data-keeper-name]");
      await name.click();
      await name.fill("小橘");
      check("起名字输入框的回车键显示「完成」", (await name.getAttribute("enterkeyhint")) === "done");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      check("起完名字按回车，键盘收起", await page.evaluate(() => !document.activeElement?.matches?.("[data-keeper-name]")));
      check("名字还在、面板没有关", (await name.inputValue()) === "小橘" && (await page.locator("#choose-dialog[open] .keeper-onboard").count()) === 1);
      // (V10.84: 今天的计划 is no longer on Home, so its Return test is gone.)
      await page.keyboard.press("Escape");
      await context.close();
    }
    // ---------- 4: the type bar above the keyboard in the pinned link ----------
    for (const embedded of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "zh-CN", userAgent: IPHONE });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      let app = page;
      if (embedded) {
        // Like the pinned link: the app in a frame inside another page (same
        // origin here so the test browser allows its storage).
        await page.route(`${base}/__wrap`, (route) => route.fulfill({ contentType: "text/html", body: `<body style="margin:0"><iframe src="${base}" style="border:0;width:390px;height:844px;display:block"></iframe></body>` }));
        await page.goto(`${base}/__wrap`);
        await page.waitForTimeout(500);
        app = page.frames().find((f) => f !== page.mainFrame());
      } else await page.goto(base);
      await app.waitForSelector(".hero");
      await app.locator('[data-action="today-write"]').first().click();
      await app.waitForSelector("#journal-canvas");
      await app.evaluate(() => document.activeElement?.blur?.());
      await app.locator('.tool-dock [data-action="add-text-layer"]').first().tap();
      await app.waitForTimeout(800);
      const r = await app.evaluate(() => {
        const bar = document.querySelector("#type-bar:not([hidden])")?.getBoundingClientRect();
        return { guess: document.documentElement.classList.contains("kb-guess"), line: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kb-line")) || null, barBottom: bar ? Math.round(bar.bottom) : null, inner: innerHeight };
      });
      if (embedded) {
        check("固定链接（嵌在页面里）：估算键盘高度", r.guess && r.line > 0 && r.line < r.inner * 0.7, JSON.stringify(r));
        check("固定链接：字体工具条在估算的键盘上方", r.barBottom != null && r.barBottom <= r.line, JSON.stringify(r));
      } else check("直接打开（iPhone App / Safari）：不估算，用实测", !r.guess, JSON.stringify(r));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  check("没有页面错误", errors.length === 0, errors.join(" | "));
  console.log(`\nv165: ${passed} checks passed`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
