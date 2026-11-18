// V10.85 · When Captain joins a first stamp — the fixed, testable rule.
import test from "node:test";
import assert from "node:assert/strict";
import { captainRole, remember, lucky, luck, weekOf } from "../Public/js/captain-stamp.mjs";

const nov = (d) => `2026-11-${String(d).padStart(2, "0")}`;

test("the month's first stamp: Captain always comes", () => {
  assert.equal(captainRole({ date: nov(18), before: [], today: nov(18) }), "first");
  // Other months' stamps do not count.
  assert.equal(captainRole({ date: nov(18), before: ["2026-10-30", "2025-11-02"], today: nov(18) }), "first");
  // A backfilled date as the month's first stamp counts too (by the stamp's date).
  assert.equal(captainRole({ date: "2026-10-05", before: [nov(1)], today: nov(18) }), "first");
  // Even when the week's extras are used up.
  const full = { [nov(16)]: { role: "extra", on: nov(16) }, [nov(17)]: { role: "extra", on: nov(17) } };
  assert.equal(captainRole({ date: "2026-12-01", before: [nov(16), nov(17)], today: nov(18), log: full }), "first");
});

test("after that: only lucky dates, at most two extra a week", () => {
  const before = [nov(1)];
  for (let d = 2; d <= 30; d++) {
    const role = captainRole({ date: nov(d), before, today: nov(18) });
    assert.equal(role, lucky(nov(d)) ? "extra" : "", nov(d));
  }
  // Same answer every time (no randomness).
  assert.equal(luck("2026-11-18"), luck("2026-11-18"));
  // The weekly cap: simulate a week of first stamps on Wednesday 11-18.
  let log = { [nov(1)]: { role: "first", on: nov(1) } };
  const stamped = [nov(1)];
  let extras = 0;
  for (let d = 2; d <= 30; d++) {
    const role = captainRole({ date: nov(d), before: stamped, today: nov(18), log });
    if (role) log = remember(log, nov(d), role, nov(18));
    if (role === "extra") extras++;
    stamped.push(nov(d));
  }
  assert.ok(extras <= 2, `at most two extra in one week (${extras})`);
  assert.equal(extras, Math.min(2, Array.from({ length: 29 }, (_, i) => nov(i + 2)).filter(lucky).length));
  // Next week, it may come again.
  const nextWeek = Array.from({ length: 29 }, (_, i) => nov(i + 2)).find((d) => lucky(d) && !log[d]);
  if (nextWeek) assert.equal(captainRole({ date: nextWeek, before: stamped, today: "2026-11-25", log }), "extra");
});

test("never twice for one date; bad input is ignored", () => {
  const log = { [nov(5)]: { role: "first", on: nov(5) } };
  assert.equal(captainRole({ date: nov(5), before: [], today: nov(5), log }), "");
  assert.equal(captainRole({ date: "x", before: [], today: nov(5) }), "");
  assert.equal(captainRole({ date: nov(5), before: [], today: "" }), "");
});

test("week and log helpers", () => {
  assert.equal(weekOf("2026-11-18"), "2026-11-16");
  assert.equal(weekOf("2026-11-22"), "2026-11-16");
  assert.equal(weekOf("2026-11-23"), "2026-11-23");
  let log = {};
  for (let d = 1; d <= 120; d++) log = remember(log, new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10), "extra", "2026-05-01");
  assert.equal(Object.keys(log).length, 90, "kept small");
});
