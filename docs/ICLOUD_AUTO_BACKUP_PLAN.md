# 自动 iCloud 备份升级规划

> **状态：Planned — Post-Alpha Data Safety Upgrade**（已规划，Alpha 稳定性修复和备份恢复验证完成后实施）。
> 2026-11-15。本文只做技术调查、需求整理和规划：**没有修改备份逻辑、没有启用 iCloud / CloudKit、没有修改数据结构、没有删除或迁移任何数据**。现有的手动 JSON 备份保留，作为安全兜底。
> 代码证据以 commit `a3cea07` 为准（容器快照，和 Mac 的 HEAD 相同；`Native/…/WebApp/` 和 `Public/` 逐字节一致）。行号会漂移，以函数名为准。
> 本文在 [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md)（2026-11-14 架构设计）和 [SPRINT1_BACKUP_RESTORE_PLAN.md](SPRINT1_BACKUP_RESTORE_PLAN.md) 的基础上更新，不重复的细节见这两份。任务 ID 见 [DEVELOPMENT_TRACKER.md](DEVELOPMENT_TRACKER.md) 第 5 节（DS-01～DS-14）。

产品目标：**用户安心记录生活，不需要主动管理备份文件。**

## 1. 当前数据存储架构

| 存储 | 键 / 名称 | 内容 | 位置 |
|---|---|---|---|
| IndexedDB `little-days-meta` / `kv` | `little-days.v1` | **整份手帐**：books、entries（每页、图层、贴纸、字体、排版、背景）、drafts、habits、checks、plans、reflections、keeper（Captain）、samplesAdded | `meta-store.mjs` |
| 同上 | `….snap.<日期>`（每天，保留 3 天 / 14 天 / 60 MB）、`….before-restore.<时间>`（保留 2 个）、`….rescue`、`little-days.media-sha` | 只有 JSON 的快照（不含媒体）和内容哈希索引 | `restore-safety.mjs`、`journal-open.mjs` |
| IndexedDB `little-days-media` / `media` | UUID | `{id, bytes, mime, size, createdAt, kind, name, aspect?, duration?…}`，**没有删除接口** | `media.mjs` |
| localStorage | `little-days.v1` | 手帐的镜像（放得下时）；放不下时关掉镜像 | `model.mjs` |
| localStorage | 约 45 个 `little-days.*` 键 | 主题、语言、提醒、App 锁、Labs、引导、账户名和头像、阅读位置、Captain 未发送的草稿、清空一天的撤销副本、事件日志、上次备份时间等 | `app.js`、`js/*.mjs` |
| Cache API / Service Worker / sessionStorage | — | **没有使用** | — |
| 原生层 | UserDefaults（提醒标记、Debug 键）；Documents（PNG 等导出） | **手帐数据从不存在原生层** | `LittleDaysReminders.swift`、`LittleDaysWebShellView.swift` |

- WKWebView 用 `websiteDataStore = .default()`（持久），页面来自自定义 scheme `littledays://app`，所以 IndexedDB 和 localStorage 都属于这个固定的 origin，存在 App 容器的 `Library/WebKit/WebsiteData/…`。
- **结论：是的，所有手帐数据都只在 WebKit 存储（这个 origin 的 IndexedDB + localStorage）里**，没有任何别的副本，除了用户手动保存的备份文件。
- 写入：`store.update` 先同步写 localStorage，再排队写 IndexedDB；`store.stored()` 等 IndexedDB 写完；编辑器草稿 450 ms 内写入，切到后台 / 关闭时立即写；媒体写入后回读检查大小。
- 启动：先读 IndexedDB，`decideJournalOpen` 决定用哪一份；两份都读不了时显示救援面板，不会用空数据覆盖；启动时请求 `navigator.storage.persist()`。

## 2. 现有备份机制和潜在风险

### 2.1 手动 JSON 备份（v1）

