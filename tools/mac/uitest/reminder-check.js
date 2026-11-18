// V10.80 · Daily reminder check in the iOS Simulator (via -LittleDaysCheck,
// driven by ReminderUITests.swift, which taps the system's "Allow" and the
// notification banner). Synthetic data only. Runs the page's own buttons
// (click()) and, after each step, asks the app what iOS really has scheduled
// ({ type: "pending" } → window.__capidayReminders). Publishes its progress as
// an accessibility label "LDSTATE:{json}" for the UI test, and returns the
// steps (printed as "LittleDaysCheck: …").
//
// First launch on a fresh install: signs in locally and returns "seeded"
// (the UI test launches again for the scenario).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(200);
  }
  return null;
};
if (!localStorage.getItem("little-days.account")) {
  localStorage.setItem("little-days.account", JSON.stringify({ version: 1, method: "local", name: "", avatar: "🌷", createdAt: "2026-11-18T00:00:00.000Z", signedIn: true, onboarded: true }));
  localStorage.setItem("little-days.with-samples", "0");
  localStorage.setItem("little-days.onboarding", JSON.stringify({ v: 1, home: "skipped", firstPage: "done", at: "2026-11-18T00:00:00.000Z" }));
  localStorage.setItem("little-days.studio-guide", JSON.stringify({ tour: "skipped", tips: { dblTap: true } }));
  localStorage.setItem("little-days.language", "zh-CN");
  return "seeded";
}
const box = document.createElement("div");
box.setAttribute("role", "img");
box.style.cssText = "position:fixed;left:0;top:0;width:4px;height:4px;opacity:0.02;pointer-events:none;z-index:2147483647";
document.documentElement.append(box);
const steps = [];
let phase = "start";
const publish = () => {
  const host = document.querySelector("dialog[open]") || document.documentElement;
  if (box.parentNode !== host) host.append(box);
  box.setAttribute("aria-label", "LDSTATE:" + JSON.stringify({ phase, n: steps.length, steps }));
};
setInterval(publish, 300);
const click = (sel) => {
  const el = document.querySelector(sel);
  el?.click();
  return Boolean(el);
};
const pending = async () => {
  window.__capidayReminders = null;
  window.webkit.messageHandlers.littleDaysReminder.postMessage({ type: "pending" });
  const info = await until(() => window.__capidayReminders, 8000);
  if (!info) return { error: "no answer" };
  const at = info.pending.map((p) => p.at);
  return { authorization: info.authorization, count: at.length, first: at[0] || "", times: [...new Set(at.map((a) => a.slice(11)))], days: at.map((a) => a.slice(0, 10)), unique: new Set(info.pending.map((p) => p.id)).size === at.length, title: info.pending[0]?.title || "", body: info.pending[0]?.body || "" };
};
const pad = (n) => String(n).padStart(2, "0");
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const soon = new Date(Date.now() + 2 * 60 * 1000 + 30 * 1000); // fires in about two minutes
const soonTime = `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
// Later today (an hour on, at most 23:59): still ahead today, so after a page
// for today is saved, the check can see that today is left out.
const later = new Date(Date.now() + 60 * 60 * 1000);
const laterTime = later.getDate() === new Date().getDate() ? `${pad(later.getHours())}:${pad(later.getMinutes())}` : "23:59";
let result = null;
const home = async () => {
  if (document.querySelector("#phone.in-reader")) click('[data-action="reader-back"]');
  await wait(400);
  click('#navigation [data-page="home"]');
  await until(() => document.querySelector(".hero"));
};
const settings = async () => {
  await home();
  click(".settings-gear");
  await until(() => document.querySelector(".s2"));
};

await until(() => document.querySelector(".hero"), 60000);
await wait(2500);
// Hooked only now: the app's own script (a module) sets this handler while it
// starts, and this check can begin before that.
const before = window.littleDaysReminderResult;
window.littleDaysReminderResult = (r) => {
  result = r;
  before?.(r);
};
steps.push({ step: "0-start", reminder: localStorage.getItem("little-days.reminder"), pending: await pending() });

// 1. Turn on (asks for the time first), a time two minutes ahead.
await settings();
click('[data-action="reminder-toggle"]');
await until(() => document.querySelector("#reminder-pick"));
const sheetText = document.querySelector(".reminder-sheet")?.innerText || "";
document.querySelector("#reminder-pick").value = soonTime;
click('[data-action="reminder-confirm"]');
phase = "asking"; // the UI test taps "允许" / "Allow"
publish();
await until(() => result, 90000);
await wait(800);
const p1 = await pending();
steps.push({ step: "1-on", time: soonTime, todayIncluded: Boolean(p1.days?.includes(today)), sheetAskedTime: /几点/.test(sheetText), result, pending: p1 });

// 2. A draft written, not saved (it must survive the reminder tap).
await home();
click('[data-action="today-write"]');
await until(() => document.querySelector("#jot-text"));
const ta = document.querySelector("#jot-text");
ta.value = "模拟器：还没保存的草稿 draft";
ta.dispatchEvent(new Event("input", { bubbles: true }));
await wait(400);
click('[data-action="jot-back"]');
await until(() => document.querySelector(".hero"));
steps.push({ step: "2-draft", kept: Boolean(localStorage.getItem("little-days.jot")) });

// 3. The UI test goes to the Home Screen, waits for the notification and taps it.
phase = "wait-notification";
publish();
const opened = await until(() => document.querySelector('.jot-page[data-from="reminder"]'), 240000);
steps.push({ step: "3-from-notification", opened: Boolean(opened), draft: document.querySelector("#jot-text")?.value || "", page: document.querySelector(".jot-page")?.dataset.from || "" });
phase = "after-notification";
publish();

// 4. Save it (a page for today) → today's reminder is taken off.
await wait(600);
const ta2 = document.querySelector("#jot-text");
if (ta2) {
  ta2.value = (ta2.value || "") + " · saved";
  ta2.dispatchEvent(new Event("input", { bubbles: true }));
}
await wait(600);
click(".jot-save");
await until(() => document.querySelector("#phone.in-reader"), 20000);
await wait(2000);
steps.push({ step: "4-saved-today", savedToday: Boolean(JSON.parse(localStorage.getItem("little-days.v1") || "{}").entries?.some((e) => e.date === today && e.moments?.length)), pending: await pending() });

// 5. Change the time → the same reminders, rescheduled (no duplicates).
await settings();
const input = await until(() => document.querySelector("[data-reminder-time]"));
input.value = laterTime;
input.dispatchEvent(new Event("change", { bubbles: true }));
await wait(1500);
const p5 = await pending();
steps.push({ step: "5-time-later", time: laterTime, todayLeftOut: !p5.days?.includes(today), pending: p5 });

// 6. Off → nothing scheduled.
click('[data-action="reminder-toggle"]');
await wait(1500);
steps.push({ step: "6-off", reminder: localStorage.getItem("little-days.reminder"), pending: await pending() });

// 7. On again (asks for the time; iOS does not ask again).
click('[data-action="reminder-toggle"]');
await until(() => document.querySelector("#reminder-pick"));
document.querySelector("#reminder-pick").value = laterTime;
click('[data-action="reminder-confirm"]');
await wait(2000);
const p7 = await pending();
steps.push({ step: "7-on-again", todayLeftOut: !p7.days?.includes(today), pending: p7 });

phase = "done";
publish();
return JSON.stringify(steps);
