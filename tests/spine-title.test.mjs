// V10.75 (CAP-020) · The spine's vertical words: marks in a font with vertical
// forms, "!?" upright next to Chinese, one or two digits across the line,
// Latin titles left sideways, the words escaped, "…" only when cut.
import test from "node:test";
import assert from "node:assert/strict";
import { spineTitleHTML, spineIsLatin } from "../Public/js/cover-fit.mjs";

test("Chinese marks get the vertical-form font", () => {
  assert.equal(spineTitleHTML("一个书架放五本！"), '一个书架放五本<span class="sp-mark">！</span>');
  assert.equal(spineTitleHTML("我的手帐：第一本"), '我的手帐<span class="sp-mark">：</span>第一本');
  assert.match(spineTitleHTML("「周末」—— 小日子……"), /^<span class="sp-mark">「<\/span>周末<span class="sp-mark">」<\/span><span class="sp-mark">—<\/span>/);
});
test("half-width !? stand upright, short digits go across, long numbers stay", () => {
  assert.equal(spineTitleHTML("第3本!?"), '第<span class="sp-tcy">3</span>本<span class="sp-mark sp-up">!</span><span class="sp-mark sp-up">?</span>');
  assert.equal(spineTitleHTML("12月"), '<span class="sp-tcy">12</span>月');
  assert.equal(spineTitleHTML("2026 京都"), "2026 京都");
});
test("Latin titles are left as they are (they lie sideways on the spine)", () => {
  assert.equal(spineIsLatin("The Very Long Summer Road Trip Journal"), true);
  assert.equal(spineTitleHTML("Trip 2026!"), "Trip 2026!");
  assert.equal(spineIsLatin("？"), false);
  assert.equal(spineIsLatin("2026 京都 Kyoto"), false);
});
test("words are escaped; a cut title ends with one vertical-form …", () => {
  assert.equal(spineTitleHTML('<b>"猫"</b>'), '&lt;b&gt;&quot;猫&quot;&lt;/b&gt;');
  assert.equal(spineTitleHTML("我们一家", true), '我们一家<span class="sp-mark sp-more">…</span>');
  assert.equal(spineTitleHTML(""), "");
});
test("emoji and combined characters are never split", () => {
  assert.equal(spineTitleHTML("👨‍👩‍👧 家"), "👨‍👩‍👧 家");
});
