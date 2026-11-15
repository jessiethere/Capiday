# Capiday Development Tracker · 唯一任务总表

> **One source of truth. No forgotten tasks. Every plan has an owner, status, and next action.**
>
> 建立：2026-11-15（Development HQ）。所有 Bug、产品需求、技术债、规划都在这里有一个 ID 和状态；只写在聊天记录里的计划不算数。
> 详细的 Bug 记录（复现步骤、根因、验证）仍在 [BUG_BACKLOG.md](../BUG_BACKLOG.md)，发布检查在 [BETA_RELEASE_PLAN.md](../BETA_RELEASE_PLAN.md)；本表是索引和状态的唯一来源，两边状态不一致时**以本表为准**，并立即改正另一边。

## 1. 规则

### 1.1 状态

| 状态 | 含义 |
|---|---|
| **Inbox** | 刚收到，还没分析 |
| **Planned** | 已分析、已排进某个版本，但前置条件没满足（例如要等 Alpha 稳定） |
| **Ready** | 可以马上开发：需求清楚、没有阻塞 |
| **In Progress** | 正在开发 |
| **Testing** | 代码已改、自动化测试通过，**等真机或 Founder 验收**。自动化通过不等于完成 |
| **Done** | Founder 在真机上按验收标准确认过（写明日期和构建） |
| **Blocked** | 卡住了：写明卡在哪里、等谁 |

- 不删除未完成的任务；不再做的，写明原因，状态保持 Blocked（等 Founder 确认关闭）。
- **本表就是 Alpha Backlog**（2026-11-15 Nightly Sprint 要求的 `docs/ALPHA_BACKLOG.md` 用本表，不另建重复文件）。Sprint 里用的状态名对应：Pending = Inbox / Planned / Ready · In Progress = In Progress · Fixed / Awaiting Verification = **Testing** · Verified = **Done** · Blocked = Blocked · Deferred = Planned（排在以后的版本）。
- 从 BUG_BACKLOG 映射：`Fixed — Pending Device Verification` → **Testing**；`Verified` → **Done**；`Triaged（需要 Founder 决定）` → **Blocked**。

### 1.2 优先级

P0 数据丢失 / 无法使用 · P1 核心流程错误 · P2 明显影响体验 · P3 小问题、观感。高优先级 Bug 不被未来功能挤占。

### 1.3 ID

| 前缀 | 用途 |
|---|---|
| `CAP-0xx` | Bug（详细记录在 BUG_BACKLOG.md） |
| `CAP-E0xx` | 功能改进（BUG_BACKLOG.md 5b 节） |
| `MW-0x` | Memory Wall 照片墙 v1.0 |
| `DS-0x` | Data Safety：备份、恢复、自动 iCloud 备份 |
| `TD-0x` | 技术债、工具、测试环境 |
| `REL-0x` | 发布、验收、构建 |
| `FT-0x` | 其他已有规划的功能（Beta 及以后） |

### 1.4 每次开发前后

- **开发前**：读本表，选定任务（Ready 里优先级最高的 Bug 优先），把它改成 In Progress。
- **开发后**：
  1. 更新状态和「测试结果」；
  2. 在 agent.md 记录实际修改；
  3. README.md 写摘要；
  4. 在本表末尾「变更记录」加一行；
  5. 回复里给出下一个建议执行的任务。

## 2. 总览

统计（2026-11-15，V10.77 · Nightly Sprint 之后；随每次更新改写）：

| | 数量 |
|---|---|
| 任务总数 | **63**（Bug 28 · 功能改进 4 · DS 14 · MW 5 · TD 5 · REL 2 · FT 5） |
| 未完成（不是 Done） | **63**（还没有任何一项经过 Founder 真机确认） |
| 按优先级 | P0 9 · P1 13 · P2 24 · P3 15 · 未定级 2（TD-04、TD-05 建议关闭） |
| 按状态 | Testing 29 · Planned 17 · Blocked 13 · In Progress 2（DS-01、REL-02）· Ready 1（TD-01）· Inbox 1（FT-05）· Done 0 |
| Testing（代码已改、等真机） | CAP-002～028（除 CAP-001）、CAP-E001、CAP-E002 |
| Blocked（等 Founder） | 决定：CAP-E003、DS-13、DS-14、MW-04、FT-03、FT-04、TD-04、TD-05；批准修复：DS-09、DS-10、DS-12；真机数据：CAP-001；构建：REL-01 |

