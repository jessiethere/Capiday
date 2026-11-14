# Sprint 1 · 完整备份与恢复可靠性（技术方案，等确认后实施）

> 2026-11-14。本文只是方案，**没有改任何业务代码**。基于 agent.md 中的「数据存储架构与数据安全审查」，以及这一轮重新核对的代码（下文写明了行号，以 commit `134dac0` 为准）。
> 已确认的产品决策见 agent.md「2026-11-14 — 数据安全与分享导出：产品决策」。

## 0. 一句话

iPhone App 里改用一个**由 Swift 写入的备份包**：媒体逐个、分块交给 Swift 写进文件；写完以后**重新读一遍、逐个校验**，全部通过才显示「完整备份成功」。

这样做：
- 去掉 100 MB 上限，同时不需要把所有媒体一次放进内存；
- 恢复前先预览，确认后才写入；
- 写入前留一份当前手帐快照，可以「撤销恢复」；
- 任何一步失败都不碰现有数据。

在线链接（浏览器）没有 Swift，继续使用现在的 v1 JSON 备份（100 MB 以内），并如实说明限制。

---

## 1. 现状（代码证据）

| 环节 | 现状 | 证据 |
|---|---|---|
| 备份格式 | 单个 JSON：`{format:"little-days-backup", version:1, createdAt, complete, missing?, state, media:[{…, data:"data:…;base64,…"}]}` | `Public/js/media.mjs:317-325` |
| 100 MB 上限 | 先按记录的 `size` 求和，超过 `MAX_BACKUP_MEDIA_BYTES` 就直接拒绝，不生成文件 | `media.mjs:286-290, 433`；提示 `app.js:9339`（`error.backupSize`） |
| 内存 | 每个媒体用 `FileReader.readAsDataURL` 转成 base64（体积多约 33%），整份 `JSON.stringify` 成一个字符串，再生成 Blob | `media.mjs:298-309`；`app.js:11877-11916` |
| 校验 | 没有校验和、清单、App 版本，也没有数量记录；只有 `complete` 和 `missing` | `media.mjs:317-325` |
| 导出到哪里 | `<a download>` 下载，外壳把文件写到 **Documents/**，同名文件会先删除再写（同一天会覆盖），然后弹出分享面板。**之后不会清理** | `LittleDaysWebShellView.swift:295-344` |
| Documents 可见性 | `UIFileSharingEnabled` 和 `LSSupportsOpeningDocumentsInPlace` 都是 YES：明文备份在「文件」App 和 Finder 里可以直接看到，不受 App 锁保护 | `Native/LittleDays.xcodeproj/project.pbxproj:184-194` |
| 恢复入口 | `#backup-input` 文件选择，最大 150 MB，`JSON.parse(await file.text())` 整份读进内存 | `app.js:10129-10158` |
| 恢复校验 | 格式、`version 1`、`schemaVersion 1`、`validateStateSnapshot`、最多 2000 个媒体、单个不超过 50 MB；mime 用正则检查 | `media.mjs:328-374`，正则在 `media.mjs:350` |
| 恢复方式 | **整份替换**：先删掉 `state` 的所有键，再赋值；只确认一次（`settings.restoreConfirm`），**替换前不留快照** | `app.js:10144-10147` |
| 媒体写入 | 每个文件都用新的 UUID（`media.put(blob, …, null)`），引用重新映射 | `media.mjs:75, 376-379` |
| 部分失败 | 手帐不变（「备份没有恢复，当前记录已保留」）。但失败前已经写入的媒体会留下来成为孤儿文件 | 同上 |
| 已有方案 | `docs/BACKUP_FORMAT_PLAN.md`（C1 分卷 JSON、C4 恢复前快照），**没有实现** | — |

### 1.1 这一轮核对出的具体风险

1. **R-B1 媒体超过 100 MB 时无法备份**（已知 P0）。
2. **R-B2 恢复会拒绝合法的 mime。**
   - 正则 `(;codecs=[^;,]+)?` 不接受带逗号的 codecs，例如 `video/webm;codecs=vp8,opus`。
   - App 自己录音时优先用 `audio/webm;codecs=opus`（`app.js:12687`），没有逗号，所以**目前的录音不受影响**。
   - 但在 iOS 上，用户导入的视频的 `blob.type` 是否会带上含逗号的 codecs，**需要真机验证**。
   - 后果：用户能做出一个备份，却恢复不了。
3. **R-B3 恢复没有安全网**：整份替换之前不留快照，只能靠用户自己事先手动备份。
4. **R-B4 重复恢复会让媒体翻倍**：每次恢复都给媒体新 UUID，同一份备份恢复两次，占用的空间就是两倍。
5. **R-B5 明文备份和导出文件堆在 Documents 里**：在「文件」App 中可见，绕过了 App 锁，也从不清理。
6. **R-B6 备份成功的依据只是用户点了「已保存」**（`backupKeptSheet`，`app.js:2431`）。App 无法知道文件是否真的存好了，也无法验证文件可以读回。

---

## 2. 目标与验收原则

- 媒体多少都能完整备份（以设备剩余空间为限），**单个文件处理时的内存峰值约为 1 个媒体的大小加上 8 MB**。
- **只有逐项校验全部通过，界面才会显示「完整备份成功」。** 不完整的备份一律标成「不完整（缺少 N 个文件）」，绝不显示为成功。
- 恢复前先预览；确认之后再写入；写入失败时手帐不变；恢复成功以后可以撤销一次。
- 旧的 v1 JSON 备份照样可以恢复；新 App 在浏览器（在线链接）里仍然输出 v1。

---

## 3. 方案

### 3.1 新的备份包格式（v2，只在 iPhone App 里生成）

文件名：`Capiday-Backup-2026-11-14-2130.capiday`，内容是一个 **Apple Archive**（`AppleArchive` 框架，iOS 15 起提供，我们的最低版本是 17，不需要第三方库），里面是一个目录：

```
manifest.json      // 格式、版本、appVersion、schemaVersion、createdAt、设备语言、
                   // counts{days,pages,media}、totalBytes、complete、missing[]、
                   // files[{id, kind, mime, size, sha256, path}]
state.json         // 和现在 v1 的 state 完全一样（整本手帐 JSON，不含媒体）
media/<id>.<ext>   // 原始字节，不用 base64
```

- 每个媒体的 `sha256` 由 Swift 一边写入一边用 **CryptoKit** 计算。
  - 不在 JS 里算：`littledays://` 自定义来源下 `crypto.subtle` 是否可用没有把握，App 锁用的就是纯 JS 的 SHA-256（`app-lock.mjs`），大文件用纯 JS 算太慢。
- `state.json` 也计算 sha256，写进 manifest。
- 是否压缩：媒体本身已经压缩过（JPEG、MP4），用 `lzfse` 的收益很小。建议**不压缩**（`.none`），写得最快。
- 为什么不用 zip：iOS 没有公开的解压 API；而 Apple Archive 读写都有公开 API，在 Mac 上也能用「归档实用工具」打开。

### 3.2 JS 和 Swift 之间怎样传数据（不把全部媒体放进内存）

**备份（JS 推送，Swift 写入）**

1. JS 发出 `backup.begin {appVersion, counts}`。Swift 在 `tmp/backup-<uuid>/` 下建立暂存目录，返回 `token`。
2. JS 写 `state.json`：把字符串分块（每块 1 MB）发给 Swift。
3. 对每个**被引用的**媒体（`media.referencedIds(state)`），每次只处理一个：
   - 从 IndexedDB 读出这一个记录（`media.get`）。
   - 按 4 MB 一块转成 base64，用 `WKScriptMessageHandlerWithReply` 依次发送（`backup.chunk {token, id, seq, b64}`）。Swift 边收边解码，追加写入 `media/<id>` 并更新哈希。
   - 每块发完都要等 Swift 回复后才发下一块，这样可以控制内存和背压。
   - 发完后 `backup.fileEnd {id, size}`。Swift 核对字节数后返回 sha256。
4. 读不出来的媒体记进 `missing`，**继续处理下一个，不中断整个备份**。
5. `backup.finish {complete, missing}`。Swift 写 `manifest.json`，打包成 `.capiday`，然后进入「回读校验」（3.3）。
6. 校验通过后，Swift 弹出系统的「存储到…」面板（`UIDocumentPickerViewController(forExporting:)`），让用户选择保存位置：「文件 / 我的 iPhone」或 iCloud Drive。
7. 用户确实选了位置、系统回调成功之后，才记录「上次备份」。取消则记为「没有保存」。
8. 结束后清理暂存目录。

> **备选路线（需要先做一个小实验，Spike S1-0）**：JS 用 `fetch("littledays://backup/<token>/media/<id>", {method:"PUT", body: blob})`，由现有的 `WKURLSchemeHandler` 直接接收字节，省掉 base64。
> - 是否能拿到较大的请求体（`httpBody` / `httpBodyStream`），需要在 iOS 17 和 27 上实测。
> - 实验成功就用它（更快、更省内存）；失败就用上面的消息分块方案。

**恢复（Swift 解包，JS 按需拉取）**

1. Swift 的「选择备份文件」（`UIDocumentPicker`，类型 `.capiday` 加 `.json`）把文件解包到 `tmp/restore-<uuid>/`。
2. Swift 逐个核对 sha256 和大小。
3. 把 manifest 摘要交给 JS。
4. JS 显示**恢复预览**（3.5）。用户确认以后，JS 通过外壳已经在用的自定义 scheme 拉取：
   - `fetch("littledays://restore/<token>/state")`
   - 逐个 `fetch("littledays://restore/<token>/media/<id>")` → `blob()` → `media.put`
   - 每次只处理 1 个文件。
5. `.json`（v1）文件：Swift 只负责读取文件，然后交给现有的 JS `media.restore` 流程。继续保留 150 MB 上限，但改为由 Swift 告诉 JS 文件的大小。

### 3.3 完整性校验（「成功」的唯一标准）

备份时：
1. 写入时校验：每个文件的字节数等于 IndexedDB 记录的 `size`。
2. 打包后**回读校验**：打开 `.capiday`，逐个读出每个条目，重新计算 sha256，和 manifest 对比。数量、总字节数都要一致，`state.json` 能解析，并且通过 `validateStateSnapshot`（交给 JS 校验）。
3. 只要有一项不一致，就**不允许**显示「完整备份成功」。
   - 显示「备份失败，没有保存任何文件」（暂存目录会被删除）。
   - 或者显示「不完整：缺少 N 个文件（可以查看哪些）」，用户主动选择以后才保存。
4. 导出到用户选择的位置之后，再读一次目标文件的大小（如果能访问的话），确认和本地一致。

恢复时：
- 先完成 sha256 校验、manifest 校验和 `validateStateSnapshot`，**全部通过才进入预览**。
- 文件损坏或被截断时，明确说「这个备份文件已损坏，现有手帐没有改动」。

### 3.4 去掉 100 MB 上限，同时不破坏现有数据（重点）

| 风险点 | 做法 |
|---|---|
| 老用户已有的 v1 备份文件 | 恢复逻辑保留 v1 分支，原样可用。新的 v2 是新的扩展名和格式，旧版 App 打开 v2 时只会拒绝，不会读坏 |
| 浏览器 / 在线链接 | 仍然输出 v1 JSON，`MAX_BACKUP_MEDIA_BYTES` 只在浏览器路径生效。在 iPhone App 里调用的是 v2，不再检查这个上限 |
| 备份过程中用户继续编辑 | 备份开始时先 `await store.stored()`，再对当时的状态做一份快照（`structuredClone`）。媒体按快照里的引用读取；媒体库**没有删除接口**（`media.mjs` 只有 put / get），所以备份过程中被引用的文件不会消失 |
| 备份读取影响日常使用 | 只读：`media.get` 不修改记录。整个备份过程**不写** `little-days-meta`，也**不写** `little-days-media` |
| 内存 | 每次处理一个文件，按 4 MB 分块。最大的单个文件是 50 MB 的视频，峰值约为 50 MB 加分块缓冲 |
| 空间不足 | 开始前，Swift 用 `volumeAvailableCapacityForImportantUsage` 估算需要的空间（媒体总字节 × 1.1 加 state），不够就直接说明「需要约 X GB 空闲空间」，什么都不写 |
| 中途切到后台或被系统结束 | 用 `beginBackgroundTask` 争取时间。如果还是被结束，暂存目录留在 tmp 里（下次启动时清理），手帐本身不受影响。界面不会出现「成功」 |
| 写入格式之外的其他存储 | 不改 IndexedDB 的结构，也不迁移任何数据 |

### 3.5 安全恢复

1. **预览**（只读）
   - 备份日期、来自哪个 App 版本；
   - 有多少天、多少页、多少照片 / 视频 / 声音，总大小；
   - 完整或不完整（缺少哪些文件）。
   - 同时和**当前手帐**对比：「当前：128 天 · 1.2 GB；备份：96 天 · 900 MB」。如果备份比当前内容少，用醒目的提示说明。
2. **确认**：一张底部面板，「恢复会替换当前的全部手帐」，按钮是「恢复这个备份」和「取消」。如果当前手帐有内容，第二步要先点「我已了解」，或者勾选一项确认。
3. **写入前快照**（C4）：把当前状态的 JSON 原样写进 `little-days-meta` 的 `little-days.v1.before-restore`。
   - 只写 state，因为媒体本来就不会被删除，旧的引用仍然有效。
   - 快照写入失败时，**停止恢复**。
4. **写入顺序**：媒体先写，state 最后一次性写入。
   - 媒体写入阶段如果失败：手帐不变，提示失败。已经写进去的媒体留作孤儿文件（记录到「待清理」清单，等 Sprint 2 的安全清理处理，不在这里删除）。
   - 最后一步 `store.update` 失败：手帐不变（现有的 `onPersistError` 会提示）。
5. **媒体去重**（解决 R-B4）
   - v2 备份带有原始 id 和 sha256。如果当前媒体库里已经有**相同 id 而且相同 sha256** 的文件，就跳过写入，沿用原来的 id。
   - id 冲突但内容不同时，才分配新的 UUID 并重新映射。
   - v1 备份保持现在的行为，每个文件都用新 id。
6. **撤销恢复**：恢复成功后，设置里显示「撤销上次恢复（7 天内）」。点了以后，用快照替换回去，也要先确认。
7. 修复 R-B2：mime 校验放宽为 `type/subtype` 加任意参数（只检查主类型属于 image、audio 或 video，图片子类型允许 jpeg / png / webp / gif / heic），同时继续限制大小和数量。

### 3.6 Documents 清理与隐私（R-B5）

- 下载、导出改为先放进 `tmp/`，再通过系统面板「存储到…」或「分享」交给用户；完成或取消以后删除 tmp 中的文件。
- Documents 里已经存在的旧文件**不自动删除**，因为那可能是用户唯一的备份副本。设置里加一项「App 文件夹中有 N 个旧备份或导出文件（X MB）」，由用户在「文件」App 里自行处理，或者点「查看」。
- 备份加密：**这次不做**。设置和导出说明里写明「备份文件没有加密，请放在你信任的位置」。是否需要「带密码的备份」，放到 Sprint 2 之后再决定（见 9）。

### 3.7 设置里的说明和提醒

- **数据与存储**分区（见 `docs/SETTINGS_IA_V2_PLAN.md`）写一句固定的说明：「手帐保存在这台 iPhone 上。删除 App 前请先备份。」
- 提醒沿用现有的 `backupDue`（至少 3 天自己的内容，并且 14 天以上没有备份，`app.js:2469`），再加两个条件：
  - 自上次备份以来新增了 50 个以上的媒体，或 500 MB 以上；
  - 上次备份「不完整」，而且之后没有补一次完整备份。
- 首页横幅点 × 之后，7 天内不再出现（保持现有规则）。不加推送通知。

---

## 4. 需要修改 / 新增的文件（实施时）

| 文件 | 改动 |
|---|---|
| `Native/Sources/LittleDaysUI/WebShell/LittleDaysBackup.swift`（新） | 暂存目录、分块写入、CryptoKit 哈希、Apple Archive 打包和解包、回读校验、空间检查、清理 |
| `LittleDaysWebShellView.swift` | 注册 `backup.*` 和 `restore.*` 消息处理（`WKScriptMessageHandlerWithReply`）；文档选择器和导出面板；把下载目标从 Documents 改成 tmp |
| `LittleDaysWebResources.swift` | `littledays://restore/<token>/…` 只读路由（只开放当前 token 的暂存目录） |
| `Public/js/backup-v2.mjs`（新，纯逻辑加编排） | manifest 生成和校验、分块、进度、预览摘要（可以单元测试） |
| `Public/js/media.mjs` | `referencedIds` 导出；放宽 mime 正则；v1 路径保留 |
| `Public/app.js` | 备份和恢复界面：进度、取消、预览、二次确认、撤销恢复、错误文案 |
| i18n、styles | 新文案和面板样式 |
| `Packages/LittleDaysCore`（只有测试） | 用 Swift 端的单元测试覆盖 manifest 编解码和哈希 |
| 测试 | 单元测试：manifest、分块、mime、去重映射。浏览器测试：v1 回归（在线链接路径）。原生端在 Mac 上跑 XCTest，加上模拟器的端到端测试 |

---

## 5. 分步实施（每一步都可以单独发布）

1. **S1-0 Spike（半天）**：验证 `WKURLSchemeHandler` 能否接收 PUT 请求体，以及 Apple Archive 在模拟器上的读写性能（1 GB 的样例）。
2. **S1-1** 修复恢复的 mime 正则（R-B2），加入恢复前快照和撤销恢复（R-B3）。这一步只改 JS，风险最小，先做。
3. **S1-2** Swift 备份写入、回读校验、导出面板（v2）。
4. **S1-3** Swift 解包和校验，JS 预览和拉取式恢复，媒体去重（R-B4）。
5. **S1-4** 下载改为放进 tmp 并清理，加上 Documents 旧文件提示（R-B5）；完善设置说明和提醒。

---

## 6. 风险控制

| 风险 | 控制措施 |
|---|---|
| 恢复写坏现有手帐 | 先快照、媒体先写 state 后写、写入失败停止、可撤销；测试必须**只用合成数据**，不能动用户真实的手帐 |
| 备份显示成功但文件不可用 | 回读校验是成功的唯一判据；另外加「验证备份文件」按钮，可以随时选择一个备份文件只做校验、不恢复 |
| 大文件导致内存崩溃 | 每次处理一个文件、分块传输；用 1 GB 和 5 GB 的合成数据压力测试 |
| 系统中途结束 App | 暂存在 tmp、下次启动时清理；界面上没有「成功」的中间状态 |
| v2 格式以后需要改 | manifest 带 `formatVersion`；读取时不认识的字段忽略，主版本号不认识就拒绝 |
| 旧版 App 读新备份 | 扩展名和 `format` 都不同，旧版只会提示「无法识别的备份」 |

---

## 7. 真机验收清单（TestFlight）

用**测试设备和合成数据**，不碰真实手帐。

**A. 备份**
1. 媒体少于 100 MB、约 1 GB、约 5 GB（含 20 个以上 40–50 MB 的视频）的手帐，各备份一次：成功；内存没有被系统终止（用 Xcode Organizer 或 Instruments 看峰值）；记下耗时。
2. 备份过程中切到后台 5 秒再回来，以及备份过程中锁屏：备份能继续或明确失败，不会出现假的成功。
3. 存储空间不足（剩余空间小于预计大小）：开始前就提示，什么都不写。
4. 人为让一个媒体记录无法读取（测试构建里的注入开关）：显示「不完整，缺少 1 个」，默认不保存，用户主动选择才保存，界面上不显示「成功」。
5. 导出到「文件 / 我的 iPhone」、iCloud Drive、AirDrop 到 Mac：在 Mac 上用「归档实用工具」能打开，manifest 可以读取。

**B. 校验**
6. 截断或篡改备份文件的一个字节：「验证备份文件」和恢复都报「文件已损坏」，现有手帐不变。

**C. 恢复**
7. 在第二台测试 iPhone（或删除重装后）恢复 1 GB 的备份：天数、页数、媒体数和备份时一致；随机抽 20 页逐项核对照片、视频和声音能播放。
8. 恢复中途强制结束 App：重新打开后，原来的手帐还在（没有被替换）。
9. 恢复成功后点「撤销上次恢复」：回到恢复前的状态。
10. 同一份备份连续恢复两次：媒体库的总占用不会翻倍（去重生效）。
11. 用旧版 App 做的 v1 JSON 备份恢复到新版：成功。

**D. 系统行为**（同时也是 Sprint 1 的调查项，写入结论）
12. 通过 TestFlight 从旧版本更新到新版本：手帐和媒体都在。
13. iCloud 整机备份后抹掉设备，再从 iCloud 恢复：确认 Capiday 的手帐是否随整机备份恢复（`Library/WebKit` 是否包含在内）。结论写进设置里的说明。
14. 通过「快速开始」迁移到新手机：同上。
15. 删除 App 再重装：确认数据确实没有了，设置里的说明与实际一致。

---

## 8. Sprint 2 预评估：保留原图（只评估，不实施）

| 问题 | 评估 |
|---|---|
| 空间成本（估算） | 现在的显示图：长边 1200 px、JPEG 0.84，约 0.2–0.45 MB。iPhone 原图（HEIC 12 MP）约 1.5–3 MB，24 MP 约 3–5 MB，以 JPEG 原样保存时约 4–8 MB。也就是**每张照片多占约 5–15 倍**。按每天一页、每页 3 张、一年估算：显示图约 0.3–0.5 GB，加上原图约 2–5 GB |
| 能否复用媒体引用 | 能。原图作为另一个 `media:<uuid>` 记录，照片图层新增可选的 `originalRef` 字段。显示、排版、导出缩略图继续用 `mediaRef`。注意 `sourceRef` 已经用于「照片编辑前的原片」（V3.6），不能混用 |
| 获取真正的原图 | `<input type=file>` 在 WKWebView 里拿到的文件，iOS 可能已经转码（HEIC 转 JPEG，是否缩小尺寸**需要真机验证**）。要拿到真正的原始字节，需要原生的 `PHPickerViewController` 加 `loadFileRepresentation`，不需要照片库授权 |
| 隐私 | 原图带 EXIF、GPS，分享或导出时**默认去除位置信息**；隐私说明要写清楚原图会保留位置信息（只在本机） |
| 备份容量与性能 | 原图会让备份体积变成原来的 5–10 倍，所以必须先完成 Sprint 1 的流式备份。备份中可以选择「包含原图」（默认包含，可以关闭以缩小备份） |
| 旧照片 | 没有原图，`originalRef` 缺省，界面显示「标准画质」，不回溯、不提示升级 |
| 用户选择 | 在「数据与存储」里设置「照片保存质量」：**标准（默认，节省空间）/ 保留原图**。只对之后新加入的照片生效。在 Sprint 1 的流式备份上线并通过真机验收之前，**不默认开启**（按产品决策） |

## 9. 需要产品负责人确认

1. 新的备份包用 `.capiday`（Apple Archive）的单文件格式，还是继续沿用 `BACKUP_FORMAT_PLAN.md` 的「分卷 JSON」？
   - 推荐 `.capiday`：没有 base64 膨胀，可以流式处理，校验也完整。
   - 分卷 JSON 的好处是浏览器也能用，但文件多、恢复时要一次选中所有分卷。
2. 备份的保存方式：每次由用户在系统面板里选择位置（推荐，简单透明）；还是在 App 里固定保存最近 1 份到 Application Support（不在「文件」里显示）？
3. 是否在 Sprint 1 就加入「带密码的备份」（AES-GCM）？推荐放到以后：忘记密码就等于失去备份，需要更细的设计。
