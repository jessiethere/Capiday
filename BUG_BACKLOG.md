# Capiday Bug Backlog

> 建立于 2026-11-15，用于 TestFlight 内测阶段。Founder 负责发现问题、收集反馈、决定优先级，开发按本文件的流程进行。
> 发布计划和发布前检查见 [BETA_RELEASE_PLAN.md](BETA_RELEASE_PLAN.md)。每次变更同时记在 `agent.md`（详细）和 `README.md`（摘要）。
> 规则：**不虚构信息，不知道的写 TBD**；**代码改了不等于问题解决**，只有通过对应验证（通常是真实 iPhone 上按复现步骤确认）才能标记 Verified。

## 1. 优先级（Severity）

| 级别 | 含义 | 举例 | 处理 |
|---|---|---|---|
| **P0 · Critical** | 数据或安全出事 | 日记或媒体丢失；恢复备份造成破坏；严重隐私或安全问题 | 立即处理，必要时暂停扩大内测 |
| **P1 · High** | 核心功能坏了 | 保存失败；主要功能完全不能用；频繁崩溃 | 优先修，尽快出新 Build |
| **P2 · Medium** | 明显影响体验，但有办法绕过 | 键盘遮挡输入区；字体面板遮挡预览；录音首次播放延迟（已排除更严重根因时） | 下一轮 Beta 修 |
| **P3 · Low** | 细节 | 视觉间距、文案、非关键动画 | 放进后续优化 |

优先级要按**实际影响、复现频率、数据风险**随时调整：例如一个 P2 查出会让用户误以为已备份、实际没有，就升到 P1 或 P0。调整时在该条目里写明原因和日期。

## 2. 状态（Status）

| 状态 | 什么时候用 |
|---|---|
| **New** | 刚记录，还没分析 |
| **Triaged** | 已确认是问题，定了优先级和目标版本，等 Founder 批准修复 |
| **In Progress** | Founder 已批准，正在修 |
| **Fixed** | 修复已进代码，自动化 / 模拟器测试通过（写作「Fixed — Pending Device Verification」）。**还没有在真机上确认**；如果还没有进 TestFlight 构建，Target Build 写「下一个构建（未上传）」 |
| **Verified** | 在 Target Build 的真实 iPhone 上，按复现步骤确认问题不再出现（写明谁、哪台设备、哪个 Build、哪天） |
| **Closed** | 已 Verified 并随版本发出；或确认不修 / 重复 / 无法复现（写明原因） |

一个 Fixed 的问题在真机上仍然出现时，状态退回 **Triaged**，在 Verification 里记下这次结果，不新建条目。

## 3. 反馈处理流程（Founder 说「记录一个 Bug」时）

1. **先查重**：在下面的总表和条目里找相同或相关的问题。相同就在原条目补充证据和日期；相关就新建并互相引用。
2. 没有相同的，**新建 ID**（顺延编号，编号不复用）：
   - Bug（原本应该能用、但出错或体验受损）用 **CAP-001、CAP-002……**；
   - 功能改进（Enhancement，现在没有、希望增加或改进）用 **CAP-E001、CAP-E002……**，记在第 5 节之后的「功能改进」部分，同样有级别、状态和目标版本。
3. **分析影响和严重程度**：是否涉及数据丢失、隐私，影响多少人、多频繁，有没有绕过办法。
4. **写复现步骤和可能原因**（可能原因写成「推测」，确认后才写进 Root Cause）。
5. **提出修复建议和目标版本**。
6. **更新本文件**（条目 + 总表），并在 `agent.md` / `README.md` 记日志，提交推送。
7. **默认不改代码**。只有 Founder 明确说「开始修复」「修复 CAP-XXX」或批准一批修复时，才进入开发（状态 → In Progress）。

**例外**：发现 P0 或重大数据安全风险时，立即报告，建议暂停相关测试，并说明打算怎么做；仍然等 Founder 同意后再动手（除非只是停止一项正在进行的危险操作）。

## 4. 总表