P0 的 9 项：CAP-016（Testing）、DS-01（In Progress）、DS-02、DS-05、DS-07、MW-01、MW-02、MW-03、MW-05（Planned）。

## 3. 版本计划

| 版本 | 目标 | 进入条件 | 包含 |
|---|---|---|---|
| **Alpha Stability**（当前） | 已记录的 Bug 全部修好并在真机确认；数据不丢 | — | CAP-001～020、CAP-E001/E002、DS-01、DS-03、DS-09/10/12（等批准）、TD-01、REL-01/02 |
| **Alpha UX Polish** | 小的体验改进，不碰数据结构 | Alpha Stability 的 P1 全部 Done | CAP-E003、CAP-E004、TD-02 |
| **Data Safety Upgrade** | 备份恢复验证完成、自动 iCloud 备份 | Alpha Stability 完成；DS-01 Done | DS-02、DS-04～DS-08、DS-11、DS-13 |
| **Beta Features** | 新功能 | Data Safety Upgrade 的 P0 完成 | MW-01～MW-05、FT-01～FT-05 |

顺序（Founder 2026-11-15 确认）：Alpha 关键 Bug → 数据完整性和备份恢复验证 → 自动 iCloud 备份 → Memory Wall v1.0 → 后续 Beta 功能。

## 4. 任务表

### 4.1 Alpha Stability

