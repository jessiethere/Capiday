// V10.62 · 新手引导 (design round V10.52 §3, approved). A real new install —
// no test seeding (no Labs, no samples, no account, nothing seen).
//  1. Opens by itself on Home: Captain's welcome → 照片卡 → 其他方式 → 日历 +
//     书架 (one ring around both) → invitation. Each ring is on the real
//     place and the card never covers it. 开始我的第一篇 opens the record
//     sheet; nothing is made by the guide.
//  2. It does not come back after a reload; Settings → 功能介绍 shows it
//     again without changing anything.
//  3. The first page really saved → one card 「你的第一篇手帐完成啦！」, once.
//  4. 我自己探索 → skipped, not again; reduced motion → no animation.
//  5. Left half-way (reload mid-guide) → not again.
// zh at 375×667, en at 430×932 (reduced motion). Chromium — not a real iPhone.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");
const shots = process.env.SHOTS || "";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  const fresh = async ({ lang, w, h, reducedMotion = "no-preference" }) => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion });
    await context.addInitScript((l) => localStorage.getItem("little-days.language") || localStorage.setItem("little-days.language", l), lang === "zh" ? "zh-CN" : "en");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    return { context, page, errors };
  };
  const record = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.onboarding") || "null"));
  const ownDays = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries || []).filter((e) => !e.isDemo).length);
  // The card must not cover the ring (both measured on screen).
  const clear = (page) =>
    page.evaluate(() => {
      const ring = document.querySelector("#home-guide .hg-ring").getBoundingClientRect();
      const card = document.querySelector("#home-guide .hg-card").getBoundingClientRect();
      const overlap = !(card.bottom <= ring.top || card.top >= ring.bottom);
      return { overlap, inView: card.top >= 0 && card.bottom <= innerHeight, ring: [ring.top, ring.bottom].map(Math.round), card: [card.top, card.bottom].map(Math.round) };
    });
  const ringAround = (page, selector) =>
    page.evaluate((sel) => {
      const ring = document.querySelector("#home-guide .hg-ring").getBoundingClientRect();
      return [...document.querySelectorAll(sel)].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= ring.left - 1 && r.right <= ring.right + 1 && r.top >= ring.top - 1 && r.bottom <= ring.bottom + 1;
      });
    }, selector);
  try {
    // ------------------------------------------------ zh 375: the whole way through
    {
      const { context, page, errors } = await fresh({ lang: "zh", w: 375, h: 667 });
      await page.goto(base);
      await page.waitForSelector('#home-guide[data-step="welcome"] .hg-card');
      assert.match(await page.locator("#home-guide .hg-body").innerText(), /嗨！我是 Captain。带你认识一下开铺手帐吧？/);
      assert.equal(await page.locator('#home-guide .hg-captain.hg-peek img.bot-captain[data-asset="captain-lie"]').count(), 1, "Captain on the welcome (V10.90: paws on the card's edge)");
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "hg-next", "focus on 带我看看");
      assert.equal((await record(page)).home, "new");
      if (shots) await page.screenshot({ path: `${shots}/v158-welcome-zh-375.png` });
      // Taps outside the card do nothing (the guide is in front).
      await page.mouse.click(30, 300);
      assert.equal(await page.locator("#home-guide").count(), 1);
      await page.locator('#home-guide [data-action="hg-next"]').tap();
      const places = [
        ["photos", ".v9-home .v9-cta", /选几张喜欢的照片/],
        ["ways", ".v9-home .today-tiles", /写一句、画几笔、录一段声音/],
        ["nav", '#navigation [data-page="calendar"], #navigation [data-page="books"]', /日历里，也收在你的手帐本里/],
      ];
      const seen = [];
      for (const [id, selector, words] of places) {
        await page.waitForSelector(`#home-guide[data-step="${id}"] .hg-ring:not([hidden])`);
        await page.waitForTimeout(350);
        assert.match(await page.locator("#home-guide .hg-body").innerText(), words);
        assert.ok(await ringAround(page, selector), `${id}: the ring is around the real place`);
        const c = await clear(page);
        assert.ok(!c.overlap && c.inView, `${id}: the card is beside the ring, on screen ${JSON.stringify(c)}`);
        assert.equal(await page.locator("#home-guide .hg-captain").count(), 0, "Captain only as a small avatar here");
        assert.equal(await page.locator('#home-guide .hg-avatar img.bot-captain[data-asset="expr-happy"]').count(), 1);
        if (shots) await page.screenshot({ path: `${shots}/v158-${id}-zh-375.png` });
        seen.push(`${id} ring ${c.ring.join("–")} card ${c.card.join("–")}`);
        if (id === "photos") {
          // V10.90: no 下一步 here — tapping 选今天的照片 opens the picker; cancelling it, the guide carries on.
          assert.equal(await page.locator('#home-guide [data-action="hg-next"]').count(), 0);
          assert.equal(await page.locator('#home-guide [data-action="hg-skip"]').count(), 1);
          const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator("#home-guide .hg-hit").tap()]);
          assert.ok(chooser.isMultiple());
          await page.evaluate(() => document.querySelector("#attachment-image-input").dispatchEvent(new Event("cancel", { bubbles: true })));
          continue;
        }
        await page.locator('#home-guide [data-action="hg-next"]').tap();
      }
      await page.waitForSelector('#home-guide[data-step="invite"]');
      assert.match(await page.locator("#home-guide .hg-body").innerText(), /要不要现在做你的第一页/);
      if (shots) await page.screenshot({ path: `${shots}/v158-invite-zh-375.png` });
      await page.locator('#home-guide [data-action="hg-start"]').tap();
      await page.waitForSelector("#choose-dialog[open]");
      assert.equal(await page.locator("#home-guide").count(), 0);
      assert.equal((await record(page)).home, "done");
      assert.equal(await ownDays(page), 0, "the guide made nothing");
      passed.push(`zh 375: opens by itself; welcome (Captain, focus on 带我看看) → ${seen.join(" · ")} → invitation; 开始我的第一篇 opens the record sheet; nothing made`);
      await page.keyboard.press("Escape");

      // 2 · Not again; Settings replays it, changing nothing.
      await page.reload();
      await page.waitForSelector(".hero");
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#home-guide").count(), 0, "not again after a reload");
      const before = await record(page);
      await page.locator('.home-top [data-page="settings"]').tap();
      await page.locator('[data-action="tour-replay"]').tap();
      await page.waitForSelector('#home-guide[data-step="welcome"]');
      await page.locator('#home-guide [data-action="hg-next"]').tap();
      await page.waitForSelector('#home-guide[data-step="photos"] .hg-ring:not([hidden])');
      await page.locator('#home-guide [data-action="hg-skip"]').first().tap();
      await page.waitForFunction(() => !document.querySelector("#home-guide"));
      assert.deepEqual(await record(page), before, "a replay changes nothing");
      assert.equal(await ownDays(page), 0);
      passed.push("zh 375: not again after a reload; Settings → 功能介绍 shows it again and changes nothing");

      // 3 · The first page saved → the card, once.
      const save = async (name) => {
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-action="today-photos"]').first().tap()]);
        await chooser.setFiles(path.join(lib, `LD-photo-${name}.jpg`));
        await page.waitForSelector('[data-action="story-save"]');
        await page.locator('[data-action="story-save"]').tap();
        await page.waitForSelector("#phone.in-reader");
      };
      await save("brunch");
      await page.waitForSelector("#choose-dialog[open] .first-page-card");
      assert.match(await page.locator(".first-page-card h2").innerText(), /你的第一篇手帐完成啦！/);
      assert.equal(await page.locator('.first-page-card .fp-art img.bot-captain[data-asset="expr-happy"]').count(), 1, "V10.89: the happy illustrated Captain");
      assert.equal((await record(page)).firstPage, "done");
      assert.equal(await ownDays(page), 1);
      if (shots) await page.screenshot({ path: `${shots}/v158-first-page-zh-375.png` });
      await page.locator('[data-action="fp-home"]').tap();
      await page.waitForSelector(".hero");
      await save("latte-art");
      await page.waitForTimeout(1200);
      assert.equal(await page.locator("#choose-dialog[open] .first-page-card").count(), 0, "only once");
      passed.push("zh 375: the first page saved → 你的第一篇手帐完成啦！ (after it is stored), 回到首页; the second page: no card");
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ------------------------------------------------ en 430, reduced motion: 我自己探索
    {
      const { context, page, errors } = await fresh({ lang: "en", w: 430, h: 932, reducedMotion: "reduce" });
      await page.goto(base);
      await page.waitForSelector('#home-guide[data-step="welcome"] .hg-card');
      assert.match(await page.locator("#home-guide .hg-body").innerText(), /Hi, I'm Captain\. Want a quick look around\?/);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#home-guide .hg-card")).animationName), "none", "no animation with reduced motion");
      const sizes = await page.$$eval("#home-guide .hg-actions button", (els) => els.map((e) => e.getBoundingClientRect().height));
      assert.ok(sizes.every((h) => h >= 44), `buttons ≥ 44 pt (${sizes})`);
      await page.locator('#home-guide [data-action="hg-skip"]').tap();
      await page.waitForFunction(() => !document.querySelector("#home-guide"));
      assert.equal((await record(page)).home, "skipped");
      await page.reload();
      await page.waitForSelector(".hero");
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#home-guide").count(), 0);
      passed.push("en 430: Captain's welcome in English; reduced motion → no animation; buttons ≥ 44; I'll explore → skipped, not again");
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ------------------------------------------------ zh 375: left half-way
    {
      const { context, page, errors } = await fresh({ lang: "zh", w: 375, h: 667 });
      await page.goto(base);
      await page.waitForSelector('#home-guide[data-step="welcome"]');
      await page.locator('#home-guide [data-action="hg-next"]').tap();
      await page.waitForSelector('#home-guide[data-step="photos"]');
      await page.reload();
      await page.waitForSelector(".hero");
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#home-guide").count(), 0, "left half-way: not again");
      assert.equal((await record(page)).home, "skipped");
      passed.push("zh 375: left half-way (the app closed) → counts as skipped, not again");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
