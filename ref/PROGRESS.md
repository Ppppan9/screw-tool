# 进度
- [x] M1 帧分析（ANALYSIS.md, screenshots/ref_*.jpg）
- [x] M2 可玩版本：src/{level,render,audio,settings,main}.js，build.mjs → index.html；test/run-test.mjs 自动通关+录制通过
- [ ] 视觉细调：叶子形状（参考为大卵形叶片少锯齿）、手指底板露边过多、拇指尖形状
- [x] M3 README、GitHub Pages(built, cmp一致)、服务器 /screw/ (cmp一致)；部署脚本 /workspace/screw-tool-deploy.sh
## 继续工作提示
- 叠加检查脚本：把 referenceLevel() 的板/孔画到 ref/frames/g_004.jpg 上（见 ANALYSIS.md 坐标说明）
- `npm run build && npm test`，截图在 screenshots/
- [x] v1.1 视觉对齐：tools/trace_plates.py（以已知螺丝为种子的分水岭分割参考帧 → src/ref_trace.json，25 块板边到边铺满 + 手型轮廓）；tools/make_bg.py（多帧逐像素取绿色样本中位数去笔/手，手掌区归一化模糊填充 → src/bg_ref.jpg，默认背景，可切程序化）。重新生成需先生成 tools/screw_groups.json（每块板螺丝坐标，见 git 历史 v1.1 提交说明）。设置版本 v2（迁移旧默认值）。
## v1.2（进行中）
- [x] M1 螺丝阻挡判定：level.js setBlocking/platePins/holeLayer；板只有在没有任何贯穿螺丝（自己孔里的 + 位置落在其轮廓内的任何螺丝）时才掉落；applyMove 每次移动后不动点重评所有板；孔可用=未被更高层无孔板覆盖；求解器优先未覆盖孔。设置 v3：screwBlock(默认开)、debugPins 调试叠加、AE/3D 导出设置（迁移只补默认值）。test/logic-test.mjs（npm run test:logic）通过；参考关卡 29 步可解（隐藏孔无需调整）；run-test 自动通关 25/25。
- [x] M2 AE 导出 src/ae/（recorder.js 每帧采样 newGame/自动通关开始时重置；zip.js；build_ae_project.jsx 复用麻将版+audioEnabled；README_AE.md）。audio.js 加 hook/now()/renderSfxOffline/encodeWav；render.js drawScrew 支持 part 拆层。npm run test:ae：ae-export(→/workspace/screw_ae_sample.zip, 截图 /tmp/screw_ae/snaps) + ae-mock + ae-composite（PSNR 均值 37.8 dB）→ screenshots/ae_export_check.jpg
- [x] M3 3D 导出 src/export3d/（export3d.js 直接用记录器原始样本；板块=挤出多边形+贴面四边形；螺丝=3D 网格或四边形；blender_import.py；README_3D.md）。E3D=1 node test/ae-export.mjs → /workspace/screw_3d_sample.zip；bash test/export3d-blender.sh（Blender 计数、Cycles 渲染 PSNR 23~28 dB、FBX 放回 zip）→ screenshots/export3d_blender_compare.jpg
- [x] M4 README、提交 'v1.2: 螺丝阻挡判定 + AE 与 3D 动画导出'、push、Pages、部署
## M-next（v1.2 之后，由后续接手者完成）
- (a) 最重要：导入任意带透明通道图片（PNG/WebP）生成关卡：alpha 轮廓 → 底板形状（平滑轮廓、内孔）、按参考风格自动切分板块（细缝、尺寸可调）、螺丝布置、空孔/隐藏孔、分层；在阻挡规则下保证可解；可选使用图片自身颜色/纹理作底板或板块；参数：板数/尺寸、每板螺丝数、缝宽等。
- (b) 严格对照参考帧校验材质/风格：板块薰衣草渐变、高光、排线/木纹、描边、厚度边、投影；螺丝帽银色明暗、十字槽、边缘；底板粉色纹理与描边；缝隙。做放大并排裁切对比并修正差异。
- (c) Bug：粉色手形底板（尤其手腕/底部）边缘锯齿 —— 用平滑抗锯齿矢量路径渲染（不用像素蒙版；平滑轮廓，或高分辨率蒙版 模糊+阈值，或按 devicePixelRatio 缩放），导出（AE/3D）也要同样处理。ref_trace.json 的 base 多边形点很密/阶梯状，可先做 Chaikin/RDP 平滑。

