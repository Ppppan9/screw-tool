// 主题注册表（v1.8，与麻将工具 src/themes/index.js 同一模式）。
// 一个主题 = 外观默认值覆盖（defaults）+ 参考关卡（level：'reference' 关卡随主题切换）。
// 手掌款 = 之前的全部外观（settings.js 的 DEFS 原值，数值完全不变）；经典款 = 朋友圈广告「折螺丝」的大脚掌。
export const THEMES = {
  palm: { id: 'palm', name: '手掌款', level: 'hand', defaults: {} },
  classic: {
    id: 'classic', name: '经典款', level: 'bigfoot',
    // 取样：ref/bigfoot/ref_720.png（tools/trace_bigfoot.py 的板块多边形分区取样，见 ANALYSIS.md「经典款」）
    defaults: {
      bgMode: 'silk', bgColor: '#dcd9cb', bgNoise: 0.05, silkColor: '#a08d68', silkOpacity: 0.85, linen: 0.5,
      baseStyle: 'wood', baseColor: '#6f6151', baseGrain: 0.25, baseOutline: '#0c0909', baseGloss: 0, edgeHalo: 0.12,
      plateStyle: 'metal', plateColor: '#a8a3a4', plateAltColor: '#c8b896', plateShade: '#4b4646', plateThick: 1.5, plateGrain: 0.55,
      plateOutline: '#0d0a0a', plateGloss: 0.95, outlineW: 2.4, plateRadius: 1, plateShadow: 0.22,
      screwStyle: 'chrome', screwSize: 50, screwColor: '#b9b6b7', screwDark: '#5b5859', screwBrush: 0.8, screwRim: '#0e0b0b', screwRimW: 2.6,
      screwCross: '#2f2c2d', crossLen: 0.54, crossW: 0.27,
      holeStyle: 'black', holeSize: 38, plateHoleSize: 44, plateHoleWall: 3, holeColor: '#1d1b1e',
    },
  },
};
// 跟随主题保存的设置键（切换主题时各自独立保存用户的改动）
export const THEME_KEYS = [...new Set(Object.values(THEMES).flatMap(t => Object.keys(t.defaults)))];
export function themeDefaults(DEFS, id) {
  const base = {}; for (const k of THEME_KEYS) base[k] = DEFS[k];
  return { ...base, ...((THEMES[id] || THEMES.palm).defaults) };
}
