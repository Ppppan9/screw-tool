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

## v1.3.1（随 v1.3 一起提交）导出格式与通用参数对齐麻将工具
- settings v7：autoStepMin/Max→delayMin/Max，autoMoveDur→moveMin/Max(±15%)，autoJitter→jitter，handImg→handImage，handScale→handSize(画面宽比例, ×0.42)，handPress→pressDepth(1-x)，tapFx→pressEnabled，sfx→sfxMute(取反)，sfxVol→sfxVolume，recTail(ms)→tailSec(s)，endText→endTitle；新增 thinkChance/thinkMax、autoStop、aeWithRec、aeSize、aeNames、aeSaveAep、endCardHand。分组/标签/顺序同麻将（音效 → 手指 / 自动通关 → 录制 → 导出 AE 工程 → 导出 3D 动画 → 结束页）。
- 面板按钮：AE「● 开始记录/■ 停止并导出」「⬇ 导出 ZIP」、3D「导出 3D 动画 (glTF/FBX/Blender)」移入对应分组（顶部按钮与麻将一致）。打螺丝保留“开局即记录”。
- AE：aeNames 中/英命名后处理、aeSize 整体缩放 K（meta.scale）、meta.saveAep 跟随设置、主合成每个音效事件一个标记、混合音轨默认开启（与麻将一致）；图层名 结束页/手指/免责声明。3D：复用 AE 记录（export3dFps、bake、en、canvas、both），十字槽尺寸跟随 crossLen/crossW。
- 规范文档 ref/TOOLKIT_STANDARD.md。
- 剩余：handRotation/handFlip/manualHand/handAvoid、recRes 未移植（打螺丝用 canvasW/H）；逐事件音效无 audioDb（音效 hook 无音量）。

