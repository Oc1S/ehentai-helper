# E-Hentai Helper 设计系统

> **Design Read：** Chrome 扩展工具 UI，Mono + Emerald 暗色精密工具语言，基于 `tokens.css` + Tailwind + NextUI。

## 0. 设计定位

### 0.1 产品形态

本项目是 **浏览器扩展工具界面**（Popup 800×600、Options 全页、内容脚本浮层），不是营销落地页。设计目标：

- **高密度信息展示**：下载进度、历史记录、设置表单在同一视口内可操作
- **暗色常驻**：扩展 Popup 无系统主题切换，固定暗色 `color-scheme: dark`
- **品牌识别**：近黑碳底 + emerald 祖母绿强调，区别于通用 SaaS 蓝紫渐变

### 0.2 三档拨盘（Dial）

| 拨盘 | 值 | 含义 |
|------|-----|------|
| `DESIGN_VARIANCE` | **3** | 对称网格、左对齐标签、可预测布局 |
| `MOTION_INTENSITY` | **3** | 仅 hover / active / 进度条过渡；无滚动动画 |
| `VISUAL_DENSITY` | **8** | 紧凑间距、表格行高 32px、信息优先于留白 |

### 0.3 美学关键词

`Mono Emerald` · 暗碳底 · 祖母绿点缀 · 克制玻璃质感 · 工具精密感 · 单强调色

**明确不做：** 蓝紫渐变、居中 Hero、三栏等宽功能卡、营销式 eyebrow 堆砌、装饰性滚动提示、假数据仪表盘。

---

## 1. Token 来源与使用规则

### 1.1 唯一真相源

```
src/styles/tokens.css   ← 所有颜色、阴影、玻璃、布局尺寸的定义
src/styles/index.css    ← 组件 class（glass-*、settings-*、eh-*-btn）
tailwind.config.js      ← 将 token 映射为 Tailwind 语义色；NextUI 构建期色值须与 token 同步
```

**硬性约束：**

1. 组件与页面 **禁止内联 hex**（`#34d399` 等），一律使用 `var(--eh-*)` 或 Tailwind 语义类（`text-brand-accent`、`bg-surface-card`）
2. 新增颜色 **只加在 `tokens.css`**，再在 `tailwind.config.js` 的 `theme.extend.colors` 中暴露
3. NextUI 主题色在构建期写入，**必须与 `tokens.css` 主色一致**；改 token 时同步改 `tailwind.config.js` 的 `nextui({ themes: { dark: ... } })`
4. 禁止引入第二套并行色板（如 `primaryBlue`、Cal.com 遗留命名）

### 1.2 语义色板

#### 画布与文字

| Token | CSS 变量 | Hex | Tailwind | 用途 |
|-------|----------|-----|----------|------|
| Canvas | `--eh-canvas` | `#09090b` | `bg-canvas` | 页面底色 |
| Ink | `--eh-ink` | `#fafafa` | `text-ink` | 标题、主文字 |
| Body | `--eh-body` | `#e4e4e7` | `text-body` | 正文、表单值 |
| Muted | `--eh-muted` | `#a1a1aa` | `text-muted` | 次要说明 |
| Muted Soft | `--eh-muted-soft` | `#71717a` | `text-muted-soft` | 占位符、表头、辅助标注 |

#### 表面层级

| Token | Hex | Tailwind | 用途 |
|-------|-----|----------|------|
| Surface Soft | `#141414` | `bg-surface-soft` | 输入框底、次要区块 |
| Surface Card | `#18181b` | `bg-surface-card` | 卡片、Toast、Modal |
| Surface Strong | `#27272a` | `bg-surface-strong` | 强调区块、禁用底 |
| Surface Dark | `#050505` | `bg-surface-dark` | Options 顶栏、最深底 |

#### 品牌与操作

| Token | Hex | Tailwind | 用途 |
|-------|-----|----------|------|
| Brand Accent | `#34d399` | `text-brand-accent` / `bg-brand-accent` | 强调数字、链接、图标高亮 |
| Brand Accent Bright | `#6ee7b7` | — | 主按钮文字、强高亮 |
| Primary | `#059669` | `bg-primary` | NextUI 主按钮、Progress |
| Primary Hover | `#047857` | — | 按钮按压 |
| Primary FG | `#ecfdf5` | `text-primary-foreground` | emerald 按钮上的文字 |
| On Primary | `#ecfdf5` | `text-on-primary` | 深色按钮上的文字 |

主色阶 `--eh-primary-50` … `--eh-primary-900` 供 NextUI `color="primary"` 梯度使用。

#### 描边与阴影

