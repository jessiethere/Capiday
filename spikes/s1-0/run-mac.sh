#!/bin/zsh
# S1-0 spike on the Mac: export a throw-away copy, patch it, build for a
# dedicated new simulator, run the page, print the results, clean up.
set -e
REPO=${1:-$HOME/Documents/Developer/Notebook}
WORK=/tmp/capiday-s1-0
rm -rf $WORK && mkdir -p $WORK/copy
git -C $REPO archive origin/v33-write-first-community | tar -x -C $WORK/copy
python3 $WORK/copy/spikes/s1-0/apply.py $WORK/copy
DEV=$(xcrun simctl create "Capiday S1-0 Spike" com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-27-2)
echo "simulator $DEV"
cd $WORK/copy
xcodebuild -workspace LittleDays.xcworkspace -scheme LittleDays -configuration Release -destination "id=$DEV" -derivedDataPath $WORK/dd build 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | tail -n 5
xcrun simctl boot $DEV
xcrun simctl bootstatus $DEV -b > /dev/null
APP=$(ls -d $WORK/dd/Build/Products/Release-iphonesimulator/*.app | head -1)
xcrun simctl install $DEV "$APP"
xcrun simctl launch $DEV com.capiday.app -CapidaySpike YES
DATA=$(xcrun simctl get_app_container $DEV com.capiday.app data)
for i in $(seq 1 180); do [ -f "$DATA/Documents/spike-results.json" ] && break; sleep 1; done
cp "$DATA/Documents/spike-results.json" $WORK/spike-results.json 2>/dev/null || echo "no results after 180 s"
xcrun simctl io $DEV screenshot $WORK/spike-screen.png > /dev/null 2>&1 || true
xcrun simctl shutdown $DEV
xcrun simctl delete $DEV
echo "RESULTS:"; cat $WORK/spike-results.json 2>/dev/null
