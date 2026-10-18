// v1.5 用户反馈复现：“板子都掉一半下去了，结果还能把螺丝放回去”。孔固定在底板；板孔对准才能放。
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(600);
const W = ms => p.waitForTimeout(ms);
const H = (x, y) => p.evaluate(([x, y]) => __game.L.holes.findIndex(h => Math.hypot(h.x - x, h.y - y) < 4), [x, y]);
const idle = async () => { for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !__game.screwVis.some(v => v.anim && v.anim.k !== 'hover') && !__game.pending)) return; await W(30); } };
const screwAt = (hi) => p.evaluate(hi => __game.st.screwHole.indexOf(hi), hi);
const h23 = await H(452, 806), hE = await H(400, 668), h22l = await H(426, 754), h22r = await H(482, 757), hHid = await H(500, 812), hFinger = await H(386, 368);
const R = {};
const liftF = async () => { for (let k = 0; k < 3; k++) { await p.evaluate(h => __game.tapHole(h), hFinger); for (let i = 0; i < 40; i++) { const st = await p.evaluate(h => { const si = __game.st.screwHole.indexOf(h); const a = __game.screwVis[si].anim; return a ? a.k : ''; }, hFinger); if (st === 'hover') return true; await W(20); } } throw new Error('finger screw did not lift'); };
await p.evaluate(h => __game.tapHole(h), h23); await W(300); await p.evaluate(h => __game.tapHole(h), hE); await W(900); await idle();
await p.evaluate(h => __game.tapHole(h), h22r); await W(300); await p.evaluate(h => __game.tapHole(h), h23); await W(900); await idle();
R.swing = await p.evaluate(() => { const b = __game.plateVis.find(b => b.s === 'swing' || (b.posed && b.s === 'on')); return b ? +(b.ang * 180 / Math.PI).toFixed(2) : null; });
const sF = await screwAt(hFinger);
const tryPut = async (target, label, shot) => {
  await idle(); await liftF();
  const snap = async f => fs.writeFileSync(f, Buffer.from((await p.evaluate(() => stage.toDataURL('image/jpeg', 0.92))).split(',')[1], 'base64'));
  if (shot) await snap(shot.replace('.jpg', '_a.jpg'));
  const r = await p.evaluate(([x, y]) => __game.tapXY(x, y), target); await W(500); await idle();
  const moved = (await screwAt(hFinger)) !== sF;
  if (shot) await snap(shot.replace('.jpg', '_b.jpg'));
  R[label] = { accepted: moved }; return moved;
};
// 摆动板：原对准位置（底板孔）与板孔移动后的位置都不能放
await tryPut([482, 757], 'swungOldBaseHole');
const moved = await p.evaluate(h => __game.holeWorld(h), h22r);
const pv = await p.evaluate(() => { const L = __game.L, pi = L.plates.findIndex(q => q.holes.length === 2 && q.holes.some(h => Math.hypot(L.holes[h].x - 482, L.holes[h].y - 757) < 4)); const b = __game.plateVis[pi]; const h = L.holes.find(h => Math.hypot(h.x - 482, h.y - 757) < 4); const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = h.x - b.C[0], uy = h.y - b.C[1]; return [b.C[0] + c * ux - s * uy + b.dx, b.C[1] + s * ux + c * uy + b.dy]; });
R.movedPlateHole = pv.map(v => +v.toFixed(1));
// v1.6：板孔是镂空——错位后孔里透出粉色底板（不是纯黑）
R.holePix = await p.evaluate(([x, y]) => { const v = __game.view(), g = stage.getContext('2d'); const px = Math.round(v.k * (v.b * x + v.tx)), py = Math.round(v.k * (v.b * y + v.ty) + v.oy); return [...g.getImageData(px, py, 1, 1).data].slice(0, 3); }, [pv[0] - 1.6, pv[1] + 8]);
R.basePix = await p.evaluate(([x, y]) => { const v = __game.view(), g = stage.getContext('2d'); const px = Math.round(v.k * (v.b * x + v.tx)), py = Math.round(v.k * (v.b * y + v.ty) + v.oy); return [...g.getImageData(px, py, 1, 1).data].slice(0, 3); }, [400, 668]);
fs.mkdirSync('/tmp/holeal', { recursive: true }); fs.writeFileSync('/tmp/holeal/view.json', JSON.stringify(await p.evaluate(() => __game.view())));
await tryPut(pv, 'swungMovedPlateHole', '/tmp/holeal/moved.jpg');
// 拧走摆动板最后一颗（支点）→ 掉落；下落过程中它的孔位/盖住的底板孔不能放
await p.evaluate(() => { __game.S.gravity = 30; }); // 慢速下落，便于在“掉一半”时尝试
await p.evaluate(h => __game.tapHole(h), h22l); await W(250); await p.evaluate(h => __game.tapHole(h), hHid);
for (let i = 0; i < 100; i++) { if (await p.evaluate(() => __game.plateVis.some(b => b.s === 'fall'))) break; await W(10); }
R.fallingBlocked = await p.evaluate(h => !__game.holeTargetable(h), h22r);
await idle(); await liftF();
await p.evaluate(() => __game.tapXY(426, 754)); await W(20);
R.fallDy = await p.evaluate(() => Math.round(Math.max(...__game.plateVis.filter(b => b.s === 'fall').map(b => b.dy)))); await p.evaluate(() => { __game.S.gravity = 3600; __game.world.pw.setGravity({ x: 0, y: 3600 / 50 }); }); // v1.7.2：世界重力在建世界/恢复快照时设定，进行中的下落要同步改实时世界
R.duringFall = { accepted: (await screwAt(hFinger)) !== sF, plateState: await p.evaluate(() => __game.plateVis.map(b => b.s).filter(s => s !== 'on').join(',')) };
await W(1500); await idle();
// 板离开后，原先被盖住的底板孔露出 → 可放
// v1.7.2：下落板可能被下方螺丝托住而停在画面上（新托住设计）——此时孔仍被挡住是正确的
R.held = await p.evaluate(() => __game.plateVis.some(b => b.s === 'fall' || b.s === 'rest'));
R.afterGone = { targetable: await p.evaluate(h => __game.holeTargetable(h), h22r) };
const ok3 = await tryPut([482, 757], 'clearedBaseHole', '/tmp/holeal/cleared.jpg');
await b.close();
console.log(JSON.stringify(R), errs);
const pink = c => c[0] > 130 && c[0] > c[2] + 10 && c[0] > c[1] + 15;
R.holeShowsBase = pink(R.holePix); R.alignedDark = (R.basePix[0] + R.basePix[1] + R.basePix[2]) / 3 < 70;
const ok = R.holeShowsBase && R.swing > 12 && !R.swungOldBaseHole.accepted && !R.swungMovedPlateHole.accepted && R.fallingBlocked && !R.duringFall.accepted && (R.held ? (!R.afterGone.targetable && !ok3) : (R.afterGone.targetable && ok3)) && !errs.length;
console.log(ok ? 'HOLEALIGN OK' : 'HOLEALIGN FAIL'); process.exit(ok ? 0 : 1);
