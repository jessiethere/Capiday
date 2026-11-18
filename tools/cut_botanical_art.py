"""Cut Capiday's approved Captain and botanical art from the Founder's references.

Sources (supplied by the Founder on 2026-11-18; "Approved reference =
specification, not inspiration"):
- docs/visual/captain-scenes-v1.png (1536×1024): the four Captain scenes;
- docs/visual/botanical-board-v1.png (1448×1086): plants and cover art.

Every asset is cut, the paper turned transparent (colour kept relative to
white, so it sits on any paper surface without a box or a halo), trimmed, and
given a status from its pixel size against its real display size on a 3x
iPhone:

- APPROVED      hi-res enough for its production size (≤ 1.2× upscale at 3x)
- LIMITED SIZE  only used up to its natural size at 3x (px / 3 pt), never larger
- NEEDS HI-RES  still clearly soft at its real UI size → NOT shipped: written to
                docs/visual/asset-audit/ (dev review only), never to Public/

Production assets go to Public/botanical/ with manifest.json (source, source
box, pixels, max display size, production size, status). Nothing here is
redrawn or restyled; replace a NEEDS HI-RES entry by giving it a hi-res
source and re-running.
"""
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Public/botanical"
AUDIT = ROOT / "docs/visual/asset-audit"
SOURCES = {
    "captain": ROOT / "docs/visual/captain-scenes-v1.png",
    "board": ROOT / "docs/visual/botanical-board-v1.png",
}
CAPTAIN_MAX = 540  # px wide: sharp up to 180 pt on a 3x iPhone, lighter to load

# name: (source, box in source px, planned display width in pt, production width in pt, use)
ASSETS = {
    "captain-sleep": ("captain", (0, 55, 775, 492), 120, 120, "Captain resting on the books (reserved: Home Captain card)"),
    "captain-sit": ("captain", (795, 12, 1536, 488), 150, 150, "Empty stamp month; Captain / My Cat cover; Captain invitation"),
    "captain-ready": ("captain", (14, 512, 745, 996), 120, 120, "Captain about to stamp (reserved)"),
    "captain-stamp": ("captain", (755, 512, 1536, 1004), 96, 64, "First-stamp moment"),
    "corner-berry": ("board", (22, 132, 266, 302), 72, 72, "Botanical corner, seasonal (reserved)"),
    "corner-blossom": ("board", (272, 136, 448, 300), 72, 58, "Stamp page corner"),
    "berry-1": ("board", (46, 388, 229, 496), 60, 56, "Stamp card corner (seasonal accent)"),
    "berry-2": ("board", (246, 386, 386, 498), 56, 46, "Berry branch (reserved)"),
    "blossom-1": ("board", (428, 380, 589, 511), 56, 50, "White blossom (reserved: empty states, papers)"),
    "blossom-2": ("board", (611, 378, 764, 508), 56, 50, "White blossom (reserved)"),
    "sprig-3": ("board", (695, 142, 781, 222), 44, 28, "Small sprig (reserved)"),
    "sprig-5": ("board", (592, 234, 686, 314), 44, 30, "Small sprig by Home's date"),
    "sprig-6": ("board", (699, 234, 783, 314), 44, 27, "Small sprig (reserved)"),
    "cover-sprig": ("board", (1125, 868, 1222, 975), 40, 31, "My Days cover"),
    # Not good enough at their real size → audit only, not shipped.
    "cover-travel-blossom": ("board", (950, 862, 1058, 966), 62, 62, "Travel Notes cover (on green cloth)"),
    "sprig-1": ("board", (488, 142, 568, 222), 44, 44, "Small sprig"),
    "sprig-2": ("board", (592, 142, 671, 222), 44, 44, "Small sprig"),
    "sprig-4": ("board", (485, 234, 563, 314), 44, 44, "Small sprig"),
    # Superseded by the hi-res captain-sit (Founder, 2026-11-18).
    "cover-captain": ("board", (1252, 790, 1418, 972), 96, 96, "Old Captain cover crop — replaced by captain-sit"),
}
# Assets kept out of production whatever their numbers say.
HOLD = {"cover-travel-blossom", "sprig-1", "sprig-2", "sprig-4", "cover-captain"}
CLEAR = {"cover-captain": [(0, 0, 100, 78)]}  # the board's own title and seal


