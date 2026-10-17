# 打螺丝核玩工具（screw-tool）

> v1.3：底板与板块轮廓改为平滑矢量路径（抗锯齿，按设备像素比渲染），导出 AE/3D 同步平滑。

复刻买量视频中“手掌形打螺丝”玩法的网页工具：单文件 `index.html`，完全离线（无 CDN），可直接双击打开。

- 在线版：https://ppppan9.github.io/screw-tool/ 、 https://game.mmhygame.xyz/screw/
- 参考关卡按参考视频 2.93s 画面逐个描点（25 块板、29 颗螺丝、中心 1 个空孔 + 3 个被板盖住的隐藏底孔）。

## 玩法

> v1.3：底板与板块轮廓改为平滑矢量路径（抗锯齿，按设备像素比渲染），导出 AE/3D 同步平滑。
- 默认“两次点击”（与参考视频一致）：先点螺丝 → 螺丝逆时针拧出并抬起悬停；再点空孔 → 螺丝弧线飞入并顺时针拧入。
- 板块物理（v1.4，对齐参考视频）：螺丝拧起悬停/飞行时板不动，螺丝在目标孔**落座后**才释放；双钉板拧走一颗后绕剩余螺丝下垂摆动（约 17° 停住）；最后一颗离开后板受重力下落（偏心时带旋转）出屏，露出下方的孔。参数见设置「物理」。
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
| 导出 AE 工程（面板分组） | ● 开始记录 / ■ 停止并导出 / ⬇ 导出 ZIP：导出 After Effects 工程包（zip：assets/ PNG、audio/ WAV、timeline.json、build_ae_project.jsx、README_AE.md），每个元素独立图层+关键帧 |
| 导出 3D 动画 (glTF/FBX/Blender) | 导出 scene.glb（真实厚度板块网格、3D 螺丝、挤出手形底板、背景、正交俯视相机、动画）+ blender_import.py + 音频 + README_3D.md |

设置自动保存在 localStorage（`screwTool.settings`，带版本号与迁移）。手指 PNG / 背景音乐以 dataURL 存入设置。

### AE / 3D 导出（v1.2）
时间轴从“重新开始”或“自动通关”开始时自动记录（每帧采样板块状态/下落位移/旋转、每颗螺丝位置/旋转/抬起/缩放、手指位置与按压、结束卡透明度、音效事件），通关后（结束卡 + 尾巴）自动停止。点导出即打包。
- **AE**：主合成 720×1280，帧率可选（24/25/30/60）。图层：背景、手形底板、孔（被覆盖的孔在露出时入点）、板块+投影（静止段）、螺丝静止段（螺帽+十字槽）、板块下落（重力逐帧烘焙/精简关键帧、旋转、可选淡出）、螺丝移动段（投影/螺杆/螺帽/十字槽：弧线位置、抬起缩放、拧出拧入旋转、投影透明度、螺杆露出）、免责声明文字、结束卡、手指/触控笔（上传 PNG）、音效逐事件预合成 + 混合音轨。AE 里 文件→脚本→运行脚本文件 选 build_ae_project.jsx 即可（按脚本自身位置找素材）。详见包内 README_AE.md。
- **3D**：scene.glb + scene3d.json + blender_import.py（帧率/帧范围、无光照材质、音频条、可选导出 FBX），Blender/C4D/UE5 导入步骤与限制见包内 README_3D.md。螺丝默认为简单 3D 网格（十字槽螺帽+螺杆），可改为贴图四边形。
- 示例：`/workspace/screw_ae_sample.zip`、`/workspace/screw_3d_sample.zip`（含 Blender 无头转换的 scene.fbx）；校验图 `screenshots/ae_export_check.jpg`、`screenshots/export3d_blender_compare.jpg`。

### 手指光标
默认不内置手图。在“手指/触控笔光标”里上传透明 PNG（手 + 触控笔），用锚点 X/Y（0~1，图片内相对位置）标定笔尖，缩放可调；点击时有按压缩放反馈。

## 参数一览（设置版本 7，由 src/settings.js 生成；通用键见 ref/TOOLKIT_STANDARD.md）

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
| `screwBlock` | 螺丝阻挡探测（板被任意贯穿螺丝挡住） | true |
| `debugPins` | 调试：显示螺丝固定哪些板 | false |
| `moveRule` | 落孔规则 | "tap2" |