## v1.4（完成）板块物理反馈对齐参考
- S1 参考逐帧重分析（ANALYSIS.md「物理反馈」，screenshots/ref_physics_frames.jpg；tools/track_plate_rot.py 模板配准测角）：悬停/飞行期间板不动；螺丝在目标孔落座后 33–67ms 才释放；双钉板拧走一颗 → 绕剩余钉 ~100ms 内下垂到 16.75° 硬停；最后一颗 → 3600 px/s² 下落，偏心钉带来 ~75°/s 旋转。v1.2.1 “拧出 200ms 掉落”是把第二次点击当成第一次点击的误判。
- S2 src/physics.js：多边形质量属性（质心、k2=I/m）；钉=铰接；≥2 钉固定；由多钉减到 1 钉 → 物理摆（boost·g·rx/(k2+r²)，阻尼、最大角限位+回弹、初始角速度）；0 钉 → 重力自由落体 + 保留角速度 + 偏心力矩初始旋转。main.js：vHole 视觉固定（落座+releaseDelay 才更新）、holeWorld（摆动板上的孔/螺丝随板变换，点击判定、自动通关点击位置、飞行目标都用世界坐标）。逻辑/求解器不变。设置 v8：分组「物理」(releaseAt seat|lift, releaseDelay, gravity 3600, swingBoost, swingMax, swingDamp, swingBounce, swingKick, releaseSpinK, fallSpin, fallFade)，迁移：gravity 旧默认 5200→3600，删除 fallDelay。
- 录制样本 plates: [t, 0/1 有位姿/2 消失, dx, dy, ang]（绕贴图中心）；AE「板块 N 运动」层逐帧位置+旋转；3D 节点 position(x,z)+quaternion；摆动板孔里的螺丝作为运动段逐帧烘焙。
- S3 test/physics-test.mjs（npm run test:physics）：按参考节奏点击前两手 → 板23 落座后 80ms 掉落（tap1 后 948ms，之前 dy=0），板22 落座后 62ms 开始摆，0/36/73ms = 1.1/10.3/17°，支点漂移 0；screenshots/physics_ref_vs_tool.jpg（tools/physics_compare.py）；/workspace/screw_physics_sample.mp4。
- 未对齐：工具飞行+拧入 360ms（参考 ~233ms），所以同一时刻对比工具晚 ~180ms；参考里掉落板看起来略放大（可能是运动模糊），未模拟；参考片段中没有“摆动板再拧走最后一颗”的画面。
- v1.4.1：螺丝动画时长对齐参考（liftDur 140→120, flyDur 230→133, screwInDur 130→100, hoverBob 2→0；设置 v9 只替换仍为旧默认的值）。test:physics 实测：板23 掉落 tap1 后 +794ms（参考 +767），板22 摆动 +2251ms（参考 +2300）；tap2→落座 257/254ms（参考 167–333）。
- v1.4.2：打开页面不再自动开始记录（与麻将一致）。newGame()/autoSolve() 去掉 recStart()；AE 记录只由「● 开始记录」或录制视频（aeWithRec，仅在录制前未在记录时由它开启、停止录制时一并停止并导出）开始；MediaRecorder 只由「开始录制」或 autoRec（默认关）启动。导出 AE/3D：记录中用当前记录，否则用同一关卡的最近一次记录，没有则提示“请先用“开始记录”记录一段”。记录中重新开局：保持记录，时间轴从新关卡重新开始。测试 test/no-autorec.mjs（npm run test:norec，全新 localStorage + MediaRecorder 计数）；test/ae-export.mjs 显式 aeStart()。
- v1.5：孔位固定在底板，板孔对齐才能放螺丝。level.js：st.swing（多钉→1 钉时按 ±swingMax 绕剩余钉的位姿）、plateAligned/plateCovers（摆动板用旋转后轮廓与孔位，ALIGN_TOL 6px、EDGE_TOL 9px）、holeUsable/screwFree/platePins 改用之；默认 releaseAt='seat'：拧出/悬停不改逻辑，applyMove 直接落孔再结算（'lift' 模式保留旧逻辑）；solve clone 复制 swing/npins。main.js：holeWorld 恒为底板坐标（板孔只随板绘制）；visBlocked() 画面遮挡（逻辑已掉/下落中的板、摆动板错位孔）；点击判定 holeTargetable = holeUsable && !visBlocked；自动通关等目标孔可点后再点。测试：logic-test 新增 v1.5 组（摆动后孔不可用、掉落后露出、随机 6/6 + 参考关卡计划逐步合法）；test/hole-align-test.mjs（npm run test:holes）复现用户场景。设置版本不变（v9）。
- v1.6：板孔透出底板，下落板与螺丝碰撞。render.js plateHoleCut（真镂空+光泽环+内壁+描边）；AE 板 PNG 透明孔、3D 挤出带孔；physics.js 质心积分+螺丝杆圆碰撞（冲量/摩擦/位置修正/忽略初始重叠/超时/对称破缺）；main.js 把已拧好的螺丝作为障碍传入。设置 v10（只补默认）：plateHoleSize/plateHoleWall，物理组 collide/collShaftR/collRest/collFric/collMaxMs。测试：test/collision-test.mjs（npm run test:collision）、hole-align-test 新增“错位板孔像素为粉色底板”、test/collision-capture.mjs（npm run test:collcap，自动通关中真实发生的板-螺丝碰撞）。截图 screenshots/plate_hole_ref_vs_tool.jpg、screenshots/fall_collision.jpg；/workspace/screw_collision_sample.mp4。
- v1.7：板块之间碰撞。src/world.js（planck.js + poly-decomp，打包进单文件）：板=刚体（静态/铰接摆动/自由下落），螺丝=静态圆，穿过对（变为动态时重叠的对，分开后恢复），卡住兜底 collStuckMs，碰撞轮廓内缩 ppInset，角阻尼 angDamp。删除 v1.6 的 collMaxMs 截止与永久忽略。逻辑：setSwingAngle 同步摆动板实际停下的角度；自动通关逐步校验计划、失效即重解，等摆动静止/遮挡解除；选螺丝查画面遮挡。设置 v11（collMaxMs→collStuckMs；新增 plateCollide/ppRest/ppFric/ppInset/angDamp）。随机关生成修复（以前总回退参考关卡）。测试：test:collision 重写（16 项，含两板下落互撞、落到固定板、叠放穿过、摆动被板/螺丝挡住），test:autoall（参考/随机×3/图形 全程自动通关无板残留），test/collision-video.mjs 逐帧抓取。截图 screenshots/plate_plate_collision.jpg；/workspace/screw_plate_collision.mp4（12s）。
- v1.7 收尾（完成，提交 e3637a1 'v1.7: 板块之间碰撞'）：自动通关在目标孔仍被画面上的板挡住时把螺丝放回并重新规划（window.__autoStats replan/abort/dev），__game.solveNow/physBusy。全部测试通过：test:logic、npm test(25/25, 43s)、test:ae(PSNR 均值 35.3)、test:3d(Blender PASS, PSNR 27–30)、test:physics、test:norec、test:holes、test:collision(16/16)、test:collcap、test:autoall(5/5，replan/abort/dev 均 0)、shape-test(heart/star_hole/cat)。Pages 与服务器 /screw/ cmp 一致。
- 已知：被托住 >collStuckMs(1.2s) 的下落板会关闭碰撞穿过掉出（参考关卡 25 块中约 13 块触发，ghosts 计数），想让穿过更少可调大 collStuckMs（等更久再穿过），或增大 ppInset（碰撞轮廓内缩更多，邻板边缘更不容易托住下落板）；swingSyncedAngles 里的 0 表示摆动板一开始就被挡住几乎没转。
- v1.7.1（完成）同层板块不再穿模（用户截图：heart 图形关卡单钉摆动板穿入左邻板与螺丝）。根因：图形关卡板轮廓很密（96–1400 点），旧 quickDecomp/earClip 静默失败，碰撞夹具只覆盖板面积 1–57%。修复：world.js cleanPoly + 保证推进的耳切 + Hertel–Mehlhorn 合并（夹具/内缩轮廓覆盖率 参考 ≥98.9%、随机 100%、heart ≥98.2%、star_hole ≥99.1%、cat ≥99.8%，test:cover）；同层板永不穿过，不同层仅当真实重叠 > ppPassArea(40px²)；板-螺丝只对自己孔里的螺丝穿过；逻辑同步物理实际位姿（poseFromXf/setPlatePose/poseDiff）；edgeTol；随机关同层一格一板；ppInset 1.5→0.5（设置 v12）。
  - 死锁修复：已插螺丝的孔判定“压住/固定”用严格规则（孔中心在板轮廓内或对准，plateCovers strict）——螺丝杆有碰撞，摆动板只会贴着杆停下，贴边算压住会“板压螺丝、螺丝固定板”互锁（heart 自动通关卡在 22/25）；空孔仍用边缘容差。
  - 测试：test/overlap-test.mjs（npm run test:overlap：heart×2/参考/随机×2 全程自动通关，每帧同层板对穿透深度与板-螺丝杆穿透 ≤2px，实测最大 1.95/1.17px，均完成且 replan/abort 0）；collision-test 叠放用例改为不同层。全部套件逐个通过。截图 screenshots/swing_overlap_fix.jpg（修复前 10.5° 穿入邻板 vs 修复后 3.1° 被挡住）。
  - 已知：overlap-test 不统计 ghost（卡住 >collStuckMs 后穿过掉出的下落板，heart 约 16/25）；紧密排列下多数摆动板几乎转不动（autoall swingSyncedAngles≈0）。
