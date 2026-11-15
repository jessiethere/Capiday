#!/usr/bin/env python3
"""Beta 2 · reads /tmp/ld-uitest/layout.log (LDLAYOUT lines from editor-layout.sh)
and checks the editor layout rules. Prints one line per rule; exit 1 if any fails."""
import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ld-uitest/layout.log"
steps = {}
for line in open(path, encoding="utf-8"):
    if "LDLAYOUT " in line:
        d = json.loads(line.split("LDLAYOUT ", 1)[1]); steps[d["step"]] = d
fails = 0
def check(name, ok, detail=""):
    global fails
    fails += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
def top(r): return r[1] if r else None
def bottom(r): return r[1] + r[3] if r else None
sa = (steps.get("b1-book-open") or steps.get("s1-story") or {}).get("sa", [0, 0])[0]
for k in ["b1-book-open", "b1b-book-no-keyboard", "b2-book-keyboard", "b3-covers-after-keyboard"]:
    d = steps.get(k)
    if d and d.get("bookH2"): check(f"{k}: 新建手帐本标题在状态栏下面", top(d["bookH2"]) >= sa, f"title top {top(d['bookH2'])}, safe area {sa}")
for k in ["b2-book-keyboard"]:
    d = steps.get(k)
    if d and d.get("bookName") and d.get("accessoryTop"): check(f"{k}: 名字输入框在键盘上方", bottom(d["bookName"]) <= d["accessoryTop"], f"field bottom {bottom(d['bookName'])}, keyboard bar {d['accessoryTop']}")
for k in ["b1b-book-no-keyboard", "b3-covers-after-keyboard", "b4-covers-later"]:
    d = steps.get(k)
    if not d: continue
    check(f"{k}: 键盘收起后没有留下键盘高度", d.get("vars", "").startswith("-,-"), d.get("vars"))
    if d.get("bookDialog"): check(f"{k}: 弹窗不再停在键盘时的高度", d["bookDialog"][3] > 470, f"dialog {d['bookDialog']}")
d = steps.get("b3-covers-after-keyboard")
if d: check("b3: 封面浏览器打开后能看到封面", (d.get("coverTiles") or [0, 0])[1] >= 3, f"tiles {d.get('coverTiles')}")
d = steps.get("s2-write-keyboard")
if d:
    acc = d.get("accessoryTop") or d.get("screenH")
    check("s2: 写字面板顶部在状态栏下面", top(d.get("sheet")) >= sa, f"sheet {d.get('sheet')}, safe {sa}")
    check("s2: 输入框在键盘上方", bottom(d.get("swField")) <= acc, f"field {d.get('swField')}, keyboard bar {acc}")
    check("s2: 「字体与样式 ›」在键盘上方能看到", d.get("swMore") is not None and bottom(d["swMore"]) <= acc, f"summary {d.get('swMore')}, keyboard bar {acc}")
for k in ["s3-font-mode", "s4-font-picked"]:
    d = steps.get(k)
    if not d: continue
    q = d.get("qeBar"); sheet = d.get("sheet")
    check(f"{k}: 操作栏不浮在页面中间", d.get("qeBarVis") == "hidden" or (q and sheet and top(q) >= top(sheet)), f"bar {q} {d.get('qeBarVis')}, sheet {sheet}")
    if d.get("words") and sheet: check(f"{k}: 正在改的字在面板上方", bottom(d["words"]) <= top(sheet), f"words {d['words']}, sheet top {top(sheet)}")
d = steps.get("s6-done")
if d: check("s6: 完成后操作栏回到底部且可见", d.get("qeBarVis") == "visible" and d.get("qeBar") and bottom(d["qeBar"]) <= d.get("screenH", 9999) and top(d["qeBar"]) > d.get("screenH", 0) * 0.6, f"bar {d.get('qeBar')}")
print(f"\n{'ALL PASS' if not fails else str(fails) + ' FAILED'} ({len(steps)} steps)")
sys.exit(1 if fails else 0)
