// 设置定义：所有可调参数。版本号 + 迁移。
export const SETTINGS_VERSION = 6;
export const STORE_KEY = 'screwTool.settings';
// [key, 标签, 类型, 默认, min, max, step]  类型: range/color/bool/select/text/file
export const GROUPS = [
  ['画布与关卡', [
    ['canvasW', '画布宽度(px)', 'range', 720, 360, 1440, 2],
    ['canvasH', '画布高度(px)', 'range', 1280, 640, 2560, 2],
    ['level', '关卡', 'select', 'reference', [['reference', '参考关卡（手掌）'], ['random', '随机生成（保证可解）'], ['image', '导入透明图形生成']]],
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
    ['screwBlock', '螺丝阻挡探测（板被任意贯穿螺丝挡住）', 'bool', true],
    ['debugPins', '调试：显示螺丝固定哪些板', 'bool', false],
    ['moveRule', '落孔规则', 'select', 'tap2', [['tap2', '两次点击：先点螺丝再点孔（参考视频）'], ['nearest', '单击：最近空孔'], ['vacated', '单击：优先刚空出的孔'], ['random', '单击：随机空孔']]],
  ]],
  ['导入透明图形生成关卡', [
    ['shapeImg', '上传透明PNG/WebP（未上传=内置心形）', 'file', ''],
    ['shapeThreshold', 'Alpha 阈值', 'range', 0.5, 0.05, 0.95, 0.01],
    ['shapeMargin', '左右边距(px)', 'range', 40, 0, 200, 1],
    ['shapeMaxH', '最大高度(px)', 'range', 760, 300, 1100, 2],
    ['shapeScale', '图形缩放', 'range', 1, 0.3, 1.5, 0.01],
    ['shapeOffX', '图形偏移X', 'range', 0, -300, 300, 1],
    ['shapeOffY', '图形偏移Y', 'range', 0, -400, 400, 1],
    ['partStyle', '切分风格', 'select', 'strip', [['strip', '条状分段（参考手指风格）'], ['voronoi', 'Voronoi 拉长块'], ['grid', '网格']]],
    ['plateSize', '目标板尺寸(px)', 'range', 110, 50, 260, 2],
    ['plateCount', '板数(Voronoi，0=按尺寸)', 'range', 0, 0, 60, 1],
    ['vorDensity', 'Voronoi 自动板数倍率(板数=0 时)', 'range', 2.6, 0.5, 5, 0.1],
    ['partAngle', '条带方向(度)', 'range', 90, 0, 180, 1],
    ['partRandom', '随机度', 'range', 0.5, 0, 1, 0.01],
    ['shapeSeed', '图形关卡种子', 'range', 1, 1, 9999, 1],
    ['seamW', '缝宽(px)', 'range', 5, 1, 24, 0.5],
    ['edgeInset', '板距底板边缘(px)', 'range', 7, 0, 30, 0.5],
    ['minPlateArea', '最小板面积(px²)', 'range', 2200, 300, 20000, 100],
    ['imgScrewMin', '每板螺丝数 最少', 'range', 1, 1, 3, 1],
    ['imgScrewMax', '每板螺丝数 最多', 'range', 2, 1, 3, 1],
    ['screwEdgeMin', '螺丝距板边最小(px)', 'range', 20, 8, 60, 1],
    ['imgEmpty', '初始空孔数', 'range', 1, 1, 6, 1],
    ['imgHidden', '隐藏底孔数', 'range', 3, 0, 10, 1],
    ['imgLayers', '层数', 'range', 1, 1, 3, 1],
    ['layerOverlap', '上层保留比例', 'range', 0.35, 0.05, 1, 0.01],
    ['baseFill', '底板填充', 'select', 'color', [['color', '设置中的底板颜色'], ['image', '图片自身像素(纹理)']]],
    ['plateTint', '板块着色', 'select', 'settings', [['settings', '设置中的板块颜色'], ['image', '按图片颜色混合']]],
    ['plateTintAmt', '图片颜色混合比例', 'range', 0.35, 0, 1, 0.01],
  ]],
  ['外观', [
    ['bgMode', '背景类型', 'select', 'image', [['image', '参考视频提取背景图（默认）'], ['procedural', '程序化绘制（纯色+纸纹+薄荷叶）']]],
    ['bgColor', '背景色(程序化)', 'color', '#668772'],
    ['bgNoise', '背景纸纹强度', 'range', 0.10, 0, 0.4, 0.01],
    ['leafOpacity', '薄荷叶线稿透明度', 'range', 0.35, 0, 1, 0.01],
    ['leafColor', '叶子线条色', 'color', '#eef3ea'],
    ['leafScale', '叶子大小', 'range', 1, 0.5, 2, 0.05],
    ['baseColor', '底板颜色', 'color', '#bf8a80'],
    ['baseGrain', '底板木纹强度', 'range', 0.16, 0, 0.6, 0.01],
    ['baseOutline', '底板描边色', 'color', '#3a1d1c'],
    ['baseGloss', '底板内侧白色亮边', 'range', 0.5, 0, 1, 0.01],
    ['edgeHalo', '描边外浅色光晕', 'range', 0.28, 0, 1, 0.01],
    ['plateColor', '板块颜色', 'color', '#bfb7ee'],
    ['plateShade', '板块厚度边颜色', 'color', '#5d5394'],
    ['plateThick', '板块厚度(px)', 'range', 1.5, 0, 14, 0.5],
    ['plateGrain', '板块木纹/排线强度', 'range', 0.3, 0, 1, 0.01],
    ['plateOutline', '板块描边色', 'color', '#261729'],
    ['plateGloss', '板块光泽白边强度', 'range', 0.85, 0, 1, 0.01],
    ['outlineW', '描边宽度', 'range', 2.1, 0, 6, 0.1],
    ['plateRadius', '板块圆角倍率', 'range', 1, 0, 2, 0.05],
    ['plateShadow', '板块投影', 'range', 0.18, 0, 1, 0.01],
    ['screwSize', '螺丝直径(px)', 'range', 40, 16, 70, 1],
    ['screwColor', '螺丝主色', 'color', '#c4bfe6'],
    ['screwDark', '螺丝暗部色', 'color', '#5f5a86'],
    ['screwBrush', '螺丝拉丝明暗强度', 'range', 0.6, 0, 1, 0.01],
    ['screwRim', '螺丝边缘色', 'color', '#30274d'],
    ['screwRimW', '螺丝边缘宽度', 'range', 1.6, 0, 5, 0.1],
    ['screwCross', '十字槽颜色', 'color', '#2a2748'],
    ['crossLen', '十字槽臂长(×半径)', 'range', 0.6, 0.2, 0.9, 0.01],
    ['crossW', '十字槽宽(×半径)', 'range', 0.34, 0.05, 0.5, 0.01],
    ['holeSize', '孔直径(px)', 'range', 30, 12, 60, 1],
    ['holeColor', '孔颜色', 'color', '#2a140d'],
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
  ['导出 AE / 3D', [
    ['aeFps', 'AE 导出帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['aeSampling', 'AE 关键帧', 'select', 'reduce', [['reduce', '精简（线性插值误差内删减）'], ['bake', '逐帧烘焙']]],
    ['aeAudio', 'AE 音频', 'select', 'both', [['both', '逐事件 + 混合音轨'], ['events', '仅逐事件'], ['mixed', '仅混合音轨'], ['none', '不导出']]],
    ['export3dFps', '3D 导出帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['export3dScrew', '3D 螺丝形式', 'select', 'mesh', [['mesh', '3D 网格（十字槽螺帽+螺杆）'], ['quad', '贴图四边形']]],
    ['export3dHand', '3D 导出包含手指', 'bool', true],
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
  // v2 -> v3：新增螺丝阻挡判定、调试叠加、AE/3D 导出设置——只补默认值，不改动已有值
  if (v < 3) v = 3;
  // v3 -> v4：底板/板块平滑矢量轮廓（无新字段）
  if (v < 4) v = 4;
  // v4 -> v5：新增“导入透明图形生成关卡”参数——只补默认值
  if (v < 5) v = 5;
  // v5 -> v6（M-C 材质对齐参考帧实测）：仍等于旧默认值的视觉参数替换为新默认；新增参数只补默认
  if (v < 6) { const OLD = { baseColor: '#bd8784', baseGrain: 0.18, baseOutline: '#4a2626', plateColor: '#c9c1ee', plateShade: '#7b70ad', plateThick: 3, plateGrain: 0.28, plateOutline: '#352840', outlineW: 2.6, plateShadow: 0.25, screwSize: 42, screwColor: '#dcd8fb', screwDark: '#6d6890', screwCross: '#3c3a4c', holeColor: '#26150f' }; for (const k in OLD) if (s[k] === OLD[k]) delete s[k]; v = 6; }
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