- v1.7.2（进行中，未发布）被托住的板不再穿过掉落（用户：“明明被下方螺丝挡住了，还是会掉落”）。已做：world.js 不休眠(allowSleep:false)；下落板静止 0.15s → b.rest + 支撑者 b.sup（planck 接触：螺丝 sid / 板 pi）；collStuckMs 默认 0=永不穿过（设置 v13，旧默认 1200→0）；新增 ppStuckMs(1200)：只被板托住（无螺丝支撑）超时后只关闭板-板碰撞（螺丝 category 4，仍被螺丝杆挡住）；W.ghosts/W.ppGhosts 计数。level.js st.rest（setRest/clearRest/releaseRest/restSupporters）：被托住的板按实际位姿挡住中心在其轮廓内的孔与螺丝，支撑螺丝离开原孔/支撑板离开即释放；done 需 rest 为空；solve 把支撑螺丝作为优先候选。main.js 每帧同步 st.rest；visBlocked 跳过被托住的板（交给逻辑）；physBusy 含刚开始下落的板（fallUnsettled）；自动通关无解时兜底 nudge（__autoStats.nudge）。autoall 现在要求 ghosts=0、nudge=0、abort=0。
  - 现状：heart(strip,1 层) 自动通关完成，0 nudge / 0 ghost。test:autoall 失败：随机关 seed1/7 需 5–6 次 nudge，seed42×3 层与 image(默认) 150s 内未完成（画面残留下落板）。根因：板被托住后盖住空孔/压住螺丝，空孔很少的关卡很快整盘无孔可用（free=[]），静态模型生成的关卡不保证在“托住”规则下可解。下一步思路：生成器/求解器加入托住模型（释放后预测落点：下方第一颗螺丝/板），或空孔更多；或只在支撑螺丝能被移走时才永久托住。其余套件未在此版本上重跑。
