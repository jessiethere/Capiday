# Real-touch UI test (XCUITest) for the iOS shell

Added 2026-11-14 for the P0 drawing bug (`docs/BUGFIX_LOG.md`). It sends **real touches** to the Simulator, which `-LittleDaysTap` / `-LittleDaysCheck` cannot do: those only call `click()` from JavaScript, and they miss iOS-only problems such as buttons hidden under the status bar.

The repository's Xcode project is **not** changed. The test target is added only to a temporary copy in `/tmp`:

```bash
rm -rf /tmp/ld-uitest && mkdir -p /tmp/ld-uitest
git -C ~/Documents/Developer/Notebook archive origin/v33-write-first-community | tar -x -C /tmp/ld-uitest
cd /tmp/ld-uitest
mkdir -p Native/UITests && cp tools/mac/uitest/DrawUITests.swift Native/UITests/ && cp tools/mac/uitest/probe.js /tmp/ld-uitest/probe.js
python3 tools/mac/uitest/add_uitest_target.py Native/LittleDays.xcodeproj/project.pbxproj
xcodebuild build -project Native/LittleDays.xcodeproj -scheme LittleDays -destination "id=<simulator>" -derivedDataPath /tmp/ld-uitest/DD
# then add the shared scheme from tools/mac/uitest/CapidayUITests.xcscheme into Native/LittleDays.xcodeproj/xcshareddata/xcschemes/
xcodebuild test -project Native/LittleDays.xcodeproj -scheme CapidayUITests -destination "id=<simulator>" -derivedDataPath /tmp/ld-uitest/DD ONLY_ACTIVE_ARCH=YES ARCHS=arm64
```

- Uninstall `com.capiday.app` from the Simulator first, so the run starts from a fresh install.
- Each step prints a line starting with `LDSTEP`. Screenshots go to `/tmp/ld-uitest/shots/`.
- `probe.js` only reads the page. It publishes the state through an accessibility label, and when a dialog is open it moves into that dialog, because a modal dialog hides everything else from accessibility.
- Gotchas found while setting this up:
  - Build the app once with the automatic `LittleDays` scheme before running `test`, otherwise the test scheme can't find the `LittleDaysUI` module.
  - Pass `ONLY_ACTIVE_ARCH=YES ARCHS=arm64`, otherwise it also builds for x86_64 and fails.

## Other checks in this folder

The target script only knows `DrawUITests.swift`: to run another check, copy its file to that name in `Native/UITests/`, and its page script to `/tmp/ld-uitest/`.

- `ReminderUITests.swift` + `reminder-check.js` (V10.80): daily reminder — the real permission alert and a real notification banner.
- `PhotoUITests.swift` + `photo-check.js` (V10.81): 添加照片 → 从相册选择 opens the system photo library straight away (the test picks two Simulator sample photos and taps 添加, later 取消), the 编辑图片 top bar measured against the real `env(safe-area-inset-top)`, 配文 on a photo, save. The Simulator has no camera: 拍一张照片 is checked on a real iPhone only.
- `SaveUITests.swift` + `save-check.js` (V10.82): 把这一页存成图片 → Photos. Copy `save-check.js` four times with `__MODE__` replaced by `seed`, `page`, `deny`, `allow` to `/tmp/ld-uitest/save-<mode>.js`. The test answers the real "add to Photos" question (不允许, then after a permission reset 允许), checks that no share sheet appears after saving and that 分享这一页 does open one; afterwards look in `~/Library/Developer/CoreSimulator/Devices/<id>/data/Media/DCIM/100APPLE/` for the new PNG files (`sips -g pixelWidth -g pixelHeight`).