## v1.3 M-A（完成）底板/板块抗锯齿
- 新增 src/geom.js：RDP 简化 + Chaikin 平滑闭合多边形；参考关卡底板（eps1.8, 3 次）与板块（eps1.2, 2 次）轮廓平滑后以矢量 path 填充/描边。
- 底板离屏画布分辨率乘以 devicePixelRatio（上限 3）；3D 导出挤出用同一平滑多边形，AE 底板 PNG 来自同一画布。
- 对比：screenshots/base_edge_before_after.jpg。设置版本 4（迁移不改值）。

## v1.3 M-B（完成，可用）导入透明图形生成关卡
- src/shapegen.js：alpha→marching squares 平滑底板（多块+内孔，evenodd 绘制，3D 挤出带孔）；切分 strip/voronoi/grid → 连通分量 → 小碎片合并 → 距离场等值线得到带细缝的板；螺丝按内切距离布置；去掉小板留出可见空孔；隐藏底孔；solve() 验证，失败换种子（14 次）后回退参考关卡。
- 设置 v5（只补默认）；按钮“🧩 重新生成图形关卡”；底板填充可用图片像素；板块可按图片颜色混合。
- 测试 test/shape-test.mjs + test/assets/shapes/{heart,star_hole,cat}.png → screenshots/import_shape_samples.jpg。
- shape-test 结果：heart 25 板/1 次尝试、star_hole 8 板(Voronoi,带内孔)/7 次、cat 19 板 2 层(图片纹理底板+图片着色)/18 次，三者自动通关完成。种子重试 24 次，每 4 次失败多加 1 个空孔。
- 剩余：M-C 材质对照未做；AE/3D 导出对图形关卡未单独跑自动测试（代码路径相同，3D 底板支持内孔）。

## v1.2.1（紧急修复，完成）拧出的螺丝不再阻挡板块掉落
- level.js：settle()/liftOut()/cancelLift()；platePins 忽略拧出中的螺丝；applyMove 先“螺丝离孔”结算掉落再落孔（求解器同步）。
- main.js：拧出（第一次点击）即结算，板在 t_tap+liftDur+fallDelay 开始下落；取消放回重新固定；飞行中不再等落孔。
- 测试：logic-test 新增 6 项（悬停中掉落、取消重固定、飞往被释放板下的孔）；test/fall-timing.mjs 实测 187ms（参考 ~200ms）。

## v1.3 M-C（完成）材质/风格对照参考帧
- 工具：test/dump-level.mjs、tools/measure_materials.py（取样表写入 ANALYSIS.md）、tools/material_compare.py（7 个放大并排裁切+差分）、tools/compare_full.py（整帧+差分+PSNR）。
- render.js：板块光泽白边(plateGloss)+右下淡暗边、斜向铅笔排线（临时层整体模糊）、描边外浅色光晕(edgeHalo)、薄厚度边；螺丝拉丝锥形渐变(screwBrush)、细暗边(screwRim/screwRimW)、去内圈、细十字(crossLen/crossW)；孔：深红棕+奶白斜面月牙；底板：弱暗纹+强亮纹、内侧白亮边(baseGloss)。geom.offsetPoly：参考关卡底板内缩 3px（手指不再露粉边）。
- 设置 v6：旧默认值→新默认（迁移只替换仍为旧默认的值），新增键只补默认。vorDensity=2.6（Voronoi 自动板数倍率，star_hole 19 板）。
- 截图：screenshots/material_compare_before.jpg / material_compare.jpg / compare_ref_vs_tool.jpg。
