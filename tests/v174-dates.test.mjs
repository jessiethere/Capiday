// V10.77 · CAP-022 (P1): dates and time zones.
// Founder's iPhone: the phone said 14 Nov 11:37 (evening, New York) and Home's
// journal card said 「11 月 15 日更新」. `updatedAt` is toISOString() (UTC);
// Home took its first 10 characters, the UTC date — a day ahead every evening
// in America. `localDayOf` turns a saved time into the day on this phone's
// calendar and keeps a record's own date ("YYYY-MM-DD") exactly as it is.
// Each case runs in a child process with TZ set, so the real time-zone rules
// (daylight saving included) are used. Synthetic times only.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const model = new URL("../Public/js/model.mjs", import.meta.url).href;
function inZone(tz, code) {
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", `import * as m from ${JSON.stringify(model)}; console.log(JSON.stringify(await (async () => { ${code} })()));`], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
  return JSON.parse(out);
}
const day = (tz, stamp) => inZone(tz, `return m.localDayOf(${JSON.stringify(stamp)});`);

test("the Founder's case: 23:37 on 14 Nov in New York is 14 Nov, not the UTC 15 Nov", () => {
  assert.equal(day("America/New_York", "2026-11-15T04:37:00.000Z"), "2026-11-14");
});

test("New York, 23:00 to 01:00 around midnight (EST, UTC-5)", () => {
  const cases = [
    ["2026-11-15T04:00:00.000Z", "2026-11-14"], // 23:00
    ["2026-11-15T04:59:59.999Z", "2026-11-14"], // 23:59:59
    ["2026-11-15T05:00:00.000Z", "2026-11-15"], // 00:00
    ["2026-11-15T06:00:00.000Z", "2026-11-15"], // 01:00
  ];
  for (const [stamp, want] of cases) assert.equal(day("America/New_York", stamp), want, stamp);
});

test("New York in summer (EDT, UTC-4) and on both daylight-saving days", () => {
  assert.equal(day("America/New_York", "2026-07-04T03:59:00.000Z"), "2026-07-03"); // 23:59 EDT
  assert.equal(day("America/New_York", "2026-07-04T04:00:00.000Z"), "2026-07-04"); // 00:00 EDT
  // 8 Mar 2026: 02:00 EST jumps to 03:00 EDT.
  assert.equal(day("America/New_York", "2026-03-08T06:59:00.000Z"), "2026-03-08"); // 01:59 EST
  assert.equal(day("America/New_York", "2026-03-08T07:00:00.000Z"), "2026-03-08"); // 03:00 EDT
  assert.equal(day("America/New_York", "2026-03-08T03:59:00.000Z"), "2026-03-07"); // 22:59 EST, 7 Mar
  // 1 Nov 2026: 02:00 EDT falls back to 01:00 EST (01:xx happens twice).
  assert.equal(day("America/New_York", "2026-11-01T05:30:00.000Z"), "2026-11-01"); // 01:30 EDT
  assert.equal(day("America/New_York", "2026-11-01T06:30:00.000Z"), "2026-11-01"); // 01:30 EST
  assert.equal(day("America/New_York", "2026-11-01T03:59:00.000Z"), "2026-10-31"); // 23:59 EDT
});

test("other zones: Los Angeles, Shanghai, Auckland, UTC", () => {
  assert.equal(day("America/Los_Angeles", "2026-11-15T07:30:00.000Z"), "2026-11-14"); // 23:30 PST
  assert.equal(day("Asia/Shanghai", "2026-11-14T16:30:00.000Z"), "2026-11-15"); // 00:30 CST
  assert.equal(day("Asia/Shanghai", "2026-11-14T15:30:00.000Z"), "2026-11-14"); // 23:30 CST
  assert.equal(day("Pacific/Auckland", "2026-11-14T11:30:00.000Z"), "2026-11-15"); // 00:30 NZDT
  assert.equal(day("UTC", "2026-11-15T04:37:00.000Z"), "2026-11-15");
});

test("a record's own date is never moved, in any zone", () => {
  for (const tz of ["America/New_York", "America/Los_Angeles", "Asia/Shanghai", "Pacific/Auckland", "UTC"]) {
    assert.equal(day(tz, "2026-11-14"), "2026-11-14", tz);
    assert.equal(day(tz, "2026-03-08"), "2026-03-08", tz);
    assert.equal(day(tz, "2026-11-01"), "2026-11-01", tz);
  }
});

test("dateKey / addDays stay on the local calendar across daylight saving", () => {
  const r = inZone("America/New_York", `return [m.dateKey(new Date(2026, 10, 14, 23, 37)), m.addDays("2026-03-07", 1), m.addDays("2026-03-08", 1), m.addDays("2026-10-31", 1), m.addDays("2026-11-01", 1), m.addDays("2026-11-14", -1)];`);
  assert.deepEqual(r, ["2026-11-14", "2026-03-08", "2026-03-09", "2026-11-01", "2026-11-02", "2026-11-13"]);
});

test("travel: the same saved time is shown on the calendar of the zone the phone is in now", () => {
  const stamp = "2026-11-15T04:37:00.000Z"; // written in New York at 23:37 on 14 Nov
  assert.equal(day("America/New_York", stamp), "2026-11-14");
  assert.equal(day("Asia/Shanghai", stamp), "2026-11-15"); // 12:37 on 15 Nov in Shanghai
  // The page's own date (chosen when it was written) stays 14 Nov everywhere.
  assert.equal(day("Asia/Shanghai", "2026-11-14"), "2026-11-14");
});

test("empty or broken values do not throw", () => {
  assert.equal(day("America/New_York", ""), "");
  assert.equal(day("America/New_York", "not a time"), "not a time");
});

// Keep this file runnable on its own (node --test tests/v174-dates.test.mjs).
void fileURLToPath;