def to_white(img, clear=(), feather=10):
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    out = np.clip(a / bg * 255 * 1.025, 0, 255)
    lum = out.mean(axis=2, keepdims=True)
    out = np.where(lum > 244, 255, out)  # paper fibres → white
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    k = np.clip(edge / feather, 0, 1)[..., None]
    out = out * k + 255 * (1 - k)  # fade to white at the edges: no box
    for (x0, y0, x1, y1) in clear:
        out[y0:y1, x0:x1] = 255
    return Image.fromarray(out.astype(np.uint8), "RGB")


def trim_white(img, pad=6):
    a = np.asarray(img.convert("L"))
    ys, xs = np.where(a < 236)
    if not len(xs):
        return img
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


def cut_out(img):
    """White paper → transparent; colours unmixed from white so they stay true."""
    w = np.asarray(img).astype(np.float32)
    alpha = np.clip((255 - w.min(axis=2)) / 255 * 3.2, 0, 1)
    safe = np.maximum(alpha, 1e-3)[..., None]
    color = np.clip(255 - (255 - w) / safe, 0, 255)
    return Image.fromarray(np.dstack([color, alpha * 255]).astype(np.uint8), "RGBA")


def cloth_cut(img):
    """Travel Notes blossom: the green cloth → transparent (audit only)."""
    a = np.asarray(img).astype(np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    alpha = np.clip((np.sqrt(((a - bg) ** 2).sum(axis=2)) / 255 - 0.07) / 0.25, 0, 1)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    alpha *= np.clip(np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]) / 6, 0, 1)
    return Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), "RGBA")


def status(px, pt):
    scale = pt * 3 / px  # upscale needed on a 3x iPhone at the production size
    if scale <= 1.2:
        return "APPROVED", scale
    return ("LIMITED SIZE" if scale <= 1.6 else "NEEDS HI-RES"), scale


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    AUDIT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    sources = {key: Image.open(path).convert("RGB") for key, path in SOURCES.items()}
    entries = []
    for name, (src, box, planned, pt, use) in ASSETS.items():
        crop = sources[src].crop(box)
        if name == "cover-travel-blossom":
            img = cloth_cut(crop)
        else:
            white = trim_white(to_white(crop, clear=CLEAR.get(name, ()), feather=14 if src == "captain" else 6))
            if src == "captain" and white.width > CAPTAIN_MAX:
                white = white.resize((CAPTAIN_MAX, round(white.height * CAPTAIN_MAX / white.width)), Image.LANCZOS)
            img = cut_out(white)
        max_pt = img.width // 3  # natural size on a 3x screen
        verdict, _ = status(img.width, planned)
        if verdict != "APPROVED" and pt <= max_pt * 1.05:
            verdict = "LIMITED SIZE"  # soft at the planned size, clear at its natural size
        scale = pt * 3 / img.width
        shipped = name not in HOLD and verdict != "NEEDS HI-RES"
        state = "NEEDS HI-RES" if name in HOLD or verdict == "NEEDS HI-RES" else verdict
        if name == "cover-captain":
            state = "SUPERSEDED"
        folder = OUT if shipped else AUDIT
        path = folder / f"{name}.png"
        img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
        entries.append({
            "name": name,
            "status": state,
            "shipped": shipped,
            "source": SOURCES[src].relative_to(ROOT).as_posix(),
            "sourceSize": list(sources[src].size),
            "sourceBox": list(box),
            "width": img.width,
            "height": img.height,
            "bytes": os.path.getsize(path),
            "maxSharpPt": max_pt,
            "plannedPt": planned,
            "productionPt": pt if shipped else None,
            "upscaleAt3x": round(scale, 2),
            "use": use,
        })
        print(f"{state:13} {name:22} {img.width}×{img.height} planned {planned}pt → {'%dpt' % pt if shipped else 'not shipped'} (natural {max_pt}pt) {'Public' if shipped else 'audit'}")
    manifest = {"note": "Phase 1 production/prototype assets cut from Founder references; not brand masters. NEEDS HI-RES entries are not shipped.", "assets": entries}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (AUDIT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