| Token | 值 | 用途 |
|-------|-----|------|
| `--eh-hairline` | `rgba(250,250,250,0.08)` | 分区线、表格边框 |
| `--eh-hairline-soft` | `rgba(250,250,250,0.04)` | 弱分隔 |
| `--eh-shadow-card` | `0 1px 3px rgba(0,0,0,0.4)` | 卡片 |
| `--eh-shadow-card-elevated` | `0 8px 28px rgba(0,0,0,0.55)` | 浮层 |
| `--eh-glow` | emerald 细描边 + 深阴影 | 聚焦强调（慎用） |

#### 语义状态

| 状态 | Hex | Tailwind |
|------|-----|----------|
| Success | `#4ade80` | `text-success` |
| Warning | `#f59e0b` | `text-warning` |
| Error | `#ef4444` | `text-error` |
| Section Label | `#34d399` | 设置区小标题（Options） |

#### 玻璃质感（Popup 专用）

| Token | 用途 |
|-------|------|
| `--eh-glass-bg` / `--eh-glass-bg-hover` | 面板半透明底 |
| `--eh-glass-border` / `--eh-glass-border-hover` | 玻璃描边（冷灰青调，避免与 emerald 主光抢焦点） |
| `--eh-glass-elevation` / `--eh-glass-elevation-hover` | 内高光 + 外阴影组合 |
| `--eh-glass-bg-pool` / `--eh-glass-border-pool` | StatusCard 等信息池变体 |
| `--eh-popup-bg` + `--eh-popup-ambient-*` | Popup 全局背景渐变 |

> **玻璃 vs 平面：** Popup 固定视口、展示为主 → 可用 `glass-panel` / `glass-card`。Options 长滚动、表单密集 → 用 `surface-card` + `hairline` 平面风格，避免大面积 `backdrop-blur` 影响性能与对比度。

### 1.3 圆角尺度（Shape Lock）

统一使用 **`eh-*` 前缀**（迁移中 `cal-*` 视为废弃别名）。

| Token | 值 | 用途 |
|-------|-----|------|
| `eh-xs` | 4px | 极小徽标 |
| `eh-sm` | 6px | 下拉项 |
| `eh-md` | 8px | 按钮、输入框、表格容器 |
| `eh-lg` | 12px | 设置面板、表格外框 |
| `eh-xl` | 16px | 大卡片 |
| `eh-2xl` | 20px | 结果摘要卡（DownloadResultSummary） |
| `eh-3xl` | 24px | StatusCard 独立态 |
| `full` | 9999px | 徽章、进度条、头像 |

**规则：** 同层组件圆角一致；禁止在同一页面混用 `rounded-2xl` 与任意 `rounded-[20px]` 表达同一层级。

### 1.4 间距

| Token | 值 | 用途 |
|-------|-----|------|
| Base unit | 4px | 所有间距为 4 的倍数 |
| Popup gutter | 16–20px | 内容区内边距 |
| Settings row gap | 8px（modal）/ 20px（page） | 标签与控件 |
| Options gutter | `24px` (`--options-gutter`) | Options 页水平内边距 |
| Options header | `56px` (`--options-header-h`) | 顶栏高度 |
| Options max-width | `800px` (`--options-content-w`) | 内容区上限 |

### 1.5 字体

| 角色 | 字体 | 用途 |
|------|------|------|
| UI Sans | Inter 400–600 | 全局界面 |
| Mono | Roboto Mono | 页码范围、路径、数字对齐 `tabular-nums` |

**层级：**

| 样式 | 规格 | 场景 |
|------|------|------|
| Display | 24–28px / 600 / tracking-tight | 进度百分比 |
| Title | 15–18px / 600 | 卡片标题、Options h1 |
| Body | 12–14px / 400 | 正文、表单 |
| Caption | 11px / 500 | 状态标签 |
| Section Label | 11px / 600 / uppercase / tracking-[0.06em] | Options 分区标题（每页 ≤3 处） |
| Micro Label | 11px / 500 / uppercase / tracking-wide | 进度区字段名（成对出现，非装饰 eyebrow） |

数字与进度一律 `font-variant-numeric: tabular-nums`。

### 1.6 Z-Index 尺度

| 层 | 值 | 用途 |
|----|-----|------|
| Base | 0 | 内容 |
| Sticky | 10 | Options header、表头 |
| Overlay | 40 | Modal、Dropdown |
| Toast | 50 | Sonner |

禁止随意 `z-50` 堆叠；新层须在此表登记。

---

## 2. 组件契约

### 2.1 表面模式

| Class | 场景 | 特征 |
|-------|------|------|
| `popup-bg` | Popup 根容器 | emerald 径向光 + 深碳渐变 |
| `glass-panel` | 可交互面板（含 hover 抬升） | blur + 冷色描边 + 环境光斑 |
| `glass-card` / `glass-card-static` | 信息卡（StatusCard） | 无 hover 或静态高亮 |
| `glass-card-pool` | 状态池变体 | 青调玻璃，配语义 ambient |
| `settings-panel--page` | Options 设置区 | `surface-card` + `hairline`，无 blur |
| `EhTableFrame` | 历史/下载表格 | 半透明底 + 细滚动条 |

