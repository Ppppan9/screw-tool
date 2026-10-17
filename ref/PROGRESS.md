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
- [ ] M3 3D 导出 src/export3d/，test/export3d.mjs + export3d-blender.sh
- [ ] M4 README、提交 'v1.2: 螺丝阻挡判定 + AE 与 3D 动画导出'、push、Pages、部署
