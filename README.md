# 打螺丝核玩工具（screw-tool）

> v1.3：底板与板块轮廓改为平滑矢量路径（抗锯齿，按设备像素比渲染），导出 AE/3D 同步平滑。

复刻买量视频中“手掌形打螺丝”玩法的网页工具：单文件 `index.html`，完全离线（无 CDN），可直接双击打开。

- 在线版：https://ppppan9.github.io/screw-tool/ 、 https://game.mmhygame.xyz/screw/
- 参考关卡按参考视频 2.93s 画面逐个描点（25 块板、29 颗螺丝、中心 1 个空孔 + 3 个被板盖住的隐藏底孔）。

## 玩法

> v1.3：底板与板块轮廓改为平滑矢量路径（抗锯齿，按设备像素比渲染），导出 AE/3D 同步平滑。
- 默认“两次点击”（与参考视频一致）：先点螺丝 → 螺丝逆时针拧出并抬起悬停；再点空孔 → 螺丝弧线飞入并顺时针拧入。
- 板上螺丝全部取走后，板块直线受重力下落出屏，露出下方的孔。
- **螺丝阻挡探测（v1.2，默认开启）**：螺丝贯穿该点所有重叠的板直到底板。一块板只有在**没有任何螺丝固定它**时才掉落——不只是它自己孔里的螺丝，任何位置落在它轮廓内的螺丝（任意层，包括上层板孔里的螺丝）都会挡住它；把螺丝拧进某个孔也会挡住覆盖该点的板。每次螺丝移动后重新评估所有板（拔出螺丝可能同时释放多块板）。求解器与随机关卡生成器使用同一规则，参考关卡在新规则下仍可解（29 步，隐藏孔无需调整）。可在“画布与关卡”关闭（回到 v1.1：只看自己孔里的螺丝）。
- 调试叠加“显示螺丝固定哪些板”：每块未掉落的板中心显示固定它的螺丝数，绿线 = 自己的螺丝，红色虚线 = 其它板的螺丝贯穿挡住。
- 孔可用条件：没有螺丝，且所有覆盖该点的更高层板都已掉落或在此处有孔（支持多层叠放 z-order）。
- 也可在设置中切换“单击”规则：最近空孔 / 优先刚空出的孔 / 随机。

## 控制面板
| 按钮 | 作用 |
|---|---|
| ▶ 自动通关 | 求解器计算可行步骤，并以拟人方式（曲线移动、随机间隔、点击抖动）操作手指光标 |
| ⏺ 开始录制 | 录制画布 + WebAudio 音效（含背景音乐），优先 MP4，不支持时 WebM |
| ↻ 重新开始 / 🎲 换一局 | 重置 / 随机生成新关卡（生成器保证可解） |
| 📷 截图 | 导出当前画面 PNG |
| 导出/导入设置 | JSON 文件（带版本号，导入时自动迁移） |
| 导出 AE 工程 | 导出 After Effects 工程包（zip：assets/ PNG、audio/ WAV、timeline.json、build_ae_project.jsx、README_AE.md），每个元素独立图层+关键帧 |
| 导出 3D 动画 (glTF/FBX/Blender) | 导出 scene.glb（真实厚度板块网格、3D 螺丝、挤出手形底板、背景、正交俯视相机、动画）+ blender_import.py + 音频 + README_3D.md |

设置自动保存在 localStorage（`screwTool.settings`，带版本号与迁移）。手指 PNG / 背景音乐以 dataURL 存入设置。

