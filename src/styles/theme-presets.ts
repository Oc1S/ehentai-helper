export type ThemePreset = {
  id: string;
  name: string;
  tagline: string;
  /** 与暖色暗底 canvas #0c0a09 / surface #292524 的融合度 */
  harmony: 'high' | 'medium' | 'low';
  brand: {
    accent: string;
    primary: string;
    'primary-active': string;
  };
  on: {
    primary: string;
  };
  primary: {
    DEFAULT: string;
    foreground: string;
  };
  glow: string;
};

const SURFACE_STRONG = '#44403c';

/** 共享暖色暗底，仅 accent / 按钮色不同 */
export const themePresets: ThemePreset[] = [
  // ── 幽林暗绿系 (Deep Forest Variants) ──
  {
    id: 'forest-pine',
    name: 'Forest Pine 松叶绿',
    tagline: '经典的深松绿色，沉静幽深',
    harmony: 'high',
    brand: {
      accent: '#10b981',
      primary: '#065f46',
      'primary-active': '#047857',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#065f46', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(16, 185, 129, 0.2), 0 4px 16px rgba(6, 95, 70, 0.25)',
  },
  {
    id: 'forest-moss',
    name: 'Forest Moss 苔藓绿',
    tagline: '带有泥土气息的暗灰绿',
    harmony: 'high',
    brand: {
      accent: '#86efac',
      primary: '#274029',
      'primary-active': '#1b2f1c',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#274029', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(134, 239, 172, 0.2), 0 4px 16px rgba(39, 64, 41, 0.25)',
  },
  {
    id: 'forest-teal',
    name: 'Forest Teal 深海青',
    tagline: '偏向青蓝的深邃海原色',
    harmony: 'high',
    brand: {
      accent: '#2dd4bf',
      primary: '#0f766e',
      'primary-active': '#115e59',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#0f766e', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(45, 212, 191, 0.2), 0 4px 16px rgba(15, 118, 110, 0.25)',
  },
  {
    id: 'forest-night',
    name: 'Forest Night 暗林绿',
    tagline: '接近黑色的极深绿色，最低调的幽林',
    harmony: 'high',
    brand: {
      accent: '#059669',
      primary: '#022c22',
      'primary-active': '#064e3b',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#022c22', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(5, 150, 105, 0.2), 0 4px 16px rgba(2, 44, 34, 0.25)',
  },
  {
    id: 'forest-emerald',
    name: 'Forest Emerald 幽翠',
    tagline: '比松叶更翠绿的深宝石绿',
    harmony: 'high',
    brand: {
      accent: '#34d399',
      primary: '#047857',
      'primary-active': '#059669',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#047857', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(52, 211, 153, 0.2), 0 4px 16px rgba(4, 120, 87, 0.25)',
  },
  {
    id: 'forest-kelp',
    name: 'Forest Kelp 海藻绿',
    tagline: '暖调更足的深暗墨绿',
    harmony: 'high',
    brand: {
      accent: '#4ade80',
      primary: '#14532d',
      'primary-active': '#166534',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#14532d', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(74, 222, 128, 0.2), 0 4px 16px rgba(20, 83, 45, 0.25)',
  },
  // ── 柔和淡彩系 (Pastel for Dark Mode) ──
  {
    id: 'pastel-blue',
    name: 'Pastel Blue 淡蓝',
    tagline: '极其温柔的淡蓝色，清新护眼',
    harmony: 'high',
    brand: {
      accent: '#bae6fd',
      primary: '#7dd3fc',
      'primary-active': '#38bdf8',
    },
    on: { primary: '#0f172a' },
    primary: { DEFAULT: '#7dd3fc', foreground: '#0f172a' },
    glow: '0 0 0 1px rgba(125, 211, 252, 0.4), 0 4px 16px rgba(125, 211, 252, 0.2)',
  },
  {
    id: 'pastel-mint',
    name: 'Pastel Mint 薄荷',
    tagline: '清凉的薄荷淡绿，舒适自然',
    harmony: 'high',
    brand: {
      accent: '#a7f3d0',
      primary: '#6ee7b7',
      'primary-active': '#34d399',
    },
    on: { primary: '#064e3b' },
    primary: { DEFAULT: '#6ee7b7', foreground: '#064e3b' },
    glow: '0 0 0 1px rgba(110, 231, 183, 0.4), 0 4px 16px rgba(110, 231, 183, 0.2)',
  },
  {
    id: 'pastel-rose',
    name: 'Pastel Rose 柔粉',
    tagline: '降低攻击性的柔和淡粉色',
    harmony: 'high',
    brand: {
      accent: '#fecdd3',
      primary: '#fda4af',
      'primary-active': '#fb7185',
    },
    on: { primary: '#4c0519' },
    primary: { DEFAULT: '#fda4af', foreground: '#4c0519' },
    glow: '0 0 0 1px rgba(253, 164, 175, 0.4), 0 4px 16px rgba(253, 164, 175, 0.2)',
  },
  {
    id: 'pastel-peach',
    name: 'Pastel Peach 蜜桃',
    tagline: '暖暖的淡橘色，温馨而不刺眼',
    harmony: 'high',
    brand: {
      accent: '#fed7aa',
      primary: '#fdba74',
      'primary-active': '#fb923c',
    },
    on: { primary: '#431407' },
    primary: { DEFAULT: '#fdba74', foreground: '#431407' },
    glow: '0 0 0 1px rgba(253, 186, 116, 0.4), 0 4px 16px rgba(253, 186, 116, 0.2)',
  },
  {
    id: 'pastel-pearl',
    name: 'Pastel Pearl 珍珠',
    tagline: '高级的浅银灰色，极度克制',
    harmony: 'high',
    brand: {
      accent: '#e2e8f0',
      primary: '#cbd5e1',
      'primary-active': '#94a3b8',
    },
    on: { primary: '#0f172a' },
    primary: { DEFAULT: '#cbd5e1', foreground: '#0f172a' },
    glow: '0 0 0 1px rgba(203, 213, 225, 0.4), 0 4px 16px rgba(203, 213, 225, 0.2)',
  },
  {
    id: 'pastel-sage',
    name: 'Pastel Sage 淡鼠尾草',
    tagline: '带灰调的淡绿，比薄荷更克制，接近珍珠的灰度',
    harmony: 'high',
    brand: {
      accent: '#cce0d1',
      primary: '#b2ccb9',
      'primary-active': '#99b8a1',
    },
    on: { primary: '#182b1d' },
    primary: { DEFAULT: '#b2ccb9', foreground: '#182b1d' },
    glow: '0 0 0 1px rgba(178, 204, 185, 0.4), 0 4px 16px rgba(178, 204, 185, 0.2)',
  },
  {
    id: 'pastel-foam',
    name: 'Pastel Foam 海沫青',
    tagline: '极淡的青色，像海水泡沫一样轻盈通透',
    harmony: 'high',
    brand: {
      accent: '#ccfbf1',
      primary: '#99f6e4',
      'primary-active': '#5eead4',
    },
    on: { primary: '#042f2e' },
    primary: { DEFAULT: '#99f6e4', foreground: '#042f2e' },
    glow: '0 0 0 1px rgba(153, 246, 228, 0.4), 0 4px 16px rgba(153, 246, 228, 0.2)',
  },
  {
    id: 'pastel-alabaster',
    name: 'Pastel Alabaster 雪花白',
    tagline: '带有一丝暖意的灰白，另一种珍珠质感',
    harmony: 'high',
    brand: {
      accent: '#e7e5e4',
      primary: '#d6d3d1',
      'primary-active': '#a8a29e',
    },
    on: { primary: '#1c1917' },
    primary: { DEFAULT: '#d6d3d1', foreground: '#1c1917' },
    glow: '0 0 0 1px rgba(214, 211, 209, 0.4), 0 4px 16px rgba(214, 211, 209, 0.2)',
  },
  {
    id: 'pastel-matcha',
    name: 'Pastel Matcha 淡抹茶',
    tagline: '淡淡的黄绿，极其柔和不刺眼',
    harmony: 'high',
    brand: {
      accent: '#ecfccb',
      primary: '#d9f99d',
      'primary-active': '#bef264',
    },
    on: { primary: '#1a2e05' },
    primary: { DEFAULT: '#d9f99d', foreground: '#1a2e05' },
    glow: '0 0 0 1px rgba(217, 249, 157, 0.4), 0 4px 16px rgba(217, 249, 157, 0.2)',
  },
  // ── 现代冷灰系 ──
  {
    id: 'abyss-green',
    name: 'Abyss 深渊',
    tagline: '极致深邃的墨绿色，最低调',
    harmony: 'high',
    brand: {
      accent: '#2dd4bf',
      primary: '#021f1e',
      'primary-active': '#011212',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#021f1e', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(45, 212, 191, 0.2), 0 4px 16px rgba(2, 31, 30, 0.25)',
  },
  {
    id: 'sky-dark',
    name: 'Sky 天蓝',
    tagline: '清爽通透，最经典百搭的 UI 主题色',
    harmony: 'high',
    brand: {
      accent: '#7dd3fc',
      primary: '#0ea5e9',
      'primary-active': '#0284c7',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#0ea5e9', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(125, 211, 252, 0.2), 0 4px 16px rgba(14, 165, 233, 0.25)',
  },
  {
    id: 'slate-dark',
    name: 'Slate 石墨',
    tagline: '极简黑白灰，剥离色彩干扰，最纯粹的阅读体验',
    harmony: 'high',
    brand: {
      accent: '#f8fafc',
      primary: '#64748b',
      'primary-active': '#475569',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#64748b', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(248, 250, 252, 0.2), 0 4px 16px rgba(248, 250, 252, 0.15)',
  },
  {
    id: 'cyan-dark',
    name: 'Cyan 青蓝',
    tagline: '带有赛博科技感的亮青色',
    harmony: 'high',
    brand: {
      accent: '#22d3ee',
      primary: '#0891b2',
      'primary-active': '#0e7490',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#0891b2', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(34, 211, 238, 0.2), 0 4px 16px rgba(8, 145, 178, 0.25)',
  },
  {
    id: 'crimson-dark',
    name: 'Crimson 绯红',
    tagline: '深邃内敛的暗红色，警醒但不刺眼',
    harmony: 'high',
    brand: {
      accent: '#fb7185',
      primary: '#e11d48',
      'primary-active': '#be123c',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#e11d48', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(251, 113, 133, 0.2), 0 4px 16px rgba(225, 29, 72, 0.25)',
  },
  {
    id: 'mango-dark',
    name: 'Mango 芒果',
    tagline: '高饱和度暖黄，带来活力与温度',
    harmony: 'high',
    brand: {
      accent: '#fde047',
      primary: '#ea580c',
      'primary-active': '#c2410c',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#ea580c', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(253, 224, 71, 0.2), 0 4px 16px rgba(234, 88, 12, 0.25)',
  },
  {
    id: 'emerald-dark',
    name: 'Emerald 翠绿',
    tagline: '中性黑灰底色，搭配明亮的祖母绿',
    harmony: 'high',
    brand: {
      accent: '#6ee7b7',
      primary: '#10b981',
      'primary-active': '#059669',
    },
    on: { primary: '#ffffff' },
    primary: { DEFAULT: '#10b981', foreground: '#ffffff' },
    glow: '0 0 0 1px rgba(110, 231, 183, 0.2), 0 4px 16px rgba(16, 185, 129, 0.25)',
  },
  // ── 之前的暖色系 ──
  {
    id: 'umber-earth',
    name: 'Umber 深褐',
    tagline: '主色取自 surface-strong，与卡片/背景同色系，最融合',
    harmony: 'high',
    brand: {
      accent: '#c9b896',
      primary: SURFACE_STRONG,
      'primary-active': '#353230',
    },
    on: { primary: '#fafaf9' },
    primary: { DEFAULT: SURFACE_STRONG, foreground: '#fafaf9' },
    glow: '0 0 0 1px rgba(68, 64, 60, 0.4), 0 4px 16px rgba(0, 0, 0, 0.25)',
  },
  {
    id: 'mocha-caramel',
    name: 'Mocha 摩卡',
    tagline: '暖棕主色 + 焦糖 accent，与 stone 底同暖调',
    harmony: 'high',
    brand: {
      accent: '#c9a882',
      primary: '#3d3229',
      'primary-active': '#322820',
    },
    on: { primary: '#faf6f2' },
    primary: { DEFAULT: '#3d3229', foreground: '#faf6f2' },
    glow: '0 0 0 1px rgba(201, 168, 130, 0.14), 0 4px 16px rgba(61, 50, 41, 0.25)',
  },
  {
    id: 'warm-olive',
    name: 'Olive 暖橄榄',
    tagline: '黄调橄榄绿，绿色系里与暖灰底最协调',
    harmony: 'high',
    brand: {
      accent: '#b5c4a0',
      primary: '#3f4535',
      'primary-active': '#333828',
    },
    on: { primary: '#f5f5f0' },
    primary: { DEFAULT: '#3f4535', foreground: '#f5f5f0' },
    glow: '0 0 0 1px rgba(181, 196, 160, 0.16), 0 4px 16px rgba(63, 69, 53, 0.2)',
  },
  {
    id: 'copper-rust',
    name: 'Copper 铜锈',
    tagline: '赤陶主色，accent 偏亮铜，有温度但不跳',
    harmony: 'high',
    brand: {
      accent: '#d4a07a',
      primary: '#4a3528',
      'primary-active': '#3d2a20',
    },
    on: { primary: '#fff8f3' },
    primary: { DEFAULT: '#4a3528', foreground: '#fff8f3' },
    glow: '0 0 0 1px rgba(212, 160, 122, 0.15), 0 4px 16px rgba(74, 53, 40, 0.22)',
  },
  {
    id: 'wine-earth',
    name: 'Wine 土酒',
    tagline: '暖红褐主色，灰粉 accent，偏文艺沉静的调性',
    harmony: 'high',
    brand: {
      accent: '#c49a96',
      primary: '#3d2a2c',
      'primary-active': '#322224',
    },
    on: { primary: '#faf5f5' },
    primary: { DEFAULT: '#3d2a2c', foreground: '#faf5f5' },
    glow: '0 0 0 1px rgba(196, 154, 150, 0.14), 0 4px 16px rgba(61, 42, 44, 0.22)',
  },
  {
    id: 'sandstone',
    name: 'Sandstone 砂岩',
    tagline: '主色略亮于卡片，accent 用 body 色，几乎单色层次',
    harmony: 'high',
    brand: {
      accent: '#d6d3d1',
      primary: '#57534e',
      'primary-active': SURFACE_STRONG,
    },
    on: { primary: '#fafaf9' },
    primary: { DEFAULT: '#57534e', foreground: '#fafaf9' },
    glow: '0 0 0 1px rgba(214, 211, 209, 0.1), 0 4px 16px rgba(0, 0, 0, 0.22)',
  },
  {
    id: 'forest-warm',
    name: 'Forest 暖林',
    tagline: '保留深林感，主色偏黄绿 #2a3d36，比 #042f2e 更贴暖底',
    harmony: 'medium',
    brand: {
      accent: '#8fb5a8',
      primary: '#2a3d36',
      'primary-active': '#22312c',
    },
    on: { primary: '#ecfdf5' },
    primary: { DEFAULT: '#2a3d36', foreground: '#ecfdf5' },
    glow: '0 0 0 1px rgba(143, 181, 168, 0.14), 0 4px 16px rgba(42, 61, 54, 0.22)',
  },
  // ── 已有方案 ──
  {
    id: 'sage-muted',
    name: 'Sage 鼠尾草',
    tagline: '低饱和绿 accent，融合度较好',
    harmony: 'medium',
    brand: {
      accent: '#a3b18a',
      primary: '#8f9f7a',
      'primary-active': '#7a8b66',
    },
    on: { primary: '#1a1f14' },
    primary: { DEFAULT: '#8f9f7a', foreground: '#1a1f14' },
    glow: '0 0 0 1px rgba(163, 177, 138, 0.18), 0 4px 16px rgba(143, 159, 122, 0.1)',
  },
  {
    id: 'amber-warm',
    name: 'Amber 琥珀',
    tagline: '暖色 accent，无绿色，融合度好',
    harmony: 'medium',
    brand: {
      accent: '#d4a373',
      primary: '#c4956a',
      'primary-active': '#b88355',
    },
    on: { primary: '#2a1f14' },
    primary: { DEFAULT: '#c4956a', foreground: '#2a1f14' },
    glow: '0 0 0 1px rgba(212, 163, 115, 0.16), 0 4px 16px rgba(196, 149, 106, 0.1)',
  },
  {
    id: 'rose-clay',
    name: 'Clay 陶玫瑰',
    tagline: '灰粉 accent，柔和克制',
    harmony: 'medium',
    brand: {
      accent: '#c9a9a6',
      primary: '#b89390',
      'primary-active': '#a67f7c',
    },
    on: { primary: '#261818' },
    primary: { DEFAULT: '#b89390', foreground: '#261818' },
    glow: '0 0 0 1px rgba(201, 169, 166, 0.16), 0 4px 16px rgba(184, 147, 144, 0.1)',
  },
  {
    id: 'pearl-minimal',
    name: 'Pearl 珍珠',
    tagline: '近单色 accent，最低调',
    harmony: 'medium',
    brand: {
      accent: '#d6d3d1',
      primary: '#e7e5e4',
      'primary-active': '#d6d3d1',
    },
    on: { primary: '#1c1917' },
    primary: { DEFAULT: '#e7e5e4', foreground: '#1c1917' },
    glow: '0 0 0 1px rgba(250, 250, 249, 0.08), 0 4px 16px rgba(0, 0, 0, 0.2)',
  },
  // ── 与暖底冲突较大 ──
  {
    id: 'forest-deep',
    name: 'Forest 深林',
    tagline: '#042f2e 偏冷青绿，在暖石底上易显突兀',
    harmony: 'low',
    brand: {
      accent: '#6db5ab',
      primary: '#042f2e',
      'primary-active': '#031f1e',
    },
    on: { primary: '#ecfdf5' },
    primary: { DEFAULT: '#042f2e', foreground: '#ecfdf5' },
    glow: '0 0 0 1px rgba(4, 47, 46, 0.35), 0 4px 16px rgba(4, 47, 46, 0.2)',
  },
  {
    id: 'teal-vivid',
    name: 'Teal 亮青',
    tagline: '高饱和青绿，与暖灰底色温冲突',
    harmony: 'low',
    brand: {
      accent: '#2dd4bf',
      primary: '#14b8a6',
      'primary-active': '#0d9488',
    },
    on: { primary: '#042f2e' },
    primary: { DEFAULT: '#09B6A2', foreground: '#042f2e' },
    glow: '0 0 0 1px rgba(45, 212, 191, 0.15), 0 4px 16px rgba(20, 184, 166, 0.12)',
  },
];

export const defaultThemePresetId = 'forest-pine';

export const warmBgPresets = themePresets.filter((p) => p.harmony === 'high');

export const getThemePreset = (id: string) =>
  themePresets.find((p) => p.id === id) ?? themePresets[0];