- 内容：`{format:"little-days-backup", version:1, createdAt, complete, missing?, state, media:[…base64…]}`，文件名 `Capiday-Backup-<日期>[-incomplete].json`。
- **包含**：整份 `state`（手帐页面、My Books、草稿、排版和贴纸、Captain 的 `keeper`、示例日），以及所有被引用的照片、视频、音频、手绘、封面（`visitMediaReferences` 列表）。
- **不包含**：所有 localStorage 设置（主题、语言、提醒、App 锁、账户名和头像、Labs 演示数据、Captain 未发送的草稿、清空一天的撤销副本、阅读位置）；快照；没有被引用的媒体。设置页已经写明（`bk2.notList`）。
- 上限：被引用的媒体合计 100 MiB，超过时**拒绝备份**（不会静默丢文件）；恢复文件上限 150 MiB、单个媒体 50 MiB、2000 个文件。
- iPhone 上的保存：写到 `tmp/capiday-backup/` → 系统「存储到」选择器 → 检查保存后的大小 → 判断位置（iCloud / 本机 / 其他）→ 删掉临时文件 → 记录「上次备份」（只有完整的备份才算）。
- 恢复：大小检查 → 解析 → `analyzeBackup`（格式、版本、结构、MIME、大小、引用齐全）→ 对比预览 + 二次确认 → 写入前快照（回读校验）→ 逐个写媒体（按 id、再按 SHA 去重）→ 一次替换 → 回读比对 → 失败回滚；中断后下次启动继续处理；7 天内可撤销。
- 加密：备份文件**没有加密**（JSON 明文 + base64 媒体），保护依赖用户选择的保存位置（iCloud Drive 本身在 Apple 侧加密；开启「高级数据保护」时端到端加密）。完整性：恢复时逐项检查结构和引用，但**文件本身没有校验和**。

### 2.2 风险（R1～R10）

| # | 风险 | 级别 | 是否真实存在 | 建议 |
|---|---|---|---|---|
| R1 | 媒体超过 100 MiB（约 300～600 张照片，或 2～3 个大视频）后**完全没有备份途径** | **高** | 是 | DS-02：`.capiday` 流式备份包（S1-2 / S1-3，未实现，只有 `spikes/s1-0/`） |
| R2 | 唯一副本在这台手机的 WebKit 存储里；没有自动的、离开手机的副本。卸载或丢手机 = 丢掉上次手动备份之后的一切。整机 iCloud 备份是否包含 WebKit 数据**没有真机验证** | **高** | 是 | DS-01 真机验证；DS-04～07 自动 iCloud 备份 |
| R3 | **能生成恢复不了的备份**：备份按原始字节限制 100 MiB，base64 后约 139.8 MB，而恢复上限是 150 MiB（157.3 MB）；state 超过约 17 MB 时文件能备份、恢复时被拒绝（`too-large`）。`runBackup` 没有检查 `blob.size` | 中低（需要很大的 state） | 潜在 | DS-09：生成后检查文件大小 ≤ 恢复上限，超过就提示，不记为成功 |
| R4 | 封面配置 `entry.coverPhotos[页].reference` 里的 `media:` 引用不在 `visitMediaReferences` 里，恢复时媒体重新编号后它不会被改写 → 重新排版封面时显示坏图（文件本身已备份，因为封面图层也引用它） | 低 | 是（边缘情况） | DS-10：把 `coverPhotos` 加进 `visitMediaReferences` + 测试 |
| R5 | 恢复切换后回滚失败被 `catch {}` 吞掉；恢复记录被清掉，`RESTORE_LAST` 没写，界面里找不到恢复前快照（14 天后被清理）。撤销恢复本身不能再撤销 | 低中 | 是（边缘情况） | DS-11：回滚失败时保留记录并在设置里显示「恢复前的数据」入口 |
| R6 | 保存到「我的 iPhone › Capiday」（App 自己的 Documents，因为开了文件共享）的备份**会随 App 一起被删除**；这个位置被归为 `other`，没有提醒，还记为「已验证」 | 中 | 很可能；**位置判断需要真机确认** | DS-12：识别 App 自己的 Documents，提示「删除 App 会一起删除，请选 iCloud Drive」 |
| R7 | 只在 localStorage 的、用户可能认为是「自己的」数据：账户名和头像、Labs 演示、清空一天的撤销副本、App 锁和提醒设置，都不在备份里 | 低（设计如此） | 是 | DS-13（决定）：账户名 / 头像是否加入备份 |
| R8 | WebKit 存储可能被系统清理或限额（iOS 17+ 非浏览器 App 每个 origin 约为磁盘的 15%）；`persist()` 是否被批准未知 | 未知 | 未验证 | DS-01 真机检查 `media-check` 里的 persisted |
| R9 | 备份在内存里约占文件大小的 3 倍；接近上限时可能内存不足，备份失败（手帐不受影响） | 低 | 是（会明确失败） | DS-02 流式备份一起解决 |
| R10 | 很小的写入窗口：镜像关闭时，编辑在 IndexedDB 写完前只在内存里；清除镜像失败时旧镜像可能在下次启动时胜出 | 低 | 理论上 | 观察；不单独排期 |

