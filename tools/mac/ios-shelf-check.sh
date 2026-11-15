#!/bin/zsh
# V10.75 · Shelf spine check (CAP-020) in the iOS Simulator with the iPhone's
# own fonts, on NEW simulators (deleted after; synthetic titles only).
#   tools/mac/ios-shelf-check.sh [git-ref]   → /tmp/ld-shelf/<device>[-xxl].log + shots/
# Builds a throw-away copy of the pushed branch (Debug: it reads the
# Debug-only -LittleDaysCheck), then for each phone size runs
# tools/mac/ios-shelf-check.js and saves a screenshot every 1.5 s; the
# largest phone also runs once with the largest Dynamic Type text size.
REPO=/Users/jessie/Documents/Developer/Notebook
REF=${1:-origin/v33-write-first-community}
W=/tmp/ld-shelf
rm -rf $W && mkdir -p $W/src $W/shots
git -C $REPO fetch -q origin
git -C $REPO archive $REF | tar -x -C $W/src
RT=com.apple.CoreSimulator.SimRuntime.iOS-27-2
BUILD=$(xcrun simctl create "Capiday Shelf Build" com.apple.CoreSimulator.SimDeviceType.iPhone-17 $RT)
xcodebuild build -project $W/src/Native/LittleDays.xcodeproj -scheme LittleDays -configuration Debug -destination "id=$BUILD" -derivedDataPath $W/DD 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | tail -3
xcrun simctl delete $BUILD
APP=$W/DD/Build/Products/Debug-iphonesimulator/LittleDays.app
run() { # run <device type> <name> [content size]
  local DEV=$(xcrun simctl create "Capiday Shelf $2" com.apple.CoreSimulator.SimDeviceType.$1 $RT)
  xcrun simctl boot $DEV; xcrun simctl bootstatus $DEV -b > /dev/null
  [[ -n $3 ]] && xcrun simctl ui $DEV content_size $3
  local JS=$W/check.js LOG=$W/$2.log
  { print -r -- "const CHECK_PAUSE = 3500;"; cat $W/src/tools/mac/ios-shelf-check.js; } > $JS
  xcrun simctl install $DEV $APP
  sleep 5
  # A just-booted simulator sometimes refuses the first launch: try again.
  for try in 1 2 3; do
    : > $LOG
    xcrun simctl launch --console-pty $DEV com.jessiethere.littledays -LittleDaysCheck $JS > $LOG 2>&1 &
    sleep 6
    grep -q 'failed to launch' $LOG || break
    sleep 5
  done
  for i in {1..160}; do
    sleep 1.5
    xcrun simctl io $DEV screenshot --type=png $W/shots/$2-$(python3 -c 'import time;print(int(time.time()*1000))').png >/dev/null 2>&1
    grep -q '^LittleDaysCheck: {\|LittleDaysCheck failed' $LOG && break
  done
  xcrun simctl terminate $DEV com.jessiethere.littledays 2>/dev/null
  xcrun simctl shutdown $DEV 2>/dev/null; xcrun simctl delete $DEV 2>/dev/null
  echo "== $2"; grep -o 'LittleDaysCheck.*' $LOG | cut -c1-200
}
for spec in ${=${DEVICES:-iPhone-SE-3rd-generation:se iPhone-17:iphone17 iPhone-17-Pro-Max:promax}}; do run ${spec%%:*} ${spec##*:}; done
[[ -z $NO_XXL ]] && run iPhone-17-Pro-Max promax-xxl accessibility-extra-extra-extra-large
