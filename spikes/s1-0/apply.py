#!/usr/bin/env python3
"""S1-0 spike: patch a THROW-AWAY copy of the repo (never the real checkout).

Usage: python3 apply.py <copy-root>
Adds the spike Swift files + spike.html to the copy's iOS shell and wires a
`-CapidaySpike YES` launch argument. Refuses to run on a git checkout.
"""
import pathlib, shutil, sys

root = pathlib.Path(sys.argv[1]).resolve()
if (root / ".git").exists():
    sys.exit("refusing: this looks like a real checkout (has .git)")
here = pathlib.Path(__file__).resolve().parent
shell = root / "Native/Sources/LittleDaysUI/WebShell"
webapp = root / "Native/Sources/LittleDaysUI/WebApp"
shutil.copy(here / "CapidayZip.swift", shell / "CapidayZip.swift")
shutil.copy(here / "ios/CapidaySpike.swift", shell / "CapidaySpike.swift")
shutil.copy(here / "ios/spike.html", webapp / "spike.html")

def patch(path, old, new):
    s = path.read_text()
    assert s.count(old) == 1, f"anchor not found once in {path}: {old[:60]}"
    path.write_text(s.replace(old, new))

res = shell / "LittleDaysWebResources.swift"
patch(res, "    static var launchURL: URL {\n", "    static var launchURL: URL {\n        if CapidaySpike.enabled { return CapidaySpike.url }\n")
patch(res, "            urlSchemeTask.didFailWithError(URLError(.badURL))\n            return\n        }\n",
      "            urlSchemeTask.didFailWithError(URLError(.badURL))\n            return\n        }\n        if url.path.hasPrefix(\"/spike/\") { CapidaySpike.handle(urlSchemeTask); return }\n")
view = shell / "LittleDaysWebShellView.swift"
patch(view, "        configuration.userContentController.add(LittleDaysHaptics(), name: LittleDaysHaptics.name)\n",
      "        configuration.userContentController.add(LittleDaysHaptics(), name: LittleDaysHaptics.name)\n        configuration.userContentController.addScriptMessageHandler(CapidaySpikeChunks(), contentWorld: .page, name: CapidaySpikeChunks.name)\n")
print("patched", root)
