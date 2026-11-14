#!/bin/zsh
# Upgrade check on a NEW, dedicated simulator (deleted at the end; no existing
# simulator or real data is touched). Synthetic data only.
#   tools/mac/upgrade-check/run-upgrade.sh <old commit> <new commit>
# 1. Debug builds of both commits from throw-away copies (git archive).
# 2. Install OLD → first start → seed.js (synthetic journal) → read.js.
# 3. Install NEW over it (same bundle id, data kept, like a TestFlight update)
#    → read.js twice (first and second start).
set -e
OLD=$1; NEW=$2
REPO=${REPO:-$HOME/Documents/Developer/Notebook}
HERE=${0:A:h}
WORK=/tmp/capiday-upgrade
rm -rf $WORK && mkdir -p $WORK/old $WORK/new
git -C $REPO archive $OLD | tar -x -C $WORK/old
git -C $REPO archive $NEW | tar -x -C $WORK/new
cp $HERE/seed.js $HERE/read.js $WORK/
DEV=$(xcrun simctl create "Capiday Upgrade Check" com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-27-2)
echo "simulator $DEV"
cleanup() { xcrun simctl shutdown $DEV 2>/dev/null || true; xcrun simctl delete $DEV 2>/dev/null || true; }
trap cleanup EXIT
for v in old new; do
  (cd $WORK/$v && xcodebuild -workspace LittleDays.xcworkspace -scheme LittleDays -configuration Debug -destination "id=$DEV" -derivedDataPath $WORK/dd-$v build 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | tail -n 5)
done
APP_OLD=$(find $WORK/dd-old/Build/Products -maxdepth 2 -name "*.app" | head -1)
APP_NEW=$(find $WORK/dd-new/Build/Products -maxdepth 2 -name "*.app" | head -1)
BID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_NEW/Info.plist")
echo "old: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' $APP_OLD/Info.plist) ($(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' $APP_OLD/Info.plist)) $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' $APP_OLD/Info.plist)"
echo "new: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' $APP_NEW/Info.plist) ($(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' $APP_NEW/Info.plist)) $BID"
xcrun simctl boot $DEV
xcrun simctl bootstatus $DEV -b > /dev/null
check() { # $1 = script, $2 = label
  local LOG=$WORK/$2.log
  : > $LOG
  xcrun simctl launch --console-pty $DEV $BID -LittleDaysCheck $WORK/$1 > $LOG 2>&1 &
  for i in {1..90}; do sleep 1; grep -q 'LittleDaysCheck' $LOG && break; done
  sleep 1
  xcrun simctl terminate $DEV $BID 2>/dev/null || true
  print -r -- "$2: $(grep -m1 'LittleDaysCheck' $LOG)"
}
xcrun simctl install $DEV $APP_OLD
xcrun simctl launch $DEV $BID > /dev/null; sleep 8; xcrun simctl terminate $DEV $BID
check seed.js old-seed
sleep 4
check read.js old-read
xcrun simctl install $DEV $APP_NEW
check read.js new-first-start
check read.js new-second-start
