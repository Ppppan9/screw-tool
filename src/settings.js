// 设置定义：所有可调参数。版本号 + 迁移。
export const SETTINGS_VERSION = 13;
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
    ['holeSize', '底板孔直径(px)', 'range', 30, 12, 60, 1],
    ['plateHoleSize', '板孔直径(px，镂空，参考≈33)', 'range', 33, 12, 64, 0.5],
    ['plateHoleWall', '板孔上沿孔壁厚(px)', 'range', 2.6, 0, 8, 0.1],
    ['holeColor', '孔颜色', 'color', '#2a140d'],
  ]],
  ['动画时长', [
    ['liftDur', '拧出/抬起时长(ms，参考≈100–133)', 'range', 120, 30, 800, 10],
    ['unscrewTurns', '拧出旋转圈数(逆时针)', 'range', 1, 0, 5, 0.25],
    ['liftH', '抬起高度(px)', 'range', 22, 0, 80, 1],
    ['liftScale', '抬起放大', 'range', 1.15, 1, 1.6, 0.01],
    ['hoverBob', '悬停浮动幅度(px，参考=0 静止)', 'range', 0, 0, 10, 0.5],
    ['flyDur', '飞行时长(ms，参考≈133)', 'range', 133, 40, 1200, 1],
    ['arcBend', '飞行弧度(px)', 'range', 40, 0, 300, 2],
    ['screwInDur', '拧入时长(ms，参考≈100)', 'range', 100, 30, 800, 10],
    ['screwInTurns', '拧入旋转圈数(顺时针)', 'range', 1, 0, 5, 0.25],
    ['settle', '拧入回弹幅度', 'range', 0.06, 0, 0.3, 0.01],
  ]],
  ['物理', [
    ['releaseAt', '板块释放时机', 'select', 'seat', [['seat', '螺丝在目标孔落座后（参考视频）'], ['lift', '螺丝拧出离孔时（v1.2.1 旧行为）']]],
    ['releaseDelay', '释放延迟(ms，参考≈33–67)', 'range', 50, 0, 800, 10],
    ['gravity', '重力(px/s²，参考≈3600)', 'range', 3600, 500, 15000, 100],
    ['swingBoost', '单钉摆动加速倍率(参考≈2.2)', 'range', 2.2, 0.2, 6, 0.1],
    ['swingMax', '单钉摆动最大角度(度，参考 16.75)', 'range', 17, 0, 90, 0.5],
    ['swingDamp', '摆动阻尼(1/s)', 'range', 6, 0, 40, 0.5],
    ['swingBounce', '到达最大角回弹系数', 'range', 0.05, 0, 1, 0.01],
    ['swingKick', '摆动初始角速度(度/秒)', 'range', 0, 0, 600, 5],
    ['releaseSpinK', '掉落初始旋转(度/秒 每 px 钉偏心，参考≈8.3)', 'range', 8.3, 0, 40, 0.1],
    ['fallSpin', '掉落额外旋转(度/秒)', 'range', 0, -360, 360, 5],
    ['fallFade', '下落时淡出', 'bool', false],
    ['collide', '板与螺丝碰撞（螺丝杆挡住下落/摆动的板）', 'bool', true],
    ['collShaftR', '碰撞螺丝杆半径(px)', 'range', 6, 1, 20, 0.5],
    ['collRest', '碰撞弹性（恢复系数 0=不弹 1=全弹）', 'range', 0.2, 0, 1, 0.05],
    ['collFric', '碰撞摩擦系数', 'range', 0.3, 0, 1.5, 0.05],
    ['plateCollide', '板与板碰撞（下落/摆动的板撞到其它板）', 'bool', true],
    ['ppRest', '板与板碰撞弹性（恢复系数）', 'range', 0.1, 0, 1, 0.05],
    ['ppFric', '板与板摩擦系数', 'range', 0.4, 0, 1.5, 0.05],
    ['ppInset', '碰撞轮廓内缩(px，越大同层板越会互相压住边)', 'range', 0.5, 0, 6, 0.1],
    ['ppPassArea', '不同层板重叠超过此面积(px²)才互相穿过（同层板永不穿过）', 'range', 40, 0, 2000, 10],
    ['angDamp', '下落角阻尼(1/s，抑制撞击后快速旋转)', 'range', 1.5, 0, 10, 0.1],
    ['collStuckMs', '卡住穿过(ms，下落板被托住这么久就穿过障碍掉出；0=永不穿过，一直被托住)', 'range', 0, 0, 8000, 100],
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
  // ---- 以下分组与麻将工具统一（键名/中文标签/顺序见 ref/TOOLKIT_STANDARD.md），打螺丝专有项放在各组末尾 ----
  ['音效', [
    ['sfxMute', '静音', 'bool', false],
    ['sfxVolume', '总音量', 'range', 0.8, 0, 1.5, 0.01],
    ['ratchetRate', '棘轮咔哒频率(次/秒)', 'range', 45, 5, 120, 1],
    ['ratchetPitch', '棘轮音高', 'range', 1, 0.5, 2, 0.05],
    ['fallSfx', '板掉落音效', 'bool', true],
    ['bgm', '上传背景音乐(可选)', 'file', ''],
    ['bgmVol', '背景音乐音量', 'range', 0.5, 0, 1, 0.01],
  ]],
  ['手指 / 自动通关', [
    ['autoSpeed', '整体速度倍率', 'range', 1, 0.25, 6, 0.05],
    ['moveMin', '移动耗时最小(ms)', 'range', 220, 50, 2000, 10],
    ['moveMax', '移动耗时最大(ms)', 'range', 300, 50, 3000, 10],
    ['delayMin', '点击间隔最小(ms)', 'range', 150, 0, 2000, 10],
    ['delayMax', '点击间隔最大(ms)', 'range', 350, 0, 4000, 10],
    ['thinkChance', '“思考停顿”概率', 'range', 0, 0, 0.6, 0.01],
    ['thinkMax', '思考停顿最长(ms)', 'range', 900, 0, 4000, 50],
    ['jitter', '落点随机抖动(px)', 'range', 4, 0, 40, 1],
    ['handSize', '手指大小(画面宽比例)', 'range', 0.42, 0.1, 0.9, 0.01],
    ['handAnchorX', '指尖锚点 X(0~1)', 'range', 0.05, 0, 1, 0.005],
    ['handAnchorY', '指尖锚点 Y(0~1)', 'range', 0.05, 0, 1, 0.005],
    ['handImage', '上传手指图片(透明PNG，不上传则不显示手指)', 'file', ''],
    ['pressEnabled', '点击按下效果（手指按压）', 'bool', true],
    ['pressDepth', '按压幅度', 'range', 0.07, 0, 0.3, 0.01],
    ['tapRipple', '点击处显示波纹圈（参考视频没有）', 'bool', false],
    ['handShow', '显示手指图片', 'bool', true],
    ['handRest', '空闲位置', 'select', 'br', [['br', '右下角外'], ['hide', '隐藏']]],
    ['autoSelectGap', '点螺丝→点孔间隔(ms)', 'range', 120, 0, 2000, 10],
    ['autoStartDelay', '开始前等待(ms)', 'range', 500, 0, 5000, 50],
  ]],
  ['录制', [
    ['recFps', '帧率', 'range', 30, 15, 60, 1],
    ['recFormat', '格式', 'select', 'auto', [['auto', '自动(优先 MP4)'], ['mp4', 'MP4'], ['webm', 'WebM']]],
    ['recBitrate', '码率(Mbps)', 'range', 8, 1, 30, 0.5],
    ['autoRec', '自动通关开始时自动录制（默认关）', 'bool', false],
    ['autoStop', '自动通关通关后停止录制并下载（仅在正在录制时）', 'bool', true],
    ['tailSec', '通关后继续录制(秒)', 'range', 1.2, 0, 10, 0.1],
  ]],
  ['导出 AE 工程', [
    ['_aeToggle', '记录 AE 时间轴（自动通关/手动游玩都可）', 'button', 'aeToggle', '● 开始记录'],
    ['_aeExport', '重新导出上一次记录', 'button', 'aeExport', '⬇ 导出 ZIP'],
    ['aeWithRec', '录制视频时同步记录，停止录制后自动导出', 'bool', true],
    ['aeFps', 'AE 合成帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['aeSize', 'AE 合成尺寸', 'select', 'canvas', [['canvas', '同画布分辨率'], ['720x1280', '720×1280'], ['1080x1920', '1080×1920']]],
    ['aeSampling', '关键帧方式', 'select', 'reduce', [['reduce', '精简关键帧（线性插值，误差 <0.3px）'], ['bake', '逐帧烘焙（每帧一个关键帧）']]],
    ['aeNames', '图层命名', 'select', 'zh', [['zh', '中文'], ['en', 'English']]],
    ['aeAudio', '音频', 'select', 'both', [['both', '混合音轨 + 逐事件音效层'], ['mixed', '仅混合音轨'], ['events', '仅逐事件音效层'], ['none', '不导出音频']]],
    ['aeSaveAep', '脚本跑完后提示另存为 .aep', 'bool', true],
  ]],
  ['导出 3D 动画（UE5 / C4D / Blender）', [
    ['_export3d', '用上一次 AE 记录生成 glTF 场景 + Blender 脚本 + 音频', 'button', 'export3d', '导出 3D 动画 (glTF/FBX/Blender)'],
    ['export3dFps', '3D 动画帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['export3dHand', '包含手指（贴图平面；结束页是否显示仍按“结束页显示手指”）', 'bool', true],
    ['export3dScrew', '螺丝形式', 'select', 'mesh', [['mesh', '3D 网格（十字槽螺帽+螺杆）'], ['quad', '贴图四边形']]],
  ]],
  ['结束页(End Card)', [
    ['endCard', '显示结束页', 'bool', false],
    ['endCardHand', '结束页显示手指（自动通关点按钮）', 'bool', false],
    ['endDelay', '通关后出现延迟(ms)', 'range', 600, 0, 5000, 50],
    ['endTitle', '标题', 'text', '立即下载 挑战更多关卡'],
  ]],
];
export const DEFS = {};
for (const [, items] of GROUPS) for (const it of items) if (it[2] !== 'button') DEFS[it[0]] = it[3];
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
  // v6 -> v7（v1.3.1 与麻将工具统一通用参数键名）：旧键 → 新键（有值才迁移，单位换算），其它只补默认
  if (v < 7) {
    const mv = (o, n, f = x => x) => { if (o in s) { if (!(n in s)) s[n] = f(s[o]); delete s[o]; } };
    mv('autoStepMin', 'delayMin'); mv('autoStepMax', 'delayMax'); mv('autoJitter', 'jitter');
    if ('autoMoveDur' in s) { if (!('moveMin' in s)) s.moveMin = Math.round(s.autoMoveDur * 0.85); if (!('moveMax' in s)) s.moveMax = Math.round(s.autoMoveDur * 1.15); delete s.autoMoveDur; }
    mv('handImg', 'handImage'); mv('handScale', 'handSize', x => Math.round(x * 0.42 * 1000) / 1000); // 旧：图片原尺寸倍率（按 300px 宽手图换算为画面宽比例）
    mv('handPress', 'pressDepth', x => Math.round((1 - x) * 1000) / 1000); mv('tapFx', 'pressEnabled');
    mv('sfx', 'sfxMute', x => !x); mv('sfxVol', 'sfxVolume');
    mv('recTail', 'tailSec', x => Math.round(x / 100) / 10); mv('endText', 'endTitle');
    if ('recBitrate' in s && typeof s.recBitrate !== 'number') delete s.recBitrate;
    v = 7;
  }
  // v7 -> v8（v1.4 板块物理）：新增“物理”分组（只补默认）；重力旧默认 5200 → 参考实测 3600；fallDelay 由 releaseDelay 取代
  if (v < 8) { if (s.gravity === 5200) delete s.gravity; delete s.fallDelay; v = 8; }
  // v8 -> v9（v1.4.1 螺丝动画时长对齐参考逐帧实测）：仍等于旧默认值的才替换为新默认
  if (v < 9) { const OLD = { liftDur: 140, flyDur: 230, screwInDur: 130, hoverBob: 2 }; for (const k in OLD) if (s[k] === OLD[k]) delete s[k]; v = 9; }
  // v9 -> v10（v1.6）：新增板孔镂空(plateHoleSize/plateHoleWall)与下落碰撞参数——只补默认
  if (v < 10) v = 10;
  // v10 -> v11（v1.7 板与板碰撞）：collMaxMs（碰撞超时）由 collStuckMs（卡住判定）取代；其余新增键只补默认
  if (v < 11) { delete s.collMaxMs; v = 11; }
  // v11 -> v12（v1.7.1 同层板不穿模）：ppInset 旧默认 1.5 → 0.5；新增 ppPassArea 只补默认
  if (v < 12) { if (s.ppInset === 1.5) delete s.ppInset; v = 12; }
  // v12 -> v13（v1.7.2 被托住的板不再穿过）：collStuckMs 旧默认 1200 → 0（永不穿过）
  if (v < 13) { if (s.collStuckMs === 1200) delete s.collStuckMs; v = 13; }
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
