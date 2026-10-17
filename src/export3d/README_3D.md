# 打螺丝 · 3D 动画导出说明（glTF / FBX / Blender）

压缩包内容：
- `scene.glb`：glTF 2.0 场景 + 动画（单个动画片段 `screw_game`）
- `scene.fbx`：由 Blender 无头转换得到（示例包内已附带；自己导出的包可用下面的命令生成）
- `scene3d.json`：帧率/帧范围/相机/淡入淡出曲线/音频事件等元数据；`timeline.json`：与 AE 导出相同的时间轴
- `blender_import.py`：Blender 一键导入脚本；`audio/*.wav`：逐事件音效 + 混合音轨

## 场景结构
- 坐标：Y 轴向上，单位米，**1 设计像素 = 1 mm**（画面 720×1280 → 0.72 m × 1.28 m），画面铺在 XZ 平面，屏幕右 = +X、屏幕下 = +Z。
- `background`：背景平面（贴图）；`base_hand`：手形底板，由描绘的手形多边形挤出 4 mm，顶面贴底板贴图。
- `plate_NN`：板块，由描绘出的多边形挤出真实厚度（= 设置“板块厚度”），顶面贴板面贴图（含自身孔），侧面为厚度边颜色。外层 `plate_NN_vis` 的缩放 1/0（阶梯插值）控制掉落结束后隐藏。
- `screw_NN`：螺丝。默认 **简单 3D 网格**：圆柱螺帽（顶面贴银色明暗贴图）+ 十字槽（两条深色凹槽，`_cross` 节点旋转 = 拧出/拧入）+ 螺杆（`_shank`）+ 投影（`_shadow`）。设置里可改为 **贴图四边形**（螺帽/十字槽为带透明的平面，适合纯 2D 合成）。选择 3D 网格的原因：在 C4D/UE5 里可直接打光、换材质、改透视相机。
- 抬起的表现：网页里螺丝抬起是画面上移 lift 像素（2.5D），3D 中螺帽升高 lift mm 并向 −Z 偏移 lift mm，螺杆从孔斜向连接到螺帽；俯视相机看到的画面与网页一致，透视相机看是“抬起并略倾斜”。
- 遮挡：下落中的板抬高 30 mm，移动中的螺丝抬高 40 mm（与网页的绘制顺序一致）。
- `hole_NN`：孔（贴图平面，位于底板上，被板盖住，板掉落后露出）。
- `hand`：手指/触控笔贴图平面（位置 + 按下缩放），`overlay_text` 免责声明文字，`end_card` 结束卡。
- `camera_ortho_topdown`：正交俯视相机，画面与网页完全对齐。
- 板的掉落时刻来自同一时间轴，已包含“螺丝阻挡探测”的判定结果。

## Blender（4.2 测试通过）
1. 解压，Blender → Scripting → 打开 `blender_import.py` → Run Script（脚本与 scene.glb 同目录）。
2. 脚本会：设置帧率与帧范围 → 导入 glb → 设活动相机/分辨率 720×1280 → 材质改为自发光无光照（与网页一致，色彩管理 Standard）→ 把 `scene3d.json` 的淡入淡出（螺丝投影、结束卡）烘到材质 Alpha → 音效按时间加入视频序列编辑器（混合音轨默认静音）。
3. 命令行（生成 FBX / 渲染校验帧）：
   `blender --background --python blender_import.py -- --fbx --render 0,30,60 --engine CYCLES --out 输出目录`

## Cinema 4D
- 推荐导入 `scene.fbx`（文件 → 合并/打开），勾选“动画”“相机”；或 C4D 2023+ 直接导入 `scene.glb`。
- 单位：FBX 为米制，如显示过大/过小，在导入设置里缩放 100 或 0.01。
- 材质为基础色贴图 + 自发光；若要无光照效果，把材质改为“仅发光”或关闭场景灯光。
- 显示/隐藏是缩放 0/1 的关键帧（阶梯），时间线上可见。

## Unreal Engine 5
- 内容浏览器 → 导入 `scene.fbx`（或启用 glTF Importer 插件后导入 glb）：勾选 Import Animations、Import Cameras，“Import Uniform Scale” 设为 100（米 → 厘米）。
- 导入后会生成 Level Sequence/动画；材质建议改为 Unlit（Shading Model = Unlit，Emissive = 贴图）。
- 音频：把 `audio/mix.wav` 导入为 Sound Wave，放入 Sequencer 的音频轨，起点 0。

## 限制
- 材质透明度动画不在 glTF 核心规范里：螺丝投影、结束卡的淡入淡出只保存在 `scene3d.json`，由 Blender 脚本烘焙；FBX/C4D/UE5 中只有显示/隐藏（缩放 0/1）。
- 板块投影（网页的柔和阴影）、点击波纹、调试叠加不导出；螺杆螺纹为纯色。
- 螺丝十字槽旋转与网页一致，但螺帽高光不随旋转（与网页相同）。
- 背景音乐（上传的 BGM）不包含，请在剪辑软件里自行添加。