- v1.7.2 第二轮（进行中，未发布；用户决定：落点预测 + 空孔递增兜底，被螺丝托住永久停住，ppStuckMs 保留）
  - 已做：level.js predictDrop（求解器/生成器 st.pred=true；solve(L, st, maxNodes, pred=true)）：板从当前位姿（静止/摆动/被托住）竖直平移，轮廓加密到 3px，求第一次碰到插着的螺丝杆圆(SHAFT_R=collShaftR)的位移；同一高度(±3px)接触的螺丝组若质心 x 落在其水平范围 ±6px 内则停住（scr=这些螺丝），否则视为翻落、忽略继续往下；忽略板-板支撑（与 ppStuckMs 一致）。支撑螺丝移走 → 从托住位姿重新预测（releaseRest(L, st)）。求解器：状态去重 seen + 深度上限；支撑螺丝优先，且不放到被托住板正下方（under 排序）。随机关生成每 6 次失败 emptyHoles+1（level.js generateLevel）；图形关卡原有每 4 次失败加空孔。参考关卡：不加孔即可在预测下求解（38 步；无稳定性检查时第 5 步板 1 落在螺丝 1 上、盖住孔 1 → 无解）。test:logic 全过（16s，求解变慢）。
  - test:autoall 现状（未通过）：reference 完成但 abort 1；random seed1 nudge 4；seed7 逻辑完成但画面残留 1 块 'fall' 板（物理上卡住却不是 rest：可能是只靠板支撑/缓慢滑动、或被托住时 sup 为空）；seed42×3 未完成 nudge 10；image 完成但 abort 3。ghosts(螺丝穿过)=0 除 nudge 产生的。
  - 已试 ②（world.js b.stable：螺丝支撑但质心不在螺丝范围 ±6px → 按 ppStuckMs 处理）：autoall 结果基本不变（reference abort 1、seed1 nudge 4、seed7 残留、seed42 nudge 11、image abort 4），保留该改动。
  - 下一步：① 诊断残留板：在 world.js 记录 fall 板 restT/sup/速度，若静止但 sup 为空（接触在 pass 对里被禁用？isEnabled）→ 应按 ppStuckMs 穿过；② 预测与物理差异：实际板常靠在邻板+螺丝上（sup.s 非空 → 永久），而预测认为翻落 → 自动通关看到比预测更差的局面。可让物理里“接触螺丝但质心不在螺丝范围内”的板也按 ppStuckMs 处理（与预测一致），即永久托住只限 预测会停住 的情形；③ abort：目标孔被画面上的托住板挡住，检查 visBlocked 与 st.rest.inn 一致性；④ 然后补 rest-on-screw 测试、screenshots/rest_on_screw.jpg、AE/3D 检查、全部套件逐个跑、发布。
