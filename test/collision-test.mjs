// v1.6/v1.7 刚体碰撞单元测试（npm run test:collision）：板-螺丝杆、板-板（下落-下落、下落-固定、摆动-固定）、叠放穿过对、卡住兜底
import { newBody, toWorld, inPoly } from '../src/physics.js';
import { createWorld, stepWorld } from '../src/world.js';
import { offsetPoly } from '../src/geom.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const S0 = { gravity: 3600, swingBoost: 2.2, swingMax: 17, swingDamp: 6, swingBounce: 0.05, swingKick: 0, releaseSpinK: 8.3, fallSpin: 0, collide: true, collShaftR: 6, collRest: 0.2, collFric: 0.3, plateCollide: true, ppRest: 0.1, ppFric: 0.4, angDamp: 0.6, collStuckMs: 2000, plateHoleSize: 33 };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const R2D = 180 / Math.PI;
// plates: [{poly, pins: frame => n, pinW}] ; obst: screws
function sim(plates, obst = [], S = S0, frames = 240) {
  const L = { plates: plates.map(p => ({ poly: p.poly })) };
  const B = plates.map(p => { const xs = p.poly.map(v => v[0]), ys = p.poly.map(v => v[1]); return newBody(p.poly, [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]); });
  const W = createWorld(L, B, S), track = [], pen = { pp: 0, ps: 0 };
  for (let f = 0; f < frames; f++) {
    stepWorld(W, plates.map(p => p.pins(f)), plates.map(p => p.pinW || null), 1 / 60, S, obst);
    track.push(B.map(b => [b.s, Math.round(b.cx), Math.round(b.cy), +(b.ang * R2D).toFixed(1)]));
    // 碰撞轮廓 = 板轮廓内缩 ppInset（描边/细缝容差），穿透按碰撞轮廓计
    const wp = B.map((b, i) => offsetPoly(plates[i].poly, S.ppInset ?? 1.5).map(([x, y]) => toWorld(b, x, y)));
    // 穿透深度：A 的顶点落在 B 内的最大深度（只统计不是“穿过对”的组合，由调用方指定 pairs）
    for (const [i, j] of (plates.pairs || [])) { if (B[i].s === 'gone' || B[j].s === 'gone' || B[i].ghost || B[j].ghost) continue; for (const [a, b] of [[i, j], [j, i]]) for (const v of wp[a]) if (inPoly(v[0], v[1], wp[b])) pen.pp = Math.max(pen.pp, edgeDist(v, wp[b])); }
    for (const o of obst) B.forEach((b, i) => { if (b.s !== 'fall' || b.ghost || plates[i].noPen) return; const d = inPoly(o.x, o.y, wp[i]) ? -edgeDist([o.x, o.y], wp[i]) : edgeDist([o.x, o.y], wp[i]); pen.ps = Math.max(pen.ps, S.collShaftR - d); });
  }
  return { B, W, track, pen };
}
function edgeDist([x, y], P) { let d = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(ax + t * dx - x, ay + t * dy - y)); } return d; }
const fallAt = (f0) => f => f < f0 ? 1 : 0, pinned = () => 2;
const P = (poly, pins, pinW) => ({ poly, pins, pinW });

// ---- 板-螺丝 ----
const free = sim([P(rect(240, 280, 360, 320), fallAt(1), [300, 300])]);
ok(free.B[0].s === 'gone' && Math.abs(free.B[0].ang) < 1e-6, '无障碍：直线下落不转、出屏');
const hit = sim([P(rect(240, 280, 360, 320), fallAt(1), [300, 300])], [{ id: 0, x: 330, y: 380 }]);
ok(hit.B[0].hits > 0 && hit.pen.ps < 1.5 && Math.min(...hit.track.map(t => t[0][3])) < -10 && hit.B[0].s === 'gone', `下落板碰到螺丝杆：接触 ${hit.B[0].hits}，最大穿透 ${hit.pen.ps.toFixed(2)}px，绕螺丝翻转后出屏`);
const mid = sim([P(rect(240, 280, 360, 320), fallAt(1), [300, 300])], [{ id: 0, x: 300, y: 380 }], S0, 300);
ok(mid.B[0].s === 'gone' && mid.pen.ps < 1.5, `正下方的螺丝：不穿过（${mid.pen.ps.toFixed(2)}px），失衡/卡住兜底后出屏（第 ${mid.track.findIndex(t => t[0][0] === 'gone')} 帧）`);
const late = sim([P(rect(240, 280, 360, 320), fallAt(1), [300, 300])], [{ id: 0, x: 330, y: 700 }]);
ok(late.B[0].hits > 0 && late.pen.ps < 2, `下落很久后（~0.5s，高速）仍然碰撞，无 1.5s 截止（穿透 ${late.pen.ps.toFixed(2)}px）`);
const off = sim([P(rect(240, 280, 360, 320), fallAt(1), [300, 300])], [{ id: 0, x: 330, y: 380 }], { ...S0, collide: false });
ok(Math.abs(off.B[0].ang) < 1e-6, '关闭板-螺丝碰撞：直接穿过');
const deep = sim([{ ...P(rect(240, 280, 360, 320), fallAt(1), [300, 300]), noPen: true }], [{ id: 0, x: 250, y: 300 }]);
ok(deep.B[0].s === 'gone' && Math.abs(deep.B[0].ang * R2D) < 5, '释放瞬间螺丝杆在板轮廓内：穿过（不弹飞），分开后恢复碰撞');
const graze = sim([{ ...P(rect(240, 280, 360, 320), fallAt(1), [300, 300]), noPen: true }], [{ id: 0, x: 364, y: 300 }]);
const gx = graze.track.slice(1, 10).map(t => t[0][1]);
ok(Math.max(...gx) - Math.min(...gx) < 8, `释放瞬间擦边重叠的螺丝：温和推开（前 9 帧横移 ${Math.max(...gx) - Math.min(...gx)}px）`);

