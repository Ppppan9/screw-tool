import { referenceLevel, generateLevel } from '../src/level.js';
import { createSim, solvePhys } from '../src/sim.js';
import { DEFS } from '../src/settings.js';
const S = {}; for (const k in DEFS) S[k] = DEFS[k];
let t = Date.now(); const L = referenceLevel(); const sim = createSim(L, S); const st = {};
const plan = solvePhys(L, S, sim.snap, { sim, timeMs: 60000, stats: st });
console.log('reference', plan && plan.length, st, Date.now() - t, 'ms');
for (const [seed, lay] of [[1, undefined], [42, 3]]) { t = Date.now(); const o = { ...S }; if (lay) o.genLayers = lay; const G = generateLevel(o, seed); console.log('gen random', seed, lay, G.name, G.plates.length, Date.now() - t, 'ms'); }
