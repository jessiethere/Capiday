"""Cut Captain Illustrated Asset Pack v1 from the Founder's four sheets (2026-11-18).

Sources (already transparent PNGs, supplied by the Founder; "Approved reference
= specification, not inspiration"), in docs/visual/captain-pack-v1/:
- source-lying.png (1254x1254): Captain lying down, awake, paws forward;
- source-sheet.png (1254x1254): front bust, sitting, lemon hat, yarn ball;
- source-play.png (1536x1024): four Playroom frames with the yarn ball;
- source-expressions.png (1254x1254): calm, happy, curious, sleepy busts.

Nothing is redrawn, recoloured or restyled. Each figure is cropped, trimmed,
the near-invisible stray pixels around the fur are cleared (alpha < 10 → 0,
which is invisible on any background), and it is only ever scaled down.

STAGING: the cuts go to docs/visual/captain-pack-v1/cut/ with manifest.json,
not to Public/. They reach the app only after the Founder confirms where each
one is used ("确认后再接入正式页面"). Status rule, same as the botanical pack:
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
SOURCES = {key: DIR / f"source-{key}.png" for key in ("lying", "sheet", "play", "expressions")}

# name: (source, box x0 y0 x1 y1, max width px, planned display pt, use, audit rows)
ASSETS = {
    "captain-lie": ("lying", (200, 92, 1082, 1144), 540, 120, "Lying down, awake, paws forward (Home Captain on the today card; idle)", [11]),
    "captain-face": ("sheet", (28, 74, 588, 679), 360, 64, "Front bust, calm (avatar 28-64 pt: guide, panel header, Ask Captain, Settings)", [9, 12, 14, 16]),
    "captain-sit-up": ("sheet", (674, 11, 1233, 683), 540, 150, "Sitting, looking up (greeting; onboarding; Home guide)", [7, 8]),
    "acc-lemon-hat": ("sheet", (71, 757, 527, 1148), 436, 96, "Lemon hat accessory (outfit 'lemon')", [11, 12, 15, 16, 19]),
    "acc-yarn": ("sheet", (713, 784, 1173, 1207), 300, 80, "Yarn ball accessory (outfit 'yarn'; Playroom ball)", [19, 20]),
    "play-watch": ("play", (20, 79, 736, 457), 720, 220, "Playroom 1: watching the yarn ball", [20]),
    "play-reach": ("play", (788, 80, 1503, 457), 720, 220, "Playroom 2: paw raised", [20]),
    "play-bat": ("play", (20, 592, 758, 969), 720, 220, "Playroom 3: paw on the ball", [20]),
    "play-rolled": ("play", (788, 592, 1527, 969), 720, 220, "Playroom 4: ball rolled away, watching", [20]),
    "expr-calm": ("expressions", (102, 16, 566, 610), 360, 96, "Expression calm (looking aside)", [12, 13, 17]),
    "expr-happy": ("expressions", (687, 25, 1158, 615), 360, 96, "Expression happy (eyes closed, smiling)", [6, 12, 13]),
    "expr-curious": ("expressions", (94, 619, 559, 1233), 360, 96, "Expression curious (wide eyes, head tilt)", [12, 17]),
    "expr-sleepy": ("expressions", (691, 665, 1179, 1237), 360, 96, "Expression sleepy (half-closed eyes)", [12, 15]),
}


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
    sources = {key: Image.open(path).convert("RGBA") for key, path in SOURCES.items()}
    entries = []
    for name, (src, box, max_w, planned, use, rows) in ASSETS.items():
        img = trim(clean(sources[src].crop(box)))
        if img.width > max_w:
            img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
            img = clean(img)
        verdict, scale = status(img.width, planned)
        path = OUT / f"{name}.png"
        img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
        entries.append({
            "name": name,
            "status": verdict,
            "shipped": False,
            "source": SOURCES[src].relative_to(ROOT).as_posix(),
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
    manifest = {"note": "Captain Illustrated Asset Pack v1, staged for Founder confirmation; not shipped to Public/ yet.", "assets": entries}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
