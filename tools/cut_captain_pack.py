"""Cut Captain Illustrated Asset Pack v1 from the Founder's four sheets (2026-11-18).

Sources (already transparent PNGs, supplied by the Founder; "Approved reference
= specification, not inspiration"), in docs/visual/captain-pack-v1/:
- source-lying.png (1254x1254): Captain lying down, awake, paws forward;
- source-sheet.png (1254x1254): front bust, sitting, lemon hat, yarn ball;
- source-play.png (1536x1024): four Playroom frames with the yarn ball;
- source-expressions.png (1254x1254): calm, happy, curious, sleepy busts.
- source-reading-journal.webp (768x547) and source-weekly-recap.webp (768x640):
  sent in the chat as transparent WebP; weekly recap entry and page.

Playroom Asset Addendum v1.1 (Founder, 2026-11-18), docs/visual/captain-pack-v1.1/:
- playroom/yarn-lemon-hat/01–04 and playroom/hug/01–04: 768x512 transparent
  frames on one shared canvas and origin (README-founder.md).

Playroom frames keep their whole 768x512 canvas (CANVAS): no trim, no resize,
so every frame of a sequence lines up. The four v1 yarn frames are the four
768x512 quadrants of source-play.png, cut the same way.

Nothing is redrawn, recoloured or restyled. Each figure is cropped, trimmed,
the near-invisible stray pixels around the fur are cleared (alpha < 10 → 0,
which is invisible on any background), and it is only ever scaled down.

STAGING: every cut goes to docs/visual/captain-pack-v1/cut/ with manifest.json.
Only the assets in SHIP (confirmed by the Founder and used by the interface)
are also written to Public/captain/ ("确认后再接入正式页面"); the rest stay
staged until their place migrates. Status rule, same as the botanical pack:
planned pt x 3 vs pixel width. ≤ 1.2x upscale = APPROVED, ≤ 1.6x = LIMITED
SIZE, more = NEEDS HI-RES.
"""
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "docs/visual/captain-pack-v1"
OUT = DIR / "cut"
PUBLIC = ROOT / "Public/captain"
SOURCES = {key: DIR / f"source-{key}.png" for key in ("lying", "sheet", "play", "expressions")}
# Sent in the chat on 2026-11-18 as transparent WebP (the README's v1
# poses/reading-journal.png and interactions/weekly-recap.png).
SOURCES["reading-journal"] = DIR / "source-reading-journal.webp"
SOURCES["weekly-recap"] = DIR / "source-weekly-recap.webp"
V11 = ROOT / "docs/visual/captain-pack-v1.1/playroom"
for seq, prefix in (("yarn-lemon-hat", "play-hat"), ("hug", "hug")):
    for i, f in enumerate(sorted((V11 / seq).glob("*.png")), 1):
        SOURCES[f"{prefix}-{i}"] = f

# name: (source, box x0 y0 x1 y1, max width px, planned display pt, use, audit rows)
ASSETS = {
    "captain-lie": ("lying", (200, 92, 1082, 1144), 540, 120, "Lying down, awake, paws forward (Home Captain on the today card; idle)", [11]),
    "captain-face": ("sheet", (28, 74, 588, 679), 360, 64, "Front bust, calm (avatar 28-64 pt: guide, panel header, Ask Captain, Settings)", [9, 12, 14, 16]),
    "captain-sit-up": ("sheet", (674, 11, 1233, 683), 540, 150, "Sitting, looking up (greeting; onboarding; Home guide)", [7, 8]),
    "acc-lemon-hat": ("sheet", (71, 757, 527, 1148), 436, 96, "Lemon hat accessory (outfit 'lemon')", [11, 12, 15, 16, 19]),
    "acc-yarn": ("sheet", (713, 784, 1173, 1207), 300, 80, "Yarn ball accessory (outfit 'yarn'; Playroom ball)", [19, 20]),
    # v1 yarn play, no hat: the four 768x512 quadrants (one canvas each).
    "play-watch": ("play", (0, 0, 768, 512), 768, 220, "Playroom yarn 1 (no hat): watching the ball", [20]),
    "play-reach": ("play", (768, 0, 1536, 512), 768, 220, "Playroom yarn 2 (no hat): paw raised", [20]),
    "play-bat": ("play", (0, 512, 768, 1024), 768, 220, "Playroom yarn 3 (no hat): paw on the ball", [20]),
    "play-rolled": ("play", (768, 512, 1536, 1024), 768, 220, "Playroom yarn 4 (no hat): ball rolled away", [20]),
    # v1.1 addendum: yarn play wearing the lemon hat (160 / 130 / 130 / 360 ms).
    "play-hat-1": ("play-hat-1", (0, 0, 768, 512), 768, 220, "Playroom yarn, lemon hat 1: notice", [20]),
    "play-hat-2": ("play-hat-2", (0, 0, 768, 512), 768, 220, "Playroom yarn, lemon hat 2: reach", [20]),
    "play-hat-3": ("play-hat-3", (0, 0, 768, 512), 768, 220, "Playroom yarn, lemon hat 3: nudge", [20]),
    "play-hat-4": ("play-hat-4", (0, 0, 768, 512), 768, 220, "Playroom yarn, lemon hat 4: settle", [20]),
    # v1.1 addendum: hugging the heart cushion, no hat (180 / 150 / 220 / 420 ms).
    "hug-1": ("hug-1", (0, 0, 768, 512), 768, 220, "Playroom hug 1: notice the cushion", [20]),
    "hug-2": ("hug-2", (0, 0, 768, 512), 768, 220, "Playroom hug 2: lean in", [20]),
    "hug-3": ("hug-3", (0, 0, 768, 512), 768, 220, "Playroom hug 3: hug", [20]),
    "hug-4": ("hug-4", (0, 0, 768, 512), 768, 220, "Playroom hug 4: settle", [20]),
    "captain-reading": ("reading-journal", (0, 0, 768, 547), 768, 120, "Looking at the journal, a sprig beside (weekly recap entry: week card)", [18]),
    "captain-recap": ("weekly-recap", (0, 0, 768, 640), 768, 200, "Lying by an open album of landscapes, looking up (weekly recap page)", [18]),
    "expr-calm": ("expressions", (102, 16, 566, 610), 360, 96, "Expression calm (looking aside)", [12, 13, 17]),
    "expr-happy": ("expressions", (687, 25, 1158, 615), 360, 96, "Expression happy (eyes closed, smiling)", [6, 12, 13]),
    "expr-curious": ("expressions", (94, 619, 559, 1233), 360, 96, "Expression curious (wide eyes, head tilt)", [12, 17]),
    "expr-sleepy": ("expressions", (691, 665, 1179, 1237), 360, 96, "Expression sleepy (half-closed eyes)", [12, 15]),
}

