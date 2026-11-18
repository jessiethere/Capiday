// V10.80 · 每日一问 / Daily prompt: one gentle question a day on Today, in
// Chinese and English (the app's language picks which one is shown). The
// question is only an invitation: the person's own words and voice are kept
// exactly as they are — in any language, mixed or not — and never rewritten.
// A page made from a question keeps its id and the text as it was shown
// (`prompt: { id, text }`), so the page reads the same later.
//
// Pure helpers (no storage, no DOM) so they can be tested on their own.
export const PROMPTS = [
  { id: "small-good", zh: "今天有什么小事让你觉得还不错？", en: "What small thing went right today?" },
  { id: "heard", zh: "今天听到的一句话，你想记下来的是？", en: "What's one thing someone said today that you'd like to keep?" },
  { id: "ate", zh: "今天吃到的哪一口，值得留个纪念？", en: "Which bite today deserves a little note?" },
  { id: "light", zh: "今天的光线、天气或空气是什么样的？", en: "What were the light, the weather, the air like today?" },
  { id: "smile", zh: "今天是什么让你笑了一下？", en: "What made you smile today?" },
  { id: "tired", zh: "今天累不累？累在哪里，也可以说说。", en: "Were you tired today? Say where, if you like." },
  { id: "proud", zh: "今天有哪件事，你想夸夸自己？", en: "What did you do today that deserves a little praise?" },
  { id: "someone", zh: "今天想到了谁？想对 Ta 说什么？", en: "Who crossed your mind today, and what would you tell them?" },
  { id: "sound", zh: "今天听到的哪个声音让你停了一下？", en: "Which sound today made you pause?" },
  { id: "walk", zh: "今天走过的路上，看见了什么？", en: "What did you notice on your way today?" },
  { id: "learned", zh: "今天学到了什么，大的小的都算。", en: "What did you learn today, big or small?" },
  { id: "kept-going", zh: "今天是什么让你继续往前走？", en: "What kept you going today?" },
  { id: "change", zh: "如果今天可以重来一小段，你会改哪里？", en: "If you could redo one small part of today, which would it be?" },
  { id: "tomorrow", zh: "明天有什么小小的期待？", en: "What's one small thing you're looking forward to tomorrow?" },
  { id: "photo-why", zh: "今天拍的照片里，哪一张背后有故事？", en: "Which photo from today has a story behind it?" },
  { id: "quiet", zh: "今天有没有一段安静的时间？在做什么？", en: "Did you have a quiet moment today? What were you doing?" },
  { id: "kind", zh: "今天收到或送出的一点善意是？", en: "What kindness did you give or receive today?" },
  { id: "worry", zh: "有什么在心里放不下？写下来，就先放在这里。", en: "Anything on your mind? Write it down and leave it here for now." },
  { id: "song", zh: "今天脑子里一直在放哪首歌？", en: "Which song kept playing in your head today?" },
  { id: "color", zh: "如果今天是一种颜色，会是什么？为什么？", en: "If today were a colour, which one, and why?" },
  { id: "body", zh: "今天身体想对你说什么？", en: "What did your body try to tell you today?" },
  { id: "first", zh: "今天有没有第一次做的事？", en: "Did you do anything for the first time today?" },
  { id: "home", zh: "今天家里（或住的地方）有什么小变化？", en: "What changed a little at home today?" },
  { id: "pet", zh: "今天身边的小动物、小植物怎么样了？", en: "How were the little animals or plants around you today?" },
  { id: "word", zh: "用一个词形容今天，再说说为什么。", en: "Describe today in one word, then say why." },
  { id: "future-you", zh: "一年后的你，会想记得今天的什么？", en: "A year from now, what would you like to remember about today?" },
  { id: "grateful", zh: "今天想谢谢的一个人或一件事？", en: "Who or what would you like to thank today?" },
  { id: "noticed", zh: "今天注意到一个平时没留意的细节吗？", en: "Did you notice a detail today you usually miss?" },
  { id: "laughed", zh: "最近一次笑出声，是因为什么？", en: "What last made you laugh out loud?" },
  { id: "rest", zh: "今天你是怎么让自己休息一下的？", en: "How did you give yourself a little rest today?" },
];

// "YYYY-MM-DD" → a stable number (same day, same question on every device).
function dayNumber(date) {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** The question for a day; `skip` = how many times 换一题 was tapped that day. */
export function promptFor(date, skip = 0, list = PROMPTS) {
  if (!list.length) return null;
  const step = 7; // a few apart, so neighbouring days don't feel alike
  const at = (((dayNumber(date) * step + Math.max(0, Number(skip) || 0)) % list.length) + list.length) % list.length;
  return list[at];
}

/** The question's words in the app's language ("zh" / "en"), or "" for an unknown id. */
export function promptText(id, lang = "zh", list = PROMPTS) {
  const item = list.find((p) => p.id === id);
  if (!item) return "";
  return lang === "en" ? item.en : item.zh;
}

/** What a page shows as its small question line: the current language when the
 * question is known, else exactly the text it was answered with. */
export function pagePromptText(page, lang = "zh", list = PROMPTS) {
  const prompt = page?.prompt;
  if (!prompt || typeof prompt !== "object") return "";
  return promptText(prompt.id, lang, list) || String(prompt.text || "");
}
