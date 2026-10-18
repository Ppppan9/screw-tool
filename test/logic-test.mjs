// 螺丝阻挡判定单元测试：esbuild 打包后在 Node 里运行（npm run test:logic）
import { setPhysicsRules, plateAligned, plateCovers, liftOut, cancelLift, initState, applyMove, holeUsable, screwFree, platePins, setBlocking, solve, referenceLevel, generateLevel, done } from '../src/level.js';
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
setPhysicsRules({ releaseAt: 'lift' }); // 以下 3 组为旧的 'lift' 释放模式
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
setPhysicsRules({ releaseAt: 'seat', swingMax: 17 });
{ // v1.5 默认 'seat' 模式：悬停中不释放
  const L = mini(), st = initState(L); applyMove(L, st, 0, 2);
  const f = liftOut(L, st, 1); ok(f.length === 0 && !st.removed.has(1), 'seat 模式：拧出最后一颗（悬停中）板不掉');
  cancelLift(st, 1);
}
{ // v1.5 孔位固定在底板：双钉板拧走一颗 → 摆动，其另一个孔不再对准底板孔，不能再放回
  const L = { name: 'two', base: { polys: [], capsules: [] }, holes: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 500, y: 500 }, { x: 600, y: 500 }, { x: 225, y: 130 }],
    plates: [{ poly: [[70, 60], [240, 60], [240, 140], [70, 140]], layer: 0, holes: [0, 1], radius: 3 }], screws: [{ hole: 0 }, { hole: 1 }] };
  const st = initState(L);
  ok(!holeUsable(L, st, 4), '板材料下的底板孔不可用');
  applyMove(L, st, 1, 2);
  ok(st.swing.has(0) && !st.removed.has(0), '拧走右钉：板绕左钉摆动（未掉落）');
  ok(!plateAligned(L, st, 0, 1), '摆动后板的右孔不再对准底板孔 1');
  ok(!holeUsable(L, st, 1), '底板孔 1（原对准位置）被摆动板材料压住 → 不可放');
  ok(holeUsable(L, st, 4) === !plateCovers(L, st, 0, 4), '底板孔 4 可用性 = 是否被摆动后的板覆盖');
  ok(!solve(L, st) || true, 'solve 不崩溃');
  applyMove(L, st, 0, 3); ok(st.removed.has(0), '拧走最后一颗：板掉落');
  ok(holeUsable(L, st, 1) && holeUsable(L, st, 0), '板掉落后底板孔 0/1 露出可用');
}
{ let n = 0; for (let seed = 1; seed <= 6; seed++) { const L = generateLevel({ ...DEFS, genLayers: 2 }, seed); const p = solve(L, initState(L)); if (p) { const s2 = initState(L); let good = true; for (const [si, hi] of p) { if (!holeUsable(L, s2, hi)) { good = false; break; } applyMove(L, s2, si, hi); } if (good && done(L, s2)) n++; } } ok(n === 6, `v1.5 规则下随机关卡 6/6 可解且计划逐步合法：${n}`); }
{ const L = referenceLevel(), st = initState(L), plan = solve(L, st); let s2 = initState(L), good = !!plan, sw = 0;
  if (plan) for (const [si, hi] of plan) { if (!holeUsable(L, s2, hi)) { good = false; break; } applyMove(L, s2, si, hi); sw = Math.max(sw, s2.swing.size); }
  ok(good && done(L, s2), `v1.5 参考关卡可解（${plan ? plan.length : '-'} 步，过程中最多 ${sw} 块板摆动）`); }
// ---- v1.8 主题 + 经典款大脚掌 ----
import { bigfootLevel } from '../src/level.js';
import { migrate, SETTINGS_VERSION } from '../src/settings.js';
import { THEMES, THEME_KEYS, themeDefaults } from '../src/themes.js';
import { createSim, solvePhys, validateLevel } from '../src/sim.js';
{ const m = migrate({ version: 13, settings: { plateColor: '#123456', gravity: 3600 } });
  ok(SETTINGS_VERSION >= 14 && m.theme === 'palm' && m.plateColor === '#123456' && m.plateStyle === 'hatch' && m.screwStyle === 'brushed' && JSON.stringify(m.themeStore) === '{}', 'v13 存档迁移：主题 = 手掌款（默认），用户值保留，新材质键补默认');
  const f = migrate(null); ok(f.theme === 'palm' && f.bgMode === 'image' && f.plateColor === DEFS.plateColor, '新存档：默认主题手掌款，外观 = 之前的默认值');
  const c = migrate({ version: 14, settings: { theme: 'classic', themeStore: { palm: { plateColor: '#ff0000' } }, plateColor: '#a8a3a4' } }); ok(c.theme === 'classic' && c.themeStore.palm.plateColor === '#ff0000', 'v14 存档：主题与分主题外观保留');
  ok(migrate({ version: 14, settings: { theme: 'xx' } }).theme === 'palm', '未知主题 → 手掌款');
  { const a = migrate({ version: 14, settings: {} }), b2 = migrate({ version: 14, settings: { hideCursor: false } }); ok(SETTINGS_VERSION === 15 && a.hideCursor === true && b2.hideCursor === false, 'v15 hideCursor：旧存档补默认 true，用户值保留'); }
  const td = themeDefaults(DEFS, 'palm'); ok(THEME_KEYS.every(k => td[k] === DEFS[k]), '手掌款主题默认值 = 原默认值（数值完全不变）');
  ok(THEME_KEYS.every(k => k in DEFS), '主题键都在设置定义里'); }
{ const L = bigfootLevel(), st = initState(L);
  ok(L.plates.length === 21 && L.screws.length === 25 && L.holes.length === 27, `大脚掌关卡：${L.plates.length} 板 / ${L.screws.length} 螺丝 / ${L.holes.length} 孔（含脚跟板空孔 + 1 隐藏孔）`);
  const free = L.holes.map((_, i) => i).filter(h => holeUsable(L, st, h) && st.screwHole.indexOf(h) < 0); ok(free.length === 1 && L.plates.some(p => p.openHoles && p.openHoles.includes(free[0])), '初始唯一可用空孔 = 脚跟板上的黑孔');
  ok(L.plates.filter(p => p.mat === 'alt').length === 1, '脚跟米色板使用第二板材');
  const S = { ...DEFS }, sim = createSim(L, S), stats = {}, plan = solvePhys(L, S, sim.snap, { sim, timeMs: 30000, stats });
  ok(!!plan, `大脚掌 solvePhys 可解（${plan ? plan.length : '-'} 步，${stats.nodes} 节点，${stats.ms}ms）`);
  ok(validateLevel(bigfootLevel(), S, 30000), '大脚掌 validateLevel 通过'); }
process.exit(fails ? 1 : 0);
