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
| **Fixed** | 修复已进代码，自动化 / 模拟器测试通过，并已进某个 Build。**还没有在真机上确认** |
| **Verified** | 在 Target Build 的真实 iPhone 上，按复现步骤确认问题不再出现（写明谁、哪台设备、哪个 Build、哪天） |
| **Closed** | 已 Verified 并随版本发出；或确认不修 / 重复 / 无法复现（写明原因） |

一个 Fixed 的问题在真机上仍然出现时，状态退回 **Triaged**，在 Verification 里记下这次结果，不新建条目。

## 3. 反馈处理流程（Founder 说「记录一个 Bug」时）

1. **先查重**：在下面的总表和条目里找相同或相关的问题。相同就在原条目补充证据和日期；相关就新建并互相引用。
2. 没有相同的，**新建 Bug ID**（顺延编号，CAP-001、CAP-002……，编号不复用）。
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
| [CAP-002](#cap-002) | 标题编辑时键盘遮挡输入区 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-003](#cap-003) | 字体编辑面板遮挡正在编辑的页面 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-004](#cap-004) | 备份流程不够直观 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-005](#cap-005) | 恢复备份缺少引导 | P2 | Fixed | TBD | 0.2.0 (4) |
| [CAP-006](#cap-006) | 新加的文字框要先打字才能移动 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-007](#cap-007) | 「只写几句话」的标题和正文不能移动 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-008](#cap-008) | Captain 起名后按回车键盘不收起 | P3 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |
| [CAP-009](#cap-009) | 打字时字体工具条被键盘挡住 | P2 | Fixed | 固定链接 V10.68 | 0.2.0 (4) |

统计（2026-11-15）：P0 0 · P1 0 · P2 8 · P3 1；状态：Fixed 9，Verified 0。

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
- **Status**：Fixed（真机未验证）
- **Affected Build**：TBD（同 CAP-001，构建号未记录）
- **Target Build**：0.2.0 (4)
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
- **Verification**：
  - 自动化：`tests/v162-browser.cjs`；`tests/v164-browser.cjs` 34/34（Chromium 模拟键盘，不算 iOS 自己的平移）。
  - 模拟器：这个弹层没有用真实触摸单独测。
  - 真机：**TBD**。

<a id="cap-003"></a>
### CAP-003 · 字体编辑面板遮挡正在编辑的页面

- **Title**：修改字体时，底部面板挡住正在编辑的页面。
- **Reported Date**：2026-11-14
- **Source**：Founder
- **Severity**：P2
- **Status**：Fixed（真机未验证；Founder 后来报告「打字换字体还是会挡到」，另记为 CAP-009，见下）
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
