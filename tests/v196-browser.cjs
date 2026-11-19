// V10.93 · Captain's first meeting: one decision (Founder spec).
// Chromium, synthetic data, iPhone-size touch (390×844) — not an iPhone.
//  1. New user: Home's invitation is one decision (要让 Captain 陪你写手帐吗？ ·
//     让 Captain 加入 / 以后再说). Joining stays on Home; Captain is quiet
//     company (no hello first), named Captain, no hat; a tap still responds.
//  2. "Maybe later", then turned on from Settings: the same one-decision sheet
//     (no modes, no name field, no lemon hat), back to Settings afterwards.
//  3. The hello-first switch (off for someone new): on → Captain speaks first
//     on Home; off → quiet again, and a tap still opens Captain's corner.
//  4. Upgrades keep what was saved: on/off, name, look, an explicit
//     hello-first; an old mode name grants nothing; earlier pages are not read.
//  5. Both languages; the three mode cards are gone from the first meeting and
//     from Settings.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
// The old mode labels as their own button / card titles (the words 安静地 /
// quiet in a sentence are fine).
const MODE_WORDS = { zh: /^(安静|温柔|互动)$/m, en: /^(Quiet|Gentle|Interactive)$/m };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  const open = async ({ lang = "zh", keeper } = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript((lang) => {
      if (localStorage.getItem("v196.boot")) return;
      localStorage.setItem("v196.boot", "1");
      localStorage.setItem("little-days.language", lang === "en" ? "en" : "zh-CN");
      localStorage.setItem("little-days.with-samples", "0");
    }, lang);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    await page.clock.install({ time: new Date("2026-11-18T10:00:00") });
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    await page.evaluate((keeper) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const book = s.books[0].id;
      const date = "2026-11-17";
      s.entries.push({ id: "e" + date, date, title: "湖边的早晨", body: "风很轻。", bookId: book, layers: [], moments: [{ id: "m" + date, title: "湖边的早晨", body: "风很轻。", bookId: book, layers: [{ id: "t1", kind: "text", text: "今天", x: 50, y: 30, w: 40, h: 10, scale: 1, rotation: 0 }], media: [], createdAt: date + "T09:00:00.000Z" }], createdAt: date + "T09:00:00.000Z" });
      if (keeper) s.keeper = keeper;
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, keeper || null);
    await page.reload();
    await page.waitForSelector(".hero");
    return { context, page, errors };
  };
  const keeper = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).keeper || {});
  const settings = async (page) => {
    await page.locator(".settings-gear").tap();
    await page.waitForSelector(".keeper-card");
  };
  const home = async (page) => {
    await page.locator('#navigation [data-page="home"]').tap();
    await page.waitForSelector(".hero");
  };
  const tapResponds = async (page) => {
    await page.locator('.keeper-perch [data-action="keeper-tap"]').tap();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".cap-perch .cap-squint")).opacity === "1", null, { timeout: 800 });
    await page.waitForSelector("#choose-dialog[open] .kp");
    await page.locator('.kp [data-action="choose-close"]').first().tap();
    await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
  };
  const quietHome = (page) => page.locator(".keeper-home .keeper-bubble, .keeper-home .keeper-entry").count();
  try {
    // ---------------------------------------------- 1 · new user joins from Home
    {
      const { context, page, errors } = await open();
      const invite = page.locator(".keeper-invite");
      assert.match(await invite.innerText(), /要让 Captain 陪你写手帐吗？[\s\S]*一只喜欢待在手帐旁边的小灰猫。[\s\S]*让 Captain 加入[\s\S]*以后再说/);
      assert.doesNotMatch(await invite.innerText(), /柠檬帽|lemon/i);
      await invite.locator('[data-action="keeper-start"]').tap();
      await page.waitForSelector(".keeper-perch img.bot-captain");
      assert.equal(await page.locator(".hero").count(), 1, "back on Home");
      assert.equal(await page.locator("#choose-dialog[open]").count(), 0);
      const k = await keeper(page);
      assert.deepEqual([k.enabled, k.name, k.outfit, k.proactive], [true, "", "", false], "Captain, no hat, no hello first");
      assert.equal(await quietHome(page), 0, "quiet company: no line, no tag");
      await tapResponds(page);
      passed.push("new user: one decision on Home → joined, stays on Home; Captain, no hat, quiet; a tap → eyes-closed smile + Captain's corner");
      assert.deepEqual(errors, []);
      await context.close();
    }
    // ---------------------------------------------- 2 · later, then from Settings; 3 · the hello-first switch
    {
      const { context, page, errors } = await open();
      await page.locator('.keeper-invite [data-action="keeper-invite-dismiss"]').tap();
      await page.waitForSelector(".keeper-invite", { state: "detached" });
      assert.equal(await page.locator(".keeper-perch").count(), 0, "not joined");
      await page.reload();
      await page.waitForSelector(".hero");
      assert.equal(await page.locator(".keeper-invite").count(), 0, "not asked again on Home");
      await settings(page);
      await page.locator('.keeper-card [data-action="keeper-onboard"]').tap();
      await page.waitForSelector("#choose-dialog[open] .keeper-onboard");
      const sheet = page.locator(".keeper-onboard");
      assert.match(await sheet.innerText(), /要让 Captain 陪你写手帐吗？[\s\S]*一只喜欢待在手帐旁边的小灰猫。[\s\S]*让 Captain 加入[\s\S]*以后再说/);
      assert.equal(await sheet.locator('.keeper-mode, [data-action="keeper-pick-mode"], [data-keeper-name]').count(), 0, "no mode cards, no name field");
      assert.doesNotMatch(await sheet.innerText(), MODE_WORDS.zh);
      assert.equal(await sheet.locator('img[data-asset="captain-sit-up"]').count(), 1, "the no-hat watercolour Captain");
      await sheet.locator('[data-action="keeper-start"]').tap();
      await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
      await page.waitForSelector(".keeper-card .s2-keeper");
      const card = page.locator(".keeper-card");
      assert.doesNotMatch(await card.innerText(), MODE_WORDS.zh, "no modes in Settings");
      assert.equal(await card.locator('[data-action="keeper-set"][data-key="mode"]').count(), 0);
      const greet = card.locator('[data-action="keeper-toggle"][data-key="proactive"]');
      assert.match(await greet.innerText(), /允许 Captain 主动打招呼/);
      assert.equal(await greet.getAttribute("aria-checked"), "false", "off for someone new");
      passed.push("Maybe later → not asked again on Home; Settings opens the same one-decision sheet (no modes, no name, no hat) and comes back to Settings; one hello-first switch, off");

      await greet.tap();
      await page.waitForSelector('.keeper-card [data-key="proactive"][aria-checked="true"]');
      await home(page);
      await page.waitForSelector(".keeper-home .keeper-bubble, .keeper-home .keeper-entry");
      await settings(page);
      await page.locator('.keeper-card [data-action="keeper-toggle"][data-key="proactive"]').tap();
      await page.waitForSelector('.keeper-card [data-key="proactive"][aria-checked="false"]');
      await home(page);
      assert.equal(await quietHome(page), 0, "quiet again");
      await tapResponds(page);
      assert.equal((await keeper(page)).proactive, false);
      passed.push("hello first on → Captain speaks first on Home; off → quiet, and a tap still responds");
      assert.deepEqual(errors, []);
      await context.close();
    }
    // ---------------------------------------------- 4 · upgrades keep what was saved
    for (const [label, saved, expect] of [
      ["Interactive, hello first never switched on", { enabled: true, name: "糯米", outfit: "lemon", mode: "interactive", proactive: false, allowMemories: true, invite: "shown" }, { greet: false }],
      ["Gentle, hello first switched on earlier", { enabled: true, name: "", outfit: "yarn", mode: "gentle", proactive: true, invite: "shown" }, { greet: true }],
      ["Quiet", { enabled: true, name: "Mochi", outfit: "", mode: "quiet", proactive: false, invite: "shown" }, { greet: false }],
      ["turned off", { enabled: false, name: "小橘", outfit: "lemon", mode: "interactive", proactive: true, invite: "dismissed" }, { off: true }],
    ]) {
      const { context, page, errors } = await open({ keeper: saved });
      const k = await keeper(page);
      assert.deepEqual([k.enabled, k.name, k.outfit, k.proactive, k.mode], [saved.enabled, saved.name, saved.outfit, saved.proactive, saved.mode], `${label}: nothing rewritten`);
      if (expect.off) {
        assert.equal(await page.locator(".keeper-perch, .keeper-invite").count(), 0, `${label}: stays off, not asked again`);
      } else {
        await page.waitForSelector(".keeper-perch img.bot-captain");
        if (expect.greet) await page.waitForSelector(".keeper-home .keeper-bubble, .keeper-home .keeper-entry");
        else assert.equal(await quietHome(page), 0, `${label}: an old mode name grants no hello first`);
        await tapResponds(page);
        // Earlier pages are not read, whatever was saved before.
        await page.locator('.keeper-perch [data-action="keeper-tap"]').tap();
        await page.waitForSelector("#choose-dialog[open] [data-keeper-say]");
        await page.locator("[data-keeper-say]").fill("看看以前的回忆");
        await page.locator(".kp-send").tap();
        await page.waitForFunction(() => /还没有开放/.test(document.querySelector(".keeper-msgs")?.textContent || ""));
        assert.doesNotMatch(await page.locator(".keeper-msgs").innerText(), /湖边的早晨/);
        await page.locator('.kp [data-action="choose-close"]').first().tap();
        await settings(page);
        assert.equal(await page.locator('.keeper-card [data-key="proactive"]').getAttribute("aria-checked"), String(expect.greet));
        if (saved.name) assert.match(await page.locator(".keeper-card .s2-keeper").innerText(), new RegExp(saved.name));
      }
      passed.push(`upgrade (${label}): on/off, name, look and hello-first kept; ${expect.off ? "stays off" : expect.greet ? "says hello first (it was switched on)" : "quiet (mode alone grants nothing)"}; earlier pages not read`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    // ---------------------------------------------- 5 · English
    {
      const { context, page, errors } = await open({ lang: "en" });
      const invite = page.locator(".keeper-invite");
      assert.match(await invite.innerText(), /Want Captain to keep you company\?[\s\S]*A little grey cat who likes to sit beside your journal\.[\s\S]*Welcome Captain[\s\S]*Maybe later/);
      assert.doesNotMatch(await invite.innerText(), /lemon/i);
      await settings(page);
      await page.locator('.keeper-card [data-action="keeper-onboard"]').tap();
      await page.waitForSelector("#choose-dialog[open] .keeper-onboard");
      const text = await page.locator(".keeper-onboard").innerText();
      assert.match(text, /Want Captain to keep you company\?[\s\S]*Welcome Captain[\s\S]*Maybe later/);
      assert.doesNotMatch(text, MODE_WORDS.en);
      assert.doesNotMatch(text, /lemon/i);
      await page.locator('.keeper-onboard [data-action="keeper-start"]').tap();
      await page.waitForSelector(".keeper-card .s2-keeper");
      const card = await page.locator(".keeper-card").innerText();
      assert.match(card, /Let Captain say hello first/);
      assert.doesNotMatch(card, MODE_WORDS.en);
      passed.push("English: Want Captain to keep you company? · Welcome Captain / Maybe later; Let Captain say hello first; no Quiet / Gentle / Interactive");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
  console.log(`\nv196: ${passed.length} passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
