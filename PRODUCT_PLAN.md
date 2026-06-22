# E-Hentai Helper 产品优化计划

> 基于当前实现（v0.0.1）的产品审查结论整理。  
> 目标：从「popup 内的一次性下载启动器」演进为「可靠的 E-Hentai 下载助手」。

---

## 1. 现状摘要

### 1.1 产品定位（对外）

README 承诺的能力：

- 一键下载整个 Gallery，不消耗 credit/GP，无需登录
- 自由选择下载范围
- 提取并保存画廊信息与 tag
- 可配置命名规则、格式转换
- 实时监控进度，失败可重试

### 1.2 实际架构

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| Popup | 页面检测、UI、**完整下载编排**（分页请求、图片页解析、触发 download） | `src/popup/index.tsx` |
| Background | 文件名规则、download 索引、gallery 记录同步 | `src/background.ts` |
| Options / Settings Modal | 配置管理 | `src/options/options-page.tsx`、`src/components/download-settings.tsx` |
| Storage | 配置、历史、gallery 记录、download 映射 | `src/storage/*` |

**核心矛盾**：下载引擎绑在 Popup 生命周期上；Background 只做落盘后的「管家」，不做抓取编排。

### 1.3 相对亮点

- Background 下载监听有过滤、防抖、owner map，结构清晰
- `gallery-records` 持久化模型为续传、审计打了底子
- Popup UI（范围选择、信息卡、三 Tab）比典型脚本扩展更完整
- 文件名规则、格式转换、冲突策略等配置项方向正确

---

## 2. 问题清单（按严重程度）

### P0 — 阻断核心体验

| # | 问题 | 用户影响 | 代码证据 |
|---|------|----------|----------|
| P0-1 | **下载任务绑在 Popup** | 用户关闭 popup 后不再抓新页/新图，任务半途中断 | 全部编排逻辑在 `src/popup/index.tsx` 的 `downloadJob` |
| P0-2 | **成功/失败状态机不完整** | 部分失败时永远卡在 Downloading；无法进入明确的 Failed / Partial 终态 | 成功判定仅比较 `complete` 数量（`popup/index.tsx` L226–234） |
| P0-3 | **范围下载仍扫描全部分页** | 只下前 20 张时，500 页画廊仍会空转等待 | `downloadAllImages` interval 扫到 `numPages`（L211–222），`processGalleryPage` 虽会 skip 但 clock 照跑 |
| P0-4 | **静默失败** | axios / download 失败无 toast、无 record 标记，用户不知哪里出错 | `axios.get`、`chrome.downloads.download` 回调中大量 `return` / `console.*` |

### P1 — 与 README 承诺不符

| # | 问题 | 用户影响 | 代码证据 |
|---|------|----------|----------|
| P1-1 | **断点续传只有展示** | 「Previously tracked」无法一键续下缺失图片 | popup Info 页展示文案，无续传 CTA |
| P1-2 | **重试能力割裂** | README 写「失败可重试」，实际仅 Downloads 表单条 Restart | `src/components/Table.tsx` |
| P1-3 | **每次下载清空全局跟踪** | 新任务 `clear-download-index-map`，Downloads Tab 与历史对不上 | `handleClickDownload` → background message |

### P2 — UX 与信任

| # | 问题 | 用户影响 |
|---|------|----------|
| P2-1 | 错误文案不准确 | HTML 解析失败显示「Connection Failed」（`StatusEnum.Fail`） |
| P2-2 | 三 Tab 关系未解释 | Info / Downloads / History 心智负担高 |
| P2-3 | 下载中无全局控制 | Info 页无暂停/取消/重试整批；控制藏在 Downloads Tab |
| P2-4 | 设置双入口 | Popup Modal 与 Options 页行为一致但交互不同（即时保存 vs 点 Save） |
| P2-5 | 路径难预测 | 运行时追加画廊名到 `intermediateDownloadPath`，与设置页展示不一致 |
| P2-6 | Clear All 无确认 | History 一键清空 history + gallery records |
| P2-7 | Downloads 表显示 download id | 对终端用户无意义 |
| P2-8 | 权限说明不足 | `host_permissions: https://*/*` 极宽，README 未向用户解释用途 |
| P2-9 | i18n 空心 | README 有中文，UI 全英文，`_locales` 几乎空壳 |

