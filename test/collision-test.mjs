// v1.6 下落板与螺丝杆碰撞单元测试（npm run test:collision）
import { newBody, stepBody, contact } from '../src/physics.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const S = { gravity: 3600, swingBoost: 2.2, swingMax: 17, swingDamp: 6, swingBounce: 0.05, releaseSpinK: 8.3, fallSpin: 0, collide: true, collShaftR: 6, collRest: 0.2, collFric: 0.3, collMaxMs: 1500, plateHoleSize: 33 };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function run(obst, S2 = S, pin = [300, 300]) {
  const b = newBody(rect(240, 280, 360, 320), [300, 300], [[300, 300]]);
  stepBody(b, 1, pin, 1 / 60, S2, obst); // 单钉（开局单钉板，不摆动）
  let maxPen = 0, track = [];
  for (let i = 0; i < 180; i++) { stepBody(b, 0, null, 1 / 60, S2, obst); for (const o of obst) { const c = contact(b, o, { ...S2, collShaftR: S2.collShaftR - 0.5 }); if (c && b.s === 'fall') maxPen = Math.max(maxPen, c.pen); } track.push([+(b.ang * 180 / Math.PI).toFixed(1), Math.round(b.cx), Math.round(b.cy), b.s]); }
  return { b, maxPen, track };
}
const free = run([]);
ok(Math.abs(free.b.ang) < 1e-6 && free.b.s === 'gone', '无障碍：直线下落不转、出屏');
const hit = run([{ id: 0, x: 330, y: 380 }]);
console.log('hit track (deg, cx, cy):', JSON.stringify(hit.track.filter((_, i) => i % 6 === 0)));
ok(hit.b.hits > 0, `碰到右下方的螺丝杆（接触 ${hit.b.hits} 次）`);
ok(hit.maxPen < 3, `不穿过螺丝杆（最大穿透 ${hit.maxPen.toFixed(2)}px < 3）`);
ok(hit.track.some(t => t[0] < -10), `被螺丝挡住的一侧绕螺丝翻转（最小角 ${Math.min(...hit.track.map(t => t[0]))}°）`);
ok(hit.b.s === 'gone', '翻过螺丝后继续下落出屏（不永久卡住）');
const mid = run([{ id: 0, x: 300, y: 380 }]);
ok(mid.b.s === 'gone' && mid.maxPen < 3, `正下方的螺丝：失衡翻落、出屏（${mid.track.findIndex(t => t[3] === 'gone')} 帧，最大穿透 ${mid.maxPen.toFixed(2)}px）`);
const off = run([{ id: 0, x: 330, y: 380 }], { ...S, collide: false });
ok(Math.abs(off.b.ang) < 1e-6, '关闭碰撞：直接穿过');
const ign = run([{ id: 0, x: 250, y: 300 }]);
ok(Math.abs(ign.b.ang) < 1e-6 && ign.b.hits === 0, '释放瞬间已与材料重叠的螺丝被忽略（不弹飞）');
process.exit(fails ? 1 : 0);
