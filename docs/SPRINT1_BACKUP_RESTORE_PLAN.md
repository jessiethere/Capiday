# Sprint 1 · 完整备份、恢复与数据完整性保护（详细实施方案，等确认后编码）

> 2026-11-14 第 2 版。已确认的决策：
> - 使用单个 `.capiday` 文件（格式见 `docs/CAPIDAY_BACKUP_FORMAT.md`）；
> - 首发用系统文件选择器保存，位置可以是本机或 iCloud Drive；
> - 区分「备份生成成功」「文件保存成功」「云端上传完成」。
>
> 本文是实施方案，**还没有改任何业务代码**。代码位置以 commit `0e950a8` 为准。

## 0. 范围

**包含**
1. 完整备份：`.capiday` 1.0，没有大小上限；流式写入；回读校验；保存到用户选择的位置。
2. 安全恢复：先校验再预览；二次确认；写入前快照；媒体先写、state 后写；失败时不改动；可以撤销；媒体去重。
3. 数据完整性保护：滚动快照、写入者标记、修正救援事件、放宽 mime 兼容。
4. 状态展示：「生成成功 / 已保存 / 已上传到 iCloud（仅在能确认时）」三种状态，分开显示。

**不包含**：自动 iCloud 备份和历史版本（以后规划）、原图（Sprint 2）、最近删除（Sprint 1 之后）、设置 IA 的整体重排（只在现有的「数据与隐私」里替换备份和恢复相关的几行）。

## 1. 现状和风险（复核过的代码证据）

| ID | 风险 | 证据 |
|---|---|---|
| R-B1 | 媒体超过 100 MB 时无法备份 | `Public/js/media.mjs:286-290, 433` |
| R-B2 | mime 中的 codecs 含逗号时恢复会被拒绝。App 自己的录音（`audio/webm;codecs=opus`，`app.js:12687`）不受影响；导入视频的 `blob.type` 是否会带逗号，需要真机验证 | `media.mjs:350` |
| R-B3 | 恢复是整份替换，替换前不留快照 | `app.js:10144-10147` |
| R-B4 | 每次恢复都给媒体新 id，重复恢复会让占用翻倍 | `media.mjs:75, 376-379` |
| R-B5 | 备份和导出的明文文件留在 Documents，在「文件」App 中可见，从不清理 | `LittleDaysWebShellView.swift:329-344`；`project.pbxproj` 里的 `UIFileSharingEnabled` |
| R-B6 | 「备份成功」只靠用户点「已保存」 | `app.js:2431`（`backupKeptSheet`） |
| R-D1 | 没有历史快照；救援副本只有一个槽位 `little-days.v1.rescue`，每次都会被覆盖 | `journal-open.mjs:15`；`app.js:13080` |
| R-D2 | 救援事件 `journal-blocked` 不符合事件命名规则，从来没有被记录下来 | `events.mjs:32` |

## 2. 三种状态（界面和数据都分开）

```
备份生成成功（本机临时文件，已通过回读校验）
   └─▶ 文件已保存（用户在系统面板里选了位置，并且目标文件的大小已核对）
          └─▶ 已上传到 iCloud（仅当目标在 iCloud Drive，并且确认 isUploaded == true）
```

| 状态 | 判断依据 | 界面文案 |
|---|---|---|
| 正在生成 | 进度 = 已写入的媒体数 / 总数 | 「正在备份 · 312 / 1186」（可以取消） |
| 生成失败 | 任何一层校验失败、空间不足、被取消 | 「备份没有完成，没有保存任何文件。」加上原因 |
| 生成成功（不完整） | 三层校验都通过，但 `complete: false` | 「备份不完整：缺少 3 个文件（查看）」→「仍然保存」或「取消」 |
| 生成成功 | 三层校验都通过，并且 `complete: true` | 自动进入保存面板 |
| 已保存 | `UIDocumentPickerViewController(forExporting:, asCopy: true)` 回调成功，返回目标 URL；能读取它的大小并且和本地一致 | 「已保存到『文件 › 我的 iPhone › Capiday』」或「已保存到 iCloud Drive，正在上传」 |
| 已上传到 iCloud | 目标 URL 是 ubiquitous 项目，并且 `ubiquitousItemIsUploaded == true`。在前台最多观察 2 分钟，同时保存一个 security-scoped bookmark，下次打开 App 时再查一次 | 「已上传到 iCloud（11 月 14 日 21:32）」 |
| 无法确认上传 | 拿不到状态，或者超时 | 「已保存到 iCloud Drive；上传由系统完成，请稍后在『文件』App 中确认」 |
| 用户取消保存 | 面板被取消 | 「备份没有保存。」**不记录**为上次备份 |