**按要求先提出修复建议**：R3、R4、R6 是「现在就可能让用户以为有备份、其实恢复不了或会丢」的问题，建议在 **Alpha Stability 的 DS-01 里优先修**（都是小改动、只改 JS / 一处 Swift 判断，不改数据结构）。本次没有修改，**等 Founder 批准**。R1、R2 需要较大的工作（DS-02 起），放在 Data Safety Upgrade。

## 3. 三种技术路线对比

| 维度 | A. iOS 系统 iCloud 整机备份 | B. iCloud Drive 自动备份（App 容器） | C. CloudKit |
|---|---|---|---|
| 是什么 | 系统每天在充电 + Wi-Fi + 锁屏时备份整台手机，App 容器的 `Library/` 通常包含在内 | App 定期生成一个完整的备份包，写进自己的 iCloud 容器 `iCloud.com.capiday.app/Documents/Backups/`，由系统上传 | 把手帐按记录（书、天、页、媒体）存进 CloudKit 私有数据库，增量同步 |
| 和现在架构的兼容性 | 不用改代码，但**完全不受 App 控制**：不能单独恢复 Capiday、不能确认是否包含 WebKit 数据（未验证） | **很好**：备份本来就是一个自包含文件；只要把「保存位置」从用户选择改成 App 的容器。不碰 IndexedDB | **差**：现在是一整份 JSON，要先拆成记录、加修改时间和删除标记，改动整个存储层 |
| 开发复杂度 | 0（只需验证和说明） | 中：entitlements、`NSUbiquitousContainers`、Swift 写文件、上传状态、调度；依赖 DS-02 流式备份包 | 高：数据模型拆分、同步引擎（`CKSyncEngine`）、冲突处理、删除同步 |
| 数据完整性 | 不可验证（App 看不到） | 可以验证：manifest + sha256，回读比对；用 `isUploaded` 确认上传完成 | 每条记录可验证，但跨记录一致性要自己保证 |
| 媒体文件 | 包含在整机备份里（未验证） | 每次备份是全量包；大视频会重复上传（**需要增量或减少频率**） | 媒体作为 `CKAsset` 逐个上传，天然增量 |
| 恢复体验 | 只能在新手机「从 iCloud 云备份恢复」时整机恢复；不能单独恢复 Capiday | 设置里「从 iCloud 恢复」，列出备份（时间、天数、页数、大小），沿用现有的预览 + 确认 + 快照 + 撤销 | 自动出现（同步），但冲突和误删的处理需要额外设计 |
| 运行成本 | 0（用户自己的 iCloud 空间） | 0（用户自己的 iCloud 空间；没有服务器） | 私有数据库用用户自己的空间，没有服务器成本 |
| 后台执行限制 | 系统决定 | 切到后台时的短时间任务 + `BGProcessingTask`（系统决定何时运行）；**不能承诺固定时间** | 同 B，另外有推送和速率限制 |
| 长期扩展性 | 无 | 中：是 C 的前置（备份包和校验能复用） | 高：多设备、iPad、以后的共享 |
| 隐私和安全 | Apple 侧加密；「高级数据保护」下端到端 | 同左（iCloud Drive）；文件对用户可见，可以自己删除或转移 | 私有数据库同样加密；开启「高级数据保护」时大部分字段端到端 |

