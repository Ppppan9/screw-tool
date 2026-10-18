// predictMove 耗时分布（node，esbuild 打包后运行）
import fs from 'fs';
import * as SIM from '../src/sim.js';
const n = process.argv[2] || 'cat', a = +(process.argv[3] || 0), ms = +(process.argv[4] || 4000);
const { S, out } = JSON.parse(fs.readFileSync(`/tmp/lv_${n}.json`)); const L = out[a];
const sim = SIM.createSim(L, S); const orig = SIM.predictMove; const rec = [];
const st = {}; const t0 = Date.now();
const plan = SIM.solvePhys(L, S, sim.snap, { sim, timeMs: ms, stats: st, onPredict: (dt, ok, ticks) => rec.push([dt, ok, ticks]) });
console.log('plan', !!plan, Date.now() - t0, JSON.stringify(st));
rec.sort((x, y) => y[0] - x[0]); console.log('n', rec.length, 'top', JSON.stringify(rec.slice(0, 12)), 'nullMs', rec.filter(r => !r[1]).reduce((s, r) => s + r[0], 0), 'okMs', rec.filter(r => r[1]).reduce((s, r) => s + r[0], 0));
