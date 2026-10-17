// 螺丝阻挡判定单元测试：esbuild 打包后在 Node 里运行（npm run test:logic）
import { liftOut, cancelLift, initState, applyMove, holeUsable, screwFree, platePins, setBlocking, solve, referenceLevel, generateLevel, done } from '../src/level.js';
import { DEFS } from '../src/settings.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
function mini() {
  // A: 底层(0) 板 100..300 × 100..200，自己 1 颗螺丝 h0(150,150)
  // B: 上层(1) 板 220..400 × 120..180，自己 1 颗螺丝 h1(260,150)，该位置落在 A 的轮廓内 → 贯穿 A
  // 底板空孔 h2(600,600)、h3(700,600)
  const L = { name: 'mini', base: { polys: [], capsules: [] }, holes: [{ x: 150, y: 150 }, { x: 260, y: 150 }, { x: 600, y: 600 }, { x: 700, y: 600 }],
    plates: [{ poly: [[100, 100], [300, 100], [300, 200], [100, 200]], layer: 0, holes: [0], radius: 3 }, { poly: [[220, 120], [400, 120], [400, 180], [220, 180]], layer: 1, holes: [1], radius: 3 }],
    screws: [{ hole: 0 }, { hole: 1 }] };
  return L;
}
setBlocking(true);
{ const L = mini(), st = initState(L);
  ok(platePins(L, st, 0).length === 2, 'A 被 2 颗螺丝固定（自己的 + B 的螺丝贯穿）');
  const f1 = applyMove(L, st, 0, 2);
  ok(f1.length === 0 && !st.removed.has(0), '拔掉 A 自己的螺丝后 A 不掉（仍被 B 的螺丝挡住）');
  const f2 = applyMove(L, st, 1, 3);
  ok(f2.includes(1) && f2.includes(0), '拔掉 B 的螺丝后 B 与 A 一起掉落 ' + JSON.stringify(f2));
}
{ // 螺丝拧进孔会挡住板：底板孔 h4 位于 A 内但 A 在该处无孔 → 不可用；A 上层孔被 B 覆盖时不可用
  const L = mini(); L.holes.push({ x: 120, y: 120 }); const st = initState(L);
  ok(!holeUsable(L, st, 4), '被板覆盖的底板孔不可用');
  ok(screwFree(L, st, 1) && screwFree(L, st, 0), '两颗螺丝都可取（无更高层无孔板压住）');
}
{ // 关闭阻挡判定 → 旧规则
  setBlocking(false); const L = mini(), st = initState(L);
  const f = applyMove(L, st, 0, 2); ok(f.includes(0), '关闭“螺丝阻挡探测”时 A 拔完自己的螺丝即掉落（v1.1 规则）'); setBlocking(true);
}
{ const L = referenceLevel(), st = initState(L), plan = solve(L, st);
  let s2 = initState(L); if (plan) for (const [si, hi] of plan) { if (!holeUsable(L, s2, hi)) { ok(false, '计划含不可用孔'); break; } applyMove(L, s2, si, hi); }
  ok(!!plan && done(L, s2), `参考关卡在阻挡规则下可解（${plan ? plan.length : '-'} 步）`);
}
{ let n = 0; for (let seed = 1; seed <= 3; seed++) { const L = generateLevel({ ...DEFS, genLayers: 2 }, seed); const p = solve(L, initState(L)); if (p) n++; } ok(n === 3, `随机关卡（2 层）3/3 可解：${n}`); }
{ // v1.2.1：最后一颗螺丝拧出（悬停/飞行中，未落孔）时板即掉落
  const L = mini(), st = initState(L);
  applyMove(L, st, 0, 2);
  const f = liftOut(L, st, 1); ok(f.includes(1) && f.includes(0), '拧出 B 的螺丝（悬停中、尚未落孔）B 与 A 立即掉落 ' + JSON.stringify(f));
  ok(st.screwHole[1] === 1, '悬停螺丝仍记在原孔（未落孔）');
  const f2 = applyMove(L, st, 1, 3); ok(f2.length === 0 && done(L, st), '落孔时不再重复掉落，关卡完成');
}
{ // 取消选择：拧出后放回，未掉落的板重新被固定
  const L = mini(), st = initState(L); const f = liftOut(L, st, 0); ok(f.length === 0, '拧出 A 自己的螺丝，A 仍被 B 螺丝挡住');
  cancelLift(st, 0); ok(platePins(L, st, 0).length === 2, '取消后 A 重新被 2 颗螺丝固定');
}
{ // 目标孔在被释放的板下：先结算掉落再落孔，不会被自己挡住
  const L = mini(); L.holes.push({ x: 280, y: 110 }); const st = initState(L); applyMove(L, st, 0, 2);
  const f = applyMove(L, st, 1, 4); ok(f.includes(0) && f.includes(1), '螺丝飞往被释放板下的孔：板照常掉落 ' + JSON.stringify(f));
}
process.exit(fails ? 1 : 0);
