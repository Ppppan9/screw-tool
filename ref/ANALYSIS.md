# 参考视频分析 (ref/ref.mp4, 720x1280 30fps 18.63s)

## 时间轴（帧差检测）
- 0 – 2.77s：无关解压开场（红色爱心滴胶）。**场景切换在 2.80s**（不是 2.0s），玩法 2.80–18.63s。
- 开场带免责声明：底部 `广告素材宣传场景须达到一定条件，触发相关支线玩法`；右侧竖排 `游戏演示画面 模拟画面请勿模仿 无不良引导`（模糊，近似识读）。**玩法段画面中没有任何文字**，因此工具里两条文字默认关闭，可在设置中打开。
- 第一手操作（帧号 = 自 2.80s 起的 g_XXX 编号-1，30fps）：
  - 约 3.3s 笔尖点击右下单螺丝板的螺丝 → 螺丝 **抬起悬停**（4 帧≈0.13s 抬起，侧视可见螺杆、放大、带阴影），保持悬停等待第二次点击。
  - 约 0.35s 后笔点击空孔 → 螺丝 **飞行** 约 7 帧 ≈0.23s（弧线，直线略带上拱），**拧入** 约 3–4 帧 ≈0.12s，轻微回弹。
  - 板上螺丝全部拧走后约 1 帧开始 **板块直线下落**（无旋转），5 帧左右离开原位，加速下落出屏。露出下方底板的孔（底板在每个螺丝位置都有孔）。
- 因此交互是 **两次点击**：先点螺丝（抬起），再点空孔（飞入）。工具默认“两次点击”，可切换“单击自动选孔”。
- 场景全程静止（无镜头运动）。

## 布局（720x1280，start 帧 g_004.jpg）
- 背景：灰绿 ~#607f6d，带纸纹噪点；白色线描薄荷叶（约 6 簇，透明度 ~0.6）。
- 手掌底板：肉粉色 #c98b78（木纹斜线），深棕描边 #5a2e2a；手腕 x≈305–505, y≈840–925。
- 中心空孔 ≈(402,667)。
- 板块：淡紫 #c9c3ef → 高光 #e6e2fa，竖直木纹/铅笔排线，深色描边 #3b2a3a 约 2.5px，圆角，带下方阴影。
- 螺丝：银色十字头，直径 ≈36px，外圈暗环。
- 板块统计：5 指每指 4 段（拇指 3 段 + 掌底左 1 块），掌心 4 块双螺丝板 + 右下 1 块单螺丝板 → 共 25 块板、29 颗螺丝，1 个初始空孔。
- 精确坐标见 src/level.js（由 start 帧逐个描点，crop 偏移 (110,310)）。

## 板块掉落时机（v1.2.1 实测）
- 方法：ref.mp4 30fps 逐帧统计薰衣草像素数找掉落事件（3.47/4.47/11.03/12.63/18.47s 附近），放大裁切逐帧确认。
- 例：手腕右侧板，固定它的最后一颗螺丝在 3.967s 被点击拧出；4.067s 起螺丝已离孔悬停；**4.167s 板开始下落**（点击后约 200ms ≈ 6 帧），此时螺丝还在悬停/尚未选择目标孔，更未落孔。
- 结论：只有“坐在孔里”的螺丝固定板；螺丝一拧出（liftDur 140ms + fallDelay 30ms ≈ 170ms，渲染帧对齐后实测 187ms）板即掉落，与目标孔/落孔无关。取消选择（放回原孔）后该螺丝重新参与固定。
- 工具对照：screenshots/fall_timing_ref_vs_tool.jpg（点击后 0/67/133/167/200/267/333ms），test/fall-timing.mjs 输出 fallAfterLiftMs。
- 绘制顺序：悬停/飞行螺丝绘制在下落板之上。

## M-C 材质实测（v1.3，参考 2.93s 帧 vs 工具开局帧）
- 方法：`ffmpeg -ss 2.933 -i ref/ref.mp4 -frames:v 1 ref293.png`；`node test/dump-level.mjs level.json` 导出板/孔/底板多边形；`python3 tools/measure_materials.py ref293.png tool.png level.json` 用多边形距离场分区取样（中位数 / p95 亮 / p10 暗 / 亮度标准差）。多边形来自参考帧描绘，参考与工具同坐标。
- 放大并排：`python3 tools/material_compare.py` → screenshots/material_compare_before.jpg（v1.2.1）/ material_compare.jpg（v1.3）；整帧+差分：tools/compare_full.py → screenshots/compare_ref_vs_tool.jpg（PSNR 18.05 → 18.26 dB，主要差异来自螺丝十字角度随机、背景笔/纸纹）。