记录（localStorage，新键，不改旧键）：

```
little-days.backup-log = [{ backupId, at, complete, missing, mediaCount, bytes, saved: "local" | "icloud" | "unknown" | null, uploadedAt? }]
```

只保留最近 10 条。旧键 `little-days.last-backup` 和 `little-days.last-backup-partial` 继续同步写入，兼容现有的提醒逻辑（`backupDue`，`app.js:2469`）。

> 上传状态能否读到，取决于导出以后是否还有访问目标文件的权限（bookmark）。这一点在 **S1-0 实验**里验证。拿不到时就用「无法确认上传」这一行，**不会**显示「已上传」。

## 3. 架构和数据流

```mermaid
sequenceDiagram
  participant UI as Web UI (backup-flow.mjs)
  participant M as IndexedDB media / meta
  participant S as Swift LittleDaysBackup
  participant P as 系统文件面板
  UI->>M: await store.stored(); 状态快照
  UI->>S: backup.begin(header, estimate)
  S-->>UI: token（已检查剩余空间）
  UI->>S: backup.putState(token, chunks…)
  loop 每个被引用的媒体（一次一个）
    UI->>M: media.get(id)
    UI->>S: backup.putMedia(token, id, seq, chunk) × n
    S-->>UI: ok（背压）
    UI->>S: backup.endMedia(token, id, size, record)
    S-->>UI: sha256
  end
  UI->>S: backup.finish(token, complete, missing)
  S->>S: 写 manifest + 中央目录 → 回读校验三层
  S-->>UI: generated(report)
  UI->>S: backup.save(token)
  S->>P: forExporting(asCopy)
  P-->>S: 目标 URL / 取消
  S-->>UI: saved(location, ubiquitous) → uploaded?（观察）
  S->>S: 删除 tmp 中的暂存文件
```

**恢复**：Swift 打开 `.capiday` 文件（文件选择器）→ 完成三层校验 → 把 manifest 摘要交给 JS → 预览和确认 → JS 通过 `littledays://restore/<token>/state` 和 `…/media/<id>` 逐个拉取，再写入 → 用 `restore.finish` 清理暂存。

## 4. 工作包（按顺序，每个都可以单独合并和发布）

### S1-0 · 技术实验（0.5–1 天，不进主分支）

1. `WKURLSchemeHandler` 能否接收 `fetch(…, {method: "PUT", body: blob})` 的请求体（`httpBody` 或 `httpBodyStream`），在 iOS 17 模拟器和 iOS 27 模拟器上用 1 MB 和 50 MB 测试。
   - 能用：使用零拷贝通道。
   - 不能用：使用 `WKScriptMessageHandlerWithReply` 加 4 MB base64 分块。
2. 用 Swift 写「只存储 ZIP」的读写器原型，加上 ZIP64：写入和读取 2 GB 的合成数据，记录耗时和峰值内存。
3. 导出到 iCloud Drive 以后，能否通过 bookmark 读到 `ubiquitousItemIsUploaded`。
4. 输出：在 agent.md 里记录结论，以及选定的通道。

### S1-1 · 恢复安全和完整性保护（只改 JS，风险最低，先发布）