## 4. 推荐方案

**推荐 B（iCloud Drive 自动备份），A 作为额外的一层保护（只验证和说明，不依赖），C 暂缓。**

理由：
1. B 和现在的架构最契合：备份本来就是一个完整的文件，只是把「用户手动选择位置」换成「App 自动写进自己的 iCloud 容器」；IndexedDB、数据结构都不用改。
2. B 的成功可以被验证（manifest + sha256 回读 + `isUploaded`），满足「不能在写完或上传前显示成功」。
3. B 是 C 的前置：备份包格式和校验逻辑以后做同步时还能用。C 现在做会牵动整个存储层，风险最高，而 Capiday 还没有多设备需求。
4. A 不能被 App 控制或验证，不能作为主要方案，但真机验证后可以在设置里如实说明「整机备份也包含 / 不包含 Capiday」。

前置条件：**DS-02 流式 `.capiday` 备份包**（取消 100 MiB 上限、可校验）。在它完成之前，自动备份只能沿用 100 MiB 的 JSON，媒体多的用户恰恰得不到保护，所以不建议用 JSON 做自动备份。

媒体重复上传的对策（避免频繁上传大文件）：
- 自动备份频率：有改动时最多每天一次；只在 Wi-Fi 下（「蜂窝网络也备份」默认关）；
- 保留策略：最近 3 份 + 每月 1 份（最多 6 个月），新的一份确认上传后才删除旧的；
- v2 可以把媒体放进按 sha256 命名的共享文件夹（`Backups/media/<sha>`），每份备份只引用，实现增量（需要单独设计和验证）。

## 5. 分阶段实施计划

| 阶段 | 内容 | 任务 | 前置 |
|---|---|---|---|
| **0 · Alpha Stability** | 现有备份的完整性审查（本文第 2 节，已完成调查）+ 小修 R3 / R4 / R6（等批准）+ 真机演练：备份 → 删除 App → 重装 → 恢复；整机备份 / Quick Start 换机是否带上 WebKit 数据；`persist()` 结果 | DS-01、DS-09、DS-10、DS-12、DS-03 | Founder 批准小修 |
| **1 · 流式备份包** | Swift `.capiday`（Apple Archive）：JS 按 4 MB 分块交给 Swift，一边写一边算 sha256；manifest；回读校验；恢复同样流式；取消 100 MiB 上限；JSON v1 仍可恢复 | DS-02 | 阶段 0 |
| **2 · iCloud 容器** | Signing & Capabilities → iCloud Documents（`iCloud.com.capiday.app`）；`NSUbiquitousContainers`；`ubiquityIdentityToken` 检查登录；空间不足 / 关闭 iCloud / 换账号的处理 | DS-04 | 阶段 1；需要 Apple Developer 账号操作 |
| **3 · 自动备份** | 触发：有改动 + 切到后台（`beginBackgroundTask`）+ `BGProcessingTask`；写临时文件 → 校验 → `NSFileCoordinator` 写入 `.partial` → 改名；状态机：生成中 → 已写入容器 → 已上传（`isUploaded`）；失败不影响写日记，只在设置里显示 | DS-05 | 阶段 2 |
| **4 · 设置里的状态** | 「设置 → 数据与备份」：iCloud 是否可用、自动备份开关、**最近一次经过验证的成功备份时间**、等待中 / 失败原因、立即备份、恢复、手动导出 | DS-06 | 阶段 3 |
| **5 · 从 iCloud 恢复** | 列出容器里的备份；下载（显示进度，无网络时说明）；沿用现有恢复安全机制（预览、二次确认、快照、回滚、撤销）；本机已有数据时**不静默覆盖** | DS-07 | 阶段 3 |
| **6 · 保留与清理** | 3 份最近 + 每月 1 份；新的一份上传后才删除旧的；用户可在「文件」App 里看到并自己管理 | DS-08 | 阶段 3 |

