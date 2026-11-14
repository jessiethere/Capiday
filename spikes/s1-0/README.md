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

## 结果（2026-11-14，完成）

**容器**

| 实验 | 环境 | 结果 |
|---|---|---|
| JS 写入 → `unzip -t`、Python `zipfile` | 容器（Linux，Node 22） | 普通和强制 ZIP64 两种都通过 |
| Swift 写入 → macOS `unzip -t`、Python、JS 读取器 | Mac（release 构建） | 普通和强制 ZIP64 两种都通过：**两套实现互通** |
| 恶意或损坏文件 | JS 8 种，Swift 7 种 | **全部被拒绝** |
| 4.3 GiB（JS 读取器） | 容器 | 打开 2 ms；校验约 300 MB/s；进程约 107 MB |
| 4.3 GiB（Swift 写入和读取） | Mac | 写入约 680 MB/s，校验约 1.28 GB/s。**峰值内存：修复前 1.13 GB，修复后约 10 MB**（每个分块使用一个 autorelease pool） |
| 原生打包 1 GB（模拟器里的 App 进程） | iOS 27.2 模拟器 | 写入约 660–720 MB/s，校验约 690–720 MB/s；App 进程内存一直约 23 MB |

**WebView 和 Swift 之间的通道**（iOS 27.2 模拟器，专用设备，测完已删除）

| 通道 | 结果 |
|---|---|
| `fetch(PUT)` 发送 **Blob** 请求体 → scheme handler | **收不到**（1、16、50 MB 都是 0 字节） |
| `fetch(PUT)` 发送 **ArrayBuffer** 请求体 | 能收到（`httpBody`），SHA 一致 |
| **4 MB ArrayBuffer 分块 PUT，共 50 MB** | **69 ms，约 725 MB/s**，13 块全部送达；原生峰值 47 MB |
| base64 分块经过可回复的消息处理器（4 MB × 13） | 约 95–159 MB/s，SHA 一致；原生峰值约 52–54 MB |
| 拉取式 GET 50 MB（恢复方向） | 约 1.2 GB/s |
| 页面里的 `crypto.subtle`（`littledays://` 来源） | **可用**（安全上下文）；16 MB 用 70 ms |
| IndexedDB 中一个 50 MB 的记录 | 写入 748 ms，读取 64 ms |

**结论**：备份方向用「4 MB ArrayBuffer 分块 PUT」，base64 消息作为自动降级（开始时先发一个 1 KB 的探测请求，原生收到 0 字节就切换）；恢复方向用拉取式 GET；JS 用 `crypto.subtle` 计算每个媒体的 SHA-256，和原生算出的结果对比，实现端到端校验。

**还没有验证**：iOS 17（部署目标）的运行时（Mac 上只装了 27.2）、真机、iCloud 上传状态（需要真机和 iCloud 账号）。