| 改动 | 文件和位置 |
|---|---|
| mime 校验放宽：主类型必须是 image / audio / video；图片子类型允许 jpeg、png、webp、gif、heic、heif；参数部分放宽到 `(;[^,;]+(=[^;]*)?)*`，允许 codecs 里有逗号；继续限制大小和数量 | `media.mjs:350` 一带 |
| 恢复前快照：把当前的 `little-days.v1` 原样写进 meta 的 `little-days.v1.before-restore`（用 `meta-store` 的 `write` 后再读回比对），写入失败就停止恢复 | `app.js` 的恢复处理（`10130-10158`），`meta-store.mjs` |
| 撤销恢复：设置里出现「撤销上次恢复（7 天内）」，确认后用快照替换回去 | `app.js` 设置页、i18n |
| 恢复预览：先解析和校验，再显示一张面板，内容包括备份日期、天数、页数、媒体数、是否完整，以及和当前手帐的对比；二次确认（当前有内容时，需要勾选「我了解会替换当前手帐」） | `app.js`，新文件 `js/backup-preview.mjs`（纯函数，计算摘要和对比） |
| 滚动快照：每天第一次成功写入以后，把前一份 state 复制到 meta 的 `little-days.v1.snap.<YYYY-MM-DD>`，只保留最近 3 份（只新增键，每份是 state 的大小）；救援页增加「从快照恢复」 | `model.mjs` 的 `stored` 之后（或者在 app.js 里注册钩子），`journal-open.mjs`，救援页 |
| 写入者标记：state 加可选字段 `writer: {app, at}`（`validateStateSnapshot` 和 Swift 模型同步，作为可选字段） | `model.mjs`、`Models.swift` |
| 改正事件名：`journal-blocked` 改为 `journal_blocked` | `app.js` 中 `showJournalRescue` 一带 |
| v1 备份继续可用（浏览器和在线链接用） | 不变 |

### S1-2 · 写入器：`.capiday` 1.0（Swift 为主）

| 新增或改动 | 内容 |
|---|---|
| `Native/Sources/LittleDaysUI/WebShell/CapidayArchive.swift`（新） | 只存储的 ZIP 写入器和读取器（数据描述符、ZIP64、CRC-32、路径校验），不依赖页面，可以单独测试 |
| `…/WebShell/LittleDaysBackup.swift`（新） | 暂存目录 `tmp/capiday-<token>/`；`begin`（用 `volumeAvailableCapacityForImportantUsage` 检查空间，需要的大小 = 估算的媒体字节数 × 1.1 再加 64 MB）、`putState`、`putMedia`、`endMedia`（CryptoKit SHA-256）、`finish`（写 manifest 和中央目录）、`verify`（三层的前两层，第三层由 JS 的 `validateStateSnapshot` 完成）、`cancel`、`cleanup`；用 `beginBackgroundTask` 争取时间；启动时清理遗留的暂存目录 |
| `LittleDaysWebShellView.swift` | 注册 `capidayBackup` 消息处理（`WKScriptMessageHandlerWithReply`，或者 S1-0 选定的 scheme 通道）；导出面板；把通用下载的目标从 Documents 改为 tmp，弹出面板，完成后删除（R-B5） |
| `Public/js/capiday-format.mjs`（新，纯逻辑） | 生成和校验 manifest、路径和 id 的规则、版本比较（`formatVersion`、`minReaderVersion`、`requires`）、`complete` 的判定，加上第 3 层的引用核对（单元测试的重点） |
| `Public/js/backup-flow.mjs`（新） | 流程编排：状态快照 → 逐个读取媒体 → 分块 → 进度和取消 → 三种状态的回调；浏览器环境自动回退到 v1 |
| `Public/app.js` | 备份入口改为调用 `backup-flow`；进度面板；不完整时的说明面板；三种状态的结果面板；去掉 `backupKeptSheet`（让用户确认「是否保存了」的那一步，因为现在由系统回调代替） |
| i18n、styles | 文案、进度条、结果面板 |
| Info.plist（`INFOPLIST_KEY_*` 或独立的 plist） | `UTExportedTypeDeclarations`：`com.capiday.backup`，扩展名 `capiday`；`CFBundleDocumentTypes`：在「文件」App 中可以用 Capiday 打开（打开时只进入恢复预览，不会直接导入） |

### S1-3 · 读取器和恢复