### 2.2 按钮（EhButton）

全项目统一使用 `EhButton`，禁止直接使用 NextUI `Button`（`EhButton` 内部封装）。

| appearance | 用途 | 示例 |
|------------|------|------|
| `primary` | 每屏唯一主 CTA，半透明 emerald 底 + 亮 emerald 字 | 开始下载、保存、重试失败 |
| `accent` | 次要正向，更淡半透明描边 | 继续缺失、单条重试、外链 |
| `secondary` | 中性操作 | 查看详情、打开文件夹、关闭 |
| `danger` | 破坏性 | 取消下载、删除、清空 |
| `ghost` | 最低调 | 取消、返回、表格轻操作 |
| `link` | 文字链 | 默认文件夹 |
| `icon` | 仅图标 | 设置齿轮 |

| ehSize | 高度 | 场景 |
|--------|------|------|
| `xs` | 24px | 表格行内、标签区小按钮 |
| `sm` | 32px | Modal 底栏、次要行内 |
| `md` | 40px | Popup 底栏默认 |
| `lg` | 48px | 主下载 CTA |

`fullWidth` 用于底栏主按钮拉满。CSS 类前缀 `eh-btn--*`（`src/styles/index.css`）。

**交互：** `:active` 使用 `scale(0.98)`；过渡 150–200ms；`prefers-reduced-motion: reduce` 时去掉 transform。

### 2.3 表单（Settings）

- 标签在输入框 **上方或左侧**（page 变体左 200px 固定宽）
- 占位符颜色 `muted-soft`，聚焦边框 `brand-accent/35`
- 错误用 Sonner toast，不用 inline 红字堆砌
- Modal 与 Page 共用 `Settings` 组件，通过 `variant="modal" | "page"` 区分密度

### 2.4 表格（EhTable）

- 表头：`11px` uppercase `muted-soft`，sticky，`surface` 半透明底
- 行 hover：`brand-accent/4%` emerald 低透明底
- 空状态：`py-10 text-muted-soft`

### 2.5 状态卡（StatusCard）

- `embedded`：横向紧凑，用于 Popup 内嵌提示
- 默认：居中图标 + 标题，最大宽 400px
- 变体色通过 ambient 光斑区分，图标容器统一 `iconGlass`

### 2.6 Toast（Sonner）

- `theme="dark"`，背景 `surface-card`，边框 `hairline`
- 位置 Popup 内 `bottom-right`，offset 避开底栏

### 2.7 图标

- 库：**lucide-react**（项目已依赖，保持单一图标族）
- 全局 `strokeWidth={1.5}`（或 2.0，选定后全项目统一）
- 禁止手写 SVG 路径（`src/popup/components/icons.tsx` 存量逐步迁入 lucide）

---

## 3. 页面规范

### 3.1 Popup（800×600）

```
┌─────────────────────────────────────┐
│ Header: 画廊名 + Tab（信息/历史）    │  48px
├─────────────────────────────────────┤
│                                     │
│  Main: StatusCard / 进度 / 设置      │  480px 可滚动
│                                     │
├─────────────────────────────────────┤
│ Footer: 主 CTA + 次要操作            │  72px
└─────────────────────────────────────┘
```

- 主内容区 `scrollbar-glass`
- 下载中显示 `DownloadProgress`；结束后 `DownloadResultSummary`
- 底栏主按钮唯一（开始下载 / 重试 / 打开文件夹），不重复同意图 CTA

### 3.2 Options（全页）

- 顶栏 sticky `surface-dark` + 底部分割线
- 主内容 `settings-section-title` 分区，每区一组 `settings-row--page`
- 保存按钮仅在 header，不在底部重复

### 3.3 主题锁

- 全项目 **暗色单主题**，不做 light mode 段落穿插
- `html { @apply dark }` 固定；NextUI `defaultTheme: 'dark'`

---

## 4. 工程约束（开发必读）

### 4.1 样式

- [ ] 禁止蓝紫色渐变（含 `primaryBlue` 色板，待删除）
- [ ] 禁止内联 hex；CI/审查时 grep `#[0-9a-fA-F]{6}` 于 `src/**/*.tsx`
- [ ] 圆角只用 `eh-*` scale 或 Tailwind 等价物，清理 `cal-*` 与魔法数 `rounded-[20px]`
- [ ] 玻璃效果不用于 Options 长列表区域
- [ ] 阴影带背景色相，不用纯黑 `rgba(0,0,0,1)`

### 4.2 动效