- v1.7.2 第三轮（进行中；方案：预测 == 实际，用同一套物理）提交 4e10809 起
  - world.js：固定步长 DT=1/120（applyPins 状态转换 + stepFixed 一步积分/读回/摆动夹角/静止检测/托住/ppStuckMs/出屏）；stepWorld 保留为兼容包装（累加器）。snapWorld/restoreWorld（位置/速度/关节 referenceAngle/过滤/穿过对）。托住规则：静止 0.15s 且接触到插着的螺丝 → 永久托住（bodySettled）；只靠板（或悬空）→ ppStuckMs（模拟时间）后只穿过板。去掉 b.stable、bullet。提前出屏：板已在所有螺丝/其它板下方且向下 → s='gone' + b.out（main.js 按抛体画完，AE 记录仍当作有位姿）。
  - src/sim.js：createSim/simTick/simEvent（螺丝物理位置 = vHole，落座+releaseDelay 时切换）；冻结：全部静止就停止积分并存快照；有物理变化的事件先从快照 restoreWorld 再积分（实时与预测同起点同步数）；无变化（quietMove：钉数不引起转换、新旧孔附近无动态板）两边都不积分。predictMove（3s 上限，不静止=不走）；stateFromBodies（逻辑 removed/swing/rest/npins 来自物理）；visBlockedBy（实时点击与求解器同一遮挡判定）；solvePhys（DFS + 预测缓存 L._simCache + 粗状态去重 + 先深入“板离开且无新托住”的子步）；validateLevel 注册到 level.js（generateLevel/shapegen 用 validate，genSolveMs 默认 2500ms）。level.js 的 solve 现为解析模型（pred 默认 false，logic-test 用）。
  - main.js：累加器 tick；pend → simEvent；冻结且无螺丝在途时 syncLogic；自动通关用 solvePhys，每步带预测快照，静止后与实际快照逐字段比较（__autoStats.mispredict），去掉 nudge。
  - 参考关卡 solvePhys 43 步 5.4s（node）。下一步：跑 random 1/7/42×3、build、test:autoall（看 mispredict/abort），然后其余套件。
  - 结果（4e10809 之后数个提交）：test:autoall 5/5 PASS——reference(43 步)/random1(58)/random7(127)/random42×3(75)/image(81)，abort 0、nudge 0、ghosts 0、mispredict 0（每步实际快照与预测逐字段完全相同）。关键修复：快照里 gone 板只记状态；恢复时不为 gone 板建刚体（否则宽相树不同 → 不逐位一致）。
  - 已知：随机关生成要做物理求解，3 层约 10–20s（每次失败 +1 空孔，genSolveMs 4000/次）。
  - 下一步：rest-on-screw 测试（main.js loadLevel 钩子 + test/rest-screw-test.mjs + screenshots/rest_on_screw.jpg）、AE/3D 检查、所有套件逐个、发布。