| ID | 标题 | 优先级 | 状态 | 目标版本 | 相关模块 | 验收标准 | 测试结果 | 完成日期 |
|---|---|---|---|---|---|---|---|---|
| CAP-016 | My Books「写一页」写进目标手帐；从某本手帐打开的编辑器只显示这本手帐的页（第二部分，IMG_9476 / 9477） | **P0**（11-15 由 P1 升级） | Testing | 0.2.0 (5)（V10.72 + V10.76） | `app.js` writeInBook / startPage / studioScope / studioReturnBook | BETA_RELEASE_PLAN「CAP-016 真机验收」9 步 +「第二部分」9 步 | v169 20 项、v173 20 项 ✅；相关回归 v170 / v171 / v35 / v158 / v112 / v160 / v137 / v141 ✅；全量回归见变更记录；真机 ⏳ | — |
| CAP-018 | 封面一致：缩略图 = 大预览 = 创建后 = 书架 = 重开（统一封面配置） | P1 | Testing | 下一构建（V10.73 + V10.74） | `personal-ui.mjs` coverPhotos / coverSampleToKeep；`app.js` openBookDialog / saveBookForm；`Models.swift` CoverSample | 封面系统真机验收第 1b、2、7、8、9 步 | v170 30 项、v171 21 项 ✅；Swift Core 7 项（Mac）✅；真机 ⏳ | — |
| CAP-017 | 长书名：封面模板自适应；书架卡片两行；书本页完整 | P2 | Testing | 下一构建（V10.73 + V10.75） | `cover-fit.mjs`；`styles.css` | 封面系统验收第 3～5 步；书架排版验收第 5、6 步 | 封面审查 528 组合 0 问题；v170、v172 ✅；真机 ⏳ | — |
| CAP-019 | 新建手帐默认黑体 | P2 | Testing | 下一构建（V10.73） | `app.js` openBookDialog | 封面系统验收第 1、6 步 | v170 ✅；真机 ⏳ | — |
| CAP-020 | 书脊竖排：标点竖排字形、按完整字符截断、5 本一层不跑出书架 | P2 | Testing | 下一构建（V10.75） | `cover-fit.mjs` spineTitleHTML / fitSpineTitle；`app.js` spineTitle；`styles.css` | 书架排版验收 8 步 | spine-title 单元 5 项、v172 21 项 ✅；iOS 模拟器 4 轮（SE / 17 / 17 Pro Max / 最大字号）0 问题 ✅；真机 ⏳ | — |
| CAP-021 | 首页「我的手帐」按书架顺序（不是最近写过的一本） | P1 | Testing | 0.2.0 (5)（V10.77） | `app.js` homeLibraryHTML | 写页 / 改封面不换首页的书；往前放后首页跟着变；重开不变；删除第一本自动换；空书架空状态 | v174 17 项 ✅；v102 按新规则更新 ✅；真机 ⏳ | — |
| CAP-022 | 首页「X 月 X 日更新」用手机本地日期（以前用 UTC，晚上提前一天） | P1 | Testing | 0.2.0 (5)（V10.77） | `model.mjs` localDayOf；`app.js` bookLastWritten；`events.mjs` | 美东 23:00–01:00、夏令时、跨时区；记录日期不变 | v174-dates 8 项、v174 浏览器（纽约时区）✅；历史数据无偏移；真机 ⏳ | — |
| CAP-023 | 删除「我的手帐」后新的一天写进不存在的书 | P1 | Testing | 0.2.0 (5)（V10.77） | `app.js` defaultBookId / openStudio | 新的一天属于书架上存在的书 | v175 ✅；真机 ⏳ | — |
| CAP-024 | 书本页「1 天 · 1 页」但列表为空（草稿日） | P1 | Testing | 0.2.0 (5)（V10.77） | `day.mjs` bookDays | 列表与页数同一规则 | v175 ✅；真机 ⏳ | — |
| CAP-025 | 书架「···」先给删除又拒绝 | P2 | Testing | 0.2.0 (5)（V10.77） | `app.js` bookLinkedDays / openShelfMenu / deleteEmptyBook | 同一判断，直接说明原因；不移动数据 | v175 ✅ | — |
| CAP-026 | 「···」编辑后旧弹层不关；阅读器封面编辑后离开阅读器 | P2 | Testing | 0.2.0 (5)（V10.77） | `app.js` saveBookForm | 弹层关闭；留在阅读器 | v175 ✅ | — |
| CAP-027 | 标签筛选时往前放 / 往后放按看得见的书 | P2 | Testing | 0.2.0 (5)（V10.77） | `app.js` shelfHTML stepTo / book-step | 看得见的顺序立刻变化 | v175 ✅ | — |
| CAP-028 | 小屏弹层输入框贴着键盘 | P3 | Testing | 0.2.0 (5)（V10.77） | `styles.css` scroll-margin-bottom | 弹层输入框下留 14 px | v164 34/34 ✅ | — |
| CAP-014 | 双击文字进入编辑 | P2 | Testing | 下一构建（V10.71） | `app.js` beginGesture / DOUBLE_TAP_MS | Sprint 01 验收清单第 2 项 | v167 10 项 ✅；模拟器 testTextDoubleTap ✅；真机 ⏳ | — |
| CAP-002 | 标题编辑时键盘遮挡 | P2 | Testing | 下一构建（V10.70） | Editor Layout Coordinator `updateVisibleArea` | Sprint 01 验收第 1 项 | v162、v166 ✅；模拟器布局测量 ✅；真机 ⏳ | — |
| CAP-003 | 字体面板遮挡正在编辑的页面 | P2 | Testing | 同上 | 同上 | 同上 | 同上 | — |
| CAP-010 | 新建手帐本弹窗离状态栏太近 | P2 | Testing | 同上 | `styles.css` 安全区 | 同上 | v166 ✅；真机 ⏳ | — |
| CAP-011 | 查看更多封面关闭键盘后弹窗异常 | P2 | Testing | 同上 | `updateVisibleArea`、`--avail` | 同上 | v166 ✅；真机 ⏳ | — |
| CAP-012 | 写字面板被截断 | P2 | Testing | 同上 | 同上 | 同上 | 同上 | — |
| CAP-013 | 改字体时操作栏浮在页面中间 | P2 | Testing | 同上 | `styles.css` `#app::after` | 同上 | 同上 | — |
| CAP-006 | 新文字框要先打字才能移动 | P2 | Testing | 0.2.0 (4) | `app.js` textPress | V10.69 修复说明 | v165 ✅；真机 ⏳ | — |
| CAP-007 | 「只写几句话」标题正文不能移动 | P2 | Testing | 0.2.0 (4) | `app.js` noteToLayout | 同上 | v165 ✅；真机 ⏳ | — |
| CAP-008 | Captain 起名后回车不收键盘 | P3 | Testing | 0.2.0 (4) | `app.js` ONE_LINE | 同上 | v165 ✅；模拟器测不了键盘 ✓ 键；真机 ⏳ | — |
| CAP-009 | 打字时字体工具条被键盘挡住 | P2 | Testing | 0.2.0 (4) | `app.js` nativeKeyboardTop；`LittleDaysKeyboard` | 同上 | v165 ✅；真机 ⏳ | — |
| CAP-015 | 弹窗主按钮字号太小 | P3 | Testing | 下一构建（V10.71） | `styles.css` `dialog .primary` | Sprint 01 验收第 1 项 | v168 ✅；真机 ⏳ | — |
| CAP-E001 | 字体列表加黑体、宋体 | P3 | Testing | 下一构建（V10.71） | `personal-ui.mjs` coverFontChoices | Sprint 01 验收第 4 项 | v168 ✅；真机 ⏳ | — |
| CAP-E002 | 字体列表用字体本身显示、实时预览 | P2 | Testing | 下一构建（V10.71） | 同上 | 同上 | v168 ✅；真机 ⏳ | — |
| CAP-004 | 备份流程不够直观 | P2 | Testing | 0.2.0 (4) | `app.js` openBackupSheet；外壳 UIDocumentPicker | 备份恢复真机演练（DS-01） | v163 ✅；真机 ⏳ | — |
| CAP-005 | 恢复备份缺少引导 | P2 | Testing | 0.2.0 (4) | `restore-safety.mjs` | 同上 | v161、v163 ✅；真机 ⏳ | — |
| CAP-001 | 录音首次播放延迟（约 7 秒） | P2 | Blocked | TBD | `voice-skin.mjs`、`canvas.mjs` | 真机「点按到出声」< 1.5 s | 模拟器：首次 1.18 s、第二次 0.25 s；7 s 复现不出。**等 Founder 真机秒数**（设置 → 媒体检查 first / again） | — |
| DS-01 | 现有手动备份的数据完整性审查与恢复演练 | P0 | In Progress | Alpha Stability | `media.mjs` backup / visitMediaReferences；`app.js` runBackup / restore；`restore-safety.mjs`；外壳 WKDownload / UIDocumentPicker | 代码审查列出包含 / 不包含的内容和风险；真机演练：备份 → 删除 App → 重装 → 恢复，数据一致 | 代码审查 ✅（2026-11-15，ICLOUD_AUTO_BACKUP_PLAN 第 1、2 节，风险 R1～R10）；真机演练 ⏳ | — |
| DS-03 | 真机验证：整机 iCloud 备份 / Quick Start 换机是否带上 Capiday 的 WebKit 数据；`persist()` 是否被批准 | P1 | Planned | Alpha Stability | WebKit 存储；`media-check.mjs` | ICLOUD_AUTO_BACKUP_PLAN 第 6 节第 10 项；结果写进设置说明 | 需要真机，未做 | — |
| DS-09 | R3：生成的 JSON 备份可能超过恢复上限（能备份、恢复不了） | P1 | Blocked | Alpha Stability | `app.js` runBackup；`restore-safety.mjs` MAX_RESTORE_FILE_BYTES | 生成后检查文件大小 ≤ 恢复上限；超过时提示，不记为成功；测试覆盖 | **等 Founder 批准修复**（本次只规划） | — |
| DS-10 | R4：`coverPhotos` 里的 `media:` 引用恢复时没有改写 | P2 | Blocked | Alpha Stability | `media.mjs` visitMediaReferences | 恢复时媒体重新编号后封面重新排版不出现坏图；测试覆盖 | **等 Founder 批准修复** | — |
| DS-12 | R6：备份存到「我的 iPhone › Capiday」会随 App 删除，却记为已验证 | P1 | Blocked | Alpha Stability | `LittleDaysWebShellView.swift` didPickDocumentsAt | 识别 App 自己的 Documents 并提醒选 iCloud Drive；真机确认位置判断 | **等 Founder 批准修复**；位置判断需要真机确认 | — |
| TD-01 | Mac 模拟器脚本仍用旧 Bundle ID（dev.sh、sim-shots.sh、ios-layout-check.sh） | P3 | Ready | Alpha Stability | `tools/mac/*` | 三个脚本都能在模拟器里启动 App | ios-shelf-check.sh 已修（79ee727）；已建议另开任务 | — |
| REL-01 | Founder 真机验收 Sprint 01（CAP-002～020、E001/E002） | P1 | Blocked | Alpha Stability | — | BETA_RELEASE_PLAN 各验收清单逐项通过 | 等新的内部构建 | — |
| REL-02 | 内部 TestFlight 构建 0.2.0 (5)（含 V10.70～V10.77） | P1 | In Progress | Alpha Stability | Xcode Archive | Release Gate 通过 | 2026-11-15 Founder 在 Nightly Sprint 中授权上传到 Internal Testing；结果见第 7 节变更记录 | — |