### 导入透明图形生成关卡
| 键 | 说明 | 默认 |
|---|---|---|
| `shapeImg` | 上传透明PNG/WebP（未上传=内置心形） | "(空)" |
| `shapeThreshold` | Alpha 阈值 | 0.5 |
| `shapeMargin` | 左右边距(px) | 40 |
| `shapeMaxH` | 最大高度(px) | 760 |
| `shapeScale` | 图形缩放 | 1 |
| `shapeOffX` | 图形偏移X | 0 |
| `shapeOffY` | 图形偏移Y | 0 |
| `partStyle` | 切分风格 | "strip" |
| `plateSize` | 目标板尺寸(px) | 110 |
| `plateCount` | 板数(Voronoi，0=按尺寸) | 0 |
| `vorDensity` | Voronoi 自动板数倍率(板数=0 时) | 2.6 |
| `partAngle` | 条带方向(度) | 90 |
| `partRandom` | 随机度 | 0.5 |
| `shapeSeed` | 图形关卡种子 | 1 |
| `seamW` | 缝宽(px) | 5 |
| `edgeInset` | 板距底板边缘(px) | 7 |
| `minPlateArea` | 最小板面积(px²) | 2200 |
| `imgScrewMin` | 每板螺丝数 最少 | 1 |
| `imgScrewMax` | 每板螺丝数 最多 | 2 |
| `screwEdgeMin` | 螺丝距板边最小(px) | 20 |
| `imgEmpty` | 初始空孔数 | 1 |
| `imgHidden` | 隐藏底孔数 | 3 |
| `imgLayers` | 层数 | 1 |
| `layerOverlap` | 上层保留比例 | 0.35 |
| `baseFill` | 底板填充 | "color" |
| `plateTint` | 板块着色 | "settings" |
| `plateTintAmt` | 图片颜色混合比例 | 0.35 |

### 外观
| 键 | 说明 | 默认 |
|---|---|---|
| `bgMode` | 背景类型 | "image" |
| `bgColor` | 背景色(程序化) | "#668772" |
| `bgNoise` | 背景纸纹强度 | 0.1 |
| `leafOpacity` | 薄荷叶线稿透明度 | 0.35 |
| `leafColor` | 叶子线条色 | "#eef3ea" |
| `leafScale` | 叶子大小 | 1 |
| `baseColor` | 底板颜色 | "#bf8a80" |
| `baseGrain` | 底板木纹强度 | 0.16 |
| `baseOutline` | 底板描边色 | "#3a1d1c" |
| `baseGloss` | 底板内侧白色亮边 | 0.5 |
| `edgeHalo` | 描边外浅色光晕 | 0.28 |
| `plateColor` | 板块颜色 | "#bfb7ee" |
| `plateShade` | 板块厚度边颜色 | "#5d5394" |
| `plateThick` | 板块厚度(px) | 1.5 |
| `plateGrain` | 板块木纹/排线强度 | 0.3 |
| `plateOutline` | 板块描边色 | "#261729" |
| `plateGloss` | 板块光泽白边强度 | 0.85 |
| `outlineW` | 描边宽度 | 2.1 |
| `plateRadius` | 板块圆角倍率 | 1 |
| `plateShadow` | 板块投影 | 0.18 |
| `screwSize` | 螺丝直径(px) | 40 |
| `screwColor` | 螺丝主色 | "#c4bfe6" |
| `screwDark` | 螺丝暗部色 | "#5f5a86" |
| `screwBrush` | 螺丝拉丝明暗强度 | 0.6 |
| `screwRim` | 螺丝边缘色 | "#30274d" |
| `screwRimW` | 螺丝边缘宽度 | 1.6 |
| `screwCross` | 十字槽颜色 | "#2a2748" |
| `crossLen` | 十字槽臂长(×半径) | 0.6 |
| `crossW` | 十字槽宽(×半径) | 0.34 |
| `holeSize` | 孔直径(px) | 30 |
| `holeColor` | 孔颜色 | "#2a140d" |

### 动画时长
| 键 | 说明 | 默认 |
|---|---|---|
| `liftDur` | 拧出/抬起时长(ms) | 120 |
| `unscrewTurns` | 拧出旋转圈数(逆时针) | 1 |
| `liftH` | 抬起高度(px) | 22 |
| `liftScale` | 抬起放大 | 1.15 |
| `hoverBob` | 悬停浮动幅度(px) | 0（参考悬停静止） |
| `flyDur` | 飞行时长(ms) | 133 |
| `arcBend` | 飞行弧度(px) | 40 |
| `screwInDur` | 拧入时长(ms) | 100 |
| `screwInTurns` | 拧入旋转圈数(顺时针) | 1 |
| `settle` | 拧入回弹幅度 | 0.06 |
| `releaseAt` | 板块释放时机 | seat（落座后）/ lift |
| `releaseDelay` | 释放延迟(ms) | 50 |
| `gravity` | 重力(px/s²) | 3600 |
| `swingBoost` | 单钉摆动加速倍率 | 2.2 |
| `swingMax` | 单钉摆动最大角度(度) | 17 |
| `swingDamp` | 摆动阻尼(1/s) | 6 |
| `swingBounce` | 最大角回弹 | 0.05 |
| `swingKick` | 摆动初始角速度(度/秒) | 0 |
| `releaseSpinK` | 掉落初始旋转(度/秒/px 偏心) | 8.3 |
| `fallSpin` | 下落旋转(度/秒，参考=0) | 0 |
| `fallFade` | 下落时淡出 | false |

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

### 音效
| 键 | 说明 | 默认 |
|---|---|---|
| `sfxMute` | 静音 | false |
| `sfxVolume` | 总音量 | 0.8 |
| `ratchetRate` | 棘轮咔哒频率(次/秒) | 45 |
| `ratchetPitch` | 棘轮音高 | 1 |
| `fallSfx` | 板掉落音效 | true |
| `bgm` | 上传背景音乐(可选) | "(空)" |
| `bgmVol` | 背景音乐音量 | 0.5 |