- v1.7.2 发布尝试（2026-10-18 19:50 UTC+8，基于 15abfb4）：未发布。build OK；test:logic/rest/autoall 通过；test:overlap、test:collision 失败（板-板穿透 3.6–40px、板-螺丝 4–6.7px，非 ppGhost 引起；摆动板不再 settled，可能与 allowSleep:false/固定步长 DT 有关）。详见 ref/v172_test_log.txt。下一步：查 stepFixed/stepWorld 兼容包装下的碰撞（对比 4e10809 之前 collision-test 全过的提交，git bisect）。
- v1.7.2 修复物理回归（2026-10-18 19:20 UTC+8）：根因 a8c1118 关闭 continuousPhysics/bullet 且 stepFixed 只做一次 1/120s、6/2 迭代 step（v1.7.1 是 1/360s 子步、10/4 迭代、TOI）。修复：stepFixed 内固定 SUB=3 个 1/360s 子步、VEL_IT 10/POS_IT 4、continuousPhysics 开、下落板 setBullet(true)（applyPins 与 restoreWorld 都设）。test:collision 16/16 通过（含摆动 settled）。
  - SUB=3/10/4 使 overlap 中图形关卡生成超时（heart 15s waitForFunction 失败），参考关卡求解 5.4s→12.2s。实验（PHYS=sub,vel,pos 环境变量，仅 node）：只要 TOI+bullet 开，SUB=1/6/2 穿透全部通过；只剩摆动 settled 失败——贴着固定板的摆动板形成 ±0.1° 极限环（om 0.05↔0.47），om<0.15 永远不满足。修复：settled 另加“0.12s 内角度在 0.35° 带内且 |om|<1”（setRef/setLo/setHi/setT2，applyPins/restoreWorld/wake 复位）。默认 SUB=1, VEL 8, POS 3。collision 16/16。
  - 速度（node test/_bench.mjs，需 esbuild 打包）：reference solvePhys 1/6/2 5.3s、3/10/4 12.2s；random1 生成 ~5.4s；random42×3 生成 ~57–60s（与改动无关，genSolveMs 4000×多次失败）。
  - test:overlap 仍失败（见 v172_test_log）。node 复现 test/_replay.mjs（esbuild 打包后 node；参考关卡 solvePhys 计划逐 tick 回放测同层板顶点穿透）：最大 37px 的一方 ppGhost=true（只被板托住 ppStuckMs 后只穿过板——v1.7.2 新的有意行为，v1.7.1 没有）；XPPG=1 排除 ppGhost 后最大 3.41px（第 6 步 tick 2，刚释放的板与贴着的固定板，释放前已贴住）。
  - 已做：overlap-test 板-板排除 ppGhost（同 ghost）；level.js restCovers 非 strict（放螺丝）时被托住板连对准的孔也挡（random1 54px 的根因：螺丝插进托住板的对准孔，板下落穿过螺丝；修复后 replay random1 PS 0.94）。
  - 浏览器 ONLY=heart,reference：板-板已过（0.38/1.7px），板-螺丝仍 5.4/3.72px（physics replay 只有 ~1px → 是画面：螺丝插进离被托住板边缘 <6px 的孔，“贴边不挡”）。已做：poseFromXf 新增 nr（孔中心离轮廓 < SHAFT_NEAR=7），restCovers 非 strict 时 inn 或 nr 都挡。test:logic 通过。
  - test:overlap 通过（540s，PP≤1.67 PS≤1.16）。下一步： test:collision、test:autoall（~13min）、其余套件逐个；不过则看 worstPS 的 t/screw 定位。旧条目：② 查 worstPS：random1/42x3 的 54px 是 pass 对（螺丝落进被动态板盖住的孔 → screwOverlaps 设穿过），heart 5.4px/reference 3.7px 是下落板 vs 螺丝（需 replay 加 PS 测量定位）；③ 释放瞬间 3.4px 预穿透（摆动极限环/静止贴住）是否需排除。
- v1.7.2 发布（2026-10-18 20:40 UTC+8）：build OK；test:logic/rest/collision(16/16)/overlap(f148d1d) 通过；test:autoall 5/5（abort/nudge/ghost/mispredict 均 0，~713s）；npm test 通过（25/25 板移除，solve 100s）；test:ae 通过（PSNR 均值 36.1，最低 30.7）；test:3d Blender PASS（PSNR 26.9–29.5）；test:physics/norec/collcap 通过；test:holes 更新后通过（下落板被下方螺丝托住停在画面上，原“板离开后孔可放”改为：被托住时孔保持被挡）。未完成：test:cover（这次运行 rc=1 686s，期间 box 重启，未复查）、shape-test 未跑。
  - 已推送 b31aea3；Pages built b31aea3，cmp 一致；服务器 /screw/ cmp 一致（box 重启后需重装 sshpass）。
- v1.7.3（进行中）图形关卡生成提速（目标每关 ≤20s，仍需物理预测可解）
  - 已提交 87b0052（levelFromImage 埋点 L.genLog/genMs、test/_genbench.mjs：playwright 调 __game.levelFromImage，打印每次尝试 [attempt, ms, ok, plates, emptyHoles, stats]）、7f805b1（buildOnce 去掉被上层板盖住的下层孔/螺丝，死锁修复；_diag/_diag2/_dumplv/_nodegen/_one 诊断脚本）。
  - 基准（7f805b1，_genbench）：heart 3.3s(1 次)、star_hole 9.2s(2 次)、cat 139s(16 次，空孔 4→11 才成功)。单次校验常超出 genSolveMs=4000（4.7–12.4s：只在 rec 入口查预算，单个 predictMove 很慢）。
  - test:cover 失败原因推测：fixture-cover 等图形关卡 waitForFunction 60s，cat 生成 >60s 超时。
