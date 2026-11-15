// Debug-only, prepended to probe.js by editor-layout.sh: the story's photo
// picker gets the app's own sample photos (synthetic data) instead of the
// system picker, so a UI test can reach 今天的故事 without the Photos app.
(() => {
  const input = document.getElementById("attachment-image-input");
  if (!input || input.dataset.fake) return;
  input.dataset.fake = "1";
  input.click = async function () {
    const urls = [...document.querySelectorAll(".v9-pol")].map((el) => (getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/) || [])[1]).filter(Boolean);
    const files = [];
    for (const [i, u] of [...urls, urls[0]].entries()) {
      const blob = await (await fetch(u)).blob();
      files.push(new File([blob], `sample-${i}.jpg`, { type: blob.type || "image/jpeg", lastModified: Date.now() - (3 - i) * 60000 }));
    }
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
})();
