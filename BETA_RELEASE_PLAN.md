# Capiday Beta Release Plan

> 建立于 2026-11-15，是**初始规划，不是承诺**：阶段的范围、日期、测试人数都可以改，未确定的写 TBD。
> Bug 的记录和优先级见 [BUG_BACKLOG.md](BUG_BACKLOG.md)。每次发布记录追加在第 5 节，不删除旧记录。

## 1. 原则

- 数据安全第一：任何 P0 都会暂停扩大内测。
- **自动化测试通过 ≠ 真实 iPhone 测试通过**。网页（Chromium）、模拟器和真机的结果分开写。
- **上传成功 ≠ Apple 处理完成 ≠ 测试者已能安装**。三件事分别记录。
- 每个 Build 都要先过第 3 节的 Release Gate。

## 2. 三个阶段

### Beta 1 — Initial Testing（初始测试）

- **目标**：验证核心功能和数据安全，收集真实用户反馈。
- **候选 Build**：0.2.0 (4)。已于 2026-11-14 上传，Apple 处理结果 TBD。
- **测试者**：先 Founder 本人；之后是否加入少量内部或外部测试者、加多少人：TBD（Founder 决定）。外部测试需要先通过 Apple 的 Beta App Review，并提供测试说明等资料，具体要求以 App Store Connect 页面为准。
- **重点测什么**：
  1. 写一页、存一页、重新打开还在（文字、照片、录音、视频、手绘）；
  2. 从旧版本更新后，原有手帐和媒体都在；
  3. 备份 → 存到「文件」→ 恢复的预览 → 取消；再完整恢复一次（用测试手帐）；
  4. 录音和播放（CAP-001）；
  5. 打字和键盘（CAP-002、CAP-006～009）；字体面板（CAP-003）；
  6. 备份和恢复的引导（CAP-004、CAP-005）。
- **完成标准**：
  - 没有未解决的 P0、P1；
  - CAP-001～009 每一条都在真机上验证（Verified）或重新分级；
  - 记下 Founder 的使用反馈。

### Beta 2 — Stability & UX Fixes（稳定性与体验修复）

- **目标**：集中修复 Beta 1 发现的重要 Bug。
- **范围**：Beta 1 结束时的 P0 / P1 全部、Founder 选定的 P2。具体清单 TBD，由 Founder 从 BUG_BACKLOG 里批准。
- **暂定候选**（2026-11-15 登记，都是 Triaged，**没有开始修**，最终以 Founder 确认为准）。按根因分组（见 BUG_BACKLOG.md「根因分组」），同组一起修，避免同一个根因改两次：

  | 顺序（建议） | 分组 | ID | 内容 | 级别 | 理由 |
  |---|---|---|---|---|---|
  | 1 | W | CAP-013 | 改字体时底部操作栏浮在页面中间 | P2 | 推测是 V10.66（CAP-003）带来的副作用；改动小、独立；修好后 CAP-003 才能验收 |
  | 2 | K + S | CAP-011 | 「查看更多封面」关闭键盘后布局异常 | P2 | 先用模拟器软键盘复现并测量；同一套测量也用于 CAP-012 |
  | 3 | K + S | CAP-012 | 写字面板打字时下半部被截断 | P2 | 与 CAP-011 同一个键盘高度问题，加上底部安全区留白 |
  | 4 | S | CAP-010 | 新建手帐本弹窗顶部离状态栏太近 | P2 | 与 CAP-011 同一个弹窗、与 CAP-012 同类安全区问题，同一轮改 |
  | 5 | F | CAP-E002 | 字体列表用字体本身显示 + 实时预览 + 取消恢复 | P2 | 换成 App 自己的列表，是 CAP-E001 的基础 |
  | 6 | F | CAP-E001 | 增加基础宋体、黑体 | P3 | 同一个列表 |

  另外：Beta 1 真机验证时，CAP-001～009 中如果有退回 Triaged 的，按级别插入上表。
- **完成标准**：本轮修复全部 Verified；升级和备份恢复的回归在真机上重新做一遍。

### Beta 3 — Experience Refinement（体验打磨）

