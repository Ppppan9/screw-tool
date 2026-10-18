// 经典款大脚掌关卡：物理求解（solvePhys）+ validateLevel。esbuild 打包后 node 运行：npm run test:foot:node
import { bigfootLevel, initState, screwFree, holeUsable } from '../src/level.js';
import { createSim, solvePhys, validateLevel } from '../src/sim.js';
import { DEFS } from '../src/settings.js';
const S = { ...DEFS };
let t = Date.now(); const HID = process.env.HID ? JSON.parse(process.env.HID) : undefined; const L = bigfootLevel(HID);
console.log('plates', L.plates.length, 'screws', L.screws.length, 'holes', L.holes.length);
const st = initState(L); console.log('free screws', L.screws.map((_, i) => i).filter(i => screwFree(L, st, i)).length, 'usable holes', L.holes.map((_, i) => i).filter(i => holeUsable(L, st, i) && st.screwHole.indexOf(i) < 0));
const sim = createSim(L, S); const stats = {};
const plan = solvePhys(L, S, sim.snap, { sim, timeMs: +(process.env.MS || 60000), stats });
console.log('solvePhys', plan ? plan.length + ' steps' : 'FAIL', JSON.stringify(stats), Date.now() - t, 'ms');
if (plan) console.log(JSON.stringify(plan));
t = Date.now(); console.log('validateLevel', validateLevel(bigfootLevel(HID), S, 20000), Date.now() - t, 'ms');