- [ ] 只动画 `transform` 与 `opacity`
- [ ] `MOTION_INTENSITY ≤ 3`：禁止无限循环环境光动画（`glass-ambient-pulse` 仅用于「下载中」且需 reduced-motion 降级）
- [ ] 禁止 `window.addEventListener('scroll')` 驱动 React state

### 4.3 React

- [ ] 禁止使用 `useCallback`（除非有充分理由并注释说明）
- [ ] 动画相关用 framer-motion（存量）或 CSS transition，不用 scroll 监听写 state

### 4.4 文案

- [ ] 禁止 em dash（`—`）作装饰；范围用 hyphen（`1-10`）
- [ ] 中间点 `·` 每行最多 1 个
- [ ] i18n：可见文案走 `t()`，不硬编码

### 4.5 无障碍

- [ ] 正文对比度 WCAG AA（`body` on `canvas` ≥ 4.5:1）
- [ ] emerald 按钮文字使用 `primary-foreground`，禁止低对比文字 on 高亮 emerald
- [ ] 图标按钮最小触控 36×36（Popup 密集区可接受，但主 CTA ≥ 40px）
- [ ] Progress 带 `aria-label`

---

## 5. 彻底优化方案（分阶段）

### Phase 1 — 地基清理 ✅

| 任务 | 状态 |
|------|------|
| 删除 `primaryBlue` | 已完成 |
| `cal-*` → `eh-*` | 已完成 |
| 统一魔法圆角 | 已完成 |

### Phase 2 — Token 与双轨统一 ✅

| 任务 | 状态 |
|------|------|
| NextUI 同步注释块 | 已写入 `tokens.css` 头部 |
| 玻璃色温决策 | 通用 panel emerald 环境光；信息池保留冷青 |
| 字体自托管 | `@fontsource/inter` + `@fontsource/roboto-mono` |

### Phase 3 — 组件提炼 ✅

| 任务 | 状态 |
|------|------|
| `EhButton` | `src/components/eh-button.tsx`（`appearance` 属性） |
| `EhSectionLabel` | `src/components/eh-section-label.tsx` |
| `EhProgress` | `EhProgressBar` / `EhDownloadProgressPanel` / `EhDownloadResultProgress` |
| 图标迁移 | Popup 改用 lucide，删除 `popup/components/icons.tsx` |

### Phase 4 — 密度与一致性打磨 ✅

| 任务 | 状态 |
|------|------|
| `--popup-footer-h` token | 已加入 `tokens.css` |
| Options / Popup 输入框 | 统一 `eh-text-input--page` / `--modal` |
| 表格行高 | `td` 统一 `py-2` |
| StatusCard 标题 | standalone `text-xl` → `text-lg` |

### Phase 5 — 动效与 a11y 验收 ✅

| 任务 | 状态 |
|------|------|
| `prefers-reduced-motion` | 按钮 scale、玻璃脉冲、GitHub 链接图标 |
| 文案 em dash 清理 | UI 可见文案改为 hyphen |
| 表单 label | 下载路径输入增加 `aria-label` |

---

## 6. 交付前检查（Product UI 版）

- [ ] 所有颜色来自 `tokens.css` 或 Tailwind 语义类
- [ ] 无蓝紫渐变、无 `primaryBlue`、无 Cal.com 遗留命名
- [ ] 圆角符合 Shape Lock 表
- [ ] Popup 与 Options 按钮样式同源
- [ ] 主 CTA 每屏唯一意图
- [ ] 数字 tabular-nums
- [ ] 无 em dash 装饰文案
- [ ] reduced-motion 已处理动态装饰
- [ ] 新文案已加入 `assets/_locales`

---

## 7. 文件索引

| 文件 | 职责 |
|------|------|
| `src/styles/tokens.css` | 颜色与效果 token 定义 |
| `src/styles/index.css` | 全局 base + 组件 class + 工具 class |
| `src/styles/popup.css` | Popup 视口尺寸锁 |
| `src/styles/options.css` | Options 布局与 page 设置变体 |
| `tailwind.config.js` | Tailwind 映射 + NextUI 主题 |
| `src/app.tsx` | NextUIProvider + Toaster 主题 |
| `src/components/eh-table.tsx` | 表格样式契约 |
| `src/components/status-card.tsx` | 状态卡变体 |
| `src/components/settings.tsx` | 设置表单共享组件 |

---

## 8. 已知差距（Known Gaps）

- NextUI 色值与 CSS 变量 **手动双写**，暂无构建期自动同步
- Popup 玻璃体系保留 **冷青信息池** 与 emerald 主光并存；新增状态卡需避免再引入第三种环境光
- Inter 为功能字体，非品牌 display；后续可考虑 **DM Sans** 或 **Geist** 仅用于标题
- `framer-motion` 已安装但使用有限；新动效优先 CSS，避免扩 bundle
- 内容脚本注入 UI 未纳入本规范，需单独审计
