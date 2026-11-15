#!/bin/zsh
# Beta 2 · editor layout measurements on a NEW simulator (deleted after), with
# the software keyboard. Throw-away copy of the pushed branch; synthetic data.
# Usage: tools/mac/uitest/editor-layout.sh [git-ref]   → /tmp/ld-uitest/layout.log + shots/
REPO=/Users/jessie/Documents/Developer/Notebook
REF=${1:-origin/v33-write-first-community}
W=/tmp/ld-uitest
rm -rf $W && mkdir -p $W/shots
git -C $REPO fetch -q origin
git -C $REPO archive $REF | tar -x -C $W
cd $W
mkdir -p Native/UITests && cp tools/mac/uitest/DrawUITests.swift Native/UITests/
cat tools/mac/uitest/fake-photos.js tools/mac/uitest/probe.js > $W/editor-probe.js
python3 tools/mac/uitest/add_uitest_target.py Native/LittleDays.xcodeproj/project.pbxproj
DEV=$(xcrun simctl create "Capiday Layout UITest" com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-27-2)
trap 'xcrun simctl shutdown $DEV 2>/dev/null; xcrun simctl delete $DEV 2>/dev/null' EXIT
xcrun simctl boot $DEV; xcrun simctl bootstatus $DEV -b > /dev/null
xcodebuild build -project Native/LittleDays.xcodeproj -scheme LittleDays -destination "id=$DEV" -derivedDataPath $W/DD 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | tail -3
mkdir -p Native/LittleDays.xcodeproj/xcshareddata/xcschemes && cp tools/mac/uitest/CapidayUITests.xcscheme Native/LittleDays.xcodeproj/xcshareddata/xcschemes/
xcodebuild test -project Native/LittleDays.xcodeproj -scheme CapidayUITests -destination "id=$DEV" -derivedDataPath $W/DD -only-testing:CapidayUITests/DrawUITests/testBookDialogLayout -only-testing:CapidayUITests/DrawUITests/testStoryWordsLayout ONLY_ACTIVE_ARCH=YES ARCHS=arm64 2>&1 | grep -E "LDLAYOUT|LDTEXT|error:|XCTAssert|failed|passed|TEST (SUCCEEDED|FAILED)" > $W/layout.log
grep -E "TEST (SUCC|FAIL)|failed|error:" $W/layout.log | tail -5
