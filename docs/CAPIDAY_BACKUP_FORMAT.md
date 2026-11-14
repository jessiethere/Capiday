# `.capiday` 备份文件格式规范 · 1.0（草案，等确认）

> 2026-11-14。产品决策：首发使用单个 `.capiday` 文件；支持大容量媒体，可以流式或分批写入，有版本管理，可以逐项校验完整性，内容包含可以恢复的完整手帐。
> 本规范定义文件的**结构、标识、清单、校验和兼容规则**，不只是一个扩展名。实现细节见 `SPRINT1_BACKUP_RESTORE_PLAN.md`。

## 1. 设计目标

| 目标 | 做法 |
|---|---|
| 大容量 | 媒体以原始字节存放，不用 base64；支持 ZIP64，单个文件和总大小都没有 4 GB 的限制 |
| 流式写入 | 每个条目在写入时计算 CRC-32 和 SHA-256，用数据描述符记录大小，**不需要事先知道全部内容**；清单放在最后写 |
| 随机读取 | 恢复和预览时先读末尾的中央目录，再按需读取单个条目，不需要把整个文件读进内存 |
| 完整性 | 三层校验：ZIP 的 CRC-32（容器层），清单里的 SHA-256 和大小（内容层），手帐结构和引用（语义层） |
| 版本管理 | `formatVersion` 用「主版本.次版本」；有 `minReaderVersion`，以及必须理解的特性列表 `requires` |
| 可以移植 | 容器是标准 ZIP（只存储、不压缩），macOS、Windows 和浏览器（`File.slice`）都能读。所以以后在线链接、Android 或电脑端工具都可以读，不依赖 Apple 的私有格式 |

> 和上一版方案相比的变化：上一版建议用 Apple Archive。改用 ZIP 的原因是 Apple Archive 只有 Apple 平台能读，浏览器版的 Capiday 和将来别的平台都读不了。代价是要自己写一个约 300 行的「只存储 ZIP」读写器，加上测试向量，实现量可以接受。

## 2. 文件标识

- 扩展名：`.capiday`
- UTI：`com.capiday.backup`，遵从 `public.data` 和 `public.archive`（在 Info.plist 的 `UTExportedTypeDeclarations` 里声明，这样「文件」App 和文档选择器都能识别）。
- MIME：`application/vnd.capiday.backup+zip`
- **第一个条目**必须是 `mimetype`，存储方式为 STORE（不压缩），没有额外字段，内容是 ASCII 的 `application/vnd.capiday.backup+zip`（和 EPUB、OpenDocument 的做法一样）。这样只读文件开头几十个字节就能识别格式：偏移 30 处就是这个字符串。
- 容器要求：
  - 所有条目都是 STORE（方法 0）；
  - 不加密；
  - 文件名用 UTF-8（标志位 11）；
  - 写入器**可以**使用数据描述符（标志位 3）和 ZIP64 扩展；
  - 读取器**必须**支持这两者。

## 3. 目录结构

```
mimetype                       必须是第 1 个条目
header.json                    第 2 个条目：基本信息（即使文件被截断，也能看出是什么备份）
state.json                     手帐状态（和 App 里的 little-days.v1 完全相同）
media/<id>.<ext>               媒体原始字节，每个文件一个条目
manifest.json                  倒数第 2 个条目：完整清单和所有校验值
manifest.sig.json              最后一个条目（保留给以后的签名或加密；1.0 中可以不存在）
```

- 路径只能是上面这些格式。`<id>` 只允许 `[A-Za-z0-9-]{1,64}`，`<ext>` 只允许 `[a-z0-9]{1,8}`。
- 读取器必须拒绝：包含 `..`、以 `/` 开头、含有反斜杠，或者路径重复的条目（防止 zip-slip 路径攻击）。

### 3.1 `header.json`

```json
{
  "format": "capiday-backup",
  "formatVersion": "1.0",
  "backupId": "8f3c…（UUID）",
  "createdAt": "2026-11-14T21:30:05.120Z",
  "writer": { "app": "Capiday", "version": "10.65", "platform": "ios", "osMajor": 27 }
}
```

### 3.2 `manifest.json`（最后写入，校验的依据）

```json
{
  "format": "capiday-backup",
  "formatVersion": "1.0",
  "minReaderVersion": "1.0",
  "requires": [],
  "backupId": "8f3c…（必须和 header 一致）",
  "createdAt": "2026-11-14T21:30:05.120Z",
  "writer": { "app": "Capiday", "version": "10.65", "platform": "ios", "osMajor": 27 },
  "complete": true,
  "state": {
    "path": "state.json", "size": 2384120, "sha256": "…64 位十六进制…",
    "schemaVersion": 1,
    "counts": { "books": 4, "days": 128, "pages": 311, "drafts": 1, "habits": 2 }
  },
  "media": [
    {
      "id": "0b6a…", "path": "media/0b6a….jpg",
      "kind": "photo", "mime": "image/jpeg",
      "size": 284113, "sha256": "…",
      "record": { "name": "IMG_0412.jpg", "createdAt": "…", "aspect": 0.75, "edited": false }
    }
  ],
  "missing": [ { "id": "c91e…", "kind": "video", "reason": "unreadable" } ],
  "totals": { "mediaCount": 1186, "mediaBytes": 1873041122, "referencedCount": 1187 }
}
```