| ID | 标题 | 级别 | 状态 | 发现于 | 目标 Build |
|---|---|---|---|---|---|
| [CAP-001](#cap-001) | 录音首次播放延迟（约 7 秒） | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-002](#cap-002) | 标题编辑时键盘遮挡输入区 | P2 | Fixed — Pending Device Verification | TBD | 0.2.0 (4)；V10.70 加强，下一个构建（未上传） |
| [CAP-003](#cap-003) | 字体编辑面板遮挡正在编辑的页面 | P2 | Fixed — Pending Device Verification | TBD | 下一个构建（未上传，V10.70） |
| [CAP-004](#cap-004) | 备份流程不够直观 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-005](#cap-005) | 恢复备份缺少引导 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-006](#cap-006) | 新加的文字框要先打字才能移动 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-007](#cap-007) | 「只写几句话」的标题和正文不能移动 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-008](#cap-008) | Captain 起名后按回车键盘不收起 | P3 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-009](#cap-009) | 打字时字体工具条被键盘挡住 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-010](#cap-010) | 新建手帐本弹窗顶部离状态栏太近（Safe Area） | P2 | Fixed — Pending Device Verification | TBD | 下一个构建（未上传，V10.70） |
| [CAP-011](#cap-011) | 「查看更多封面」关闭键盘后弹窗布局 / 滚动异常 | P2 | Fixed — Pending Device Verification | TBD | 下一个构建（未上传，V10.70） |
| [CAP-012](#cap-012) | 「写字 · 改字体」打字时面板下半部被截断 | P2 | Fixed — Pending Device Verification | 0.2.0 (4)（推断） | 下一个构建（未上传，V10.70） |
| [CAP-013](#cap-013) | 改字体时「换照片 / 写文字 / 换个排版 / 保存」浮在页面中间 | P2 | Fixed — Pending Device Verification | 0.2.0 (4)（推断） | 下一个构建（未上传，V10.70） |
| [CAP-014](#cap-014) | 双击文字元素无法进入编辑 | P2 | Triaged | 0.2.0 (4)（推断） | Beta 2（暂定） |
| [CAP-015](#cap-015) | 弹层里的主按钮（保存、创建）字号比「取消」小很多 | P3 | Triaged | 0.2.0 (4)（推断） | Beta 2（暂定） |

**功能改进（Enhancement）**

| ID | 标题 | 级别 | 状态 | 提出于 | 目标 Build |
|---|---|---|---|---|---|
| [CAP-E001](#cap-e001) | 封面等字体列表增加基础中文宋体、黑体 | P3 | Triaged | 2026-11-15 | Beta 2（暂定） |
| [CAP-E002](#cap-e002) | 字体列表用每种字体本身显示，并实时预览 | P2 | Triaged | 2026-11-15 | Beta 2（暂定） |

统计（2026-11-15 第三次更新，Beta 2 · Editor Layout & Interaction Stability 之后）：
- Bug 15 条：P0 0 · P1 0 · P2 13 · P3 2；Fixed 13（都是 Pending Device Verification）、Triaged 2（CAP-014、CAP-015）、Verified 0。
- 功能改进 2 条：P2 1 · P3 1；都是 Triaged。

### 根因分组（2026-11-15，避免同一个根因修两次）

最初都是推测。**2026-11-15 V10.70 在模拟器（iPhone 17，iOS 27.2，真实触摸 + 软键盘）里测量，K、S、W 三组已确认**，见 Beta 2 工作流（BETA_RELEASE_PLAN.md）和各条目。

| 分组 | 推测的共同原因 | 条目 | 建议 |
|---|---|---|---|
| **K · 键盘高度**（已确认 · V10.70 已修） | iOS 27 键盘弹出时页面会自己滚；键盘收起时 `--vv-h` / `--kb` 没有在键盘真正收起后再算一次；底部弹层、居中弹窗的高度都依赖这两个值 | CAP-011、CAP-012（已修待验证的相关条目：CAP-002、CAP-009） | 一起修：先在模拟器用软键盘复现，把键盘弹出 / 收起前后的数值记下来，再统一改一处测量逻辑 |
| **S · 安全区**（已确认 · V10.70 已修） | 弹窗和底部弹层没有算 `safe-area-inset-top`；键盘弹出时底部仍留着 `safe-area-inset-bottom`（约 34 pt）的空白 | CAP-010、CAP-012 | 和 K 组同一轮改，同一套截图测试 |
| **W · 写字面板（V10.66）的副作用**（已确认 · V10.70 已修） | 为了让文字能滚到面板上方，给页面加了 `padding-bottom: 60dvh`；底部操作栏是 `position: sticky; bottom: 0`，被这段留白一起「抬」到屏幕中间 | CAP-013（由 CAP-003 的修复引起，推测） | 单独小修，不影响 K / S |
| **F · 字体列表** | 封面字体用原生 `<select>`，只列打包字体 | CAP-E001、CAP-E002 | 一起做 |
| **T · 画布手势** | 双击由 App 自己判断（400 ms、8 px），每次轻点都会重画页面 | CAP-014（推测） | 先在模拟器复现，量出两次抬起的间隔 |

> 说明：CAP-001～005 是 Founder 指定录入的条目。CAP-006～009 是 Founder 2026-11-14 在固定链接上报告、已在 V10.69 修改的问题，为了真机验收不遗漏，一并录入。同一轮里「新文字框默认用黑体加粗」是改动请求，不是 Bug，不记在这里（见 BETA_RELEASE_PLAN.md 的 0.2.0 (4) 改动）。
> 2026-11-15 之前已经修完的问题（例如 0.1.0 (1) 上的手绘无法选中、语音保存后无声、媒体持久化）记录在 `docs/BUGFIX_LOG.md` 和 `agent.md`，不补录为 CAP 条目。

---

## 5. 条目

<a id="cap-001"></a>
### CAP-001 · 录音首次播放延迟（约 7 秒）

- **Title**：录音结束后立即播放，约 7 秒才听到声音；加到手帐页面后第一次播放也延迟。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2（待根因调查。如果真机上查出是录音丢失、无声或损坏，升级为 P0 / P1）
- **Status**：Fixed —— **真机上的根因没有确认**，模拟器无法复现 7 秒；代码修了所有找到的可能原因，必须真机验证。
- **Affected Build**：TBD（真实 iPhone 上的 TestFlight 构建，构建号当时没有记录；当时可装的是 0.1.0 (1) 或 0.2.0 (3)）
- **Target Build**：0.2.0 (4)
- **Steps to Reproduce**：
  1. 新建一页 → 更多方式 → 声音 → 开始录音，说 3–5 秒 → 停止。
  2. 立刻点面板里录音卡片的 ▶。
  3. 把录音放在页面上，点页面上播放器的 ▶（第一次）。
- **Expected Behavior**：点 ▶ 后约 1 秒内听到声音；真正出声前按钮显示「准备中」，不假装在播放；第二次播放马上出声。
- **Actual Behavior**：约 7 秒后才听到声音（Founder 描述）；页面上第一次播放同样延迟。
- **Evidence**：
  - Founder 文字描述（这次没有收到截图或录屏）。
  - 模拟器测量（iPhone 17，iOS 27.2，`tools/mac/uitest/voice-latency.js`、`voice-app-check.js`）：文件开头静音 0–7 ms；修复前播放器起步 0.1–0.3 s；修复后 App 流程录成 AAC，停止后 0.4 s 出现在页面，第一次播放 1.0 s、第二次 0.25 s。
  - 真机日志：0.2.0 (4) 起，设置 → 媒体检查 → 最近的媒体记录会有 `media_play` 的 playing / moving 毫秒数。TBD。
- **Root Cause**：**真机未确认**。已排除：文件开头是静音（模拟器测量）。代码里找到并已处理的可能原因（`docs/BUGFIX_LOG.md` V10.66）：
  1. 录成 WebM/Opus，iPhone 上走 WebKit 自己的 WebM 播放器，保存后时长丢失；
  2. 默认打开回声消除，Apple 的语音处理会压低声音或改走听筒，结束后还持续一段时间；
  3. 保存要等最长 6 秒的波形解码；
  4. 播放器在「请求播放」时就显示「正在播放」。
- **Fix Summary**（V10.66，`Public/app.js`、`Public/js/voice-skin.mjs`、`Public/js/canvas.mjs`）：Apple WebKit 上录 AAC/MP4；不开回声消除；录完立刻上页面，波形之后补上；`preload="auto"`；播放器以时间真正前进为准显示「准备中 → 正在播放」；记录起步毫秒数。已有录音不改动。
- **Verification**：
  - 自动化：`tests/v162-browser.cjs`、`v162-voice-format.test.mjs` 通过（Chromium，不等于 iPhone）。
  - 模拟器：见 Evidence（模拟器麦克风，不等于真机）。
  - 真机：**TBD**。固定链接在 Claude App 里不能录音，必须用 0.2.0 (4)。请记下「点按到听到声音」的秒数和媒体检查里的 moving 毫秒数。

<a id="cap-002"></a>
### CAP-002 · 标题编辑时键盘遮挡输入区

- **Title**：点「标题」编辑后，iOS 键盘挡住输入区域。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2
- **Status**：Fixed — Pending Device Verification（V10.66 起；V10.70 统一键盘处理后加强）
- **Affected Build**：TBD（同 CAP-001，构建号未记录）
- **Target Build**：0.2.0 (4)；V10.70 的加强在下一个构建（未上传）
- **Steps to Reproduce**：
  1. Studio 里选中一段声音 → 点「标题」。
  2. 用中文拼音输入（候选词栏出现）。
- **Expected Behavior**：输入框和「保存」都在键盘和候选栏上方，完整可见；后面的页面不跳、不放大；按「完成」或「保存」后恢复正常编辑。
- **Actual Behavior**：键盘遮挡输入区域（Founder 描述）。
- **Evidence**：Founder 文字描述（没有截图）。
- **Root Cause**（代码确认，`docs/BUGFIX_LOG.md` V10.66）：iPhone App（WKWebView）里键盘盖在页面上，不缩小布局。「标题」底部弹层没有使用 App 测到的键盘高度；任何输入框获得焦点都进入全局打字模式，弹层后面的编辑器跳动 46 px。
  - 2026-11-14 模拟器追加发现（V10.69）：iOS 27 上键盘弹出时页面会自己往上滚，App 原来的「键盘是否弹出」判断可能失效。是否影响这个弹层，真机 TBD。
- **Fix Summary**：
  - V10.66：底部弹层抬到键盘和候选栏上方；弹层内打字不改变 Studio 布局；标题输入框 16 px（避免 iOS 自动放大）。
  - V10.68：17 个能打字的地方都检查并修了键盘避让。
  - V10.69：iOS 外壳直接告诉网页键盘从哪里开始（含系统输入栏）。
  - V10.70（Beta 2，Issue 1）：底部弹层的键盘规则改为跟随统一的键盘状态（`html.kb-open`），不再依赖「输入框是否还有焦点」；弹层高度统一为 `--avail`（状态栏以下、键盘以上）；键盘弹出时去掉底部安全区留白。
- **Verification**：
  - 自动化：`tests/v162-browser.cjs`；`tests/v164-browser.cjs` 34/34（Chromium 模拟键盘，不算 iOS 自己的平移）；V10.70 后 v162 再次通过。
  - 模拟器：这个弹层没有用真实触摸单独测。
  - 真机：**TBD**。

<a id="cap-003"></a>
### CAP-003 · 字体编辑面板遮挡正在编辑的页面

- **Title**：修改字体时，底部面板挡住正在编辑的页面。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2
- **Status**：Fixed — Pending Device Verification（V10.66 的低矮面板 + V10.70 修掉 CAP-013 的副作用并让文字回到面板上方中部）
- **Affected Build**：TBD（同 CAP-001）
- **Target Build**：0.2.0 (4)
- **Steps to Reproduce**：
  1. 今天的故事（选 2–3 张照片）→ 写字，输入一句话。
  2. 点「Aa 字体」或展开「更多样式」，换字体、字号、颜色、对齐。
- **Expected Behavior**：面板收成低矮的工具栏，上面能看到真实页面和正在改的那句话，每次修改马上看到效果。
- **Actual Behavior**：底部面板盖住正在编辑的页面（Founder 描述）。
- **Evidence**：Founder 文字描述。
- **Root Cause**（代码确认，V10.66）：同一个面板（最高 62% 屏幕）里写字用的部分在调字体时仍然占着位置，盖住真实页面。
- **Fix Summary**（V10.66）：面板分「写字 / Aa 字体」两种高度；字体模式约 222 px，只留字体工具；正在改的文字滚到面板上方。
- **Verification**：
  - 自动化：`tests/v162-browser.cjs` 通过。
  - 真机：**TBD**。
  - 2026-11-14 Founder 在固定链接上说「打字换字体还是会挡到」（IMG_9432–9433）。截图是 Studio 纸上的文字框，不是「今天的故事」面板，所以另记为 CAP-009。**这个面板本身在真机上是否已不遮挡：TBD**。
  - 2026-11-15 Founder 真机截图 IMG_9459（推断是 0.2.0 (4)）：面板已经收成低矮的「改字体」模式，页面上的标题「今天吃了韩餐」在面板上方能看到。但同时，底部操作栏「换照片 / 写文字 / 换个排版 / 保存」浮到页面中间，挡住了预览，另记为 **CAP-013**；推测正是这次修复带来的副作用。所以**这条仍不能标 Verified**，等 CAP-013 修好后一起验收。
  - **V10.70（Beta 2，Issue 3）**：CAP-013 已修；面板换高度后（ResizeObserver，不用定时器）把正在改的字放到面板上方可见区域的中部。
    - 模拟器测量（真实触摸）：改字体时字在 88–122 / 173–207 pt，面板顶部 618 pt；
    - `tests/v166`：换字体后页面上的字体实时变化（宋体），字在面板上方、状态栏下方。
    - 真机：**Pending Device Verification**。

<a id="cap-004"></a>
### CAP-004 · 备份流程不够直观

- **Title**：导出后出现系统分享菜单，随后问「备份文件存好了吗？」，用户难以判断是否已经完成备份。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2。数据安全方面：旧流程会让用户**误以为已经备份**（文件可能只留在 App 自己的文件夹，删除 App 时会一起删掉）。App 内的手帐本身不会因此丢失，所以没有升级。如果真机上发现「已备份」的记录对应的文件不存在，升级为 P1。
- **Status**：Fixed（真机未验证）
- **Affected Build**：TBD（Founder 真机截图，构建号未记录）
- **Target Build**：0.2.0 (4)（V10.67 起）
- **Steps to Reproduce**（旧版）：设置 → 导出完整本机备份 → 出现 iOS 分享面板 → 选择或关闭 → 弹出「备份文件存好了吗？」。
- **Expected Behavior**：
  - 先说明会备份什么、不会备份什么、大约多大；
  - 用系统「存储到文件」选位置；
  - 存好后 App 自己确认（核对文件大小），取消时不记录；
  - 设置里写明是谁确认的。
- **Actual Behavior**：
  - 分享面板里有 AirDrop、信息、微信、存储到「文件」等选项，用户要自己猜点哪个；
  - App 收不到结果，只能问用户，并把用户点的「存好了」当成已备份。
- **Evidence**：Founder 截图 IMG_9420–9422（没有存入仓库）；审查 `docs/BACKUP_UX_REVIEW.md`。
- **Root Cause**（代码审查确认）：外壳把下载的备份放进 App 自己的 Documents 后弹出 `UIActivityViewController`；共享面板不把结果告诉网页。
- **Fix Summary**（V10.67）：
  - 「备份我的手帐」说明面板；
  - iPhone App 用 `UIDocumentPickerViewController(forExporting:asCopy:)` 选择保存位置，外壳读回文件、核对大小后才记为「系统已确认」；
  - 取消不记录，空间不够或写入失败时说明原因；
  - 浏览器里由用户确认，标注「你确认」；
  - 备份内容和格式不变。
- **Verification**：
  - 自动化：`tests/v163-browser.cjs` 通过。
  - 模拟器真实触摸（XCUITest `testBackupRoundTrip`）：取消 → 存到「我的 iPhone」→ 读回 → 出现预览，TEST SUCCEEDED。
  - 真机：**TBD**，包括存到 iCloud 云盘的路径。

<a id="cap-005"></a>
### CAP-005 · 恢复备份缺少引导

- **Title**：点「恢复」后直接进入 iOS 文件选择器，缺少备份内容预览和清晰的恢复说明。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2。意外覆盖风险：恢复会**替换**现在的手帐（不是合并）。S1-1（V10.65）起，替换前有预览、二次确认、恢复前快照（7 天内可撤销），失败时回到原来的手帐，所以没有升级。如果用的构建早于 V10.65（例如 0.1.0 (1)），这些保护都还没有，风险更高。
- **Status**：Fixed（真机未验证）
- **Affected Build**：TBD（同 CAP-004）
- **Target Build**：0.2.0 (4)（V10.67 起；恢复保护自 V10.65 / 0.2.0 (3)）
- **Steps to Reproduce**（旧版）：设置 → 从备份恢复 → 直接打开「文件」选择器。
- **Expected Behavior**：
  - 先说明：选一个备份，开始前会显示里面有什么；恢复会替换现在的手帐；替换前自动保留，7 天内可撤销。
  - 再选文件 → 校验 → 预览（日期、天数、页数、照片、视频、声音）→ 确认 → 恢复。
  - 失败时说明原因，手帐不变。
- **Actual Behavior**：直接打开文件选择器，用户不知道会发生什么（Founder 截图）。
- **Evidence**：IMG_9420–9422（没有存入仓库）；`docs/BACKUP_UX_REVIEW.md`。
- **Root Cause**（代码审查确认）：「从备份恢复」直接触发文件选择；预览只在选完文件之后出现。
- **Fix Summary**（V10.67）：先显示说明，再「选择备份文件」；之后沿用 S1-1 的校验、预览、二次确认、快照和回滚；空间不够时单独说明。恢复的「替换」含义没有改。
- **Verification**：
  - 自动化：`tests/v161-browser.cjs` 16/16（失败回滚、中断恢复、快照写入失败）、`v163` 通过。
  - 模拟器：`testBackupRoundTrip` 读回文件、出现预览。
  - 真机：**TBD**。两台 iPhone 之间互相恢复没有测过。

<a id="cap-006"></a>
### CAP-006 · 新加的文字框要先打字才能移动

- **Title**：插入文字框后不能拖动，必须先打一些字。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2（可以绕过：先打字、点完成，再拖）
- **Status**：Fixed（真机未验证）
- **Affected Build**：固定链接 V10.68（Web 预览，不是 TestFlight 构建）。同样的代码在 0.2.0 (4) 之前的构建里：TBD
- **Target Build**：0.2.0 (4)（V10.69）
- **Steps to Reproduce**：Studio → 文字 → 新文字框出现并进入打字状态 → 不打字，直接拖它。
- **Expected Behavior**：按住拖就能移动，拖完还能接着打字；轻点只放光标。
- **Actual Behavior**：拖不动（Founder，IMG_9427–9428）。
- **Evidence**：IMG_9427–9428（没有存入仓库）。
- **Root Cause**（代码确认）：画布的 `pointerdown` 碰到正在输入的文字时直接交给系统打字，不处理拖动。
- **Fix Summary**（V10.69）：碰到正在输入的文字时先记下，手指移动超过 12 px 才拿起来移动，按纸上的坐标跟手。
- **Verification**：
  - 自动化：`tests/v165-browser.cjs` 通过。
  - 模拟器真实触摸 XCUITest `testTextDrag`：空文字框从 60% 拖到约 30%，拖完仍在打字，TEST SUCCEEDED。
  - 真机：**TBD**。

<a id="cap-007"></a>
### CAP-007 · 「只写几句话」的标题和正文不能移动

- **Title**：首页选「只写几句话」进入后，标题和正文两个框只能打字，不能移动。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2（可以绕过：切换到「自由排版」后再移动）
- **Status**：Fixed（真机未验证）
- **Affected Build**：固定链接 V10.68；更早的构建 TBD
- **Target Build**：0.2.0 (4)（V10.69）
- **Steps to Reproduce**：首页 → 今天怎么记 → 只写几句话 → 开始 → 在标题或正文上拖动。
- **Expected Behavior**：可以把标题和正文拖到别处，文字不丢，能撤销。
- **Actual Behavior**：两个框都拖不动（Founder，IMG_9429–9430）。
- **Evidence**：IMG_9429–9430（没有存入仓库）。
- **Root Cause**（代码确认）：笔记页的标题和正文是固定在纸上的字段，不是可移动的图层；碰到它们时也直接交给系统打字。
- **Fix Summary**（V10.69）：拖动时，这一页按「自由排版」原有方式变成文字框，被拖的那个跟手；撤销一次回到原来的笔记页。
- **Verification**：
  - 自动化：`tests/v165-browser.cjs` 通过。
  - 模拟器真实触摸 `testTextDrag`：拖正文后变成文字框并移动，通过。
  - 真机：**TBD**。

<a id="cap-008"></a>
### CAP-008 · Captain 起名后按回车键盘不收起

- **Title**：给 Captain 起完名字，要点右上角的勾键盘才收起。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P3（有替代操作）
- **Status**：Fixed（真机未验证）
- **Affected Build**：固定链接 V10.68。截图里右上角的勾是 Claude App 外框的按钮，不是 Capiday 的。App 里是否同样：TBD
- **Target Build**：0.2.0 (4)（V10.69）
- **Steps to Reproduce**：认识 Captain → 给它起个名字 → 输入名字 → 按键盘上的回车。
- **Expected Behavior**：键盘收起，名字保留，面板不关。
- **Actual Behavior**：键盘不收起（Founder，IMG_9431）。
- **Evidence**：IMG_9431（没有存入仓库）。
- **Root Cause**（代码确认）：单行输入框不在表单里时，iPhone 上的回车不会收起键盘，App 也没有处理。
- **Fix Summary**（V10.69）：不在表单里的单行输入框，按回车后（没有别的功能用它时）收起键盘，并显示「完成」键。今天的计划、标签等自己使用回车的输入框行为不变。
- **Verification**：
  - 自动化：`tests/v165-browser.cjs` 通过。
  - 真机：**TBD**。

<a id="cap-009"></a>
### CAP-009 · 打字时字体工具条被键盘挡住

- **Title**：在纸上打字时想换字体，文字工具条（Aa 样式 · B I U S · 完成）被挡住。
- **Reported Date**：2026-11-14
- **Source**：Founder（固定链接）。iOS App 里的另一个原因是 2026-11-14 在模拟器测试中发现的。
- **Severity**：P2（可以绕过：收起键盘后选中文字框，用底部工具改字体）
- **Status**：Fixed（真机未验证）
- **Affected Build**：
  - 固定链接 V10.68；
  - iOS App：在模拟器（iOS 27.2）上用 V10.69 开发中的代码复现；已发出的构建是否受影响 TBD。
- **Target Build**：0.2.0 (4)（V10.69）
- **Related**：CAP-003
- **Steps to Reproduce**：Studio → 文字 → 在新文字框里打字 → 找「Aa 样式」。
- **Expected Behavior**：工具条完整显示在键盘（和系统输入栏）上方。
- **Actual Behavior**：
  - 固定链接：工具条在键盘后面（Founder，IMG_9432–9433）。
  - iOS App（模拟器）：工具条被键盘上方系统自带的「⌃ ⌄ ✓」输入栏盖住。
- **Evidence**：
  - IMG_9432–9433（没有存入仓库）；
  - 模拟器截图 `/tmp/ld-uitest/shots/t3-added.png`（Mac 临时目录，不在仓库）；
  - 模拟器测量：`innerHeight` 613、可见区域高 477、偏移 261（屏幕 874 pt）。
- **Root Cause**（确认）：
  - 固定链接是嵌在 Claude App 里的一个框，键盘不会让框里能测到的可见区域变小，量不到键盘高度。
  - iOS 27 上键盘弹出时页面会自己往上滚，App 的键盘判断失效，工具条退回「不打字」的位置，正好在系统输入栏后面。
- **Fix Summary**（V10.69）：
  - iOS 外壳 `LittleDaysKeyboard` 把键盘（含系统输入栏）在网页里的顶端位置告诉网页，工具条、纸的上移、输入框滚动都以它为准；
  - 固定链接里在 iPhone 上按屏幕高度估算键盘，只用来摆放工具条。
- **Verification**：
  - 自动化：`tests/v165-browser.cjs`（嵌入时在估算线上方），`v164` 34/34。
  - 模拟器真实触摸 `testTextDrag`：工具条底边 471 pt，系统输入栏顶边 487 pt，完整可见。
  - 真机：**TBD**（App 和固定链接都要看）。

<a id="cap-010"></a>
### CAP-010 · 新建手帐本弹窗顶部离状态栏太近（Safe Area）

- **Title**：「新建手帐本」弹窗的标题离 iPhone 状态栏太近，上方空间不够。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone 测试）
- **Severity**：P2（影响观感和可读性，不影响保存；如果标题或按钮被状态栏 / 灵动岛挡住点不到，升级为 P1）
- **Status**：Fixed — Pending Device Verification（V10.70）
- **Affected Build**：TBD（Founder 没有说明是 TestFlight 哪个构建，还是固定链接）
- **Target Build**：下一个构建（未上传，V10.70）；Beta 2
- **Steps to Reproduce**：
  1. 在 iPhone 上打开 Capiday。
  2. 我的手帐 → ＋（或首页「新建手帐本」）。
  3. 看弹窗顶部「新建手帐本」标题和状态栏的距离；再点名字输入框，让键盘弹出。
- **Expected Behavior**：
  - 顶部避开 iOS 的安全区（状态栏、灵动岛）；
  - 标题、表单、操作按钮的布局合理；
  - 键盘弹出时仍能看到正在编辑的输入框。
- **Actual Behavior**：弹窗顶部标题距离状态栏过近，视觉空间不足（Founder 截图 1）。
- **Evidence**：Founder 截图 1（本次消息没有收到图片附件，按文字描述记录；截图不放进仓库）。
- **Root Cause**：**推测，未在设备上确认**（代码阅读，2026-11-15）：
  - 这个弹窗是居中的 `<dialog>`（`#form-dialog.book-editor-dialog`，`Public/styles.css` V10.54 段）。高度上限是 `min(90dvh, var(--vv-h) − 16px)`，**没有用 `env(safe-area-inset-top)`**。iOS App 里网页铺满全屏（外壳 `contentInsetAdjustmentBehavior = .never`），所以 90dvh 高的弹窗居中后，顶部只剩约 5dvh（874 pt 的屏幕上约 44 pt），比状态栏 / 灵动岛区域还小。
  - 键盘弹出时，V10.68 的规则 `html[style*="--kb"] dialog[open]:not(.choose-dialog):has(:focus)` 把弹窗顶到「可见区域顶部 + 10px」，同样没有算安全区。
  - V10.69 在模拟器上发现，iOS 27 键盘弹出时页面会自己往上滚，`--kb` 可能一直小于 80。这时上面那条规则不生效，弹窗位置由 iOS 自己的滚动决定。两种情况都要在真机上看。
- **Root Cause（已确认，2026-11-15 模拟器测量）**：
  - iPhone 17（iOS 27.2）上，状态栏 / 灵动岛区域高 62 pt；
  - 修复前弹窗顶边在 10 pt（键盘弹出时）或 16 pt（键盘收起后），标题「新的一本，小小期待。」在 31–37 pt，压在状态栏下面；
  - 和上面的推测一致：没有用 `safe-area-inset-top`，键盘规则顶到「可见顶部 + 10px」。
- **Fix Summary（V10.70）**：
  - `Public/styles.css`：新增 `--sat` / `--sab`（安全区）和 `--avail`（弹窗、弹层可用高度：状态栏以下；键盘弹出时为键盘以上）。
  - 表单弹窗在安全区内居中（`dialog:where(#form-dialog)[open]` 的 top / bottom），新建手帐本的最大高度改为 `min(90dvh, var(--avail))`。
  - 键盘弹出时的居中弹窗规则改为跟随 `html.kb-open`，顶部是 `可见顶部 + 安全区 + 8px`。
  - 模拟器测量（修复后）：标题在 91 pt（安全区 62 pt），名字输入框底边 201 pt，键盘上方的系统输入栏在 487 pt。
- **原来的建议方向**（保留）：
  - 弹窗的上下边距和最大高度都减去安全区，顶部至少 `safe-area-inset-top + 8px`；
  - 键盘弹出时，顶部同样留出安全区；
  - 正在编辑的输入框在弹窗内部滚到可见处；
  - 也可以考虑把「新建手帐本」改成全屏或底部表单。这是设计改动，需要 Founder 确认。
- **Verification**：
  - 浏览器：`tests/v166-browser.cjs`（402 × 874，安全区 62 / 34，模拟键盘 397）——没有键盘和键盘弹出时，标题都在状态栏下面，弹窗在安全区内，名字输入框在键盘上方。
  - 模拟器真实触摸：`tools/mac/uitest/editor-layout.sh` + `check-layout.py`，修复前失败，修复后通过。
  - 真机：**Pending Device Verification**（有灵动岛的机型，如有条件再加小屏机型）。
- **Related**：CAP-002（键盘遮挡）、CAP-011（同一个弹窗）。

<a id="cap-011"></a>
### CAP-011 · 「查看更多封面」关闭键盘后弹窗布局 / 滚动异常

- **Title**：从新建手帐本进入「查看更多封面」，关闭键盘后，封面选择弹窗出现布局或滚动异常，手动滚动后才显示更多内容。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone 测试）
- **Severity**：P2（可以绕过：手动滚动一下就恢复；不影响数据）
- **Status**：Fixed — Pending Device Verification（V10.70）
- **Affected Build**：TBD（同 CAP-010）
- **Target Build**：下一个构建（未上传，V10.70）；Beta 2
- **Steps to Reproduce**（按 Founder 描述整理，具体顺序待确认）：
  1. 我的手帐 → ＋ 新建手帐本。
  2. 点名字输入框，键盘弹出（可以输入几个字）。
  3. 点「查看更多封面」进入封面选择。
  4. 键盘收起后观察弹窗：高度、内容是否被截断或留白；不滚动时能看到多少封面。
  5. 手动上下滚动一下，内容才完整显示。
- **Expected Behavior**：
  - 键盘关闭后立即恢复正确布局，不需要用户额外滚动；
  - 弹窗高度和内部滚动区域分开管理；
  - 没有意外跳动、截断或空白。
- **Actual Behavior**：键盘关闭后封面选择弹窗布局或滚动异常，手动滚动后页面才显示更多内容（Founder 截图 2、3）。
- **Evidence**：Founder 截图 2、3（本次消息没有收到图片附件；截图不放进仓库）。
- **Root Cause**：**推测，未复现**（代码阅读，2026-11-15）。按可能性从高到低：
  1. **键盘收起后高度变量没有及时更新（visualViewport / keyboard inset）**。
     - 这个弹窗的最大高度用 `--vv-h`，底边距用 `--kb`（`.book-editor-dialog`）。这两个值只在三种时候更新：`visualViewport` 的 resize / scroll 事件，以及外壳发来的键盘消息。
     - 外壳在 `keyboardWillHide`，也就是键盘**开始**收起时就发 0。那一刻可见区域还是键盘弹出时的大小，所以按键盘弹出时的高度算出来的 `--vv-h` 会留下来。
     - V10.69 测到，iOS 27 键盘弹出时页面会自己滚（`innerHeight` 613、可见区域偏移 261）。如果键盘收起后 WebKit 没有再发一次 resize，这个旧值就一直不变，弹窗一直按「有键盘」时的高度显示。
     - 用户手动滚动会触发 `visualViewport` 的 scroll 事件，`updateVisibleArea` 才会清掉旧值，布局随之恢复。这和「手动滚动后才显示更多内容」完全吻合。
  2. **滚动位置复位的时机不对（scroll restoration）**：`openCoverBrowser` 在下一帧把弹窗滚到顶（`#form-dialog.scrollTop = 0`），那时键盘还在收起、弹窗高度还在变。
  3. **嵌套滚动（nested scrolling）**：弹窗本身可以滚动（`overflow-y: auto`），里面还有横向的封面行和照片区。封面浏览器和第一屏共用同一个弹窗和滚动容器（`.book-main` 隐藏、`#cover-browser` 显示），没有独立的滚动区域。
  4. **WebKit 重绘**：键盘收起后，最上层的 `<dialog>` 等到下一次滚动才重绘。这一条要在真机或模拟器上用截图加测量来区分。
  - 不太相关的一项：「Bottom Sheet 高度」。这里不是底部弹层（`.choose-dialog`），而是居中弹窗，但高度同样依赖键盘变量（见第 1 条）。
- **Root Cause（已确认，2026-11-15 模拟器测量）**：上面的第 1 条。
  - 键盘收起后 `--kb` 仍是 397px、`--vv-h` 仍是 477px，而这时可见区域已经是 874（没有键盘）。
  - 弹窗一直停在 [16, 461 高]，下半屏空白；用户在弹窗里滚动也不会更新（滚动的是弹窗，不是可见区域）。
  - 代码原因：`updateVisibleArea` 只绑在可见区域的 scroll 事件上；resize 时只经过 `keepFieldInView`，而它在没有输入框获得焦点时直接返回；外壳的 `keyboardWillHide` 在键盘**开始**收起时就发，那一刻量到的还是有键盘的高度。
  - 另外发现：键盘规则依赖「输入框是否还有焦点」（`:has(:focus)`）。手指按下按钮时焦点先离开，弹窗在手指抬起前就变了大小，点击落到别处，在 Chromium 里「查看更多封面」因此没有打开。
- **Fix Summary（V10.70，Editor Layout Coordinator）**：
  - `Public/app.js` `updateVisibleArea` 成为唯一判断键盘的地方：只有「有输入框获得焦点」**并且**量到键盘（外壳给出的位置，或可见区域变小）时，才设置 `html.kb-open`、`--vv-h`、`--kb`；否则全部清掉。
  - 在失去焦点、可见区域 resize / scroll、外壳通知时都重新计算。
  - 手指正按着时不改布局，等抬起、这次点击处理完再更新（由事件触发，不用固定延迟）。
  - `LittleDaysWebShellView.swift`：外壳在键盘动画结束后（`keyboardDidChangeFrame`、`keyboardDidHide`）再通知一次。
  - `Public/styles.css`：弹窗和弹层的键盘规则改为跟随 `html.kb-open`。
  - 模拟器测量（修复后）：键盘收起后变量清空，弹窗 [58, 787 高]，封面浏览器不滚动就能看到 9 个封面；返回上一级后刚选的封面保留（v166）。
- **原来的建议方向**（保留）：
  - 键盘真正收起后（外壳发 `keyboardDidHide`，网页在 focusout 后约 300–600 ms）再测一次，并清掉旧变量；
  - 没有输入框获得焦点时，弹窗高度不依赖键盘变量；
  - 封面浏览器用自己的滚动区域，打开时等布局稳定后再复位滚动；
  - 先在模拟器里用软键盘复现，并记录前后的 `visualViewport` 数值和弹窗高度，再决定改哪里。
- **Verification**：
  - 模拟器真实触摸：输入名字 → 查看更多封面 → 键盘收起 → 不滚动，截图并测量。修复前失败（弹窗 461 高、看到 0 个封面），修复后通过。
  - 浏览器 `tests/v166`：模拟键盘收起**不发** resize，键盘状态被清掉，弹窗恢复高度，封面可见，返回上一级保留选择；外壳路径（`capidayKeyboard`）失去焦点后立即清掉。
  - 真机：**Pending Device Verification**。
- **Related**：CAP-010（同一个弹窗），CAP-009（V10.69 的键盘位置修改）。

<a id="cap-012"></a>
### CAP-012 · 「写字 · 改字体」打字时面板下半部被截断

- **Title**：在「写字 · 改字体」面板里输入文字，中文键盘弹出后，面板下半部被截断，「可以不写，直接保存」下面的设置看不全。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone）
- **Severity**：P2（可以绕过：先收起键盘再改设置；不影响保存）
- **Status**：Fixed — Pending Device Verification（V10.70）
- **Affected Build**：0.2.0 (4)（推断，待 Founder 确认）。依据：截图是 iPhone App（键盘上方有系统自带的「⌃ ⌄ ✓」输入栏，没有网页预览的标记），面板头部有 V10.66 才加的「Aa 字体」按钮，而 0.2.0 (4) 是唯一包含 V10.66 的 TestFlight 构建。
- **Target Build**：下一个构建（未上传，V10.70）；Beta 2
- **Steps to Reproduce**：
  1. 首页 → 今天的故事，选 2–3 张照片 → 生成。
  2. 点「写文字」，打开「写字 · 改字体」面板（写字模式）。
  3. 点「整个 Moment 的一句话」输入框，用中文拼音输入，候选栏出现。
  4. 看输入框下面：「可以不写，直接保存」和「字体与样式 ›」。
- **Expected Behavior**：
  - 输入框一直可见；
  - 面板不被键盘不合理地遮挡，能滚到并使用全部必要设置；
  - 中文候选栏出现或消失时布局稳定。
- **Actual Behavior**（截图 IMG_9458）：
  - 面板从状态栏下方一直铺到键盘上方的输入栏；
  - 输入框可见，但「可以不写，直接保存」下面的「字体与样式 ›」只露出半行，再往下是一段空白；
  - 看不出可以滚动。
- **Evidence**：IMG_9458（Founder 截图，含个人照片，不放进仓库）。
- **Root Cause**：**推测，未复现**（代码阅读）：
  1. **键盘高度（K 组）**：带焦点输入框的底部弹层规则（V10.66，`styles.css` 里 `.choose-dialog[open]:has(…:focus)`）用 `max-height: calc(var(--vv-h) - 8px)`、`margin-bottom: var(--kb)`。
     - V10.69 测到，iOS 27 上 `--kb` 可能一直小于 80，不会设置；`--vv-h` 改为由外壳提供的键盘位置得出。
     - 两者组合下，面板的高度和位置是否正确，没有在软键盘下测过（V10.68 的 34 处检查是 Chromium 模拟，V10.69 的模拟器测试只覆盖了 Studio 纸上的文字框）。
  2. **安全区（S 组）**：面板底部固定留了 `16px + env(safe-area-inset-bottom)`（`.choose-sheet`，约 50 pt）。键盘弹出时这段已经没有意义，但仍然占着位置，截图里截断线下面的空白就是它。顶部没有算 `safe-area-inset-top`，所以面板标题紧贴状态栏（和 CAP-010 同类）。
  3. **滚动区域**：最大高度设在 `<dialog>` 上，面板内容（预览小卡、照片条、输入框、提示、折叠的「字体与样式」）比这个高度更高。实际滚动的是哪一层、有没有滚动提示，要在设备上测。
- **Root Cause（已确认，2026-11-15 模拟器测量）**：
  - 面板 [0, 16, 461 高] → 顶部压在状态栏（62 pt）下面；
  - 面板里可滚动的区域只有 198 px（内容 263 px）；
  - 「字体与样式 ›」在 457–497，而键盘上方的系统输入栏在 487 → 被截断；
  - 底部还留着 `16px + 安全区`（约 50 pt）。三条推测都成立。
- **Fix Summary（V10.70）**：
  - 面板高度用 `--avail`（状态栏以下、键盘以上）；
  - 键盘弹出时：底部不留安全区；「可以不写，直接保存」提示隐藏；写给谁的标题改成一行；实时预览小窗变矮（矮屏手机上隐藏）；
  - 输入框和「字体与样式 ›」（点它切到字体工具，键盘收起）都在键盘上方，其余设置在面板里滚动；
  - 模拟器测量（修复后）：面板顶部 74 pt，输入框 351–407，「字体与样式 ›」425–465，系统输入栏 487。
- **原来的建议方向**（保留）：
  - 和 CAP-011、CAP-010 一起，按 K / S 组统一处理键盘高度和安全区；
  - 键盘弹出时去掉底部安全区留白；
  - 写字模式下，面板只保证输入框和「完成」可见，其余设置在面板内滚动，并有可见的滚动提示；
  - 或在键盘弹出时暂时收起预览小卡。具体由 Founder 选择。
- **Verification**：
  - 模拟器软键盘 + 真实触摸（拼音输入「你」）：修复前失败，修复后通过；
  - `tests/v166`：面板顶部在状态栏下面，输入框、「字体与样式 ›」在键盘上方；
  - 真机：**Pending Device Verification**（包括小屏机型）。
- **Related**：CAP-003（同一个面板，字体模式）、CAP-002 / CAP-009（键盘避让，已修待验证）、CAP-010 / CAP-011（同组根因）。**不是重复**：CAP-003 讲的是字体模式挡住页面，这条讲的是写字模式下键盘弹出后面板内容被截断。

<a id="cap-013"></a>
### CAP-013 · 改字体时「换照片 / 写文字 / 换个排版 / 保存」浮在页面中间

- **Title**：在「今天的故事」里已经打开「写字 · 改字体」面板，页面中间突然出现「换照片 / 写文字 / 换个排版 / 保存」操作栏，挡住预览。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone）
- **Severity**：P2（挡住正在编辑的预览，但不影响数据；可以关闭面板后操作）
- **Status**：Fixed — Pending Device Verification（V10.70）
- **Affected Build**：0.2.0 (4)（推断，依据同 CAP-012：截图里是 V10.66 的「✎ 写字」低矮面板）
- **Target Build**：下一个构建（未上传，V10.70）；Beta 2
- **Steps to Reproduce**（按截图推断，具体步骤待确认）：
  1. 首页 → 今天的故事，选 2–3 张照片 → 生成。
  2. 点「写文字」→ 输入一句话。
  3. 点「Aa 字体」（或换一个字体），面板收成低矮的改字体模式，键盘收起。
  4. 看页面：操作栏出现在预览中间；底部同时有字体面板。
- **Expected Behavior**：
  - 不同编辑模式的操作栏正确协调；字体面板打开时，「换照片 / 写文字 / 换个排版 / 保存」不出现，或者留在原来的底部、被面板盖住；
  - 不出现叠加的工具栏，不遮挡主要创作内容；
  - 切换照片编辑、文字编辑和预览时状态稳定。
- **Actual Behavior**（截图 IMG_9459）：
  - 操作栏横在预览的第一张照片上（约屏幕 30–36% 的高度）；
  - 下面是故事页的照片和标题；
  - 屏幕底部是「写字 · 改字体」面板（字体、字号、加粗、对齐、颜色）。
- **Evidence**：IMG_9459（Founder 截图，含个人照片，不放进仓库）。
- **Root Cause**：**推测，未复现**（代码阅读）。最可能是 **V10.66 修复 CAP-003 时带来的副作用**（W 组）：
  - 操作栏 `.story-actions.qe-bar` 是 `position: sticky; bottom: 0`，在页面的滚动容器 `#app-scroll` 里贴着底部（`styles.css` 约 12856 行、21333 行）。
  - V10.66 为了让正在改的文字能滚到低矮面板上方，在面板打开时给 `#app-scroll` 加了 `padding-bottom: 60dvh`（`body:has(#choose-dialog[open] .choose-sheet.sw) #app-scroll`）。
  - 粘性定位贴底时会扣掉滚动容器的这段内边距（WebKit 上是否如此，待测量确认），于是操作栏被抬到「屏幕底部往上 60% 屏高」的位置，正好在截图里的那个高度：屏幕 874 pt × 40% ≈ 350 pt，减去操作栏自身的下边距，大约 320 pt，和截图吻合。
  - 打开字体面板时没有隐藏这个操作栏，也没有其他「编辑模式」状态让两者互斥，所以两者同时出现。
  - 已排除的方向：这个操作栏不是 `position: fixed`，也不随键盘高度变量移动，所以和 K 组（键盘）无关。z-index：它是 3，字体面板在 `<dialog>` 顶层，层级正常；问题在位置，不在层级。
- **Root Cause（已确认，2026-11-15 模拟器测量）**：
  - 操作栏平时在 765 pt，面板打开时（写字和改字体都一样）在 241 pt，正好被抬高 524 pt，也就是 874 的 60%；
  - 关掉面板后回到 765；
  - 推测（粘性定位扣掉滚动容器的 `padding-bottom: 60dvh`）成立。
- **Fix Summary（V10.70）**：两项都做了：
  - 滚动空间改为页面末尾的占位（`#app::after`），不再给滚动容器加内边距；
  - 「写字 · 改字体」面板打开时，故事页操作栏让开（`visibility: hidden`，不改变布局，面板自己有「完成」），关掉面板后恢复；
  - 关掉面板后页面回到打开前的位置（`Public/app.js`，打开时记下 `#app-scroll` 的位置）。
- **原来的建议方向**（二选一，或组合）：
  - 字体面板打开时隐藏操作栏（给 `body` 或 `#app` 加一个状态类）；
  - 不再用 `#app-scroll` 的 `padding-bottom` 制造滚动空间，改成在内容末尾放一个不影响粘性定位的占位元素。
  - 修好后 CAP-003 一起重新验收。
- **Verification**：
  - 模拟器真实触摸：修复前操作栏在 241 pt 可见；修复后面板打开时隐藏，「完成」后回到 765 pt 可见；
  - `tests/v166`：面板打开时隐藏，完成后回到底部，没有残留，页面位置恢复；
  - 真机：**Pending Device Verification**（和 CAP-003 一起）。
- **Related**：**CAP-003（推测由它的修复引起）**；和 K / S 组无关，可以单独修。

<a id="cap-014"></a>
### CAP-014 · 双击文字元素无法进入编辑

- **Title**：在 Journal Studio 里，已经选中的文字元素（例如「你猜」），双击文字本身没有进入编辑模式。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone）
- **Severity**：P2（可以绕过：点底部「编辑」也能进入编辑——待 Founder 确认这条路径在真机上可用）
- **Status**：Triaged（**只登记，没有改代码**）
- **Affected Build**：0.2.0 (4)（推断：截图 IMG_9460 是 iPhone App；「你猜」用的是 V10.69 才有的默认黑体加粗，所以这个文字框是 0.2.0 (4) 里新建的）
- **Target Build**：Beta 2（暂定），归入 Editor Layout & Interaction Stability 工作流
- **Steps to Reproduce**：
  1. 打开 Journal Studio 里已有的手帐页面。
  2. 点一下文字元素（例如「你猜」），出现选中边框和操作控件。
  3. 双击文字本身。
- **Expected Behavior**：
  - 单击选中；双击直接进入文字编辑，显示当前文字并聚焦；点底部「编辑」是同样的入口；
  - 编辑完成后保留原有样式、位置和图层属性；
  - 双击不触发拖动、缩放或其他操作。
- **Actual Behavior**：双击后没有进入编辑（Founder 描述）。
- **Evidence**：Founder 截图 IMG_9460（2026-11-15 补充；不放进仓库）。截图显示：
  - 11月14日第 6 页，「你猜」是普通的自由排版文字框，选中边框、上方的旋转把手、右下的缩放圆点都在；
  - 底部是「文字 · 已选中」工具条：返回 / 编辑 / 字体 / 颜色 / 对齐 / 图层 / 删除。
  - 所以下面第 3 条（绑定文字或笔记页固定字段）基本可以排除；底部「编辑」这个替代入口是存在的。
- **Root Cause**：**推测，未复现**（代码阅读，`Public/app.js` `commitGesture`、`DOUBLE_TAP_MS`）。双击是 App 自己判断的：两次「轻点」（手指移动不超过 8 px）落在同一个文字框上，间隔小于 400 ms，相距小于 32 px。可能原因：
  1. **400 ms 太紧**：每次轻点都会重画页面（`render()`）；页面图层多时，在 WKWebView 里两次抬起之间可能超过 400 ms。
  2. **移动阈值**：手指在两次点按中移动超过 8 px 会被当成拖动，双击计数被清零。
  3. ~~**文字类型**：「今天的故事」生成的、与页面标题绑定的文字（`bind`），或笔记页固定在纸上的标题 / 正文（不是图层），走的是不同的路径。~~ IMG_9460 显示「你猜」是普通文字框，基本排除。
  4. **覆盖层**：选中边框 `.sel-frame` 是 `pointer-events: none`，不拦截；控制点在边框外面。已检查，暂时排除；真机上仍要确认没有别的透明层。
  5. **WKWebView 双击手势**：页面禁止缩放（`maximum-scale=1`），图层是 `touch-action: none`，系统双击缩放应当不会介入。待真机确认。
- **Fix Summary**：TBD（未开始；Founder 说「修复 CAP-014」后再动手）。建议先在模拟器里用真实触摸复现：选中后双击；记下两次抬起的时间间隔和手指移动距离。确认原因后再决定放宽间隔、改用 `dblclick`，或修正特定文字类型的路径。
- **Verification**：TBD。
- **Related**：CAP-006（V10.69 改过「正在输入的文字可以拖动」，要确认没有影响双击）。

<a id="cap-015"></a>
### CAP-015 · 弹层里的主按钮（保存、创建）字号比「取消」小很多

- **Title**：录音「标题」弹层里，「保存」的字明显比下面的「取消」小，看起来不协调。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone）
- **Severity**：P3（只影响观感，按钮能用）
- **Status**：Triaged（只登记，没有改代码）
- **Affected Build**：0.2.0 (4)（推断：截图 IMG_9461 是 iPhone App）
- **Target Build**：Beta 2（暂定）
- **Steps to Reproduce**：Studio → 选中一段声音 → 更多工具 → 标题 → 看「保存」和「取消」。
- **Expected Behavior**：同一个弹层里的主按钮和次按钮字号协调，主按钮至少不比次按钮小。
- **Actual Behavior**（IMG_9461）：「保存」约 11px、常规字重；「取消」16px 加粗。
- **Evidence**：IMG_9461（Founder 截图，不放进仓库）。2026-11-15 的模拟器截图里，「新建手帐本」的「创建」也比「取消」小。
- **Root Cause（代码确认）**：
  - 主按钮用全局 `.primary`，字号 11px（`Public/styles.css` 约 666 行，早期网页预览手机框时的尺寸）；
  - 底部弹层的「取消」用 `.choose-cancel`，`600 16px`（约 7924 行）；
  - 很多地方给主按钮单独加了更大的字号（例如写字面板的「完成」、「今天怎么记」的开始按钮），但「标题」弹层的「保存」、新建手帐本的「创建」等没有，所以保留了 11px。
- **影响范围**：所有没有单独设置字号的 `.primary` 按钮。具体有哪些需要一次全面清点（TBD）。
- **Fix Summary**：TBD（未开始）。建议方向：
  - 定一套按钮字号（例如弹层里的主 / 次按钮都是 16px 600，页面里的小按钮保持现状）；
  - 先改底部弹层和表单弹窗里的主按钮，避免一次改动全局 `.primary` 影响所有页面；
  - 修改前后各截一次图对比。
- **Verification**：TBD（浏览器里比较字号，模拟器截图，真机确认）。
- **Related**：CAP-002（同一个「标题」弹层）、CAP-010（「新建手帐本」的「创建」按钮）。

---

## 5b. 功能改进（Enhancement）

功能改进和 Bug 用同样的级别、状态和流程，只是 ID 用 CAP-E。没有「复现步骤」，改成「现状」和「需求」。

<a id="cap-e001"></a>
### CAP-E001 · 字体列表增加基础中文宋体、黑体

- **Title**：现在的字体列表里有多种英文字体和中文艺术字体，但没有清楚的基础宋体、黑体。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone 测试）
- **Severity**：P3
- **Status**：Triaged
- **Affected Build**：TBD
- **Target Build**：Beta 2（暂定），建议和 CAP-E002 一起做
- **现状**（代码核对，2026-11-15）：
  - Studio 里打字时的字体条和「今天的故事」字体面板（`TYPE_FONTS`）**已经有** 黑体、宋体、楷体。它们用设备自带的字体（`Public/js/library.mjs` `SYSTEM_FONTS`：iPhone 上是苹方 PingFang SC、宋体 Songti SC），App 里没有打包，也不需要授权。
  - **新建 / 编辑手帐本的「字体」**（`Public/js/personal-ui.mjs` 里的 `<select name="coverFont">`）只列出 `library.json` 里打包的 11 种字体：6 种英文（Cormorant、Caveat、Quicksand、Libre Baskerville、DM Sans、Pacifico）和 5 种中文艺术字（马善政、站酷快乐体、站酷小薇、龙藏体、霞鹜文楷）。**没有宋体、黑体**。
  - 英文字体遇到中文时，会落到马善政毛笔字（`fontFamily()` 的备用字体是 `LD-chinese`）。所以选英文字体时，中文书名也是毛笔风格。
  - Founder 看到的是哪个列表：推测是手帐本封面的字体，**TBD 确认**。
- **需求**：
  - 加宋体、黑体两个基础中文字体类别；
  - 选择合适的 iOS / Web 字体方案，考虑跨设备一致性、授权和字体加载；
  - 选择、保存、重新打开和导出时尽量一致。
- **方案比较**（初步，待 Founder 决定）：
  1. **用设备自带字体**（推荐先做）：复用已有的 `hei` / `song` ID。
     - 不增加 App 体积，不需要额外授权，加载即时；
     - iPhone 和 Mac 上效果一致；
     - Windows、Android 浏览器会显示成微软雅黑、宋体或 Noto 等，备份到别的平台后打开，样子可能不同；
     - 「Songti SC」在 iPhone 上是否不用下载就能用：**TBD，需真机确认**。
  2. **打包开源字体**（如 Noto Serif SC / Noto Sans SC，OFL 授权）：
     - 跨平台一致；
     - 但完整中文字体每种每个字重约 10–20 MB，App 和固定链接（现在约 44 MB）都会明显变大；
     - 用户自己写的字无法提前精简字库。
  - 无论哪种方案都要做到：
    - 书的数据里只存字体 ID（`coverFont` 是字符串），**不改数据结构**；
    - 改 `library.json` 后运行 `tools/sync_library.py`，保留来源和授权说明；
    - 导出 PNG 在同一台设备上用同一字体渲染，要实际导出一次确认。
- **Fix Summary**：TBD（未开始）
- **Verification**：TBD
  - 新建手帐本选宋体、黑体 → 保存 → 重新打开 → 导出 PNG，三处字形一致；
  - 中英文书名各试一次；
  - iPhone 和固定链接各试一次。

<a id="cap-e002"></a>
### CAP-E002 · 字体列表用每种字体本身显示，并实时预览

- **Title**：字体列表里的字体名几乎都用同一种字体显示，用户无法直接判断每种字体的样子。
- **Reported Date**：2026-11-15
- **Source**：Founder（真实 iPhone 测试）
- **Severity**：P2
- **Status**：Triaged
- **Affected Build**：TBD
- **Target Build**：Beta 2（暂定），建议和 CAP-E001 一起做
- **现状**（代码核对，2026-11-15）：
  - 手帐本封面的字体是一个原生 `<select>`。在 iPhone 上点开是系统的滚轮选择器，选项一律用系统字体显示；给 `<option>` 设置字体在 iOS 上不起作用。这就是「名字几乎相同字体」的原因。
  - Studio「详情 / 文字」面板里还有两个同样的 `<select>` 字体选择（`fontOptions()`）。
  - Studio 打字时的字体条和「今天的故事」字体面板是按钮，**已经**用各自的字体显示。
  - 封面预览：`<select>` 改变时 `handleV3Input` → `refreshBookPreview()` 会**实时更新**封面预览（代码已有）。但在 iPhone 的滚轮选择器里，要选完才更新。
  - 取消：新建手帐本时取消就丢弃草稿；编辑手帐本时取消能否恢复原字体，**TBD，需要测试**。
  - 字体加载：打包字体用 `@font-face` 加 `font-display: swap`（`Public/fonts.css`）。没加载完时会先显示备用字体，没有「等加载完」的处理。
- **需求**：
  - 每个字体选项用它对应的字体显示；中文字体用中文预览文字，英文字体用英文预览文字；
  - 选择时封面预览实时更新；用户取消时恢复原来的字体；
  - 字体还没加载时，不显示错误的预览，也不保存错误的状态。
- **方案方向**（初步）：
  - 把 `<select>` 换成 App 自己的字体列表（按钮或卡片，和 Studio 字体条一致），每行用该字体写一段示例，例如「开铺手帐 小日子」/「Capiday Little Days」；
  - 打开列表时用 `document.fonts.load()` 预加载，没加载完的行先显示占位、不可选或标明「加载中」；
  - 选择只改草稿（`bookDraft`），按「创建 / 保存」才写入，取消就丢弃；
  - 三个 `<select>` 字体选择是否一起换，需要 Founder 确认范围。
- **Fix Summary**：TBD（未开始）
- **Verification**：TBD
  - 浏览器测试：每个选项的计算字体是否正确；选择后预览更新；取消后恢复；
  - 模拟器截图；
  - 真机确认，包括离线、首次打开时字体还没缓存的情况。

---

## 6. 新条目模板

```markdown
<a id="cap-0XX"></a>
### CAP-0XX · 标题

- **Title**：
- **Reported Date**：YYYY-MM-DD
- **Source**：Founder / Beta Tester（名字或代号；不写真实联系方式）
- **Severity**：P0 / P1 / P2 / P3（理由）
- **Status**：New
- **Affected Build**：0.x.y (n) / 固定链接 Vx.y / TBD
- **Target Build**：TBD
- **Steps to Reproduce**：
  1.
- **Expected Behavior**：
- **Actual Behavior**：
- **Evidence**：截图编号 / 录屏 / 设置 → 媒体检查里的记录（不把真实手帐、照片、录音放进仓库）
- **Root Cause**：TBD（推测写在这里时标明「推测」）
- **Fix Summary**：TBD
- **Verification**：TBD
```

功能改进（CAP-E）用同样的模板，把「Steps to Reproduce / Expected / Actual」换成「现状」「需求」「方案方向」。
