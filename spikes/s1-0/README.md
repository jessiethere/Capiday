# S1-0 · 技术实验（Sprint 1，不参与 App 构建）

- `CapidayZip.swift`：`.capiday` 容器原型（只存储的 ZIP、ZIP64、流式写入并原地回填头部、流式校验 CRC-32 和 SHA-256、路径和重复检查）。
- `macos/`：macOS 命令行测试：吞吐量、峰值内存、和标准 ZIP 工具的互通、恶意或损坏文件。用 `swift run -c release zipspike <small|interop|hostile|big>` 运行。
- `ios/`：只编进**一次性副本**的 iOS 实验页（`apply.py` 拒绝在真正的仓库上运行），测量 WebView 和 Swift 之间的大文件传输通道。
- `run-mac.sh`：在 Mac 上导出副本、打补丁，在**新建的专用模拟器**上构建并运行，结束后删除这个模拟器。不会接触任何已有模拟器、真实 App 数据或用户手帐。
- 全部使用合成数据。结论记录在 agent.md（S1-0）。