### AE / 3D 导出（v1.2）
时间轴从“重新开始”或“自动通关”开始时自动记录（每帧采样板块状态/下落位移/旋转、每颗螺丝位置/旋转/抬起/缩放、手指位置与按压、结束卡透明度、音效事件），通关后（结束卡 + 尾巴）自动停止。点导出即打包。
- **AE**：主合成 720×1280，帧率可选（24/25/30/60）。图层：背景、手形底板、孔（被覆盖的孔在露出时入点）、板块+投影（静止段）、螺丝静止段（螺帽+十字槽）、板块下落（重力逐帧烘焙/精简关键帧、旋转、可选淡出）、螺丝移动段（投影/螺杆/螺帽/十字槽：弧线位置、抬起缩放、拧出拧入旋转、投影透明度、螺杆露出）、免责声明文字、结束卡、手指/触控笔（上传 PNG）、音效逐事件预合成 + 混合音轨。AE 里 文件→脚本→运行脚本文件 选 build_ae_project.jsx 即可（按脚本自身位置找素材）。详见包内 README_AE.md。
- **3D**：scene.glb + scene3d.json + blender_import.py（帧率/帧范围、无光照材质、音频条、可选导出 FBX），Blender/C4D/UE5 导入步骤与限制见包内 README_3D.md。螺丝默认为简单 3D 网格（十字槽螺帽+螺杆），可改为贴图四边形。
- 示例：`/workspace/screw_ae_sample.zip`、`/workspace/screw_3d_sample.zip`（含 Blender 无头转换的 scene.fbx）；校验图 `screenshots/ae_export_check.jpg`、`screenshots/export3d_blender_compare.jpg`。

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

### 新增（v1.2，设置版本 3，旧设置迁移时只补默认值）

| 键 | 说明 | 默认 |
|---|---|---|
| `screwBlock` | 螺丝阻挡探测 | true |
| `debugPins` | 调试：显示螺丝固定哪些板 | false |
| `aeFps` | AE 导出帧率 | "30" |
| `aeSampling` | AE 关键帧：精简 / 逐帧烘焙 | "reduce" |
| `aeAudio` | AE 音频：逐事件+混合 / 仅逐事件 / 仅混合 / 不导出 | "both" |
| `export3dFps` | 3D 导出帧率 | "30" |
| `export3dScrew` | 3D 螺丝形式：3D 网格 / 贴图四边形 | "mesh" |
| `export3dHand` | 3D 导出包含手指 | true |

## 开发
```bash
npm i
npm run build   # 生成 index.html（esbuild 打包内联）
npm test        # playwright-core + /usr/bin/google-chrome 无头自动通关、录制并截图到 screenshots/
npm run test:logic  # 螺丝阻挡判定单元测试（被别的板的螺丝贯穿的板，在该螺丝拔出前不会掉落）
npm run test:ae     # 自动通关→导出 AE zip→模拟 AE 对象模型运行 jsx（ES3 语法、图层/关键帧/入出点核对）→按图层语义重建画面与网页帧比 PSNR
npm run test:3d     # 导出 3D zip→Blender 4.2 无头导入、统计、Cycles 渲染比 PSNR、转换 FBX
```
源码：`src/level.js`（参考关卡数据、规则、求解器、生成器）、`src/render.js`（背景/底板/板块/螺丝绘制）、`src/audio.js`（合成棘轮/掉落音效）、`src/settings.js`（参数定义）、`src/main.js`（动画、交互、录制、面板）。

参考分析见 `ref/ANALYSIS.md`，对比图 `screenshots/compare_ref_vs_tool.jpg`。

## 已知差异
- 参考视频为手绘素描贴图，本工具为程序化绘制（木纹/排线近似），细节质感仍有差距。
- 参考视频中玩法段无文字；免责声明与竖排文字来自开场段，默认关闭，可在“文字”中开启。
- 为保证 1 个初始空孔可解，参考关卡在若干板下放置了隐藏底孔（视频中无法确认）。


## 导入透明图形生成关卡（v1.3）
1. 设置面板「画布与关卡 → 关卡」选「导入透明图形生成」，或在「导入透明图形生成关卡」组上传带透明通道的 PNG/WebP（上传后自动切换）。未上传时使用内置心形。
2. Alpha 阈值决定剪影；边距/最大高度/缩放/偏移控制放置；支持多块与内孔。
3. 切分风格：条状分段（参考手指风格）/ Voronoi / 网格；可调目标板尺寸、板数、条带方向、随机度、缝宽、板距边缘、最小板面积、层数与上层保留比例。
4. 每板螺丝 1~3 颗（距板边最小距离可调）；初始空孔、隐藏底孔数量可调；生成后用求解器验证可解，不可解自动换种子。
5. 底板填充可选“图片自身像素”，板块可按图片颜色混合。按钮「🧩 重新生成图形关卡」换种子重新切分。AE/3D 导出同样适用。
测试：`node test/shape-test.mjs`（3 张样例图生成+自动通关，输出 screenshots/import_shape_samples.jpg）。
