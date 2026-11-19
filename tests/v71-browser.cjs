// V7.7 E2E — Little Keeper (optional companion) and Home's greeting; many
// book tags show the top 3 with a search for the rest.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const { studioTool, studioDetails, studioMode, studioPreview, studioEdit, studioClose, studioMore, studioMoreAction, momentField } = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const shots = process.env.SHOTS_DIR || "";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    const keeper = () => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "{}").keeper || null);
    const settings = async () => {
      await require("./signed-in.cjs").leaveReader(page);
      await page.locator('#navigation [data-page="home"]').click();
      await page.locator(".settings-gear").click();
      await page.waitForSelector(".keeper-card");
    };

    // 1. Greeting: "Hi! It's <weekday>"; tap to set a name.
    const weekday = await page.evaluate(() => new Date().toLocaleDateString("zh-CN", { weekday: "long" }));
    assert.match(await page.locator(".home-greeting").innerText(), new RegExp(`Hi！今天是${weekday}`));
    await page.locator(".home-greeting").click();
    await page.locator("[data-greeting-name]").fill("Jess");
    await page.locator("[data-greeting-name]").press("Enter");
    await page.waitForFunction(() => /Hi，Jess！/.test(document.querySelector(".home-greeting")?.textContent || ""));
    passed.push("Home: “Hi, Jess! It's <weekday>” — tap the greeting to set the name");

    // 2. Existing users aren't forced: one invitation; "Maybe later" keeps it away.
    assert.equal(await page.locator(".keeper-invite").count(), 1);
    assert.equal(await page.locator(".keeper-home").count(), 0, "off by default");
    await page.locator('[data-action="keeper-invite-dismiss"]').click();
    await page.waitForSelector(".keeper-invite", { state: "detached" });
    await page.reload();
    await page.waitForSelector(".hero");
    assert.equal(await page.locator(".keeper-invite").count(), 0, "not asked again");
    passed.push("not forced: one invitation on Home; “Maybe later” keeps it away");

    // 3. V10.93 · Onboarding from Settings: one decision — no modes, no naming here.
    await settings();
    await page.locator('.keeper-card [data-action="keeper-onboard"]').click();
    await page.waitForSelector(".keeper-onboard");
    assert.equal(await page.locator('[data-action="keeper-pick-animal"], [data-action="keeper-pick-mode"], .keeper-mode, [data-keeper-name]').count(), 0, "one decision only");
    assert.equal(await page.locator('.keeper-onboard img.bot-captain[data-asset="captain-sit-up"]').count(), 1, "the no-hat watercolour Captain");
    const sheetText = await page.locator(".keeper-onboard").innerText();
    assert.match(sheetText, /要让 Captain 陪你写手帐吗？[\s\S]*一只喜欢待在手帐旁边的小灰猫。[\s\S]*让 Captain 加入[\s\S]*以后再说/);
    assert.doesNotMatch(sheetText, /柠檬帽|lemon/i);
    await page.locator('[data-action="keeper-start"]').click();
    await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
    assert.ok(await page.locator(".keeper-card .s2-keeper").count(), "back where I was (Settings), Captain on");
    let k = await keeper();
    assert.deepEqual([k.enabled, k.animal, k.name, k.proactive, k.aiConsent], [true, "cat", "", false, false], "Captain by default; no hello-first");
    // The name: renamed later, in 角色与装扮.
    const manage = await require("./signed-in.cjs").settingsSheet(page, "keeper");
    await manage.locator("[data-keeper-rename]").fill("糯米");
    await manage.locator("[data-keeper-rename]").press("Enter");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("little-days.v1")).keeper.name === "糯米");
    await require("./signed-in.cjs").closeSheet(page);
    await page.reload();
    await page.waitForSelector(".keeper-home");
    // Quiet company: Home already greets, so Captain adds nothing until asked.
    assert.equal(await page.locator(".keeper-home .keeper-bubble, .keeper-home .keeper-entry").count(), 0, "no extra welcome line, no tag");
    // V10.91: the illustrated Captain looks over the card's edge (no 3D, no eye-follow).
    const art = page.locator('.keeper-home .cap-perch.mood-peek img.bot-captain[data-asset="expr-calm"]');
    assert.equal(await art.count(), 1);
    assert.equal(await page.locator(".keeper-home .keeper-img, [data-keeper-follow]").count(), 0);
    // A tap always gets a response: the short eyes-closed smile, then Captain's corner.
    await page.locator('.keeper-home [data-action="keeper-tap"]').click();
    await page.waitForSelector(".keeper-chat.kp");
    const bubbleBox = await page.locator(".kp .cp-card p").boundingBox();
    assert.ok(bubbleBox.width > 100 && bubbleBox.height < 120, `bubble ${bubbleBox.width}×${bubbleBox.height}`);
    await page.locator('.kp [data-action="choose-close"]').click();
    await page.waitForFunction(() => document.querySelector(".keeper-home img.bot-captain")?.naturalWidth > 0);
    assert.equal(await page.locator(".keeper svg").count(), 0);
    if (shots) await page.screenshot({ path: `${shots}/v71-home.png` });
    passed.push("onboarding: one decision (要让 Captain 陪你写手帐吗？ · 让 Captain 加入 / 以后再说), no hat, named Captain, renamed later in Settings; Home: quiet, a tap opens Captain's corner");

    // 4. Writing: quiet while typing; a stamp after Save; no reply about the page (that waits for 让 Captain 回应这一页).
    await page.locator('[data-action="today-write"]').tap();
    await page.waitForSelector("#journal-canvas");
    assert.equal(await page.locator(".studio-bar .keeper-mini, .studio-bar .keeper-img").count(), 0);
    await page.locator('#journal-canvas [data-inline="title"]').click();
    await page.keyboard.type("累但是很骄傲");
    await page.locator('#journal-canvas [data-inline="body"]').click();
    await page.keyboard.type("Today was exhausting, but I still managed to work out. I'm proud that I didn't give up.");
    await page.locator('[data-action="save-entry"]').tap();
    await page.waitForSelector(".keeper-stamp");
    assert.equal(await page.locator('.keeper-stamp img.bot-vignette[data-asset="captain-stamp"]').count(), 1);
    await page.waitForSelector(".reader .flip-page");
    await page.locator('[data-action="reader-more"]').click();
    await page.waitForSelector("#choose-dialog[open] .reader-sheet");
    assert.equal(await page.locator(".reader-keeper .keeper-ask").count(), 0, "no page reply offered yet");
    await page.locator('#choose-dialog [data-action="choose-close"]').first().click();
    passed.push("Studio: quiet while I type; a stamp after Save; no reply about the page until a per-page request exists");

    // 5. Hello first is the person's own switch (off by default); turning it off keeps the tap response.
    await settings();
    assert.equal(await page.locator('[data-action="keeper-toggle"][data-key="aiConsent"]').isDisabled(), true, "no AI service: the consent can't be switched on");
    const greet = page.locator('.keeper-card [data-action="keeper-toggle"][data-key="proactive"]');
    assert.equal(await greet.getAttribute("aria-checked"), "false");
    await greet.click();
    await page.waitForSelector('.keeper-card [data-key="proactive"][aria-checked="true"]');
    assert.equal((await keeper()).proactive, true);
    await page.locator('#navigation [data-page="home"]').click();
    await page.waitForSelector(".keeper-home .keeper-bubble, .keeper-home .keeper-entry");
    await settings();
    await page.locator('.keeper-card [data-action="keeper-toggle"][data-key="proactive"]').click();
    await page.waitForSelector('.keeper-card [data-key="proactive"][aria-checked="false"]');
    await page.locator('#navigation [data-page="home"]').click();
    await page.waitForSelector(".keeper-home");
    assert.equal(await page.locator(".keeper-home .keeper-bubble, .keeper-home .keeper-entry").count(), 0, "quiet again");
    await page.locator('.keeper-home [data-action="keeper-tap"]').click();
    await page.waitForSelector(".keeper-chat.kp");
    passed.push("say hello first: off by default; on → Captain speaks first on Home; off again → quiet, and a tap still opens Captain's corner; AI consent can't be on");

    // 6. Earlier pages are not read: asking for a memory gets an honest "not yet".
    await page.locator("[data-keeper-say]").fill("看看以前的回忆");
    await page.locator(".kp-send").click();
    await page.waitForFunction(() => /回看以前的页面还没有开放/.test(document.querySelector(".keeper-msgs")?.textContent || ""));
    await page.locator("[data-keeper-say]").fill("嗷呜");
    await page.locator(".kp-send").click();
    await page.waitForFunction(() => /没太懂|不太确定|还在想/.test(document.querySelector(".keeper-msgs")?.textContent || ""));
    assert.ok(await page.locator(".keeper-msg.them").last().evaluate((m) => m.getBoundingClientRect().width > 150));
    await page.locator('.keeper-chat [data-action="choose-close"]').first().click();
    await settings();
    const sheet2 = await require("./signed-in.cjs").settingsSheet(page, "keeper");
    assert.equal(await sheet2.locator('[data-key="allowMemories"]').count(), 0, "no earlier-pages switch");
    await require("./signed-in.cjs").closeSheet(page);
    passed.push("chat: “Look back at a memory” → not open yet (later per page); free text gets an honest answer; no earlier-pages switch");

    // 7. My Books: on the shelf; a tap says something about my journals.
    await page.locator('#navigation [data-page="books"]').click();
    await page.waitForSelector(".keeper-shelf");
    await page.locator('[data-action="keeper-shelf-tap"]').click();
    await page.waitForSelector(".keeper-shelf .keeper-bubble");
    passed.push("My Books: the companion sits by the shelf; a tap talks about my journals");

    // 8. Turn off: gone everywhere, nothing deleted, name kept.
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).entries.length);
    await settings();
    await page.locator('.keeper-card [data-action="keeper-disable"]').click();
    await page.locator('#navigation [data-page="home"]').click();
    assert.equal(await page.locator(".keeper-home, .keeper-invite").count(), 0);
    k = await keeper();
    assert.deepEqual([k.enabled, k.name, k.animal], [false, "糯米", "cat"]);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")).entries.length), before, "no pages deleted");
    passed.push("turning it off hides it everywhere; pages, name and choices are kept");

    // 9. Many tags: the top 3, the rest behind "More" with a search.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.books[0].tags = ["阅读", "感恩", "健身", "旅行", "美食", "self awareness"];
      s.books[1].tags = ["阅读", "感恩"];
      s.books[2].tags = ["阅读"];
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    await page.locator('#navigation [data-page="books"]').click();
    await page.waitForSelector(".shelf-tags");
    assert.deepEqual(await page.$$eval(".shelf-tags > [data-tag]:not([data-tag=''])", (els) => els.map((e) => e.dataset.tag)), ["阅读", "感恩", "健身"], "top 3 by use");
    await page.locator('[data-action="shelf-tags-more"]').click();
    await page.waitForSelector("[data-tag-search]");
    await page.locator("[data-tag-search]").fill("self");
    assert.equal(await page.locator(".shelf-tags-all button:not([hidden])").count(), 1);
    await page.locator(".shelf-tags-all button:not([hidden])").click();
    await page.waitForSelector('.shelf-tags [data-tag="self awareness"][aria-pressed="true"]');
    passed.push("many tags: the 3 most used, the rest behind “More” with a search; the chosen one stays in view");

    assert.deepEqual(errors, []);
    console.log(`V7.7 E2E passed (${passed.length} groups):\n - ${passed.join("\n - ")}\nNo page errors.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