| 新增或改动 | 内容 |
|---|---|
| `LittleDaysBackup.swift` | `openForRestore(url)`：开启 security-scoped 访问，校验第 1–2 层，返回 manifest；scheme 路由 `littledays://restore/<token>/…`（只开放当前 token 的条目，只读）；`restore.finish` 时清理 |
| `backup-flow.mjs` | 第 3 层校验 → 预览（复用 S1-1）→ 快照 → 逐个拉取并写入媒体 → 一次性写入 state → 写入后核对（每个引用都能 `media.get`）；**任何一步失败都不写 state**，并且列出这次已经写入的媒体 id，记录到 `little-days.orphan-candidates`（只记录，不删除） |
| 媒体去重 | 本地已经有相同 `id` 的媒体时，读出来计算它的 SHA-256（在 Swift 侧计算，或者用 `media.get` 加上 JS 的 SHA，取决于 S1-0）。相同就跳过，不同就分配新 UUID 并重新映射引用 |
| v1 JSON | 继续走现有的 `media.restore` 路径，加上 S1-1 的快照、预览和撤销 |

### S1-4 · 设置里的说明和提醒

- 「数据与隐私」区域只替换和备份相关的几行（整体重排留给设置 IA V2）：
  - 固定说明「手帐保存在这台 iPhone 上。删除 App 前请先备份。」
  - 上次备份的状态（三种状态之一）。
  - 「立即备份」「从备份恢复」「检查备份文件」（只校验，不恢复）。
  - 「撤销上次恢复」（有快照时才出现）。
- 媒体用量那一行去掉「上限 100 MB」，并且不再在每次渲染设置页时读取所有媒体（改为显示上次统计的结果，加一个「重新统计」）。
- 提醒规则在现有基础上增加两个条件：
  - 自上次完整备份以来新增 50 个以上媒体，或 500 MB 以上；
  - 上次备份不完整，而且之后没有补一次完整备份。
  - 点 × 以后 7 天内不再提醒；不推送通知。

## 5. 风险控制

| 风险 | 控制措施 |
|---|---|
| 恢复写坏手帐 | 快照写入并读回比对之后才开始；媒体先写、state 一次性写入；失败时不写 state；可以撤销；所有测试**只用合成数据和测试设备** |
| 「成功」是假的 | 只有三层校验全部通过才叫「生成成功」；保存成功以系统回调为准，并核对目标文件大小；上传状态拿不到时就明确说「无法确认」 |
| 内存 | 一次只处理一个媒体，分块传输并有背压；用 5 GB 的合成手帐压力测试，监控内存峰值 |
| 系统中途结束 App | 暂存文件放在 tmp，下次启动时清理；手帐不受影响；没有成功的中间状态 |
| 格式实现错误 | Swift 和 JS 两套实现共用同一组测试向量；损坏样例必须全部被拒绝；`future-1.9` 必须能读、`future-2.0` 必须拒绝 |
| 回归 | 所有新行为放在 `backupV2` 开关后面：内部构建先开启，TestFlight 内部测试通过以后，才在正式版默认开启；v1 路径一直保留 |
| 旧版 App 读到新文件 | `.capiday` 是新的扩展名和格式，旧版本根本不会去打开它，所以不会读坏 |
| 用户在备份时继续编辑 | 用备份开始时的状态快照；媒体库没有删除接口，被引用的文件在备份过程中不会消失；备份过程**不写**任何数据库 |

## 6. 测试计划

**自动化**
- 单元测试（Node）：
  - `capiday-format.mjs`：manifest 的生成和校验、版本规则、路径规则、`complete` 判定、引用核对；
  - `backup-preview.mjs`：摘要和对比；
  - mime 新规则，正反两种样例；
  - 滚动快照的轮换（3 份）。
- 浏览器测试（Chromium）：
  - v1 的完整备份和恢复（在线链接路径）；
  - 恢复预览、二次确认、快照、撤销恢复；
  - 恢复中途失败时，state 保持不变；
  - 设置里的状态文案。
