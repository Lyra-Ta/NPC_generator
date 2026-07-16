/**
 * 三套护眼配色; 通过 CSS 变量注入到面板根节点.
 * 想加新配色: 复制一项, 改 id/name/vars 即可.
 */

export type ThemeId = 'warm-paper' | 'misty-forest' | 'ink-blue' | 'deep-night';

export interface Theme {
  id: ThemeId;
  name: string;
  /** 用于切换器圆点的代表色 */
  swatch: string;
  vars: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: 'warm-paper',
    name: '暖纸',
    swatch: '#5C6E4D',
    vars: {
      '--archive-bg': '#FAF7F2',
      '--archive-card': '#FFFFFF',
      '--archive-text': '#3F3A33',
      '--archive-text-muted': '#6B6357',
      '--archive-border': '#E5DECF',
      '--archive-border-strong': '#C8BFA9',
      '--archive-row': '#F6F0E3',
      '--archive-row-hover': '#EFE9DD',
      '--archive-accent': '#5C6E4D',
      '--archive-accent-hover': '#4A593E',
      '--archive-accent-text': '#FAF7F2',
      '--archive-overlay': 'rgba(63, 58, 51, 0.45)',
    },
  },
  {
    id: 'misty-forest',
    name: '雾林',
    swatch: '#4F7058',
    vars: {
      '--archive-bg': '#F2F5F1',
      '--archive-card': '#FBFCFB',
      '--archive-text': '#2C3A2F',
      '--archive-text-muted': '#5C6F5F',
      '--archive-border': '#DCE6DC',
      '--archive-border-strong': '#A8BBA8',
      '--archive-row': '#F2F5F1',
      '--archive-row-hover': '#E4ECE3',
      '--archive-accent': '#4F7058',
      '--archive-accent-hover': '#3D5944',
      '--archive-accent-text': '#F2F5F1',
      '--archive-overlay': 'rgba(44, 58, 47, 0.45)',
    },
  },
  {
    id: 'ink-blue',
    name: '墨蓝',
    swatch: '#455A75',
    vars: {
      '--archive-bg': '#F2F4F7',
      '--archive-card': '#FFFFFF',
      '--archive-text': '#2A3340',
      '--archive-text-muted': '#5A6577',
      '--archive-border': '#E1E5EC',
      '--archive-border-strong': '#A6AEBC',
      '--archive-row': '#F2F4F7',
      '--archive-row-hover': '#E8ECF2',
      '--archive-accent': '#455A75',
      '--archive-accent-hover': '#36475E',
      '--archive-accent-text': '#F2F4F7',
      '--archive-overlay': 'rgba(42, 51, 64, 0.45)',
    },
  },
  {
    id: 'deep-night',
    name: '墨夜',
    // 渐变区分: 左下深底色 + 右上苔绿强调色, 一眼可辨"暗色"
    swatch: 'linear-gradient(135deg, #1B1F26 50%, #8FB39A 50%)',
    vars: {
      '--archive-bg': '#1B1F26',
      '--archive-card': '#252B33',
      '--archive-text': '#E0E4DE',
      '--archive-text-muted': '#8E9499',
      '--archive-border': '#2F3540',
      '--archive-border-strong': '#404656',
      '--archive-row': '#2A3038',
      '--archive-row-hover': '#353B45',
      '--archive-accent': '#8FB39A',
      '--archive-accent-hover': '#A2C2AB',
      '--archive-accent-text': '#1B1F26',
      '--archive-overlay': 'rgba(0, 0, 0, 0.6)',
    },
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'warm-paper';

export function getTheme(id: ThemeId): Theme {
  return themes.find(t => t.id === id) ?? themes[0];
}