自动备份默认**关**还是**开**（第 7 节决定 1）；任何阶段都保留手动导出。

## 6. 恢复测试方案

自动化（合成数据，每个阶段都跑；现有 v161 / v163 / testBackupRoundTrip 继续保留）：

1. 往返：生成 → 恢复到空设备 → 每本书、每天、每页、每个图层、每个媒体的 sha256 完全一致。
2. 大数据：600 张照片 + 5 个 50 MB 视频（> 100 MiB）用 `.capiday` 往返成功；JSON v1 明确拒绝，不生成坏文件（R3）。
3. 媒体重新编号：恢复时 id 冲突 / SHA 去重 → 所有引用（含 `coverPhotos`，R4）改写正确。
4. 中断：生成中、写入容器中、上传中、恢复的 4 个崩溃点 → 不显示成功；重启后状态正确；手帐不变。
5. 回滚失败（R5）：模拟回滚写入失败 → 设置里仍能找到恢复前的数据。
6. 旧备份：v1 JSON、没有新字段的备份、示例日 → 都能恢复。
7. 本机已有数据：恢复前预览显示两边的差异；取消时什么都不变。
8. 状态：未写完 / 未上传时不显示「备份成功」；只有回读校验 + `isUploaded` 后才更新「最近一次成功备份」。

真机（Founder，iPhone；结果记入 BETA_RELEASE_PLAN）：

9. 删除并重新安装 App → 从 iCloud 恢复。
10. 换新 iPhone（Quick Start 和「从 iCloud 云备份恢复」各一次）→ Capiday 数据是否在（验证 A）。
11. 同一 Apple Account 的另一台设备恢复。
12. 飞行模式下恢复 → 明确提示需要网络，什么都不改。
13. iCloud 空间不足 → 备份显示失败和原因，写日记不受影响。
14. 关闭 iCloud Drive / 退出 Apple Account → 自动备份暂停并说明；手动导出仍可用。
15. 保存到「我的 iPhone › Capiday」→ 删除 App 后文件是否还在（验证 R6）。
16. 低电量模式、后台被系统杀掉 → 下次打开时继续，不重复上传。

## 7. 需要产品负责人确认的决策

1. 自动 iCloud 备份默认开还是关（推荐：首次打开备份设置时询问，默认开；没有 iCloud 时说明）。
2. 是否批准在 Alpha Stability 里先修 R3 / R4 / R6（推荐批准；都是小改动，不改数据结构）。
3. 备份包格式确定为 `.capiday`（推荐，STORAGE_ARCHITECTURE 第 11 节的决定 1 仍待确认）。
4. 自动备份的保留数量（推荐 3 份最近 + 每月 1 份，最多 6 个月）。
5. 是否允许蜂窝网络自动备份（推荐默认只在 Wi-Fi）。
6. 账户名、头像、App 锁、提醒等设置是否加入备份（R7；推荐账户名和头像加入，App 锁不加入）。
7. 备份文件是否需要 App 自己加密（推荐 v1 不加，依赖 iCloud 加密和「高级数据保护」，避免用户忘记密码而无法恢复）。
8. 自动 iCloud 备份放进哪个版本（推荐：首个正式版之后的第一个版本，先让流式备份在真机上稳定）。
9. CloudKit 同步（C）是否进入路线图，还是等出现真实的多设备需求（推荐后者）。

## 8. 本次更新的文档

- 新增本文 `docs/ICLOUD_AUTO_BACKUP_PLAN.md`。
- `docs/DEVELOPMENT_TRACKER.md` 第 4.3 节和第 5 节：DS-01～DS-14。
- `docs/ROADMAP.md`：后续阶段一节。
- `agent.md`、`README.md`：本次记录与 Roadmap 摘要。
- 没有修改 STORAGE_ARCHITECTURE.md 的设计；其中已过时的描述（§3.1 下载到 Documents → 分享；部分行号）在本文第 2 节按当前代码重新写了。

本次只规划，不实施新备份功能。