字段规则：
- `media[].record`：保存媒体记录里**除了字节以外的全部字段**，原样保留。读取器遇到不认识的字段要保留下来，写回媒体库，这样以后新增字段时不会在一次备份和恢复后丢失。
- `media[].size` 和 `sha256` 针对条目的原始字节；`state.sha256` 针对 `state.json` 的 UTF-8 字节。
- `complete` 只有在 `missing` 为空，**并且** `state.json` 引用的每一个 `media:<id>` 都出现在 `media[]` 里时，才能是 `true`。
- `missing[].reason` 的取值：`unreadable`、`not-found`、`size-mismatch`、`user-skipped`。
- 不包含：App 锁的密码、设置偏好、事件日志、恢复快照、救援副本。只备份手帐，不备份设备上的偏好；以后要加的话，作为 1.x 的可选条目 `prefs.json`。

## 4. 写入规则（写入器）

1. 先写 `mimetype` 和 `header.json`。
2. 写 `state.json`：在备份开始时对当时的状态做一份快照（等 `store.stored()` 返回 true 之后）。
3. 按 `state.json` 中被引用的媒体逐个写入：一个条目写完再写下一个，一边写一边计算 CRC-32 和 SHA-256。读取失败的媒体记入 `missing`，跳过这个条目，继续写下一个。
4. 写 `manifest.json`，然后写中央目录（如果需要就写 ZIP64 的结束记录）。
5. **回读校验**（第 6 节第 1–3 层）全部通过以后，这个文件才算「生成成功」。
6. 只按 `state.json` 的引用写入媒体；没有被引用的孤儿文件**不写入**（它们无法被任何页面使用）。

## 5. 读取规则（读取器）

1. 读开头：`mimetype` 必须完全一致，否则「不是 Capiday 备份」。
2. 读末尾的中央目录；没有，或者结构损坏，就判定为「文件不完整或已损坏」。
3. 读 `manifest.json`，按第 7 节判断版本是否兼容。
4. 预览只需要 `manifest.json`（和 `header.json`），不需要读取媒体。
5. 恢复前执行完整校验（第 6 节），通过以后才允许写入任何数据。

## 6. 完整性校验（分层）

| 层 | 检查内容 | 失败时 |
|---|---|---|
| 1 容器 | 每个条目的 CRC-32 和大小与中央目录一致；所有条目都是 STORE；路径合法 | 「文件已损坏」 |
| 2 内容 | 每个条目的 SHA-256 和大小与 `manifest` 一致；`backupId` 和 header 一致；`media[]` 的数量等于 `totals.mediaCount` | 「文件已损坏」，并列出出问题的条目数 |
| 3 语义 | `state.json` 能解析，`schemaVersion` 能被支持，通过 `validateStateSnapshot`；`state` 里的每个 `media:` 引用都在 `media[]` 或 `missing[]` 里；`complete` 和这些规则一致 | 「备份内容不一致」 |

只有三层全部通过，才算「完整的备份」。`complete: false` 的文件可以通过前两层，但界面上要明确写「不完整：缺少 N 个文件」。

## 7. 版本和兼容规则

- `formatVersion = 主.次`。
  - **次版本**升级（例如 1.1）只能**新增**：新的可选字段、新的可选条目。旧的 1.x 读取器忽略不认识的字段和条目，照常恢复。
  - **主版本**升级（例如 2.0）可以改变结构；1.x 读取器遇到时提示「这个备份需要更新版的 Capiday」，**不尝试读取**。
- `minReaderVersion`：写入器声明「至少需要哪个读取器版本」。读取器版本低于它时，按主版本不兼容处理。
- `requires`：读取器**必须理解**才能正确恢复的特性列表，例如以后的 `"encryption-aesgcm-1"`、`"originals"`。只要有一项不认识，就拒绝并说明原因。
- `state.schemaVersion` 独立于格式版本：格式能读，但 `schemaVersion` 比 App 支持的更高时，和现在一样提示「来自更新的版本」，**不写入**。
- 旧格式：`little-days-backup` v1 的 JSON 文件继续支持恢复，并且永远支持。

## 8. 以后的扩展（只是预留，1.0 不实现）

| 特性 | 方式 |
|---|---|
| 原图（Sprint 2） | 1.1：`media[]` 增加 `variant: "original" \| "display"`，以及原图条目的 `originalOf`；`requires` 里不放这一项，所以旧读取器只会忽略原图，仍然能恢复显示图 |
| 加密 | 2.0 或 `requires: ["encryption-aesgcm-1"]`：`manifest.sig.json` 里放密钥派生参数，其他条目是加密后的字节；`mimetype` 和 `header.json` 保持明文，用于识别 |
| 增量备份 | 1.x 可选：`baseBackupId` 加上「只包含新增媒体」，需要先有基础备份；首发不做 |
| 签名 | `manifest.sig.json` 放 manifest 的签名，用来防篡改；首发不做 |

## 9. 测试向量（实现时一起提交）

`tests/fixtures/capiday/`：
- `minimal-1.0.capiday`：1 天、1 页、1 张照片；
- `incomplete-1.0.capiday`：`complete: false`，带 1 个 missing；
- `zip64-1.0.capiday`：用合成数据让偏移超过 4 GB，只在 CI 生成，不提交到仓库；
- `future-1.9.capiday`：带有不认识的字段和条目，必须能恢复；
- `future-2.0.capiday`：必须拒绝；
- 以及各种损坏样例：截断、改一个字节、路径含 `..`、条目重复、CRC 错误、SHA 错误。

Swift 和 JS 两个读写器都要用**同一组**测试向量做测试，保证双方生成的文件可以互相读取。

## 10. 需要确认

1. 同意用 ZIP（只存储）作为容器（推荐，原因见第 1 节），代替上一版提到的 Apple Archive。
2. 备份里不包含设备偏好（主题、语言、提醒、App 锁），只备份手帐。
