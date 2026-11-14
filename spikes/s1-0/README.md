# S1-0 · 技术实验（Sprint 1，不参与 App 构建）

- `CapidayZip.swift`：`.capiday` 容器原型（只存储的 ZIP、ZIP64、流式写入并原地回填头部、流式校验 CRC-32 和 SHA-256、路径和重复检查）。
- `macos/`：macOS 命令行测试：吞吐量、峰值内存、和标准 ZIP 工具的互通、恶意或损坏文件。用 `swift run -c release zipspike <small|interop|hostile|big>` 运行。
- `ios/`：只编进**一次性副本**的 iOS 实验页（`apply.py` 拒绝在真正的仓库上运行），测量 WebView 和 Swift 之间的大文件传输通道。
- `run-mac.sh`：在 Mac 上导出副本、打补丁，在**新建的专用模拟器**上构建并运行，结束后删除这个模拟器。不会接触任何已有模拟器、真实 App 数据或用户手帐。
- 全部使用合成数据。结论记录在 agent.md（S1-0）。

## 怎样运行

- JS（任何有 Node 22、`unzip` 和 Python 3 的机器）：`node spikes/s1-0/js/run-node.mjs <临时目录> [--big]`（`--big` 会生成一个约 4.3 GB 的合成文件，测完删掉）。
- macOS 上的 Swift：`cd spikes/s1-0/macos && swift run -c release zipspike interop|hostile|big <临时目录>`。
- iOS 模拟器：`zsh spikes/s1-0/run-mac.sh`（会新建并删除一个专用模拟器）。

## 结果（2026-11-14，部分完成）

| 实验 | 环境 | 结果 |
|---|---|---|
| JS 写入 → `unzip -t`、Python `zipfile` | 容器（Linux，Node 22） | 普通和强制 ZIP64 两种都通过；第 30 字节起是 `mimetype` |
| Python 生成的文件（条目带 ZIP64 字段）→ JS 读取 | 同上 | 通过 |
| 8 种恶意或损坏文件 | 同上 | 截断、只有一半、改一个字节（CRC 不符）、`..`、绝对路径、反斜杠、重复路径、第一个条目不是 `mimetype`：**全部被拒绝** |
| 4.3 GiB 文件（90 个条目，最后的偏移在 4.25 GiB） | 同上 | 打开用了 2 ms；流式校验最后 3 个条目约 300 MB/s；进程内存约 107 MB（**没有把整个文件读进内存**） |
| JS 的 CRC-32 | 同上 | 约 300–460 MB/s |
| Swift 容器（macOS：吞吐量、内存、互通、恶意文件） | Mac | **没有运行**：Mac 离线 |
| iOS 通道（PUT 请求体、base64 分块、拉取式 GET、`crypto.subtle`、IndexedDB 50 MB）、原生 1 GB 打包时的内存 | Mac 上的模拟器 | **没有运行**：Mac 离线 |
| 导出到 iCloud 以后能否读取上传状态 | 真机加 iCloud 账号 | 没有运行；模拟器无法可靠验证，需要真机 |
