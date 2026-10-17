// 设置定义：所有可调参数。版本号 + 迁移。
export const SETTINGS_VERSION = 2;
export const STORE_KEY = 'screwTool.settings';
// [key, 标签, 类型, 默认, min, max, step]  类型: range/color/bool/select/text/file
export const GROUPS = [
  ['画布与关卡', [
    ['canvasW', '画布宽度(px)', 'range', 720, 360, 1440, 2],
    ['canvasH', '画布高度(px)', 'range', 1280, 640, 2560, 2],
    ['level', '关卡', 'select', 'reference', [['reference', '参考关卡（手掌）'], ['random', '随机生成（保证可解）']]],
    ['seed', '随机种子', 'range', 1, 1, 9999, 1],
    ['emptyHoles', '初始空孔数(随机关)', 'range', 2, 1, 8, 1],
    ['screwsPerPlate', '每块板螺丝数(随机关,上限)', 'range', 2, 1, 4, 1],
    ['genCols', '列数(随机关)', 'range', 5, 2, 8, 1],
    ['genRows', '行数(随机关)', 'range', 7, 2, 10, 1],
    ['genLayers', '层数(随机关)', 'range', 2, 1, 4, 1],
    ['genDensity', '板密度(随机关)', 'range', 0.7, 0.2, 1, 0.05],
    ['genPlateW', '板宽(随机关)', 'range', 100, 50, 200, 2],
    ['genPlateH', '板高(随机关)', 'range', 80, 40, 200, 2],
    ['genGap', '板间距(随机关)', 'range', 8, 0, 30, 1],
    ['genCenterY', '棋盘中心Y(随机关)', 'range', 640, 300, 1000, 2],
    ['boardScale', '整体缩放', 'range', 1, 0.5, 1.5, 0.01],
    ['boardOffX', '整体偏移X', 'range', 0, -300, 300, 1],
    ['boardOffY', '整体偏移Y', 'range', 0, -400, 400, 1],
    ['moveRule', '落孔规则', 'select', 'tap2', [['tap2', '两次点击：先点螺丝再点孔（参考视频）'], ['nearest', '单击：最近空孔'], ['vacated', '单击：优先刚空出的孔'], ['random', '单击：随机空孔']]],
  ]],
  ['外观', [
    ['bgMode', '背景类型', 'select', 'image', [['image', '参考视频提取背景图（默认）'], ['procedural', '程序化绘制（纯色+纸纹+薄荷叶）']]],
    ['bgColor', '背景色(程序化)', 'color', '#668772'],
    ['bgNoise', '背景纸纹强度', 'range', 0.10, 0, 0.4, 0.01],
    ['leafOpacity', '薄荷叶线稿透明度', 'range', 0.35, 0, 1, 0.01],
    ['leafColor', '叶子线条色', 'color', '#eef3ea'],
    ['leafScale', '叶子大小', 'range', 1, 0.5, 2, 0.05],
    ['baseColor', '底板颜色', 'color', '#bd8784'],
    ['baseGrain', '底板木纹强度', 'range', 0.18, 0, 0.6, 0.01],
    ['baseOutline', '底板描边色', 'color', '#4a2626'],
    ['plateColor', '板块颜色', 'color', '#c9c1ee'],
    ['plateShade', '板块厚度边颜色', 'color', '#7b70ad'],
    ['plateThick', '板块厚度(px)', 'range', 3, 0, 14, 0.5],
    ['plateGrain', '板块木纹/排线强度', 'range', 0.28, 0, 1, 0.01],
    ['plateOutline', '板块描边色', 'color', '#352840'],
    ['outlineW', '描边宽度', 'range', 2.6, 0, 6, 0.1],
    ['plateRadius', '板块圆角倍率', 'range', 1, 0, 2, 0.05],
    ['plateShadow', '板块投影', 'range', 0.25, 0, 1, 0.01],
    ['screwSize', '螺丝直径(px)', 'range', 42, 16, 70, 1],
    ['screwColor', '螺丝主色', 'color', '#dcd8fb'],
    ['screwDark', '螺丝暗部色', 'color', '#6d6890'],
    ['screwCross', '十字槽颜色', 'color', '#3c3a4c'],
    ['holeSize', '孔直径(px)', 'range', 30, 12, 60, 1],
    ['holeColor', '孔颜色', 'color', '#26150f'],
  ]],
  ['动画时长', [
    ['liftDur', '拧出/抬起时长(ms)', 'range', 140, 30, 800, 10],
    ['unscrewTurns', '拧出旋转圈数(逆时针)', 'range', 1, 0, 5, 0.25],
    ['liftH', '抬起高度(px)', 'range', 22, 0, 80, 1],
    ['liftScale', '抬起放大', 'range', 1.15, 1, 1.6, 0.01],
    ['hoverBob', '悬停浮动幅度(px)', 'range', 2, 0, 10, 0.5],
    ['flyDur', '飞行时长(ms)', 'range', 230, 60, 1200, 10],
    ['arcBend', '飞行弧度(px)', 'range', 40, 0, 300, 2],
    ['screwInDur', '拧入时长(ms)', 'range', 130, 30, 800, 10],
    ['screwInTurns', '拧入旋转圈数(顺时针)', 'range', 1, 0, 5, 0.25],
    ['settle', '拧入回弹幅度', 'range', 0.06, 0, 0.3, 0.01],
    ['fallDelay', '板掉落延迟(ms)', 'range', 30, 0, 800, 10],
    ['gravity', '下落重力(px/s²)', 'range', 5200, 500, 15000, 100],
    ['fallSpin', '下落旋转(度/秒，参考=0)', 'range', 0, -360, 360, 5],
    ['fallFade', '下落时淡出', 'bool', false],
  ]],
  ['点击与自动通关', [
    ['tapFx', '点击按压反馈', 'bool', true],
    ['tapRipple', '点击波纹', 'bool', false],
    ['autoStepMin', '自动：步间隔最小(ms)', 'range', 150, 0, 3000, 10],
    ['autoStepMax', '自动：步间隔最大(ms)', 'range', 350, 0, 4000, 10],
    ['autoSelectGap', '自动：点螺丝→点孔间隔(ms)', 'range', 120, 0, 2000, 10],
    ['autoMoveDur', '自动：手指移动时长(ms)', 'range', 260, 60, 2000, 10],
    ['autoJitter', '自动：点击位置抖动(px)', 'range', 4, 0, 20, 1],
    ['autoSpeed', '自动：整体速度倍率', 'range', 1, 0.25, 4, 0.05],
    ['autoStartDelay', '自动：开始前等待(ms)', 'range', 500, 0, 5000, 50],
  ]],
  ['手指/触控笔光标', [
    ['handShow', '显示手指图片', 'bool', true],
    ['handImg', '上传手指PNG', 'file', ''],
    ['handAnchorX', '指尖锚点X(0~1)', 'range', 0.05, 0, 1, 0.01],
    ['handAnchorY', '指尖锚点Y(0~1)', 'range', 0.05, 0, 1, 0.01],
    ['handScale', '手指缩放', 'range', 1, 0.1, 3, 0.01],
    ['handRest', '空闲位置', 'select', 'br', [['br', '右下角外'], ['hide', '隐藏']]],
    ['handPress', '按下缩放', 'range', 0.93, 0.7, 1, 0.01],
  ]],
  ['声音', [
    ['sfx', '音效', 'bool', true],
    ['sfxVol', '音效音量', 'range', 0.8, 0, 1, 0.01],
    ['ratchetRate', '棘轮咔哒频率(次/秒)', 'range', 45, 5, 120, 1],
    ['ratchetPitch', '棘轮音高', 'range', 1, 0.5, 2, 0.05],
    ['fallSfx', '板掉落音效', 'bool', true],
    ['bgm', '上传背景音乐(可选)', 'file', ''],
    ['bgmVol', '背景音乐音量', 'range', 0.5, 0, 1, 0.01],
  ]],
  ['文字', [
    ['discShow', '显示底部免责声明', 'bool', false],
    ['discText', '底部文字', 'text', '广告素材宣传场景须达到一定条件，触发相关支线玩法'],
    ['discSize', '底部字号', 'range', 22, 10, 40, 1],
    ['discY', '底部文字Y(距底)', 'range', 26, 0, 200, 1],
    ['vertShow', '显示右侧竖排文字', 'bool', false],
    ['vertText', '竖排文字', 'text', '游戏演示画面 模拟画面请勿模仿 无不良引导'],
    ['vertSize', '竖排字号', 'range', 20, 10, 40, 1],
    ['textOpacity', '文字透明度', 'range', 0.85, 0, 1, 0.01],
  ]],
  ['结束卡 & 录制', [
    ['endCard', '通关后显示结束卡', 'bool', false],
    ['endText', '结束卡文字', 'text', '立即下载 挑战更多关卡'],
    ['endDelay', '结束卡延迟(ms)', 'range', 600, 0, 5000, 50],
    ['autoRec', '自动通关时自动录制', 'bool', false],
    ['recFormat', '录制格式', 'select', 'auto', [['auto', '自动(优先MP4)'], ['mp4', 'MP4'], ['webm', 'WebM']]],
    ['recBitrate', '码率(Mbps)', 'range', 8, 1, 30, 1],
    ['recFps', '帧率', 'range', 30, 15, 60, 1],
    ['recTail', '通关后继续录制(ms)', 'range', 1200, 0, 8000, 100],
  ]],
];
export const DEFS = {};
for (const [, items] of GROUPS) for (const it of items) DEFS[it[0]] = it[3];
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') return { ...DEFS };
  let v = obj.version || 0, s = { ...(obj.settings || obj) };
  // v0 -> v1: 早期草稿无版本号，字段直接平铺
  if (v < 1) v = 1;
  // v1 -> v2：新增背景图模式；视觉默认值调整（v1 旧默认值替换为新默认）
  if (v < 2) { const OLD = { leafOpacity: 0.55, leafScale: 0.85, plateColor: '#cdc6f0', plateOutline: '#2f2438', plateThick: 5, plateGrain: 0.35, plateShadow: 0.35, screwSize: 38, screwColor: '#d4cff8' }; for (const k in OLD) if (s[k] === OLD[k]) delete s[k]; v = 2; }
  const out = { ...DEFS };
  for (const k in DEFS) if (k in s && typeof s[k] === typeof DEFS[k]) out[k] = s[k];
  return out;
}
export function loadSettings() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { }
  return { ...DEFS };
}
export function saveSettings(S) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: S })); } catch (e) { console.warn('save fail (图片过大?)', e); }
}
export function exportJSON(S) { return JSON.stringify({ app: 'screw-tool', version: SETTINGS_VERSION, settings: S }, null, 2); }
