// V10.65 · S1-1 恢复安全 (docs/SPRINT1_BACKUP_RESTORE_PLAN.md S1-1). Synthetic
// journals and synthetic media only (generated in the page), zh at iPhone 13.
//  1. Preview counts come from the parsed file (a lying "summary" is ignored);
//     cancelling at the preview or at the second question changes nothing.
//  2. Damaged JSON / unusable media / incomplete file / snapshot write failure
//     / a file that breaks half way: the journal and media references stay as
//     they were; files a broken restore wrote are kept and listed, never deleted.
//  3. A full restore: books, days (Calendar dates), pages, plans, habits,
//     Captain and every media reference verified from the journal as written.
//  4. Restoring the same backup again writes no media; a file whose id is taken
//     by other bytes gets one new id the first time and none the second.
//  5. The app closed at each stage (after the snapshot, during media, before
//     and after the switch) → the next start settles it; after the switch with
//     a file gone → back to the journal from before.
//  6. 撤销 (7 days) brings back the earlier journal and its media; refused when
//     one of its files is gone (the journal stays).
//  7. An unsaved Studio edit is saved (and in the snapshot) before a restore;
//     when it cannot be saved, the restore does not start.
//  8. Daily snapshots: written and read back, 3 days / 14 days, no media,
//     never called a backup; a failed snapshot is reported and saving goes on.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

