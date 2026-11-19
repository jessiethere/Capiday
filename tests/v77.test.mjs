// V7.7 Little Keeper: profile, modes, growth (fair, configurable), prompts,
// the local feedback provider and AI consent enforcement.
import test from "node:test";
import assert from "node:assert/strict";
import * as K from "../Public/js/keeper.mjs";

const day = (date, extra = {}) => ({ id: "e-" + date, date, title: "", body: "", photo: "", bookId: "daily", layers: [], media: [], moments: [], ...extra });
const photo = { id: "p", kind: "photo", text: "", mediaRef: "photo:x", x: 50, y: 50, scale: 1, rotation: 0 };

test("profile: off by default, old journals have none, bad values fall back", () => {
  const k = K.normalizeKeeper(undefined);
  assert.equal(k.enabled, false);
  assert.equal(k.mode, "gentle");
  assert.equal(k.aiConsent, false);
  assert.equal(K.normalizeKeeper({ animal: "dragon", mode: "loud", name: "x".repeat(40) }).animal, "cat");
  assert.equal(K.normalizeKeeper({ mode: "loud" }).mode, "gentle");
  assert.equal(K.normalizeKeeper({ name: "x".repeat(40) }).name.length, 12);
  assert.equal(K.keeperName({ animal: "cat", name: "" }, "zh"), "Captain");
});

test("V10.93 permissions: no modes — joined = quiet company with tap responses; hello-first only with its own switch; pages not read", () => {
  const on = (mode, extra = {}) => K.normalizeKeeper({ enabled: true, mode, ...extra });
  for (const mode of ["quiet", "gentle", "interactive", undefined]) {
    assert.equal(K.modeAllows(on(mode), "invite"), true, `${mode}: a tap opens Captain's corner`);
    assert.equal(K.modeAllows(on(mode), "chat"), true);
    assert.equal(K.modeAllows(on(mode), "feedback"), false, "page replies wait for 让 Captain 回应这一页");
    assert.equal(K.modeAllows(on(mode, { allowMemories: true }), "memories"), false);
    assert.equal(K.modeAllows(on(mode), "proactive"), false, `${mode}: an old mode name grants no hello-first`);
    assert.equal(K.modeAllows(on(mode, { proactive: true }), "proactive"), true, `${mode}: the saved switch is kept`);
  }
  assert.equal(K.modeAllows(K.normalizeKeeper({ enabled: false, mode: "interactive", proactive: true }), "chat"), false, "off means nothing");
  assert.equal(K.modeAllows(K.normalizeKeeper({ enabled: false, proactive: true }), "proactive"), false);
  assert.equal(K.todayPrompt({ hour: 20, keeper: on("quiet") }).key, "keeper.prompt.evening", "a line is composed; Home shows it only with hello-first on");
  assert.equal(K.todayPrompt({ hour: 20, keptToday: true, keeper: on("gentle") }).key, "keeper.prompt.kept");
  const memory = { title: "海边", years: 1 };
  assert.equal(K.todayPrompt({ keeper: on("interactive", { allowMemories: true, proactive: true }), memory }).key, "keeper.prompt.afternoon", "never an earlier page");
  assert.equal(K.todayPrompt({ keeper: K.normalizeKeeper({ enabled: false }) }), null);
});

test("growth: per day, capped; sad = happy; length doesn't matter; missing days never subtract; samples don't count", () => {
  const cfg = K.DEFAULT_CONFIG;
  const sad = { entries: [day("2026-11-01", { body: "今天很难过，哭了很久。" })], books: [], checks: [], drafts: {} };
  const happy = { entries: [day("2026-11-01", { body: "今天好开心！" })], books: [], checks: [], drafts: {} };
  assert.equal(K.growthPoints(sad, {}, cfg).total, K.growthPoints(happy, {}, cfg).total);
  const long = { ...happy, entries: [day("2026-11-01", { body: "字".repeat(5000), moments: [{ id: "a", title: "x" }, { id: "b", title: "y" }, { id: "c", title: "z" }] })] };
  assert.equal(K.growthPoints(long, {}, cfg).total, K.growthPoints(happy, {}, cfg).total, "5000 characters and 4 pages count the same as one line");
  const busy = { entries: [day("2026-11-01", { body: "a", layers: [photo] })], books: [], checks: [{ habitId: "h", date: "2026-11-01", minutes: 0 }], drafts: {} };
  assert.equal(K.growthPoints(busy, { revisits: ["2026-11-01"] }, cfg).total, cfg.dayCap, "a day adds at most dayCap");
  const gap = { ...happy, entries: [day("2026-01-01", { body: "a" }), day("2026-11-01", { body: "b" })] };
  assert.equal(K.growthPoints(gap, {}, cfg).total, 2 * cfg.points.day);
  assert.equal(K.growthPoints({ entries: [day("2026-11-01", { body: "x", isDemo: true })], books: [], checks: [], drafts: {} }, {}, cfg).total, 0);
});