// ---- 板-板 ----
// 下落板落到同层固定板上：被托住、不穿透；之后卡住兜底穿过出屏
const pairsA = [[0, 1]]; const land = sim(Object.assign([P(rect(250, 200, 350, 240), fallAt(1), [300, 220]), P(rect(200, 400, 420, 440), pinned)], { pairs: pairsA }), [], S0, 300);
const yRest = land.track[60][0][2];
ok(land.B[0].pHits > 0 && yRest < 400 && land.pen.pp < 1.5, `下落板落到固定板上被托住（1s 时 cy=${yRest}，穿透 ${land.pen.pp.toFixed(2)}px）`);
ok(land.B[0].s === 'gone', `被托住超过 collStuckMs 后穿过出屏（第 ${land.track.findIndex(t => t[0][0] === 'gone')} 帧）`);
// 偏心落到固定板角上：被偏转（翻转）而不是穿过
const defl = sim(Object.assign([P(rect(330, 200, 430, 240), fallAt(1), [380, 220]), P(rect(200, 400, 360, 440), pinned)], { pairs: pairsA }));
ok(defl.B[0].pHits > 0 && defl.pen.pp < 1.5 && Math.max(...defl.track.map(t => Math.abs(t[0][3]))) > 15 && defl.B[0].s === 'gone', `偏心落到固定板边角：翻转滑落（最大角 ${Math.max(...defl.track.map(t => Math.abs(t[0][3])))}°，穿透 ${defl.pen.pp.toFixed(2)}px）后出屏`);
// 两块下落板：上面的砸在下面的上（下-下碰撞）
const two = sim(Object.assign([P(rect(260, 100, 340, 140), fallAt(1), [300, 120]), P(rect(250, 300, 350, 340), fallAt(1), [300, 320]), P(rect(150, 600, 450, 640), pinned)], { pairs: [[0, 1], [1, 2], [0, 2]] }), [], S0, 300);
ok(two.B[0].pHits > 0 && two.B[1].pHits > 0 && two.pen.pp < 1.5, `两块下落板互相碰撞不穿透（最大穿透 ${two.pen.pp.toFixed(2)}px）`);
const pOff = sim([P(rect(250, 200, 350, 240), fallAt(1), [300, 220]), P(rect(200, 400, 420, 440), pinned)], [], { ...S0, plateCollide: false });
ok(pOff.track[40][0][2] > 450, '关闭板-板碰撞：直接穿过');
// 叠放（释放时重叠）的板互相穿过，分开后恢复碰撞
const stack = sim([P(rect(250, 200, 350, 260), fallAt(1), [300, 230]), P(rect(280, 230, 420, 280), pinned), P(rect(200, 500, 420, 540), pinned)], [], S0, 60);
ok(stack.track[30][0][2] > 300 && stack.B[0].pHits > 0 && stack.track[59][0][2] < 500, `释放时叠放的板：穿过下层板（不弹飞），分开后撞到下方另一块板（cy ${stack.track[30][0][2]}→${stack.track[59][0][2]}）`);
// 摆动板被同层固定板挡住：停在 < swingMax
const swingPins = f => f < 2 ? 2 : 1;
const sw = sim([P(rect(200, 200, 400, 240), swingPins, [220, 220]), P(rect(330, 255, 450, 300), pinned)], [], S0, 90);
const swA = sw.track[89][0][3];
ok(sw.B[0].s === 'swing' && swA > 1 && swA < 15 && sw.B[0].settled, `摆动板被固定板挡住，停在 ${swA}°（< 17°）`);
const swFree = sim([P(rect(200, 200, 400, 240), swingPins, [220, 220])], [], S0, 90);
ok(Math.abs(swFree.track[89][0][3] - 17) < 0.15, `无阻挡时摆到 ${swFree.track[89][0][3]}°`);
const swS = sim([P(rect(200, 200, 400, 240), swingPins, [220, 220])], [{ id: 0, x: 300, y: 262 }], S0, 90);
ok(swS.track[89][0][3] < 15 && swS.track[89][0][3] > 1, `摆动板被螺丝杆挡住，停在 ${swS.track[89][0][3]}°`);
process.exit(fails ? 1 : 0);