- XCTest（Mac 上的 Swift 包测试，加上 App 的单元测试 target）：
  - ZIP 读写器跑完所有测试向量；
  - 截断、改一个字节、路径攻击、CRC 和 SHA 错误都要被拒绝；
  - 写入 1 GB 的合成数据，再回读校验；
  - 空间不足时直接拒绝。
- 模拟器端到端（Mac）：
  - 合成手帐（约 300 MB 和 2 GB）备份，导出到「文件 / 我的 iPhone」，然后恢复到另一台模拟器，比较天数、页数、媒体数和所有媒体的 SHA。

**真机验收清单（TestFlight，测试设备，合成数据）**

| # | 场景 | 通过标准 |
|---|---|---|
| 1 | 媒体分别约 80 MB、1 GB、5 GB 时备份 | 成功；没有被系统因内存终止；记录耗时 |
| 2 | 备份过程中切到后台 5 秒，以及锁屏 | 能继续，或者明确失败；没有假的成功 |
| 3 | 剩余空间不够 | 开始前就提示，不写入任何文件 |
| 4 | 注入一个无法读取的媒体（内部开关） | 显示「不完整，缺少 1 个」；不点「仍然保存」就不保存 |
| 5 | 保存到「我的 iPhone」 | 显示「已保存」，并且在「文件」里能看到这个文件，大小一致 |
| 6 | 保存到 iCloud Drive（联网） | 先「已保存，正在上传」，然后变成「已上传」，或者显示「无法确认」，**不会提前显示已上传** |
| 7 | 保存到 iCloud Drive（飞行模式） | 停在「正在上传」或「无法确认」；联网后再打开 App，状态更新 |
| 8 | 在保存面板里取消 | 「备份没有保存」；上次备份的记录不变 |
| 9 | 在 Mac 上把 `.capiday` 改名为 `.zip` 后解压 | 能看到 manifest 和媒体（可移植性） |
| 10 | 截断文件、改一个字节 | 「检查备份文件」和恢复都提示已损坏；手帐不变 |
| 11 | 在另一台设备（或删除重装后）恢复 1 GB 的备份 | 数量一致；抽查 20 页，照片、视频、声音都正常 |
| 12 | 恢复中途强制结束 App | 再打开时，原来的手帐还在 |
| 13 | 撤销上次恢复 | 回到恢复前的状态 |
| 14 | 同一份备份恢复两次 | 媒体占用不会翻倍 |
| 15 | 恢复旧的 v1 JSON | 成功 |
| 16 | 通过 TestFlight 从旧版本更新 | 手帐和媒体都还在 |
| 17 | iCloud 整机备份 → 抹掉设备 → 恢复 | 记录 Capiday 的数据是否回来了（作为设置里说明文字的依据） |
| 18 | 快速开始迁移到新手机 | 同上 |
| 19 | 删除 App 后重装 | 数据确实没有了；说明文字和实际一致 |

## 7. 工作量估计

| 工作包 | 估计 |
|---|---|
| S1-0 实验 | 0.5–1 天 |
| S1-1 | 1.5–2 天 |
| S1-2 | 3–4 天 |
| S1-3 | 2–3 天 |
| S1-4 | 1 天 |
| 真机验收和修复 | 2 天 |
| **合计** | **约 10–13 个工作日**（不包括 TestFlight 审核等待） |

## 8. 交付和记录

- 每个工作包合并时：更新 whats-new（用户能看到的部分）、agent.md 和 README，跑全量回归，发布在线链接。在线链接只能体验 v1 路径和恢复安全部分，`.capiday` 只在 iPhone App 里可用，这一点要如实标注。
- 真机验收的结果按「通过 / 未通过 / 未测」逐项写进 agent.md，**不把模拟器的结果写成真机结果**。

## 附：Sprint 2 原图预评估（结论不变，摘要）

- 每张照片多占约 5–15 倍。
- 用可选字段 `originalRef`，不能和 `sourceRef` 混用。
- 真正的原图需要原生 `PHPickerViewController`。
- 分享原图时默认去掉 GPS。
- 备份格式 1.1 增加 `variant`。
- 在 Sprint 1 通过真机验收之前，不默认开启。
