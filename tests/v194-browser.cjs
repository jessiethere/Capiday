// V10.90 · New-user guide fine-tuning, walked through at iPhone sizes
// (390×844 and 375×667, touch). Chromium with synthetic photos — not an iPhone.
//  1. Welcome: Captain (captain-lie) rests both front paws on the card's top
//     edge, head and ears above it, the words below the paws.
//  2. Photo step: only 选今天的照片 is highlighted; the tip keeps the words and
//     跳过, no 下一步; tapping the button opens the photo picker at once.
//  3. Photos picked → the page is made with no guide in the way → saved → the
//     first-page card. Picker cancelled → the guide carries on (其他方式 → …
//     → the invitation with the smiling, eyes-closed Captain).
//     The step card's avatar is the happy Captain, whole inside its disc.
//  4. 今天怎么记？: the chosen way is a thin olive line on a light green wash,
//     no dark border and no second ring.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const shots = process.env.SHOTS || "";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  const fresh = async (w, h) => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await context.addInitScript(() => localStorage.getItem("little-days.language") || localStorage.setItem("little-days.language", "zh-CN"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    return { context, page, errors };
  };
  const record = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.onboarding") || "null"));
  const box = (page, sel) => page.locator(sel).first().boundingBox();
  try {
    for (const [w, h] of [
      [390, 844],
      [375, 667],
    ]) {
      const L = `${w}×${h}`;
      // ---------------------------------------------- welcome → pick photos → first page
      {
        const { context, page, errors } = await fresh(w, h);
        await page.goto(base);
        await page.waitForSelector('#home-guide[data-step="welcome"] .hg-card');
        await page.waitForFunction(() => document.querySelector("#home-guide .hg-peek img")?.naturalWidth > 0);
        await page.waitForTimeout(500); // the card's entrance
        const card = await box(page, "#home-guide .hg-card");
        const cat = await box(page, "#home-guide .hg-peek img");
        const words = await box(page, "#home-guide .hg-body");
        const under = cat.y + cat.height - card.y; // how far the paws reach over the card's edge
        assert.equal(await page.locator('#home-guide .hg-peek img[data-asset="captain-lie"]').count(), 1);
        assert.ok(under >= 8 && under <= 20, `${L}: paws rest on the top edge (${under.toFixed(1)}px over it)`);
        assert.ok(cat.y < card.y - 100 && cat.y >= 0, `${L}: head and ears above the card, on screen (cat top ${cat.y.toFixed(0)}, card top ${card.y.toFixed(0)})`);
        assert.ok(Math.abs(cat.x + cat.width / 2 - (card.x + card.width / 2)) < 3, `${L}: centred on the card`);
        assert.ok(words.y >= cat.y + cat.height + 4, `${L}: the words start below the paws`);
        assert.ok(card.y + card.height <= h, `${L}: the card is on screen`);
        if (shots) await page.screenshot({ path: `${shots}/v194-welcome-${w}.png` });
        passed.push(`${L}: welcome — paws ${under.toFixed(1)}px over the card's edge, head above, words below`);

        await page.locator('#home-guide [data-action="hg-next"]').tap();
        await page.waitForSelector('#home-guide[data-step="photos"] .hg-ring:not([hidden])');
        await page.waitForSelector("#home-guide .hg-hit:not([hidden])");
        await page.waitForTimeout(350);
        const cta = await box(page, ".v9-home .v9-cta");
        const ring = await box(page, "#home-guide .hg-ring");
        const hit = await box(page, "#home-guide .hg-hit");
        assert.ok(Math.abs(ring.x + 6 - cta.x) < 1.5 && Math.abs(ring.width - 12 - cta.width) < 1.5 && Math.abs(ring.height - 12 - cta.height) < 1.5, `${L}: only 选今天的照片 is highlighted`);
        assert.ok(Math.abs(hit.x - cta.x) < 1 && Math.abs(hit.y - cta.y) < 1 && Math.abs(hit.width - cta.width) < 1, `${L}: the tappable area is the button`);
        assert.match(await page.locator("#home-guide .hg-body").innerText(), /选几张喜欢的照片/);
        assert.equal(await page.locator('#home-guide [data-action="hg-next"], #home-guide [data-action="hg-prev"]').count(), 0, "no 下一步");
        assert.equal(await page.locator('#home-guide [data-action="hg-skip"]').count(), 1, "跳过 stays");
        // The step card's avatar: the happy Captain, whole (contain) and centred in the round disc.
        const avatar = await page.evaluate(() => {
          const a = document.querySelector("#home-guide .hg-avatar");
          const i = a.querySelector("img");
          const s = getComputedStyle(i);
          const ar = a.getBoundingClientRect();
          const ir = i.getBoundingClientRect();
          return { asset: i.dataset.asset, fit: s.objectFit, pos: s.objectPosition, pad: [s.paddingTop, s.paddingLeft].map(parseFloat), round: getComputedStyle(a).borderRadius, inside: Math.abs(ir.width - ar.width) < 0.5 && Math.abs(ir.height - ar.height) < 0.5 };
        });
        assert.deepEqual([avatar.asset, avatar.fit, avatar.pos, avatar.round, avatar.inside], ["expr-happy", "contain", "50% 50%", "50%", true], JSON.stringify(avatar));
        assert.ok(avatar.pad.every((v) => v >= 2), "room around the ear tips and the sides");
        if (shots) await page.screenshot({ path: `${shots}/v194-photos-${w}.png` });

        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator("#home-guide .hg-hit").tap()]);
        assert.equal(await page.locator("#home-guide").count(), 0, "the guide steps aside for the picker");
        await chooser.setFiles(path.join(lib, "LD-photo-brunch.jpg"));
        await page.waitForSelector('[data-action="story-save"]');
        assert.equal(await page.locator("#home-guide").count(), 0, "no guide over the page being made");
        if (shots) await page.screenshot({ path: `${shots}/v194-picked-${w}.png` });
        await page.locator('[data-action="story-save"]').tap();
        await page.waitForSelector("#phone.in-reader");
        await page.waitForSelector("#choose-dialog[open] .first-page-card");
        assert.equal(await page.locator("#home-guide").count(), 0);
        const rec = await record(page);
        assert.deepEqual([rec.home, rec.firstPage], ["done", "done"]);
        passed.push(`${L}: photo step — only the button highlighted, no 下一步; tap → picker; photo picked → page made → saved → 你的第一篇手帐完成啦！`);
        assert.deepEqual(errors, []);
        await context.close();
      }
      // ---------------------------------------------- picker cancelled → the guide carries on
      {
        const { context, page, errors } = await fresh(w, h);
        await page.goto(base);
        await page.waitForSelector('#home-guide[data-step="welcome"] .hg-card');
        await page.locator('#home-guide [data-action="hg-next"]').tap();
        await page.waitForSelector("#home-guide .hg-hit:not([hidden])");
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator("#home-guide .hg-hit").tap()]);
        assert.ok(chooser.isMultiple());
        await page.evaluate(() => document.querySelector("#attachment-image-input").dispatchEvent(new Event("cancel", { bubbles: true })));
        await page.waitForSelector('#home-guide[data-step="ways"] .hg-ring:not([hidden])');
        assert.match(await page.locator("#home-guide .hg-count").innerText(), /2 \/ 3/);
        await page.locator('#home-guide [data-action="hg-next"]').tap();
        await page.waitForSelector('#home-guide[data-step="nav"]');
        await page.locator('#home-guide [data-action="hg-next"]').tap();
        await page.waitForSelector('#home-guide[data-step="invite"]');
        assert.match(await page.locator("#home-guide .hg-body").innerText(), /要不要现在做你的第一页/);
        assert.equal(await page.locator('#home-guide .hg-captain img[data-asset="expr-happy"]').count(), 1, "the invitation keeps the eyes-closed Captain");
        await page.locator('#home-guide [data-action="hg-start"]').tap();
        await page.waitForSelector(".quick-way.way-photo.selected");
        await page.waitForTimeout(400);
        const look = await page.evaluate(() => {
          const el = document.querySelector(".quick-way.selected");
          const s = getComputedStyle(el);
          return { focused: document.activeElement === el, width: s.borderTopWidth, color: s.borderTopColor, bg: s.backgroundColor, outline: s.outlineStyle, shadow: s.boxShadow };
        });
        assert.deepEqual([look.width, look.color, look.bg, look.outline, look.shadow], ["1px", "rgb(125, 141, 109)", "rgb(232, 238, 227)", "none", "none"], JSON.stringify(look));
        const other = await page.evaluate(() => getComputedStyle(document.querySelector(".quick-way:not(.selected)")).backgroundColor);
        assert.notEqual(other, look.bg, "only the chosen way is green");
        if (shots) await page.screenshot({ path: `${shots}/v194-quick-${w}.png` });
        passed.push(`${L}: picker cancelled → 2 / 3 其他方式 → 日历 + 书架 → invitation (eyes-closed Captain) → 照片 + 一句话 chosen: thin olive line, light green, no second ring`);
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
  console.log(`\nv194: ${passed.length} passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
