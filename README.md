# 打螺丝核玩工具（screw-tool）

复刻买量视频中“手掌形打螺丝”玩法的网页工具：单文件 `index.html`，完全离线（无 CDN），可直接双击打开。

- 在线版：https://ppppan9.github.io/screw-tool/ 、 https://game.mmhygame.xyz/screw/
- 参考关卡按参考视频 2.93s 画面逐个描点（25 块板、29 颗螺丝、中心 1 个空孔 + 3 个被板盖住的隐藏底孔）。

## 玩法
- 默认“两次点击”（与参考视频一致）：先点螺丝 → 螺丝逆时针拧出并抬起悬停；再点空孔 → 螺丝弧线飞入并顺时针拧入。
- 板上螺丝全部取走后，板块直线受重力下落出屏，露出下方的孔。
- 孔可用条件：没有螺丝，且所有覆盖该点的板在此处都有孔（支持多层叠放 z-order）。
- 也可在设置中切换“单击”规则：最近空孔 / 优先刚空出的孔 / 随机。

## 控制面板
| 按钮 | 作用 |
|---|---|
| ▶ 自动通关 | 求解器计算可行步骤，并以拟人方式（曲线移动、随机间隔、点击抖动）操作手指光标 |
| ⏺ 开始录制 | 录制画布 + WebAudio 音效（含背景音乐），优先 MP4，不支持时 WebM |
| ↻ 重新开始 / 🎲 换一局 | 重置 / 随机生成新关卡（生成器保证可解） |
| 📷 截图 | 导出当前画面 PNG |
| 导出/导入设置 | JSON 文件（带版本号，导入时自动迁移） |

设置自动保存在 localStorage（`screwTool.settings`，带版本号与迁移）。手指 PNG / 背景音乐以 dataURL 存入设置。

### 手指光标
默认不内置手图。在“手指/触控笔光标”里上传透明 PNG（手 + 触控笔），用锚点 X/Y（0~1，图片内相对位置）标定笔尖，缩放可调；点击时有按压缩放反馈。

## 参数一览

### 画布与关卡

| 键 | 说明 | 默认 |
|---|---|---|
| `canvasW` | 画布宽度(px) | 720 |
| `canvasH` | 画布高度(px) | 1280 |
| `level` | 关卡 | "reference" |
| `seed` | 随机种子 | 1 |
| `emptyHoles` | 初始空孔数(随机关) | 2 |
| `screwsPerPlate` | 每块板螺丝数(随机关,上限) | 2 |
| `genCols` | 列数(随机关) | 5 |
| `genRows` | 行数(随机关) | 7 |
| `genLayers` | 层数(随机关) | 2 |
| `genDensity` | 板密度(随机关) | 0.7 |
| `genPlateW` | 板宽(随机关) | 100 |
| `genPlateH` | 板高(随机关) | 80 |
| `genGap` | 板间距(随机关) | 8 |
| `genCenterY` | 棋盘中心Y(随机关) | 640 |
| `boardScale` | 整体缩放 | 1 |
| `boardOffX` | 整体偏移X | 0 |
| `boardOffY` | 整体偏移Y | 0 |
| `moveRule` | 落孔规则 | "tap2" |

### 外观

| 键 | 说明 | 默认 |
|---|---|---|
| `bgColor` | 背景色 | "#668772" |
| `bgNoise` | 背景纸纹强度 | 0.1 |
| `leafOpacity` | 薄荷叶线稿透明度 | 0.55 |
| `leafColor` | 叶子线条色 | "#eef3ea" |
| `leafScale` | 叶子大小 | 0.85 |
| `baseColor` | 底板颜色 | "#bd8784" |
| `baseGrain` | 底板木纹强度 | 0.18 |
| `baseOutline` | 底板描边色 | "#4a2626" |
| `plateColor` | 板块颜色 | "#cdc6f0" |
| `plateShade` | 板块厚度边颜色 | "#7b70ad" |
| `plateThick` | 板块厚度(px) | 5 |
| `plateGrain` | 板块木纹/排线强度 | 0.35 |
| `plateOutline` | 板块描边色 | "#2f2438" |
| `outlineW` | 描边宽度 | 2.6 |
| `plateRadius` | 板块圆角倍率 | 1 |
| `plateShadow` | 板块投影 | 0.35 |
| `screwSize` | 螺丝直径(px) | 38 |
| `screwColor` | 螺丝主色 | "#d4cff8" |
| `screwDark` | 螺丝暗部色 | "#6d6890" |
| `screwCross` | 十字槽颜色 | "#3c3a4c" |
| `holeSize` | 孔直径(px) | 30 |
| `holeColor` | 孔颜色 | "#26150f" |

### 动画时长