### 4.2 Alpha UX Polish

| ID | 标题 | 优先级 | 状态 | 目标版本 | 相关模块 | 验收标准 | 测试结果 | 完成日期 |
|---|---|---|---|---|---|---|---|---|
| CAP-E004 | 阅读器单页导出：PNG / 分享 / PDF（保留整本书 PDF） | P2 | Planned | Alpha UX Polish（V10.76 起） | `export.mjs` renderJournalCanvas；`book-share.mjs` buildPdf；`app.js` openReaderMore；外壳 WKDownload → UIActivityViewController | BUG_BACKLOG CAP-E004「测试计划」 | — | — |
| CAP-E003 | 杂志封面标题是否跟随所选字体 | P3 | Blocked | TBD | `personal-ui.mjs` magazineCoverHTML | Founder 决定方案 1 或 2 | **等 Founder 决定** | — |
| TD-02 | 测试环境：容器 Chromium 竖排中文需要 Noto Sans CJK | P3 | Planned | Alpha UX Polish | 云端环境 setup | 新会话里 v172 自动做尺寸检查 | 本会话手动装了 `fonts-noto-cjk`；环境的 setup 脚本还没加 | — |
| TD-03 | `text-wrap: balance` 在 iOS 17.5 以下不生效（单字孤行） | P3 | Planned | Alpha UX Polish | `styles.css` | iOS 17.0～17.4 上没有单字孤行，或确认接受 | 已知限制，未处理 | — |