### P3 — 功能缺口（竞品常见）

| # | 缺口 | 说明 |
|---|------|------|
| P3-1 | 打包 CBZ/PDF | 当前仅逐张落盘 |
| P3-2 | 可读元数据文件 | `saveGalleryInfo` 输出 JSON，非人类可读的 info.txt |
| P3-3 | 原图解析脆弱 | `saveOriginalImages` 依赖 `#i6` DOM 结构，站点改版即碎 |
| P3-4 | 配置导入/导出 | Options 页缺失 |
| P3-5 | 存储上限无感知 | history 200 条 / gallery 100 个，用户不可见 |

---

## 3. 优化目标

### 3.1 北极星指标

- **任务完成率**：用户发起下载后，在关闭 popup 的情况下仍能完成的比例
- **可恢复率**：失败或中断后，用户能在 3 步内续传/重试成功
- **诚实进度**：进度展示包含成功 / 失败 / 跳过，终态明确

### 3.2 非目标（本阶段不做）

- 完整 CBZ/PDF 打包（可放 Phase 4）
- 多画廊并行下载
- 完整多语言（可先中英双语）

---

## 4. 分阶段实施计划

### Phase 1 — 可靠性基础（最高优先级）

**目标**：关 popup 也能下完；进度和终态诚实；范围下载不再空转。

#### 1.1 下载编排迁出 Popup

- [ ] 新建 `src/download/` 或 `src/background/download-job.ts`，将 `downloadJob` 逻辑迁入 Background / Offscreen Document
- [ ] Popup 仅负责：发起任务、订阅进度、展示 UI
- [ ] 任务状态持久化（进行中 / 暂停 / 完成 / 部分失败 / 失败）
- [ ] Popup 重开时从 storage 恢复任务视图

**验收标准**：

- 关闭 popup 后，任务继续执行直至完成或明确失败
- 重开 popup 可看到当前任务进度

#### 1.2 修复状态机

- [ ] 定义终态：`Downloading` → `Success` | `PartialSuccess` | `Failed`
- [ ] 进度计数：`complete` + `failed` + `skipped` = `total`
- [ ] 失败路径写入 `gallery-records`（含 error 原因）
- [ ] UI 展示：「18/20 成功，2 失败」+ 重试失败项

**涉及文件**：

- `src/popup/index.tsx`
- `src/popup/status.ts`
- `src/storage/gallery-records.ts`
- `src/components/gallery-detail-modal.tsx`

#### 1.3 修复范围下载调度

- [ ] `downloadAllImages` 的 interval 只遍历 `[start.page, end.page]`
- [ ] interval 间隔基于**实际需下载页数**，而非 `numPages`
- [ ] 单页内图片 interval 同理，跳过范围外 index

**验收标准**：

- 500 页画廊只下第 1 页 20 张，调度在合理时间内结束，无长时间空转

#### 1.4 错误反馈

- [ ] axios / download / 格式转换失败 → toast + gallery record
- [ ] 区分错误类型：网络、解析、权限、限流
- [ ] 修正 `StatusEnum.Fail` 文案（非网络问题不用 Connection Failed）

---

### Phase 2 — 续传与重试（兑现 README）

**目标**：让用户能「接着下」和「重试失败的」。

#### 2.1 断点续传

- [ ] 「Previously tracked」改为可点击 CTA：「继续下载缺失的 N 张」
- [ ] 对比 gallery record 与目标 range，计算缺失 index 列表
- [ ] 续传任务复用 Phase 1 后台编排

#### 2.2 统一重试入口

- [ ] Gallery Detail Modal：单张重试 + 批量重试失败项
- [ ] History 行操作：「重新下载此范围」
- [ ] Downloads Tab Restart 与上述逻辑共用同一 retry API