// Test-only: make IndexedDB puts for a key (or a "prefix*") fail, as a full disk would.
function failingPuts() {
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    let fail = null;
    try {
      fail = localStorage.getItem("test.idb.fail");
    } catch {}
    if (fail && typeof key === "string" && (fail.endsWith("*") ? key.startsWith(fail.slice(0, -1)) : key === fail)) throw new DOMException("synthetic full disk", "QuotaExceededError");
    return put.apply(this, arguments);
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  if (process.env.PROGRESS) passed.push = (...items) => (items.forEach((x) => console.log(" … " + x)), Array.prototype.push.apply(passed, items));
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"], locale: "zh-CN" });
    await context.addInitScript(failingPuts);
    await context.addInitScript(() => {
      try {
        localStorage.setItem("little-days.language", "zh");
      } catch {}
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);

    // ---------- synthetic media + journals A and B, and their backups ----------
    const made = await page.evaluate(async () => {
      const { MediaStore } = await import("./js/media.mjs");
      const m = new MediaStore();
      const png = async (hue) => {
        const c = document.createElement("canvas");
        c.width = 24;
        c.height = 16;
        const g = c.getContext("2d");
        g.fillStyle = `hsl(${hue} 60% 55%)`;
        g.fillRect(0, 0, 24, 16);
        g.fillStyle = "#fff";
        g.fillRect(hue % 20, 3, 3, 3);
        return new Promise((r) => c.toBlob(r, "image/png"));
      };
      const ids = {};
      for (const [name, hue] of [["a1", 10], ["a2", 70], ["cover", 130], ["shared", 190], ["b1", 250]]) ids[name] = await m.put(await png(hue), { kind: "photo", name: "synthetic " + name }, null);
      ids.voice = await m.put(new Blob([new Uint8Array(4096).map((_, i) => (i * 7) & 255)], { type: "audio/webm" }), { kind: "audio", name: "synthetic voice", duration: 2 }, null);
      const live = JSON.parse(localStorage.getItem("little-days.v1"));
      const photo = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: "media:" + ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
      const pg = (id, title, layers, media = []) => ({ id, time: "", title, body: "合成正文 " + title, tags: [], bookId: "s1-book", layers, media });
      const day = (date, moments) => ({ id: "s1-" + date, date, title: "", body: "", photo: "", bookId: "s1-book", mood: "", layers: [], media: [], isDemo: false, moments });
      const book = { ...live.books[0], id: "s1-book", title: "合成测试本", category: live.books[0].category || "daily", coverImage: "media:" + ids.cover };
      const journal = (days, keeperName) => {
        const s = structuredClone(live);
        s.books = [...live.books.filter((b) => b.id !== "s1-book"), book];
        s.entries = [...live.entries.filter((e) => e.isDemo === true), ...days];
        s.drafts = {};
        s.plans = { "2026-11-02": [{ id: "p-" + keeperName, text: "买纸", done: false }] };
        s.keeper = { ...(live.keeper || {}), name: keeperName, notes: ["合成记忆 " + keeperName] };
        return s;
      };
      const A = journal([
        day("2026-11-01", [pg("a-p1", "早晨", [photo("l1", ids.a1), photo("l2", ids.shared)]), pg("a-p2", "午后", [photo("l3", ids.a2)])]),
        day("2026-11-02", [pg("a-p3", "海边", [], [{ id: "clip-v", kind: "audio", name: "风", mime: "audio/webm", source: "media:" + ids.voice }])]),
        day("2026-11-03", [pg("a-p4", "晚上", [photo("l4", ids.a1)])]),
      ], "队长A");
      const B = journal([day("2026-11-05", [pg("b-p1", "新的一天", [photo("l5", ids.b1), photo("l6", ids.shared)])])], "队长B");
      const backupA = await m.backup(A);
      const backupB = await m.backup(B);
      m.close();
      return { ids, A, B, backupA: JSON.stringify(backupA), backupB: JSON.stringify(backupB) };
    });
    const { ids } = made;

    // ---------- helpers ----------
    const idb = (fn, arg) => page.evaluate(fn, arg);
    const journalRaw = () =>
      idb(() => new Promise((res, rej) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const g = q.result.transaction("kv").objectStore("kv").get("little-days.v1"); g.onsuccess = () => { res(g.result); q.result.close(); }; g.onerror = () => rej(g.error); }; q.onerror = () => rej(q.error); }));
    const kvKeys = (prefix) =>
      idb((p) => new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const g = q.result.transaction("kv").objectStore("kv").getAllKeys(); g.onsuccess = () => { res(g.result.filter((k) => String(k).startsWith(p))); q.result.close(); }; }; }), prefix);
    const kvGet = (key) =>
      idb((k) => new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const g = q.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => { res(g.result); q.result.close(); }; }; }), key);
    const kvPut = (key, value) =>
      idb(([k, v]) => new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const tx = q.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => { res(); q.result.close(); }; }; }), [key, value]);
    const mediaCount = () =>
      idb(() => new Promise((res) => { const q = indexedDB.open("little-days-media"); q.onsuccess = () => { const c = q.result.transaction("media").objectStore("media").count(); c.onsuccess = () => { res(c.result); q.result.close(); }; }; }));
    const mediaDelete = (id) =>
      idb((x) => new Promise((res) => { const q = indexedDB.open("little-days-media"); q.onsuccess = () => { const tx = q.result.transaction("media", "readwrite"); tx.objectStore("media").delete(x); tx.oncomplete = () => { res(); q.result.close(); }; }; }), id);
    const shape = async () => {
      const raw = await journalRaw();
      return page.evaluate(async (r) => {
        const RS = await import("./js/restore-safety.mjs");
        const { MediaStore, mediaReferences } = await import("./js/media.mjs");
        const s = JSON.parse(r);
        const m = new MediaStore();
        const missing = await m.missing([...mediaReferences(s)]);
        m.close();
        const sum = RS.summarize(s);
        return { ...sum, keeperName: s.keeper?.name || "", missing: missing.length, private: s.books.every((b) => !b.visibility || b.visibility === "private"), refs: [...mediaReferences(s)].sort() };
      }, raw);
    };
    const expectShape = (state) =>
      page.evaluate(async (s) => {
        const RS = await import("./js/restore-safety.mjs");
        return { ...RS.summarize(s), keeperName: s.keeper?.name || "" };
      }, state);
    const sameAs = (got, want, label) => {
      for (const k of ["books", "days", "pages", "plans", "habits", "checks", "keeper", "mediaRefs", "keeperName"]) assert.equal(got[k], want[k], `${label}: ${k}`);
      assert.deepEqual(got.dates, want.dates, `${label}: Calendar days`);
    };
    const events = () => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.events") || "[]"));
    const lastEvent = async (name) => (await events()).filter((e) => e.e === name).at(-1);
    const openSettings = async () => {
      if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
      if (!(await page.locator('[data-action="restore-backup"]').count())) {
        if (!(await page.locator(".settings-gear").count())) {
          await SS.goTab(page, "home");
          await page.waitForSelector(".hero");
        }
        await page.locator(".settings-gear").first().click();
        await page.waitForSelector('[data-action="restore-backup"]');
      }
    };
    const pick = (json, name = "capiday-backup.json") => page.locator("#backup-input").setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(json) });
    const problem = async (code) => {
      await page.waitForSelector(`#choose-dialog[open] [data-restore-problem="${code}"]`, { timeout: 20000 });
      assert.match(await page.locator("#choose-dialog .rs-safe").innerText(), /没有改动/);
      await page.locator('#choose-dialog [data-action="choose-close"]').click();
    };
    const setJournal = async (state) => {
      await page.evaluate((s) => localStorage.setItem("little-days.v1", JSON.stringify(s)), state);
      await page.reload();
      await page.waitForSelector(".hero");
      await page.waitForTimeout(300);
    };
    const wantA = await expectShape(made.A);
    const wantB = await expectShape(made.B);

    // Start from journal B.
    await setJournal(made.B);
    await SS.touchStore(page); // a durable write of B
    await page.waitForTimeout(400);
    sameAs(await shape(), wantB, "start");
    await openSettings();
    const startRaw = await journalRaw();
    const startMedia = await mediaCount();
    const unchanged = async (label) => {
      assert.equal(await journalRaw(), startRaw, `${label}: the journal is exactly as it was`);
      assert.equal((await shape()).missing, 0, `${label}: every media reference still resolves`);
    };

    // ---------- 1 · preview from the parsed file; two places to cancel ----------
    const lying = JSON.parse(made.backupA);
    lying.summary = { days: 99, pages: 99 };
    lying.createdAt = "2026-11-13T09:30:00.000Z";
    await pick(JSON.stringify(lying));
    await page.waitForSelector('#choose-dialog[open] [data-action="restore-continue"]');
    const table = await page.$$eval("#choose-dialog .rs-compare tbody tr", (rows) => Object.fromEntries(rows.map((r) => [r.querySelector("th").innerText.trim(), [...r.querySelectorAll("td")].map((td) => td.innerText.trim())])));
    assert.deepEqual(table["天"], [String(wantA.days), String(wantB.days)], "days: backup vs now");
    assert.deepEqual(table["页"], [String(wantA.pages), String(wantB.pages)], "pages: backup vs now");
    assert.deepEqual(table["手帐本"], [String(wantA.books), String(wantB.books)]);
    assert.match(table["照片 / 视频 / 声音"][0], /4 张照片 · 0 段视频 · 1 段声音/);
    assert.deepEqual(table["Captain"], ["有", "有"]);
    assert.ok(!JSON.stringify(table).includes("99"), "the file's own summary is not shown");
    assert.match(await page.locator("#choose-dialog .restore-preview").innerText(), /7 天内/);
    await SS.restoreGo(page, { cancel: "preview" });
    await unchanged("cancel at the preview");
    await pick(made.backupA);
    await SS.restoreGo(page, { cancel: "confirm" });
    await unchanged("cancel at the second question");
    assert.equal(await mediaCount(), startMedia);
    assert.deepEqual(await kvKeys("little-days.v1.before-restore."), [], "nothing written before the second yes");
    passed.push(`preview counted from the file (${wantA.days} 天 / ${wantA.pages} 页 / 4 照片 + 1 声音 vs now ${wantB.days} / ${wantB.pages}); a lying summary (99) is ignored; cancel at the preview or the second question writes nothing`);

    // ---------- 2 · refused files and failures leave everything as it was ----------
    await pick("{ not json");
    await problem("damaged");
    const badMedia = JSON.parse(made.backupA);
    badMedia.media[0].data = "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==";
    await pick(JSON.stringify(badMedia));
    await problem("bad-media");
    const gap = JSON.parse(made.backupA);
    gap.media.pop();
    await pick(JSON.stringify(gap));
    await problem("incomplete");
    const newer = JSON.parse(made.backupA);
    newer.version = 2;
    await pick(JSON.stringify(newer));
    await problem("newer-format");
    await unchanged("refused files");
    assert.equal(await mediaCount(), startMedia);
    passed.push("damaged JSON, a non-media data URL, a file missing a referenced photo and a newer format are refused before anything is written");

    // snapshot cannot be written → stop
    await page.evaluate(() => localStorage.setItem("test.idb.fail", "little-days.v1.before-restore.*"));
    await pick(made.backupA);
    await SS.restoreGo(page).catch(() => {});
    await problem("snapshot");
    await page.evaluate(() => localStorage.removeItem("test.idb.fail"));
    await unchanged("snapshot failed");
    assert.equal(await mediaCount(), startMedia, "no media written when the snapshot failed");
    passed.push("pre-restore snapshot cannot be written (synthetic full disk) → the restore stops before any media or journal write");

    // breaks half way: one new file written, then an undecodable one
    const half = JSON.parse(made.backupA);
    const extraId = "11111111-2222-4333-8444-555555555555";
    const brokenId = "99999999-2222-4333-8444-555555555555";
    half.state.entries.push({ ...half.state.entries.at(-1), id: "s1-x", date: "2026-11-07", moments: [{ id: "x-p", time: "", title: "x", body: "", tags: [], bookId: "s1-book", layers: [{ id: "lx", kind: "photo", text: "", mediaRef: "media:" + extraId, x: 50, y: 50, rotation: 0, scale: 1 }, { id: "ly", kind: "photo", text: "", mediaRef: "media:" + brokenId, x: 50, y: 50, rotation: 0, scale: 1 }], media: [] }] });
    half.media.unshift({ id: extraId, kind: "photo", name: "new", data: half.media.find((x) => x.id === ids.a2).data.replace(/A(?=[^A]*$)/, "B") });
    half.media.push({ id: brokenId, kind: "photo", name: "broken", data: "data:image/png;base64,@@@@not-base64@@@@" });
    await pick(JSON.stringify(half));
    await SS.restoreGo(page).catch(() => {});
    await problem("failed");
    await unchanged("failed during media");
    assert.equal((await lastEvent("restore_failed"))?.stage, "media");
    const orphans = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.restore-orphans") || "[]"));
    assert.ok(orphans.includes(extraId), "the file it wrote is listed");
    assert.equal(await mediaCount(), startMedia + 1, "…and kept (nothing is deleted)");
    assert.equal(await page.evaluate(() => localStorage.getItem("little-days.restore-journal")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("little-days.restore-last")), null, "no undo offered for a restore that did not happen");
    passed.push("a file that breaks half way (1 new photo written, then an undecodable one): the journal is byte-identical, all references resolve, the written file is kept and listed in restore-orphans");

    // ---------- 3 · a full restore, verified ----------
    const beforeFull = await mediaCount();
    await pick(made.backupA);
    await SS.restoreGo(page);
    const gotA = await shape();
    sameAs(gotA, wantA, "restored A");
    assert.equal(gotA.missing, 0, "every photo / sound reference resolves");
    assert.ok(gotA.private, "every journal stays private");
    assert.equal(await mediaCount(), beforeFull, "the same bytes under the same ids: no file written twice");
    const done = await lastEvent("restore_done");
    assert.equal(done.count, 5, "A uses 5 files (4 photos, 1 sound)");
    assert.equal(done.size, 5, "all 5 reused");
    const last = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.restore-last")));
    assert.ok(last?.snapshotKey && (await kvGet(last.snapshotKey)) === startRaw, "the pre-restore snapshot is exactly the journal from before");
    passed.push(`full restore: ${gotA.books} 本 · ${gotA.days} 天 (${gotA.dates.join(", ")}) · ${gotA.pages} 页 · 计划 ${gotA.plans} · 习惯 ${gotA.habits} · Captain「${gotA.keeperName}」 · ${gotA.mediaRefs} media refs all resolve; read back from IndexedDB; 0 files written (5 reused); snapshot = the old journal byte for byte`);

    // Calendar shows the restored days (the suite runs in November 2026; other months are skipped)
    await page.evaluate(() => document.querySelector("#choose-dialog")?.open && document.querySelector("#choose-dialog").close());
    await SS.goTab(page, "calendar");
    await page.waitForSelector(".calendar-grid");
    if (await page.locator('.day-cell[data-date="2026-11-01"]').count()) {
      for (const d of wantA.dates) assert.equal(await page.locator(`.day-cell[data-date="${d}"]`).getAttribute("data-has-content"), "true", `Calendar ${d}`);
      assert.equal(await page.locator('.day-cell[data-date="2026-11-05"]').getAttribute("data-has-content"), "false", "B's day is gone from the Calendar");
      passed.push(`Calendar marks ${wantA.dates.join(" / ")} and no longer 2026-11-05`);
    }

    // ---------- 6 · undo ----------
    await openSettings();
    await page.waitForSelector(".rs-undo");
    assert.match(await page.locator(".rs-undo").innerText(), /还剩 7 天/);
    await page.locator(".rs-undo").click();
    await page.locator("#confirm-dialog[open] #confirm-ok").click();
    await page.waitForFunction(() => /恢复前的手帐/.test(document.querySelector("#toast")?.innerText || ""), null, { timeout: 15000 });
    const back = await shape();
    sameAs(back, wantB, "undone");
    assert.equal(back.missing, 0, "the earlier journal's media are all here");
    assert.equal(await page.locator(".rs-undo").count(), 0, "undo is offered once");
    passed.push("撤销: back to journal B exactly (days, pages, Captain, media all resolve); the undo row then disappears");

    // ---------- 4 · same backup twice: no duplicate media ----------
    const m0 = await mediaCount();
    await pick(made.backupA);
    await SS.restoreGo(page);
    await pick(made.backupA);
    await SS.restoreGo(page);
    assert.equal(await mediaCount(), m0, "restoring the same backup twice adds no file");
    sameAs(await shape(), wantA, "A twice");
    // an id that holds other bytes here
    const clash = JSON.parse(made.backupA);
    const otherBytes = clash.media.find((x) => x.id === ids.a2).data.replace(/A(?=[^A]*$)/, "C");
    clash.media.find((x) => x.id === ids.a1).data = otherBytes;
    const m1 = await mediaCount();
    await pick(JSON.stringify(clash));
    await SS.restoreGo(page);
    assert.equal(await mediaCount(), m1 + 1, "different bytes under a taken id → one new file");
    const firstRefs = (await shape()).refs;
    assert.ok(!firstRefs.includes(ids.a1), "the page now points at the new id");
    await pick(JSON.stringify(clash));
    await SS.restoreGo(page);
    assert.equal(await mediaCount(), m1 + 1, "…and the second time none (found by content, not by name)");
    assert.deepEqual((await shape()).refs, firstRefs);
    passed.push("same backup restored twice: 0 new files; a backup whose id is taken by other bytes: 1 new file the first time, 0 the second (content hash + byte compare, never the file name)");

    // ---------- 6b · undo refused when a file of the earlier journal is gone ----------
    await pick(made.backupB);
    await SS.restoreGo(page); // now B, undo → the clash journal
    const gone = firstRefs.find((r) => !gotA.refs.includes(r)); // the clash file: only that journal uses it
    assert.ok(gone);
    await mediaDelete(gone); // synthetic file, test only
    const rawB = await journalRaw();
    await openSettings();
    await page.locator(".rs-undo").click();
    await page.locator("#confirm-dialog[open] #confirm-ok").click();
    await problem("undo-media");
    assert.equal(await journalRaw(), rawB, "the journal stays");
    passed.push("撤销 when a photo the earlier journal used is gone: refused, the current journal is unchanged");

    // ---------- 5 · the app closed during a restore ----------
    const crash = async (stage, { dropAfter = "" } = {}) => {
      await setJournal(made.A);
      await SS.touchStore(page);
      await page.waitForTimeout(300);
      await openSettings();
      const beforeRaw = await journalRaw();
      await page.evaluate((s) => localStorage.setItem("test.restore.crash", s), stage);
      await pick(made.backupB);
      await page.waitForSelector('#choose-dialog[open] [data-action="restore-continue"]');
      await page.locator('#choose-dialog [data-action="restore-continue"]').click();
      await page.locator("#confirm-dialog[open] #confirm-ok").click();
      await page.waitForFunction(() => !localStorage.getItem("test.restore.crash"), null, { timeout: 15000 });
      await page.waitForTimeout(600);
      assert.ok(await page.evaluate(() => localStorage.getItem("little-days.restore-journal")), `${stage}: the in-progress record is there`);
      if (dropAfter) await mediaDelete(dropAfter);
      await page.reload();
      await page.waitForSelector(".hero");
      await page.waitForFunction(() => !localStorage.getItem("little-days.restore-journal"), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      return { beforeRaw, outcome: (await lastEvent("restore_recovered"))?.stage };
    };
    for (const stage of ["after-snapshot", "media", "before-switch"]) {
      const r = await crash(stage);
      assert.equal(r.outcome, "kept", stage);
      sameAs(await shape(), wantA, `${stage}: journal from before`);
      assert.equal((await shape()).missing, 0);
    }
    passed.push("closed after the snapshot / during media / before the switch → next start: the journal from before, all media resolve, the in-progress record cleared");
    const r1 = await crash("after-switch");
    assert.equal(r1.outcome, "finished");
    sameAs(await shape(), wantB, "after-switch: the restored journal");
    assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.restore-last"))))?.recovered, "and it can be undone");
    passed.push("closed right after the switch → next start checks it (counts + media) and keeps it, with 撤销 available");
    const r2 = await crash("after-switch", { dropAfter: ids.b1 });
    assert.equal(r2.outcome, "rolled-back");
    sameAs(await shape(), wantA, "after-switch with a file gone: back to before");
    passed.push("closed right after the switch and a needed file is gone → next start switches back to the journal from before");

    // ---------- 7 · an unsaved edit ----------
    await SS.goTab(page, "home");
    await page.waitForSelector(".hero");
    await page.locator('[data-action="today-write"]').first().tap();
    await page.waitForSelector("#journal-canvas");
    await page.waitForTimeout(300); // Studio opens with the page title focused
    await page.keyboard.type("未保存的一句");
    await page.evaluate(() => document.activeElement.blur());
    await pick(made.backupB); // well inside the ~1 s autosave delay
    await SS.restoreGo(page);
    const lastEdit = await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.restore-last")));
    assert.match(await kvGet(lastEdit.snapshotKey), /未保存的一句/, "the edit was saved first and is in the snapshot");
    passed.push("an edit typed in Studio a moment before the restore is saved first (it is in the pre-restore snapshot, so 撤销 brings it back)");

    await page.locator('[data-action="today-write"]').first().tap();
    await page.waitForSelector("#journal-canvas");
    await page.waitForTimeout(300);
    await page.evaluate(() => localStorage.setItem("test.idb.fail", "little-days.v1"));
    await page.keyboard.type("存不下的一句");
    await page.evaluate(() => document.activeElement.blur());
    const rawBefore = await journalRaw();
    await pick(made.backupA);
    await SS.restoreGo(page).catch(() => {});
    await problem("unsaved");
    assert.equal(await journalRaw(), rawBefore, "nothing replaced");
    assert.match(await page.locator("#journal-canvas").innerText(), /存不下的一句/, "the edit is still on the page");
    await page.evaluate(() => localStorage.removeItem("test.idb.fail"));
    passed.push("when the edit cannot be saved (synthetic write failure) the restore does not start and the typed words stay on the page");

    // ---------- 8 · daily snapshots ----------
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    const snapKeys = await kvKeys("little-days.v1.snap.");
    assert.ok(snapKeys.includes("little-days.v1.snap." + today), "today's snapshot exists");
    assert.equal(JSON.parse(await kvGet("little-days.v1.snap." + today)).schemaVersion, 1);
    for (const d of ["2026-10-01", "2026-10-25"]) await kvPut("little-days.v1.snap." + d, "{}");
    const shift = (n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    for (const n of [1, 2, 3]) await kvPut("little-days.v1.snap." + shift(n), "{}");
    await page.reload();
    await page.waitForSelector(".hero");
    await page.waitForTimeout(800);
    const kept = (await kvKeys("little-days.v1.snap.")).sort();
    assert.deepEqual(kept, [shift(2), shift(1), today].map((d) => "little-days.v1.snap." + d), "3 newest days kept, older and >14-day ones removed");
    await openSettings();
    await page.waitForFunction(() => /快照/.test(document.querySelector("#rs-snap")?.textContent || ""));
    const info = await page.locator("#rs-snap").innerText();
    assert.match(info, /3 份/);
    assert.match(info, /不含照片、视频和声音文件，不能代替完整备份/);
    passed.push(`daily snapshot of today written and read back; retention keeps ${kept.length} (3 days, none older than 14) ; Settings says「${info.trim()}」`);

    // Remove today's snapshot (so one is due at the next start), THEN make snapshot writes fail.
    await idb((k) => new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const tx = q.result.transaction("kv", "readwrite"); tx.objectStore("kv").delete(k); tx.oncomplete = () => { res(); q.result.close(); }; }; }), "little-days.v1.snap." + today);
    const olderRaw = await Promise.all([shift(2), shift(1)].map((d) => kvGet("little-days.v1.snap." + d)));
    await page.evaluate(() => localStorage.setItem("test.idb.fail", "little-days.v1.snap.*"));
    await page.reload();
    await page.waitForSelector(".hero");
    await page.waitForFunction(() => localStorage.getItem("little-days.snapshot-failed"), null, { timeout: 8000 });
    assert.equal((await lastEvent("snapshot_failed"))?.err !== undefined, true);
    assert.deepEqual((await kvKeys("little-days.v1.snap.")).sort(), [shift(2), shift(1)].map((d) => "little-days.v1.snap." + d), "older snapshots stay");
    assert.deepEqual(await Promise.all([shift(2), shift(1)].map((d) => kvGet("little-days.v1.snap." + d))), olderRaw, "…unchanged");
    const savedBefore = await journalRaw();
    await SS.touchStore(page); // the journal itself still saves
    await page.waitForTimeout(600);
    const savedAfter = await journalRaw();
    assert.notEqual(savedAfter, savedBefore, "a normal edit was written to the journal database while snapshots fail");
    assert.equal(JSON.parse(savedAfter).schemaVersion, 1);
    await openSettings();
    await page.waitForFunction(() => /没能保存/.test(document.querySelector("#rs-snap")?.textContent || ""));
    await page.evaluate(() => localStorage.removeItem("test.idb.fail"));
    passed.push("snapshot cannot be written (synthetic full disk): flagged + snapshot_failed event, the older 2 stay, the journal still saves, Settings says so");

    // ---------- the rescue event is recorded now ----------
    const rescue = await page.evaluate(async () => (await import("./js/events.mjs")).logEvent.toString().includes("[a-z_]"));
    assert.ok(rescue);

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`V10.65 S1-1 restore safety: ${passed.length} checks passed`);
    passed.forEach((p) => console.log(" ✓ " + p));
  } catch (error) {
    passed.forEach((p) => console.log(" ✓ " + p));
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