### 4.3 Data Safety Upgrade

全部 **Planned — Post-Alpha Data Safety Upgrade**。方案见 [ICLOUD_AUTO_BACKUP_PLAN.md](ICLOUD_AUTO_BACKUP_PLAN.md)。

| ID | 标题 | 优先级 | 状态 | 目标版本 | 相关模块 | 验收标准 | 测试结果 | 完成日期 |
|---|---|---|---|---|---|---|---|---|
| DS-02 | 流式 `.capiday` 备份包（取消 100 MiB 上限、manifest + sha256 回读校验；JSON v1 仍可恢复） | P0 | Planned | Data Safety Upgrade | 新 Swift `CapidayArchive`；JS 分块；`spikes/s1-0/` | 计划第 6 节第 1～4 项 | 只有 spike | — |
| DS-04 | iCloud 容器 `iCloud.com.capiday.app`（entitlements、`NSUbiquitousContainers`、登录 / 空间 / 换账号） | P1 | Planned | Data Safety Upgrade | Xcode 工程；外壳 Swift | 计划第 6 节第 13、14 项 | — | — |
| DS-05 | 自动备份（有改动 + 后台任务 + BGProcessingTask；生成 → 写入 → 已上传状态机；失败不影响写日记） | P0 | Planned | Data Safety Upgrade | 外壳 Swift；`app.js` 备份入口 | 计划第 6 节第 4、8、16 项 | — | — |
| DS-06 | 设置「数据与备份」状态（iCloud 可用、开关、最近一次经验证的成功备份、等待 / 失败、立即备份、恢复、手动导出） | P1 | Planned | Data Safety Upgrade | `app.js` 设置；i18n | 未上传时不显示成功 | — | — |
| DS-07 | 从 iCloud 恢复（列表、下载进度、无网络、沿用恢复安全机制、不静默覆盖） | P0 | Planned | Data Safety Upgrade | `restore-safety.mjs`；外壳 Swift | 计划第 6 节第 7、9、11、12 项 | — | — |
| DS-08 | 保留与清理（最近 3 份 + 每月 1 份；新的一份上传后才删旧的） | P2 | Planned | Data Safety Upgrade | 外壳 Swift | 永远至少有一份已上传的备份 | — | — |
| DS-11 | R5：恢复回滚失败后找不到恢复前的数据 | P2 | Planned | Data Safety Upgrade | `app.js` restore / undoRestore | 回滚失败时设置里仍有「恢复前的数据」入口 | — | — |
| DS-13 | R7：账户名、头像等 localStorage 设置是否加入备份 | P3 | Blocked | Data Safety Upgrade | `account.mjs`；备份格式 | Founder 决定 | **等 Founder 决定** | — |
| DS-14 | CloudKit 增量同步（路线 C）是否进入路线图 | P3 | Blocked | 以后 | — | Founder 决定 | **等 Founder 决定**（推荐等真实的多设备需求） | — |