#### 2.3 下载上下文生命周期

- [ ] 评估是否取消每次下载前的 `clear-download-index-map`
- [ ] 改为按任务 ID 隔离，或仅清理已完成任务的映射
- [ ] Downloads Tab 与 History 可关联到同一任务

---

### Phase 3 — UX 打磨

**目标**：降低认知负担，提升操作安全感。

#### 3.1 信息架构

- [ ] 首次使用引导（必须在画廊页打开）
- [ ] 三 Tab 增加简短说明或 onboarding tooltip
- [ ] Downloads 表隐藏 download id，改为序号 / 文件名

#### 3.2 设置体验

- [ ] 合并 Popup Settings 与 Options 的保存交互（或明确标注差异）
- [ ] 设置页展示「最终路径预览」：`[Default]/folder/GalleryName/`
- [ ] `downloadInterval` 校验（禁止 NaN / 0），提供慢/标准/快预设
- [ ] Clear All 增加二次确认

#### 3.3 下载中控制

- [ ] Info 页增加：暂停、取消、重试失败
- [ ] 取消时清理 in-progress 状态，保留已完成文件

#### 3.4 国际化

- [ ] 补全 `_locales`（至少 en + zh_CN）
- [ ] 状态文案、设置项、错误提示统一走 i18n

---

### Phase 4 — 功能扩展（可选）

- [ ] CBZ 打包（下载完成后可选）
- [ ] 人类可读的 gallery info.txt（tags、作者、分类）
- [ ] 配置导入/导出
- [ ] 存储上限提示与清理建议
- [ ] 原图解析增加 fallback / 站点结构变更检测

---

## 5. 建议实施顺序（单线程）

```
Phase 1.3 范围调度修复     ← 改动小、收益立竿见影
    ↓
Phase 1.2 状态机 + 1.4 错误反馈
    ↓
Phase 1.1 编排迁出 Popup   ← 最大架构改动，但解锁后续一切
    ↓
Phase 2 续传与重试
    ↓
Phase 3 UX 打磨
    ↓
Phase 4 功能扩展
```

**若资源极度有限，最小可用闭环**：

1. Phase 1.3 + 1.2 + 1.4（1–2 周量级）
2. Phase 1.1（架构，2–3 周量级）
3. Phase 2.1 断点续传（1 周量级）

---

## 6. 关键文件索引

| 领域 | 文件 |
|------|------|
| 下载编排 | `src/popup/index.tsx` |
| 状态枚举 | `src/popup/status.ts` |
| Background | `src/background.ts` |
| Gallery 记录 | `src/storage/gallery-records.ts` |
| Download 映射 | `src/storage/download-index-map.ts` |
| 历史 | `src/storage/download-history.ts`、`src/components/download-history.tsx` |
| Downloads 管理 | `src/components/Table.tsx` |
| 详情 Modal | `src/components/gallery-detail-modal.tsx` |
| 设置 | `src/components/settings.tsx`、`src/options/options-page.tsx` |
| 页面解析 | `src/utils/extractor.ts` |
| Tab 抓取 | `src/utils/browser.ts` |

---

## 7. 验收清单（发布前自检）

- [ ] 关闭 popup 后任务仍能完成
- [ ] 部分失败时显示 Partial Success，而非无限 Downloading
- [ ] 范围下载无空转等待
- [ ] 失败项可在 UI 中重试
- [ ] Previously tracked 可一键续传
- [ ] 错误文案与真实原因一致
- [ ] Clear All 有确认
- [ ] README 承诺与实现一致

---

## 8. 风险与依赖

| 风险 | 缓解 |
|------|------|
| Background Service Worker 被 Chrome 回收 | 任务状态持久化 + 唤醒恢复；必要时 Offscreen Document |
| EH 站点 DOM / 限流变更 | 抓取逻辑抽象 + 错误分类 + 可调 interval |
| 大图格式转换 OOM | 转换失败明确提示；可选关闭或限制并发 |

---

*文档版本：2025-06-22 · 对应代码库 v0.0.1*