# Founder 2026-11-18 ("可以放"): shipped with V10.89 for the places that use them;
# captain-lie (paws forward) with V10.90 as the card-edge peek on the welcome.
SHIP = {"captain-face", "captain-sit-up", "expr-happy", "captain-lie"}
# V10.91 (Founder, 2026-11-18): Home, Captain's panel, the shelf, Settings,
# Looks, the weekly recap and the Playroom move to the illustrated Captain.
SHIP |= {"expr-calm", "expr-sleepy", "acc-lemon-hat", "acc-yarn", "captain-reading", "captain-recap"}
SHIP |= {"play-watch", "play-reach", "play-bat", "play-rolled"}
SHIP |= {f"play-hat-{i}" for i in range(1, 5)} | {f"hug-{i}" for i in range(1, 5)}
# Playroom frames keep their full canvas (same origin across a sequence).
CANVAS = {n for n in ASSETS if n.startswith(("play-", "hug-"))}


def clean(img):
    a = np.asarray(img.convert("RGBA")).copy()
    stray = a[..., 3] < 10
    a[stray] = 0  # invisible specks: no colour, no alpha
    return Image.fromarray(a, "RGBA")


def trim(img, pad=4):
    alpha = np.asarray(img)[..., 3]
    ys, xs = np.where(alpha >= 10)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


def status(px, pt):
    scale = pt * 3 / px
    if scale <= 1.2:
        return "APPROVED", scale
    return ("LIMITED SIZE" if scale <= 1.6 else "NEEDS HI-RES"), scale


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob("*.png"):
        old.unlink()
    sources = {key: Image.open(path).convert("RGBA") for key, path in SOURCES.items()}
    entries = []
    for name, (src, box, max_w, planned, use, rows) in ASSETS.items():
        img = clean(sources[src].crop(box))
        if name not in CANVAS:
            img = trim(img)
        if img.width > max_w:
            img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
            img = clean(img)
        verdict, scale = status(img.width, planned)
        path = OUT / f"{name}.png"
        img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
        shipped = name in SHIP and verdict != "NEEDS HI-RES"
        if shipped:
            (PUBLIC / path.name).write_bytes(path.read_bytes())
        entries.append({
            "name": name,
            "status": verdict,
            "shipped": shipped,
            "source": SOURCES[src].relative_to(ROOT).as_posix(),
            "canvas": name in CANVAS,
            "sourceSize": list(sources[src].size),
            "sourceBox": list(box),
            "width": img.width,
            "height": img.height,
            "bytes": os.path.getsize(path),
            "maxSharpPt": img.width // 3,
            "plannedPt": planned,
            "upscaleAt3x": round(scale, 2),
            "use": use,
            "auditRows": rows,
        })
        print(f"{verdict:13} {name:15} {img.width}x{img.height} planned {planned}pt (clear up to {img.width // 3}pt) {os.path.getsize(path) // 1024}KB")
    manifest = {"note": "Captain Illustrated Asset Pack v1. shipped=true: also in Public/captain/; the rest stay staged until their place migrates.", "assets": entries}
    for folder in (OUT, PUBLIC):
        (folder / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
