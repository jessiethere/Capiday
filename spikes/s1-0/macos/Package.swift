// swift-tools-version:5.9
// S1-0 spike harness (macOS): `swift run -c release zipspike <mode>`.
import PackageDescription
let package = Package(
    name: "zipspike",
    platforms: [.macOS(.v13)],
    targets: [.executableTarget(name: "zipspike", path: "Sources/zipspike")]
)