- **目标**：优化使用体验，扩大测试规模，验证用户是否愿意持续使用。
- **范围**：剩余 P2 / P3、Founder 选定的体验改进。新功能是否加入 TBD，不在本计划里承诺。
- **观察什么**：测试者是否连续几天回来记录、在哪一步放弃。怎么收集 TBD，需要 Founder 同意，并且不上传私人手帐内容。
- **完成标准**：TBD（Beta 2 结束时再定）。

## 3. Release Gate（每次发布 TestFlight Build 前逐项检查）

| # | 检查项 | 怎么确认 |
|---|---|---|
| 1 | 没有未解决的 P0 | BUG_BACKLOG 总表 |
| 2 | P1 已修复；或有书面的风险评估并经 Founder 批准 | BUG_BACKLOG 条目 |
| 3 | 核心日记保存、读取正常 | 网页全量回归 + 模拟器 + **真机冒烟**（三项分开写） |
| 4 | 现有日记和媒体升级后仍在 | 模拟器升级测试 `tools/mac/upgrade-check/run-upgrade.sh <旧提交> <新提交>`（合成数据），以及真机从上一个 TestFlight 版本更新 |
| 5 | 备份与恢复关键路径测过 | `tests/v161`、`v163`；模拟器 `testBackupRoundTrip`；真机至少走到预览 |
| 6 | 主要编辑功能回归通过 | 网页全量回归（`tests/*-browser.cjs`）+ 单元测试（`node --test tests/*.test.mjs`）+ Python 外壳测试 |
| 7 | Release Build 编译通过 | Mac：从干净副本（`git archive`）`xcodebuild -configuration Release … archive`，核对 Info.plist：Bundle ID `com.capiday.app`、版本号、构建号 |
| 8 | 已知问题已记录，并准备好给测试者的说明 | 第 4 节 |
| 9 | 构建号大于所有已上传的构建；不改 Bundle ID、存储键和数据结构（除非有安全迁移方案） | `project.pbxproj` |

第 3、4、5 项里的「真机」只能由人在真实 iPhone 上完成；自动化或模拟器通过时写「真机 TBD」，不写成通过。

### Gate 检查：0.2.0 (4)（2026-11-15）

| # | 结果 |
|---|---|
| 1 | ✅ 没有记录在案的 P0 |
| 2 | ✅ 没有记录在案的 P1 |
| 3 | ⚠️ 网页回归通过；模拟器通过（V10.66 录音流程、V10.69 文字拖动）；**真机 TBD** |
| 4 | ⚠️ 模拟器升级测试 0.1.0 (1) → 0.2.0 (3) 通过（2026-11-14，合成数据）；**0.2.0 (3) → 0.2.0 (4) 没有单独重跑**（V10.66–V10.69 没有改存储键和数据结构）；**真机 TBD** |
| 5 | ⚠️ `v161` 16/16、`v163` 通过；模拟器 `testBackupRoundTrip` 通过（V10.67 代码）；**真机 TBD** |
| 6 | ✅ 网页全量回归 103 套里 102 套通过（失败的 v119 是已知的容器偶发问题，旧代码也会这样）；单元测试 310/310；Python 测试通过 |
| 7 | ✅ ARCHIVE SUCCEEDED（aaa7d2a，Release）；`com.capiday.app` 0.2.0 (4)，显示名 Capiday |
| 8 | ⚠️ 已知问题见 BUG_BACKLOG（全部 Fixed、未 Verified）；第 4 节的测试者说明是草稿，等 Founder 确认 |
| 9 | ✅ 构建号 4 > 3；Bundle ID、存储键不变 |

**结论**：可以给 Founder 自己在真机上测试（Beta 1 第一步）。第 3、4、5 项真机通过、第 8 项说明定稿之前，不建议扩大到外部测试者。

## 4. 给测试者的说明（草稿，待 Founder 确认）