| 取样 | 参考 2.93s | 工具 v1.2.1 | 工具 v1.3 |
|---|---|---|---|
| plate center (d>9) | #bdb5ea | #c3bce6 | #bbb3e5 |
| plate center lum sd (hatch) | 51.2 | 27.7 | 29.4 |
| plate edge band (d 2.5-5) | #a997b7 | #c8c1e7 | #cac5df |
| plate highlight p95 | #fef9ff | #d9d4f2 | #f8f6fd |
| plate hatch dark p10 | #402f48 | #877ea0 | #8d84ab |
| plate outline (abs d<1.5, darkest10%) | #241426 | #35263c | #251628 |
| seam (outside plates, in base, d 1.5-3.5) | #97888d | #60424f | #8f877f |
| screw head body (r 8-15) | #9f9ac2 | #cdc9eb | #aaa6c4 |
| screw head top-left (-9,-9) | #aaa5cb | #eeebfd | #c4c1d6 |
| screw head bottom-right (+9,+9) | #817ca3 | #b8b3d8 | #9f9bba |
| screw head p95 | #fdfaff | #f0edfd | #e5e3f1 |
| cross slot (r<9, darkest10%) | #221f40 | #3c3a4c | #2a2748 |
| screw rim (r 17-21.5, darkest10%) | #30274d | #352840 | #30274d |
| empty hole interior (r<7) | #2c160f | #31211b | #2a140d |
| empty hole rim p95 (r 10-15) | #a07473 | #4e3f3c | #ead4ce |
| base wrist median | #be8980 | #bd8784 | #c18d83 |
| base wrist p95 (light strokes) | #ebc4c6 | #c6938e | #d5aea7 |
| base wrist p10 (dark strokes) | #b07b71 | #a87572 | #b9857b |
| base wrist lum sd | 17.3 | 7.1 | 10.6 |
| base outline (y>900, abs d<2, darkest10%) | #6f776d | #4a2626 | #4c6150 |
| base inner edge (d 2-4, y>880) p95 | #b5a9a7 | #c18d89 | #94ad9a |
| bg halo outside base (d 1.5-3, y>880) p95 | #90a595 | #76957e | #789981 |
| bg shadow just below base (d 3-8, y>900) | #668371 | #688971 | #6a8c74 |
| bg far (d 25-40, y>880) | #668572 | #6a8c74 | #6a8c74 |

观察与结论：
- 板块：参考中心 #bdb5ea，边缘有很强的白色光泽边（p95 ≈ #fef9ff），排线对比强（亮度 sd 51）；描边近黑紫 #241426 约 2px；厚度边几乎不可见；描边外有一圈浅色光晕（halo p95 #90a595 vs 背景 #668572）。
- 缝：参考缝内露出浅粉底板（#97888d），v1.2.1 被厚度边+粗描边填成暗色 #60424f。
- 螺丝：参考是拉丝银（扇形明暗交替，主体 #9f9ac2，高光近白），只有一圈细暗边 #30274d（无内圈），十字槽细且偏 x 形（#221f40，臂长≈0.56R）。v1.2.1 螺帽太亮且十字粗。
- 空孔：内部深红棕 #2c160f，下缘奶白斜面月牙；v1.2.1 是黑色描边的平孔。
- 底板：中位 #be8980 与工具一致；参考亮笔触强（p95 #ebc4c6）而暗笔触弱（p10 #b07b71）；描边处取样落在背景色 → 参考底板比描绘多边形略小，手指处几乎无粉色露边（板边到底板边中位 4~5px）→ 参考关卡底板内缩 3px。
- 投影：参考底板下方背景与远处几乎相同（#668371 vs #668572），投影极弱 → plateShadow 0.25→0.18。
- 未完全对齐：板块排线对比（sd 29 vs 51，参考是视频压缩+手绘纹理，再加强会显脏）；螺丝 p95 高光 #e5e3f1 < #fdfaff；底板亮笔触 sd 10.6 vs 17.3；手腕底部形状（几何，非材质）。