### 4.4 Beta Features

Memory Wall v1.0 全部 **Planned — Post-Alpha Stability**。方案见 [MEMORY_WALL_V1_PLAN.md](MEMORY_WALL_V1_PLAN.md)。

| ID | 标题 | 优先级 | 状态 | 目标版本 | 相关模块 | 验收标准 | 测试结果 | 完成日期 |
|---|---|---|---|---|---|---|---|---|
| MW-01 | 自动生成照片墙（保留现有：只收手帐里的照片、双列瀑布流、按月分组、新到旧、看大图、关联原记录；不重复、不读相册） | P0 | Planned | Beta Features | `photo-wall.mjs` wallPhotos；`app.js` photoWallHTML | 现有 v152 + 新单元测试；5000 张性能基线 | 现有功能已在 V10.55 上线；v1.0 部分未开始 | — |
| MW-02 | 管理模式：选择、隐藏、查看已隐藏、恢复；不影响原始数据；重开后仍生效 | P0 | Planned | Beta Features | `photo-wall.mjs` applyWall（新）；`app.js`；可选 `state.wall` | 计划第 7 节 Stage 3 | — | — |
| MW-03 | 整页贴到照片墙（复用 `sharedCanvasHTML`，不复制页面，原页面改了卡片跟着变，点开回到原记录） | P0 | Planned | Beta Features | `app.js` 阅读器菜单；`canvas.mjs` | 整页卡片与阅读器缩略图一致 | — | — |
| MW-04 | 自定义排序 +「恢复时间排序」 | P1 | Blocked | Beta Features | `photo-wall.mjs`；`app.js` 拖动 | Founder 回答计划第 6 节问题 1～4 | **等 Founder 决定 4 个排序问题** | — |
| MW-05 | 数据安全与恢复（来源 ID 不含日期和 media id；坏配置只被忽略；备份恢复包含设置；旧备份兼容；Swift 可选字段） | P0 | Planned | Beta Features | `model.mjs`；`restore-safety.mjs`；`Models.swift` | 计划第 4 节 13 个边界情况的测试 | — | — |

### 4.5 其他已有规划（不在近期版本里）