- 这是测试版。请先导出一份备份（设置 → 备份我的手帐 → 选择保存位置，推荐 iCloud 云盘），再开始测试。
- 从 TestFlight **更新**，不要先删除旧 App：删除 App 会同时删除 App 里的手帐。
- 已知问题（修复已在这个版本里，等你确认）：录音第一次播放可能慢；打字时键盘可能挡住输入框或工具条；新文字框的拖动刚改过。
- 恢复备份会**替换**这台设备上现在的手帐，不是合并。替换前会自动保留一份，7 天内可以撤销。
- 反馈方式：TBD（例如 TestFlight 里截图反馈，或 Founder 指定的渠道）。请写清楚用的哪个版本、做了哪几步、看到了什么，最好附截图。不需要发送你的手帐内容。

## 5. 发布记录

每个 Build 一条，追加在最上面。

### 0.2.0 (4)

- **Version / Build Number**：0.2.0 (4)
- **Release Date**：
  - 上传到 App Store Connect：2026-11-14 22:35（Mac 本地时间）；
  - Apple 处理完成：TBD；
  - 发给测试者：TBD。
- **代码**：aaa7d2a（网页 V10.69）
- **Bugs Fixed**（代码已修，**都没有在真机上验证**）：CAP-001、CAP-002、CAP-003、CAP-004、CAP-005、CAP-006、CAP-007、CAP-008、CAP-009
- **其他改动**：新文字框默认黑体、粗细 600（Founder 要求）；iOS 外壳把键盘位置告诉网页（CAP-009）。
- **Known Issues**：
  - 上面 9 条都还要真机验证；
  - CAP-001 的真机根因没有确认；
  - 固定链接里的键盘高度是估算的，工具条可能离键盘稍远。
- **Regression Test Results**：
  - 网页全量回归 102/103（v119 是已知偶发问题）；
  - 单元测试 310/310；
  - Python 测试通过；
  - `v165` 22/22，`v164` 34/34；
  - 模拟器 `testTextDrag` 通过；
  - **真机 TBD**。
- **TestFlight Status**：上传成功（Upload succeeded、EXPORT SUCCEEDED）。2026-11-15 Founder 的真机截图（IMG_9458–9459）里出现了 V10.66 才有的界面，**推断** 0.2.0 (4) 已经处理完成并装到了 iPhone 上，待 Founder 确认。
- **真机反馈（Beta 1）**：
  - 2026-11-15 新登记 CAP-012、CAP-013（Triaged）；
  - CAP-003 的面板本身已经收成低矮模式，但被 CAP-013 影响，暂不验收。

### 0.2.0 (3)

- **Version / Build Number**：0.2.0 (3)
- **Release Date**：上传 2026-11-14 14:31 EST；Apple 处理完成 TBD；是否发给测试者 TBD
- **代码**：a633c40（网页 V10.65，S1-1 恢复安全）
- **Bugs Fixed**：这个 Backlog 建立之前的修复，见 `agent.md` 和 `docs/BUGFIX_LOG.md`
- **Known Issues**：CAP-001～005 的修复都不在这个构建里
- **Regression Test Results**：
  - 当时的网页回归；
  - 模拟器升级测试 0.1.0 (1) → 0.2.0 (3) 通过（合成数据）；
  - Release 归档成功；
  - 真机 TBD。
- **TestFlight Status**：上传成功；后续状态没有记录（TBD）

### 0.1.0 (1)

- **Version / Build Number**：0.1.0 (1)
- **Release Date**：上传 2026-11-13（Founder 在 Xcode 里操作）
- **Bugs Fixed**：首个构建
- **Known Issues**：真机上手绘画完无法选中或保存（已在后续代码修复，见 `docs/BUGFIX_LOG.md` V10.46）
- **Regression Test Results**：见 `agent.md` 当日记录
- **TestFlight Status**：出口合规已选「无」，状态 Ready to Submit；Founder 曾在真机上通过 TestFlight 安装测试

## 6. 发布记录模板

```markdown
### 0.x.y (n)

- **Version / Build Number**：
- **Release Date**：上传 TBD；Apple 处理完成 TBD；发给测试者 TBD
- **代码**：<commit>
- **Bugs Fixed**：CAP-…（写明是否已 Verified）
- **Known Issues**：
- **Regression Test Results**：网页 … / 模拟器 … / 真机 …
- **TestFlight Status**：
```
