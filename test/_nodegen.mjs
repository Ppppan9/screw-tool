// 节点内复现：对导出的候选关卡跑物理/解析求解，看耗时
import fs from 'fs';
import { createSim, solvePhys } from '../src/sim.js';
import { solve, initState } from '../src/level.js';
const n = process.argv[2] || 'cat', ms = +(process.argv[3] || 4000), which = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
const { S, out } = JSON.parse(fs.readFileSync(`/tmp/lv_${n}.json`));
for (const [a, L] of out.entries()) {
  if (which && !which.includes(a)) continue;
  let t = Date.now(); const an = solve(L, initState(L), 12000); const tA = Date.now() - t;
  t = Date.now(); const sim = createSim(L, S); const tC = Date.now() - t; const st = {};
  t = Date.now(); const plan = solvePhys(L, S, sim.snap, { sim, timeMs: ms, stats: st }); const tP = Date.now() - t;
  console.log(a, 'plates', L.plates.length, 'empty', L.holes.length - L.screws.length, 'analytic', !!an, tA + 'ms', 'create', tC, 'phys', !!plan, tP + 'ms', JSON.stringify(st));
}
