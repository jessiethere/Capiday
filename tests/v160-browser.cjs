// V10.64 · 照片分组第二阶段 (docs/PHOTO_GROUPING_PLAN.md §5, approved), in the
// Studio of a day with three pages:
//  1. 页面目录 → 选择 → 合并: the second page's photos, sticker and title join
//     the first; one 撤销 brings both pages back exactly.
//  2. A selected photo → 移到… another page (its words go with it) / 单独成一页 /
//     从这张起分成新的一页; each undone in one step.
//  3. 顺序: ‹ › and long-press drag change only photoOrder (places stay unless
//     the person asks for a new layout).
//  4. 选择 → 删除 (asks first); undo.
//  Every step: the set of media references on the day is the same (nothing
//  lost, nothing copied). zh at 390 (iPhone 13). Synthetic pages, library photos.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const { touchStore } = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const shots = process.env.SHOTS || "";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await touchStore(page);
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    await page.evaluate((d) => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const photo = (id, ref, y) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y, w: 40, h: 26, rotation: 0, scale: 1 });
      const m = (id, title, layers) => ({ id, time: "", title, body: "", tags: [], bookId: "daily", layers, media: [], layoutTemplate: "scrapbook", layoutStyle: "cozy" });
      s.entries = s.entries.filter((e) => e.date !== d);
      delete s.drafts[d];
      s.entries.push({
        id: "e-" + d, date: d, title: "", body: "", photo: "", bookId: "daily", mood: "", layers: [], media: [], isDemo: false,
        moments: [
          m("pa", "早晨", [photo("a1", "photo:latte-art", 30), photo("a2", "photo:brunch", 62), { id: "a2c", kind: "text", text: "早午餐", captionOf: "a2", x: 50, y: 80, w: 60, rotation: 0, scale: 1 }]),
          m("pb", "午后", [photo("b1", "photo:waves", 40), { id: "bs", kind: "sticker", text: "🌼", x: 20, y: 20, rotation: 0, scale: 1 }]),
          m("pc", "", [photo("c1", "photo:pizza", 40)]),
        ],
      });
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    }, today);
    await page.reload();
    await page.waitForSelector(".hero");
    // The day as the editor keeps it (the draft once something changed).
    const day = () => page.evaluate((d) => { const s = JSON.parse(localStorage.getItem("little-days.v1")); return s.drafts[d] || s.entries.find((e) => e.date === d); }, today);
    const refs = (entry) => [entry, ...entry.moments].flatMap((p) => [...(p.layers || []).map((l) => l.mediaRef).filter(Boolean), ...(p.media || []).map((c) => c.source)]).sort();
    const shape = (entry) => entry.moments.map((p) => `${p.id}:${p.layers.map((l) => l.id).join(",")}`);
    const settled = () => page.waitForFunction(() => document.querySelector("#draft-status")?.dataset.state === "saved", null, { timeout: 15000 }).then(() => page.waitForTimeout(150));
    const original = await day();
    const allRefs = refs(original);
    const undo = async () => {
      await page.locator('[data-action="undo"]').first().tap();
      await page.waitForTimeout(700);
      await settled();
    };
    const openPages = async () => {
      await page.locator('[data-action="pages-manage"]').first().tap();
      await page.waitForSelector("#choose-dialog[open] .pages-sheet");
    };
    const openPage = async (id) => {
      await openPages();
      await page.locator(`#choose-dialog [data-action="pages-open"][data-moment="${id}"]`).tap();
      await page.waitForFunction(() => !document.querySelector("#choose-dialog").open);
    };
    const selectPhoto = async (layerId) => {
      await page.evaluate(() => document.querySelector('[data-action="tool-close"]')?.click());
      const el = page.locator(`#journal-canvas [data-layer="${layerId}"]`);
      await el.evaluate((node) => node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      await el.tap({ position: { x: 10, y: 10 } }).catch(() => {});
      await page.waitForSelector('.tool-dock.ctx[data-ctx="photo"]');
    };

    // Open the day in the Studio.
    await page.evaluate((d) => { const b = document.createElement("button"); b.dataset.action = "pages-manage"; b.dataset.date = d; b.id = "t-open"; document.body.append(b); }, today);
    await page.locator("#t-open").click();
    await page.waitForSelector("#choose-dialog[open] .pages-sheet");
    await page.locator('#choose-dialog [data-action="pages-open"][data-moment="pa"]').tap();
    await page.waitForSelector("#journal-canvas");

    // 1 · 选择 → 合并 → 撤销.
    await openPages();
    await page.locator('#choose-dialog [data-action="pages-pick-toggle"]').tap();
    assert.equal(await page.locator('#choose-dialog [data-action="pages-merge"]').isDisabled(), true, "merge needs two pages");
    await page.locator('#choose-dialog [data-action="pages-pick"][data-moment="pa"]').tap();
    await page.locator('#choose-dialog [data-action="pages-pick"][data-moment="pb"]').tap();
    assert.match(await page.locator("#choose-dialog .pages-pick-head h2").innerText(), /已选 2 页/);
    if (shots) await page.screenshot({ path: `${shots}/v160-pick.png` });
    await page.locator('#choose-dialog [data-action="pages-merge"]').tap();
    await page.waitForFunction(() => /已把 2 页合并成一页，位置没动/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    let now = await day();
    assert.deepEqual(now.moments.map((p) => p.id), ["pa", "pc"]);
    const merged = now.moments[0];
    assert.deepEqual(merged.layers.filter((l) => l.kind === "photo").map((l) => l.id), ["a1", "a2", "b1"]);
    assert.ok(merged.layers.some((l) => l.id === "bs"), "the sticker came along");
    assert.ok(merged.layers.some((l) => l.kind === "text" && l.text === "午后"), "the second page's title is a text box");
    assert.deepEqual(refs(now), allRefs, "no media reference lost or added");
    await page.locator('#toast [data-action="undo"]').tap();
    await page.waitForTimeout(700);
    await settled();
    now = await day();
    assert.deepEqual(shape(now), shape(original), "one 撤销: both pages back as they were");
    passed.push("选择 → 合并: photos, sticker and title join the first page; media refs the same; 撤销 on the toast brings both pages back exactly");

    // 2 · A photo: 移到… another page / 单独成一页 / 从这张起分成新的一页.
    await openPage("pa");
    await selectPhoto("a2");
    const dock = await page.$$eval(".tool-dock.ctx button", (els) => els.map((el) => (el.dataset.action === "tool" ? el.dataset.tool : el.dataset.action)));
    assert.ok(dock.includes("photo-move") && dock.includes("photo-order"), JSON.stringify(dock));
    await page.locator('.tool-dock.ctx [data-action="photo-move"]').tap();
    await page.waitForSelector("#choose-dialog[open] .photo-move-sheet");
    assert.equal(await page.locator('#choose-dialog [data-action="photo-move-to"][data-to]:not([data-to=""])').count(), 2, "the other two pages");
    if (shots) await page.screenshot({ path: `${shots}/v160-move.png` });
    await page.locator('#choose-dialog [data-action="photo-move-to"][data-to="pc"]').tap();
    await page.waitForFunction(() => /照片已移到第 3 页/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    now = await day();
    assert.deepEqual(now.moments[2].layers.map((l) => l.id), ["c1", "a2", "a2c"], "the photo and its words moved");
    assert.deepEqual(now.moments[0].layers.map((l) => l.id), ["a1"]);
    assert.deepEqual(refs(now), allRefs);
    await undo();
    assert.deepEqual(shape(await day()), shape(original));

    await selectPhoto("a2");
    await page.locator('.tool-dock.ctx [data-action="photo-move"]').tap();
    await page.locator('#choose-dialog [data-action="photo-move-to"][data-to=""]').tap();
    await page.waitForFunction(() => /照片已单独成为第 2 页/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    now = await day();
    assert.equal(now.moments.length, 4);
    assert.deepEqual(now.moments[1].layers.map((l) => l.id), ["a2", "a2c"]);
    assert.equal(now.moments[1].bookId, "daily");
    assert.deepEqual(refs(now), allRefs);
    await undo();
    assert.deepEqual(shape(await day()), shape(original));

    await selectPhoto("a2");
    await page.locator('.tool-dock.ctx [data-action="photo-move"]').tap();
    await page.locator('#choose-dialog [data-action="photo-split"]').tap();
    await page.waitForFunction(() => /已分成两页/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    now = await day();
    assert.deepEqual(now.moments.map((p) => p.layers.filter((l) => l.kind === "photo").map((l) => l.id)), [["a1"], ["a2"], ["b1"], ["c1"]]);
    assert.deepEqual(refs(now), allRefs);
    await undo();
    assert.deepEqual(shape(await day()), shape(original));
    passed.push("a photo → 移到第 3 页 (with its words) / 单独成一页 / 从这张起分成新的一页; media refs the same; each undone in one step");

    // 3 · 顺序: ‹ › then long-press drag; places stay.
    await selectPhoto("a1");
    const places = (await day()).moments[0].layers.map((l) => [l.id, l.x, l.y]);
    await page.locator('.tool-dock.ctx [data-action="photo-order"]').tap();
    await page.waitForSelector("#choose-dialog[open] .po-item");
    assert.deepEqual(await page.$$eval(".po-item", (els) => els.map((e) => e.dataset.poId)), ["a1", "a2"]);
    await page.locator('.po-item[data-po-id="a1"] [data-action="po-step"][data-dir="1"]').tap();
    assert.deepEqual(await page.$$eval(".po-item", (els) => els.map((e) => e.dataset.poId)), ["a2", "a1"]);
    if (shots) await page.screenshot({ path: `${shots}/v160-order.png` });
    await page.locator('#choose-dialog [data-action="po-done"]').tap();
    await page.waitForSelector("#confirm-dialog[open]");
    assert.match(await page.locator("#confirm-message").innerText(), /重新排版/);
    await page.locator("#confirm-cancel").tap(); // 保持现在的位置
    await page.waitForTimeout(700);
    await settled();
    now = await day();
    const order = (p) => p.layers.filter((l) => l.kind === "photo").sort((x, y) => x.photoOrder - y.photoOrder).map((l) => l.id);
    assert.deepEqual(order(now.moments[0]), ["a2", "a1"]);
    assert.deepEqual(now.moments[0].layers.map((l) => [l.id, l.x, l.y]), places, "places and stacking stay");
    // Long-press drag a1 back in front.
    await selectPhoto("a1");
    await page.locator('.tool-dock.ctx [data-action="photo-order"]').tap();
    await page.waitForSelector("#choose-dialog[open] .po-item");
    const from = await page.locator('.po-item[data-po-id="a1"] img').boundingBox();
    const to = await page.locator('.po-item[data-po-id="a2"] img').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(420);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
    await page.mouse.up();
    assert.deepEqual(await page.$$eval(".po-item", (els) => els.map((e) => e.dataset.poId)), ["a1", "a2"], "long-press drag");
    await page.locator('#choose-dialog [data-action="po-done"]').tap();
    await page.waitForSelector("#confirm-dialog[open]");
    await page.locator("#confirm-cancel").tap();
    await page.waitForTimeout(700);
    await settled();
    assert.deepEqual(order((await day()).moments[0]), ["a1", "a2"]);
    assert.deepEqual(refs(await day()), allRefs);
    // And once with 重新排版: the page is laid out again in the new order, nothing lost.
    await selectPhoto("a1");
    await page.locator('.tool-dock.ctx [data-action="photo-order"]').tap();
    await page.locator('.po-item[data-po-id="a1"] [data-action="po-step"][data-dir="1"]').tap();
    await page.locator('#choose-dialog [data-action="po-done"]').tap();
    await page.waitForSelector("#confirm-dialog[open]");
    await page.locator("#confirm-ok").tap();
    await page.waitForFunction(() => /已按新顺序重新排版/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    now = await day();
    assert.deepEqual(order(now.moments[0]), ["a2", "a1"]);
    assert.ok(now.moments[0].layers.some((l) => l.id === "a2c"), "the photo's words stay");
    assert.deepEqual(refs(now), allRefs);
    await undo();
    assert.deepEqual(order((await day()).moments[0]), ["a1", "a2"]);
    passed.push("顺序: ‹ › and long-press drag change only photoOrder; asked before any new layout (kept places); 重新排版 lays it out in the new order, undone in one step");

    // 4 · 选择 → 删除 (asks), undo.
    await openPages();
    await page.locator('#choose-dialog [data-action="pages-pick-toggle"]').tap();
    await page.locator('#choose-dialog [data-action="pages-pick"][data-moment="pb"]').tap();
    await page.locator('#choose-dialog [data-action="pages-pick"][data-moment="pc"]').tap();
    await page.locator('#choose-dialog [data-action="pages-delete-many"]').tap();
    await page.waitForSelector("#confirm-dialog[open]");
    assert.match(await page.locator("#confirm-message").innerText(), /删除选中的 2 页/);
    await page.locator("#confirm-ok").tap();
    await page.waitForFunction(() => /已删除 2 页/.test(document.querySelector("#toast")?.textContent || ""));
    await settled();
    assert.deepEqual((await day()).moments.map((p) => p.id), ["pa"]);
    await page.evaluate(() => document.querySelector("#choose-dialog")?.open && document.querySelector("#choose-dialog").close());
    await page.locator('#toast [data-action="undo"]').tap();
    await page.waitForTimeout(700);
    await settled();
    assert.deepEqual((await day()).moments.map((p) => p.id), ["pa", "pb", "pc"]);
    assert.deepEqual(refs(await day()), allRefs);
    passed.push("选择 → 删除 (2) asks first, then 撤销 brings both pages back; media refs the same throughout");

    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