### 手指 / 自动通关
| 键 | 说明 | 默认 |
|---|---|---|
| `autoSpeed` | 整体速度倍率 | 1 |
| `moveMin` | 移动耗时最小(ms) | 220 |
| `moveMax` | 移动耗时最大(ms) | 300 |
| `delayMin` | 点击间隔最小(ms) | 150 |
| `delayMax` | 点击间隔最大(ms) | 350 |
| `thinkChance` | “思考停顿”概率 | 0 |
| `thinkMax` | 思考停顿最长(ms) | 900 |
| `jitter` | 落点随机抖动(px) | 4 |
| `handSize` | 手指大小(画面宽比例) | 0.42 |
| `handAnchorX` | 指尖锚点 X(0~1) | 0.05 |
| `handAnchorY` | 指尖锚点 Y(0~1) | 0.05 |
| `handImage` | 上传手指图片(透明PNG，不上传则不显示手指) | "(空)" |
| `pressEnabled` | 点击按下效果（手指按压） | true |
| `pressDepth` | 按压幅度 | 0.07 |
| `tapRipple` | 点击处显示波纹圈（参考视频没有） | false |
| `handShow` | 显示手指图片 | true |
| `handRest` | 空闲位置 | "br" |
| `autoSelectGap` | 点螺丝→点孔间隔(ms) | 120 |
| `autoStartDelay` | 开始前等待(ms) | 500 |

### 录制
| 键 | 说明 | 默认 |
|---|---|---|
| `recFps` | 帧率 | 30 |
| `recFormat` | 格式 | "auto" |
| `recBitrate` | 码率(Mbps) | 8 |
| `autoRec` | 自动通关开始时自动录制（默认关） | false |
| `autoStop` | 自动通关通关后停止录制并下载（仅在正在录制时） | true |
| `tailSec` | 通关后继续录制(秒) | 1.2 |

### 导出 AE 工程
| 键 | 说明 | 默认 |
|---|---|---|
| 按钮 | 记录 AE 时间轴（自动通关/手动游玩都可）（● 开始记录） | |
| 按钮 | 重新导出上一次记录（⬇ 导出 ZIP） | |
| `aeWithRec` | 录制视频时同步记录，停止录制后自动导出 | true |
| `aeFps` | AE 合成帧率 | "30" |
| `aeSize` | AE 合成尺寸 | "canvas" |
| `aeSampling` | 关键帧方式 | "reduce" |
| `aeNames` | 图层命名 | "zh" |
| `aeAudio` | 音频 | "both" |
| `aeSaveAep` | 脚本跑完后提示另存为 .aep | true |

### 导出 3D 动画（UE5 / C4D / Blender）
| 键 | 说明 | 默认 |
|---|---|---|
| 按钮 | 用上一次 AE 记录生成 glTF 场景 + Blender 脚本 + 音频（导出 3D 动画 (glTF/FBX/Blender)） | |
| `export3dFps` | 3D 动画帧率 | "30" |
| `export3dHand` | 包含手指（贴图平面；结束页是否显示仍按“结束页显示手指”） | true |
| `export3dScrew` | 螺丝形式 | "mesh" |

### 结束页(End Card)
| 键 | 说明 | 默认 |
|---|---|---|
| `endCard` | 显示结束页 | false |
| `endCardHand` | 结束页显示手指（自动通关点按钮） | false |
| `endDelay` | 通关后出现延迟(ms) | 600 |
| `endTitle` | 标题 | "立即下载 挑战更多关卡" |

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

## v1.2.1 修复
螺丝一拧出（悬停、飞行中）就不再固定板块，板立即下落（对齐参考视频：点击后约 0.2 秒）。取消选择放回原孔后重新参与固定。

## v1.3 材质对齐 + v1.3.1 与麻将工具统一
- 材质按参考帧 2.93s 实测对齐（ref/ANALYSIS.md「M-C 材质实测」）：板块光泽白边、斜向铅笔排线、近黑紫细描边、描边外浅色光晕、薄厚度边；螺丝拉丝银、细暗边、细十字；空孔深红棕+奶白斜面；底板亮笔触+内侧亮边；参考关卡底板内缩 3px（手指处不再露粉边）。对照图：screenshots/material_compare_before.jpg、material_compare.jpg、compare_ref_vs_tool.jpg。
- Voronoi 自动板数倍率 `vorDensity`（默认 2.6）。
- 通用参数（手指/自动通关、录制、导出 AE/3D、结束页、音效）键名、中文标签、分组顺序与麻将工具一致，旧键自动迁移（settings v7）；AE 导出支持「图层命名 中文/English」「AE 合成尺寸」「另存 .aep 提示」，主合成每个音效事件一个标记，混合音轨默认开启；3D 导出复用 AE 记录（逐帧、英文命名）。规范：ref/TOOLKIT_STANDARD.md。