| 键 | 说明 | 默认 |
|---|---|---|
| `liftDur` | 拧出/抬起时长(ms) | 140 |
| `unscrewTurns` | 拧出旋转圈数(逆时针) | 1 |
| `liftH` | 抬起高度(px) | 22 |
| `liftScale` | 抬起放大 | 1.15 |
| `hoverBob` | 悬停浮动幅度(px) | 2 |
| `flyDur` | 飞行时长(ms) | 230 |
| `arcBend` | 飞行弧度(px) | 40 |
| `screwInDur` | 拧入时长(ms) | 130 |
| `screwInTurns` | 拧入旋转圈数(顺时针) | 1 |
| `settle` | 拧入回弹幅度 | 0.06 |
| `fallDelay` | 板掉落延迟(ms) | 30 |
| `gravity` | 下落重力(px/s²) | 5200 |
| `fallSpin` | 下落旋转(度/秒，参考=0) | 0 |
| `fallFade` | 下落时淡出 | false |

### 点击与自动通关

| 键 | 说明 | 默认 |
|---|---|---|
| `tapFx` | 点击按压反馈 | true |
| `tapRipple` | 点击波纹 | false |
| `autoStepMin` | 自动：步间隔最小(ms) | 150 |
| `autoStepMax` | 自动：步间隔最大(ms) | 350 |
| `autoSelectGap` | 自动：点螺丝→点孔间隔(ms) | 120 |
| `autoMoveDur` | 自动：手指移动时长(ms) | 260 |
| `autoJitter` | 自动：点击位置抖动(px) | 4 |
| `autoSpeed` | 自动：整体速度倍率 | 1 |
| `autoStartDelay` | 自动：开始前等待(ms) | 500 |

### 手指/触控笔光标

| 键 | 说明 | 默认 |
|---|---|---|
| `handShow` | 显示手指图片 | true |
| `handImg` | 上传手指PNG | (空) |
| `handAnchorX` | 指尖锚点X(0~1) | 0.05 |
| `handAnchorY` | 指尖锚点Y(0~1) | 0.05 |
| `handScale` | 手指缩放 | 1 |
| `handRest` | 空闲位置 | "br" |
| `handPress` | 按下缩放 | 0.93 |

### 声音

| 键 | 说明 | 默认 |
|---|---|---|
| `sfx` | 音效 | true |
| `sfxVol` | 音效音量 | 0.8 |
| `ratchetRate` | 棘轮咔哒频率(次/秒) | 45 |
| `ratchetPitch` | 棘轮音高 | 1 |
| `fallSfx` | 板掉落音效 | true |
| `bgm` | 上传背景音乐(可选) | (空) |
| `bgmVol` | 背景音乐音量 | 0.5 |

### 文字

| 键 | 说明 | 默认 |
|---|---|---|
| `discShow` | 显示底部免责声明 | false |
| `discText` | 底部文字 | "广告素材宣传场景须达到一定条件，触发相关支线玩法" |
| `discSize` | 底部字号 | 22 |
| `discY` | 底部文字Y(距底) | 26 |
| `vertShow` | 显示右侧竖排文字 | false |
| `vertText` | 竖排文字 | "游戏演示画面 模拟画面请勿模仿 无不良引导" |
| `vertSize` | 竖排字号 | 20 |
| `textOpacity` | 文字透明度 | 0.85 |

### 结束卡 & 录制

| 键 | 说明 | 默认 |
|---|---|---|
| `endCard` | 通关后显示结束卡 | false |
| `endText` | 结束卡文字 | "立即下载 挑战更多关卡" |
| `endDelay` | 结束卡延迟(ms) | 600 |
| `autoRec` | 自动通关时自动录制 | false |
| `recFormat` | 录制格式 | "auto" |
| `recBitrate` | 码率(Mbps) | 8 |
| `recFps` | 帧率 | 30 |
| `recTail` | 通关后继续录制(ms) | 1200 |

## 开发
```bash
npm i
npm run build   # 生成 index.html（esbuild 打包内联）
npm test        # playwright-core + /usr/bin/google-chrome 无头自动通关、录制并截图到 screenshots/
```
源码：`src/level.js`（参考关卡数据、规则、求解器、生成器）、`src/render.js`（背景/底板/板块/螺丝绘制）、`src/audio.js`（合成棘轮/掉落音效）、`src/settings.js`（参数定义）、`src/main.js`（动画、交互、录制、面板）。

参考分析见 `ref/ANALYSIS.md`，对比图 `screenshots/compare_ref_vs_tool.jpg`。

## 已知差异
- 参考视频为手绘素描贴图，本工具为程序化绘制（木纹/排线近似），细节质感仍有差距。
- 参考视频中玩法段无文字；免责声明与竖排文字来自开场段，默认关闭，可在“文字”中开启。
- 为保证 1 个初始空孔可解，参考关卡在若干板下放置了隐藏底孔（视频中无法确认）。
