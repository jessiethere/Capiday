"""Cut the Captain vignettes and cover art from the Founder's reference board.

Source: docs/visual/botanical-board-v1.png — the Capiday Botanical Decorative
System board (v1) the Founder supplied on 2026-11-18 ("裁出插画当正式素材").
Output: Public/botanical/*.png (used by Public/js/botanicals.mjs).

- Captain scenes and paper-coloured cover art: the paper is turned pure white
  and the edges fade to white, so the picture melts into any paper surface
  with `mix-blend-mode: multiply` (the cat stays solid; no cut-out halo).
- Travel Notes blossom: the green cloth becomes transparent.
Re-run after replacing the board with a higher-resolution one (crop boxes are
in board pixels; scale them if the board size changes).
"""
import numpy as np, os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Public/botanical"
os.makedirs(OUT, exist_ok=True)
board = Image.open(ROOT / "docs/visual/botanical-board-v1.png").convert("RGB")
def to_white(img, clear=(), feather=10):
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    out = np.clip(a / bg * 255 * 1.025, 0, 255)
    # clean the paper fibres: near-white → white
    lum = out.mean(axis=2, keepdims=True)
    out = np.where(lum > 244, 255, out)
    # fade to white at the edges so no box can show
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    k = np.clip(edge / feather, 0, 1)[..., None]
    out = out * k + 255 * (1 - k)
    for (x0, y0, x1, y1) in clear:
        out[y0:y1, x0:x1] = 255
    return Image.fromarray(out.astype(np.uint8), "RGB")
def trim_white(img, pad=6):
    a = np.asarray(img.convert("L"))
    ys, xs = np.where(a < 236)
    if not len(xs):
        return img
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad + 1), min(img.height, y1 + pad + 1)))
MANIFEST = []
def save(img, name):
    path = f"{OUT}/{name}.png"
    q = img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)
    print(name, img.size, os.path.getsize(path))
    MANIFEST.append({"name": name, "width": img.size[0], "height": img.size[1], "bytes": os.path.getsize(path)})
crops = {
    "captain-sleep": (815, 128, 1130, 298),
    "captain-sit": (1140, 120, 1430, 300),
    "captain-ready": (820, 340, 1110, 498),
    "captain-stamp": (1105, 345, 1430, 498),
}
for name, box in crops.items():
    save(to_white(board.crop(box)), name)
save(to_white(board.crop((1125, 868, 1222, 975))), "cover-sprig")
save(to_white(board.crop((1252, 790, 1418, 972)), clear=[(0, 0, 100, 78)]), "cover-captain")
# Travel Notes: the blossom on green cloth → transparent (green becomes clear).
a = np.asarray(board.crop((950, 862, 1058, 966))).astype(np.float32)
border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
bg = np.median(border, axis=0)
print("cloth", "#%02X%02X%02X" % tuple(int(v) for v in bg))
dist = np.sqrt(((a - bg) ** 2).sum(axis=2)) / 255
alpha = np.clip((dist - 0.07) / 0.25, 0, 1)
h, w = alpha.shape
yy, xx = np.mgrid[0:h, 0:w]
edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
alpha *= np.clip(edge / 6, 0, 1)
rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
img = Image.fromarray(rgba, "RGBA")
path = f"{OUT}/cover-travel-blossom.png"; img.save(path, optimize=True); print("cover-travel-blossom", img.size, os.path.getsize(path))
MANIFEST.append({"name": "cover-travel-blossom", "width": img.size[0], "height": img.size[1], "bytes": os.path.getsize(path)})

# Plants (V10.88 follow-up): the approved watercolour plants, paper → white.
PLANTS = {
    "corner-berry": (22, 132, 266, 302),
    "corner-blossom": (272, 136, 448, 300),
    "sprig-1": (488, 142, 568, 222),
    "sprig-2": (592, 142, 671, 222),
    "sprig-3": (695, 142, 781, 222),
    "sprig-4": (485, 234, 563, 314),
    "sprig-5": (592, 234, 686, 314),
    "sprig-6": (699, 234, 783, 314),
    "berry-1": (46, 388, 229, 496),
    "berry-2": (246, 386, 386, 498),
    "blossom-1": (428, 380, 589, 511),
    "blossom-2": (611, 378, 764, 508),
}
for name, box in PLANTS.items():
    save(trim_white(to_white(board.crop(box), feather=6)), name)
import json
(OUT / "manifest.json").write_text(json.dumps({"source": "docs/visual/botanical-board-v1.png", "board": list(board.size), "assets": MANIFEST}, indent=1) + "\n", encoding="utf-8")
