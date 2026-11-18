// V10.91 · The illustrated Captain everywhere (replaces the 3D tests v108 / v117).
// Chromium, synthetic data, iPhone-size touch (390×844) — not an iPhone.
//  1. Home: Captain looks over today's card (expr-calm), no eye-follow; a tap
//     closes its eyes for a moment (expr-happy), then the panel opens.
//  2. Captain's panel, Settings, the shelf: illustrated only (no 3D picture).
//  3. Looks: no hat (default) · lemon hat · yarn ball; choosing stores the look
//     ("" for the default) and nothing else in keeper changes.
//  4. Playroom (option B): one tap plays one round and stays on the last frame,
//     another tap replays. No hat → hug; lemon hat → yarn with the hat; yarn
//     → yarn (v1). Four 768×512 frames each at the Founder's timings. Reduced
//     motion → the last frame at once.
//  5. Weekly recap: reading-journal on the week card, weekly-recap on the page.
//  6. Replaying the guide with Captain on: the Captain behind the shade is the
//     illustrated one too.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  const open = async ({ reducedMotion = "no-preference", outfit } = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion });
    await context.addInitScript(() => {
      if (localStorage.getItem("v195.boot")) return;
      localStorage.setItem("v195.boot", "1");
      localStorage.setItem("little-days.language", "zh-CN");
      localStorage.setItem("little-days.with-samples", "0");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install({ time: new Date("2026-11-18T10:00:00") });
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    await page.evaluate((outfit) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const book = s.books[0].id;
      for (const d of [16, 17]) {
        const date = `2026-11-${d}`;
        s.entries.push({ id: "e" + date, date, title: "", body: "", bookId: book, layers: [], moments: [{ id: "m" + date, title: "小日子", body: "", bookId: book, layers: [{ id: "t" + d, kind: "text", text: "今天", x: 50, y: 30, w: 40, h: 10, scale: 1, rotation: 0 }], media: [], createdAt: date + "T09:00:00.000Z" }], createdAt: date + "T09:00:00.000Z" });
      }
      s.keeper = { ...(s.keeper || {}), enabled: true, invite: "accepted", animal: "cat", name: "Captain", mode: "interactive", outfit: outfit ?? "" };
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, outfit);
    await page.reload();
    await page.waitForSelector(".keeper-perch img.bot-captain");
    return { context, page, errors };
  };
  const keeper = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).keeper);
  const threeD = (page) => page.locator(".keeper-img, [data-keeper-follow], img[src*='library/keepers']").count();
  const playView = async (page) => {
    if (!(await page.locator(".kp").count())) {
      await page.locator('.keeper-perch [data-action="keeper-tap"]').tap();
      await page.waitForSelector(".kp");
    }
    await page.locator('.kp [data-action="keeper-view"][data-view="play"]').first().tap();
    await page.waitForSelector(".pr .pr-frames");
    await page.waitForFunction(() => [...document.querySelectorAll(".pr-frame")].every((i) => i.complete && i.naturalWidth > 0));
  };
  try {
    // ---------------------------------------------- Home, panel, Looks, Playroom
    {
      const { context, page, errors } = await open();
      const perch = page.locator(".keeper-perch .cap-perch");
      assert.deepEqual(await perch.locator("img").evaluateAll((els) => els.map((i) => i.dataset.asset)), ["expr-calm", "expr-happy"]);
      assert.equal(await threeD(page), 0, "no 3D Captain on Home");
      const visible = () => perch.evaluate((el) => [...el.querySelectorAll("img")].filter((i) => getComputedStyle(i).opacity === "1").map((i) => i.dataset.asset));
      assert.deepEqual(await visible(), ["expr-calm"]);
      // The card's top edge hides the lower part of the bust.
      const geo = await page.evaluate(() => {
        const img = document.querySelector(".cap-perch .cap-rest").getBoundingClientRect();
        const card = document.querySelector(".v9-hero").getBoundingClientRect();
        return { overlap: img.bottom - card.top, above: card.top - img.top };
      });
      assert.ok(geo.overlap > 20 && geo.above > 40, `Captain looks over the card's edge ${JSON.stringify(geo)}`);
      await page.locator('.keeper-perch [data-action="keeper-tap"]').tap();
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".cap-perch .cap-squint")).opacity === "1", null, { timeout: 500 });
      assert.deepEqual(await visible(), ["expr-happy"], "a tap: eyes closed for a moment");
      await page.waitForSelector(".kp");
      await page.waitForTimeout(800);
      passed.push("Home: expr-calm over the card's edge, no eye-follow; tap → expr-happy for a moment → the panel");

      assert.equal(await threeD(page), 0, "no 3D in the panel");
      assert.equal(await page.locator('.kp-head img.bot-captain[data-asset="captain-face"]').count(), 1);
      await page.locator('.kp [data-action="keeper-view"][data-view="looks"]').first().tap();
      await page.waitForSelector(".keeper-looks");
      const chips = await page.locator(".look-chip").evaluateAll((els) => els.map((b) => [b.dataset.look, b.getAttribute("aria-pressed"), b.querySelector("img")?.dataset.asset]));
      assert.deepEqual(chips, [["none", "true", "captain-face"], ["lemon", "false", "acc-lemon-hat"], ["yarn", "false", "acc-yarn"]]);
      passed.push("panel + Looks: illustrated; no hat (default) · lemon hat · yarn ball");

      // Playroom, no hat: the hug.
      await playView(page);
      const pr = page.locator(".pr");
      assert.equal(await pr.getAttribute("data-play"), "hug");
      const frames = await page.locator(".pr-frame").evaluateAll((els) => els.map((i) => [i.dataset.asset, i.naturalWidth, i.naturalHeight]));
      assert.deepEqual(frames, [["hug-1", 768, 512], ["hug-2", 768, 512], ["hug-3", 768, 512], ["hug-4", 768, 512]]);
      assert.equal(await page.locator(".pr-frames").getAttribute("data-ms"), "180,150,220,420");
      const box = await page.locator(".pr-frames").boundingBox();
      assert.ok(box.width <= 256.5 && Math.abs(box.width / box.height - 1.5) < 0.02, `one fixed 3:2 box ≤ 256pt (${box.width}×${box.height})`);
      const on = () => page.locator(".pr-frame.on").getAttribute("data-asset");
      assert.equal(await on(), "hug-1");
      const seen = [];
      const watch = page.evaluate(() => new Promise((resolve) => {
        const got = [];
        const box = document.querySelector(".pr-frames");
        const obs = new MutationObserver(() => {
          const now = box.querySelector(".pr-frame.on")?.dataset.asset;
          if (now && got[got.length - 1] !== now) got.push(now);
        });
        obs.observe(box, { subtree: true, attributes: true, attributeFilter: ["class"] });
        setTimeout(() => { obs.disconnect(); resolve(got); }, 1400);
      }));
      await page.locator(".pr .pr-body").tap();
      seen.push(...(await watch));
      assert.deepEqual(seen.slice(-3), ["hug-2", "hug-3", "hug-4"], `one round in order (${seen})`);
      await page.waitForTimeout(500);
      assert.equal(await on(), "hug-4", "stays on the last frame");
      assert.equal(await pr.getAttribute("data-frame"), "4");
      await page.locator(".pr .pr-body").tap();
      await page.waitForTimeout(60);
      assert.notEqual(await on(), "hug-4", "another tap plays it again");
      await page.waitForTimeout(1200);
      assert.equal(await on(), "hug-4");
      passed.push("Playroom, no hat: tap → hug-1…4 at 180/150/220/420 ms, stays on hug-4; tap again replays");

      // Put on the lemon hat → the yarn with the hat.
      await page.locator('.kp [data-action="keeper-view"][data-view="looks"]').first().tap();
      await page.locator('.look-chip[data-look="lemon"]').tap();
      await page.waitForSelector('.look-chip[data-look="lemon"][aria-pressed="true"]');
      const after = await keeper(page);
      assert.equal(after.outfit, "lemon");
      await playView(page);
      assert.equal(await pr.getAttribute("data-play"), "yarn-hat");
      assert.deepEqual(await page.locator(".pr-frame").evaluateAll((els) => els.map((i) => i.dataset.asset)), ["play-hat-1", "play-hat-2", "play-hat-3", "play-hat-4"]);
      assert.equal(await page.locator(".pr-frames").getAttribute("data-ms"), "160,130,130,360");
      await page.locator(".pr .pr-body").tap();
      await page.waitForTimeout(1100);
      assert.equal(await on(), "play-hat-4");
      // The yarn ball look → v1 yarn frames; back to no hat stores "".
      await page.locator('.kp [data-action="keeper-view"][data-view="looks"]').first().tap();
      await page.locator('.look-chip[data-look="yarn"]').tap();
      await page.waitForSelector('.look-chip[data-look="yarn"][aria-pressed="true"]');
      const yarn = await keeper(page);
      assert.equal(yarn.outfit, "yarn");
      assert.deepEqual({ ...yarn, outfit: "" }, { ...after, outfit: "" }, "changing the look changes nothing else in keeper");
      await playView(page);
      assert.equal(await pr.getAttribute("data-play"), "yarn");
      assert.deepEqual(await page.locator(".pr-frame").evaluateAll((els) => els.map((i) => i.dataset.asset)), ["play-watch", "play-reach", "play-bat", "play-rolled"]);
      await page.locator('.kp [data-action="keeper-view"][data-view="looks"]').first().tap();
      await page.locator('.look-chip[data-look="none"]').tap();
      await page.waitForSelector('.look-chip[data-look="none"][aria-pressed="true"]');
      assert.equal((await keeper(page)).outfit, "");
      passed.push("Looks → Playroom: lemon hat → play-hat-1…4 (160/130/130/360 ms); yarn ball → v1 yarn frames; no hat stored as \"\"; nothing else in keeper changes");
      assert.deepEqual(errors, []);
      await context.close();
    }
    // ---------------------------------------------- reduced motion; shelf, Settings, weekly recap, guide replay
    {
      const { context, page, errors } = await open({ reducedMotion: "reduce", outfit: "lemon" });
      await playView(page);
      await page.locator(".pr .pr-body").tap();
      await page.waitForTimeout(80);
      assert.equal(await page.locator(".pr-frame.on").getAttribute("data-asset"), "play-hat-4", "reduced motion: the last frame at once");
      await page.keyboard.press("Escape");
      passed.push("reduced motion: straight to the last frame");

      await page.locator('#navigation [data-page="books"]').tap();
      await page.waitForSelector(".keeper-shelf img.bot");
      assert.equal(await threeD(page), 0, "no 3D on the shelf");
      assert.equal(await page.locator('.keeper-shelf img[data-asset="captain-sit-up"], .keeper-shelf img[data-asset="captain-sleep"]').count(), 1);
      await page.locator('#navigation [data-page="home"]').tap();
      await page.waitForSelector(".hero");
      await page.locator(".settings-gear").tap();
      await page.waitForSelector(".s2-keeper img.bot-captain");
      assert.equal(await threeD(page), 0, "no 3D in Settings");
      passed.push("shelf (sitting up by day) and Settings: illustrated only");

      await page.locator('#navigation [data-page="home"]').tap();
      await page.waitForSelector(".week-card");
      assert.equal(await page.locator('.week-card .wk-captain img[data-asset="captain-reading"]').count(), 1, "the week card: Captain reading the journal");
      const wk = await page.evaluate(() => {
        const cap = document.querySelector(".week-card .wk-captain").getBoundingClientRect();
        const line = document.querySelector(".week-card .wk-line").getBoundingClientRect();
        return cap.left >= line.right - 1 || cap.top >= line.bottom || cap.bottom <= line.top;
      });
      assert.ok(wk, "Captain stays clear of the week's line");
      await page.locator(".week-card").tap();
      await page.waitForSelector(".week-page .wp-captain img");
      assert.equal(await page.locator('.week-page .wp-captain img[data-asset="captain-recap"]').count(), 1);
      await page.waitForFunction(() => document.querySelector(".wp-captain img").naturalWidth > 0);
      passed.push("weekly recap: captain-reading on the week card (clear of the words), captain-recap on the week page");

      await page.locator('#navigation [data-page="home"]').tap();
      await page.locator(".settings-gear").tap();
      await page.locator('[data-action="tour-replay"]').tap();
      await page.waitForSelector('#home-guide[data-step="welcome"]');
      assert.equal(await page.locator('.keeper-perch img[data-asset="expr-calm"]').count(), 1, "behind the shade: the illustrated Captain");
      assert.equal(await threeD(page), 0);
      passed.push("guide replayed with Captain on: the Captain behind the shade is illustrated, no 3D anywhere");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
  console.log(`\nv195: ${passed.length} passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