test("stages come from config, not from the UI", () => {
  const cfg = K.keeperConfig({ keeper: { stages: [{ id: "a", min: 0 }, { id: "b", min: 3 }, { id: "c", min: 6 }] } });
  assert.equal(K.stageFor(0, cfg).id, "a");
  assert.equal(K.stageFor(3, cfg).id, "b");
  assert.equal(K.stageFor(99, cfg).id, "c");
  assert.equal(K.stageFor(4, cfg).progress, 1 / 3);
  assert.equal(K.stageFor(20).id, "growing", "defaults: New Friend → Growing Companion at 15");
});

test("feedback: the example; hard days met gently; ordinary days; no diagnosis; no repeats when possible", () => {
  const r = K.localFeedback({ text: "Today was exhausting, but I still managed to work out. I'm proud that I didn't give up.", language: "en", seed: 0 });
  // V10.3: two sentences that answer the page — no fixed third "closing" line, no stage direction.
  assert.equal(r.text, "That sounds like a long day. I'm glad you made some time for yourself.");
  assert.equal(r.tone, "");
  const sad = K.localFeedback({ text: "今天很难过，一个人哭了。", language: "zh", seed: 0 });
  assert.match(sad.text, /不太容易|已经很好了|慢慢来/);
  assert.doesNotMatch(sad.text, /开心|加油|振作/, "no forced positivity");
  const plain = K.localFeedback({ text: "今天没什么特别的，平常的一天。", language: "zh" });
  assert.match(plain.text, /平平常常|安安静静|普通/);
  for (const text of ["今天好累", "I feel down", "开心的一天", ""]) assert.doesNotMatch(K.localFeedback({ text }).text, /抑郁|焦虑症|depress|anxiety disorder|diagnos/i);
  const first = K.localFeedback({ text: "今天好累", seed: 0 });
  const second = K.localFeedback({ text: "今天好累", seed: 0, recent: first.used });
  assert.notEqual(first.text, second.text, "avoids the phrases just used");
});

test("AI consent is enforced; V10.93: page replies are not offered yet, so nothing is composed or sent", async () => {
  let calls = 0;
  const remote = { available: true, respond: async () => (calls++, { text: "remote" }) };
  const service = K.createFeedbackService({ remote });
  for (const mode of ["quiet", "gentle", "interactive"]) {
    const k = K.normalizeKeeper({ enabled: true, mode });
    assert.equal(await service.respond({ text: "今天好累" }, k), null, mode);
    assert.equal(await service.respond({ text: "x" }, { ...k, aiConsent: true }), null, `${mode} + consent`);
    assert.equal(service.canUseRemote(k), false, "never without consent");
  }
  assert.equal(calls, 0, "nothing sent");
});

test("chat (V10.93): never names earlier pages, whatever was saved before; counts only", () => {
  const state = { entries: [day("2026-11-01", { title: "窗边的下午" }), day("2026-11-09", { title: "火锅" })], books: [{ id: "daily", title: "日子" }], checks: [], drafts: {} };
  for (const extra of [{}, { allowMemories: true }]) {
    const k = K.normalizeKeeper({ enabled: true, mode: "interactive", ...extra });
    assert.equal(K.localChat("memory", { state, keeper: k, today: "2026-11-10" }).key, "keeper.chat.needMemories");
    assert.equal(K.localChat("week", { state, keeper: k, today: "2026-11-10" }).key, "keeper.chat.weekCount", "counts without titles");
    assert.equal(K.localChat("shelf", { state, keeper: k, today: "2026-11-10" }).key, "keeper.chat.shelfTags");
  }
});