| ID | 标题 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| FT-01 | Captain Playroom 后续（素材与互动） | P3 | Planned | docs/CAPTAIN_PLAYROOM_PLAN.md；部分素材缺失（无领巾的 Yarn Play、开心反应） |
| FT-02 | Meme & Sticker Studio Phase A（静态 Meme 图层） | P3 | Planned | docs/MEME_STICKER_PLAN.md：设计已通过，**要等可靠存储和恢复验证完成**（DS 系列）才实施 |
| FT-03 | Quick Create v3（EXIF / PhotoKit 今天的照片等） | P3 | Blocked | docs/QUICK_CREATE_PLAN.md：提案，等 Founder 确认 |
| FT-04 | 社区、好友、协作的真实后端（ROADMAP Phase 3 / 4） | P3 | Blocked | 现在只有明确标注的本机演示；真实联网需要服务端访问控制，等 Founder 决定是否继续 |
| FT-05 | 一个 Moment 内继续拆分多页（ROADMAP V3.1 未完成项） | P3 | Inbox | 旧规划，待重新评估 |
| TD-04 | ROADMAP 旧项：原生 SwiftUI 逐项追平 Web | — | Blocked | 2026-11-07 已改为 WKWebView 外壳只维护 `Public/` 一份界面，**建议关闭**，等 Founder 确认 |
| TD-05 | ROADMAP 旧项：Windows 实机验证 | — | Blocked | 2026-11-09 起不再用 Windows localhost 查看，**建议关闭**，等 Founder 确认 |

## 5. Data Safety

- 调查完成（2026-11-15）：[ICLOUD_AUTO_BACKUP_PLAN.md](ICLOUD_AUTO_BACKUP_PLAN.md)。手动 JSON 备份**包含全部手帐内容和被引用的媒体**；真正的缺口是 R1（媒体 > 100 MiB 没有备份途径）和 R2（没有离开手机的自动副本），以及 R3～R7 几个边缘问题。
- 推荐路线：**B · iCloud Drive 自动备份**（前置：DS-02 流式 `.capiday`），A（整机备份）只验证和说明，C（CloudKit）暂缓。
- Alpha Stability 里：DS-01（真机演练）、DS-03（整机备份验证）；R3 / R4 / R6 的小修（DS-09 / 10 / 12）**等 Founder 批准**。
- 其余 DS-02、04～08、11 在 Data Safety Upgrade；DS-13、DS-14 等 Founder 决定。

## 6. Memory Wall v1.0

- 规划完成（2026-11-15）：[MEMORY_WALL_V1_PLAN.md](MEMORY_WALL_V1_PLAN.md)，状态 **Planned — Post-Alpha Stability**。本次没有改照片墙、Journal Studio 或数据结构。
- 方案：照片墙仍每次从手帐计算；新增一个可选的小配置 `state.wall`（隐藏、整页、顺序），只存来源 ID（`photo:<页 id>:<图层 id>`、`page:<页 id>`），不存图片、页面副本或 media id；整页卡片复用 `sharedCanvasHTML`。
- 13 个边界情况的分析见计划第 4 节；需要 Founder 决定的 10 个问题见第 6 节（MW-04 的 4 个排序问题按要求没有自行决定）。
- 开发顺序（Alpha 之后）：Stage 1 设计确认 → Stage 2 隐藏 / 管理模式 / 整页 / 排序 / 备份 → Stage 3 回归。

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-15 | 建立本表：Backlog 的 CAP-001～020、CAP-E001～E004 全部收进来，并逐条核对代码中的修复标记和测试文件；新增 TD、REL、FT 条目；旧 ROADMAP 中已过时的两项标为建议关闭 |
| 2026-11-15 | CAP-016 升为 **P0**（Founder，IMG_9476 / 9477 合并进来，不新建 ID）；V10.76 编辑器只显示这本手帐的页、返回这本手帐，状态 Testing |
| 2026-11-15 | **Nightly Sprint**：Pending Inventory 核对——Founder 列出的 14 条线索都已有条目（1–2 → CAP-016；3–4 → CAP-018；5 → CAP-017；6 → CAP-020；7 → CAP-019；8 → **CAP-021（新）**；9 → **CAP-022（新）**；10 → CAP-014；11 → CAP-002 / 003 / 012 / 013 / 009；12 → CAP-010 / 011；13 → CAP-E004；14 → 其余 CAP-001～015）。Books 代码审查新增 CAP-023～027，回归发现 CAP-028。V10.77 修复 CAP-021～028，状态 Testing；构建号 4 → 5 |
| 2026-11-15 | 新增 DS-01 实际内容和 DS-02～DS-14（自动 iCloud 备份规划 + 风险 R1～R10）；新增 MW-01～MW-05（照片墙 v1.0 规划）；补齐第 2、5、6 节 |
