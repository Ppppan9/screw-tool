// node 复现：参考关卡 solvePhys 计划逐 tick 回放，测同层板对穿透（顶点入多边形深度）
import { referenceLevel, generateLevel } from '../src/level.js';
import { createSim, solvePhys, simEvent, simTick } from '../src/sim.js';
import { DEFS } from '../src/settings.js';
import { toWorld, inPoly } from '../src/physics.js';
const S = {}; for (const k in DEFS) S[k] = DEFS[k];
const L = process.env.SEED ? generateLevel(S, +process.env.SEED) : referenceLevel();
let sim = createSim(L, S); const plan = solvePhys(L, S, sim.snap, { sim, timeMs: 60000 });
console.log('plan', plan && plan.length);
sim = createSim(L, S);
const eD = ([x, y], P) => { let d = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(ax + t * dx - x, ay + t * dy - y)); } return d; };
let worst = { d: 0 }, step = 0, wps = { d: 0 };
for (const [si, h] of plan) {
  step++; simEvent(sim, si, h); let n = 0;
  while (!sim.frozen && n++ < 720) {
    simTick(sim); const B = sim.bodies, W = sim.W;
    const P = B.map((b, i) => b.s === 'gone' ? null : L.plates[i].poly.map(([x, y]) => toWorld(b, x, y)));
    for (let i = 0; i < B.length; i++) for (let j = 0; j < B.length; j++) {
      if (i === j || !P[i] || !P[j] || L.plates[i].layer !== L.plates[j].layer) continue;
      const mv = b => b.s === 'swing' || (b.s === 'fall' && !b.ghost); if (!(mv(B[i]) || mv(B[j])) || B[i].ghost || B[j].ghost || (process.env.XPPG && (B[i].ppGhost || B[j].ppGhost))) continue;
      for (const v of P[i]) if (inPoly(v[0], v[1], P[j])) { const d = eD(v, P[j]); if (d > worst.d) worst = { d: +d.toFixed(2), i, j, si: B[i].s, sj: B[j].s, step, tick: n, pass: W.pass.has(i < j ? 'p' + i + '|p' + j : 'p' + j + '|p' + i), ppg: [!!B[i].ppGhost, !!B[j].ppGhost], awake: [W.plates[i].body && W.plates[i].body.isAwake(), W.plates[j].body && W.plates[j].body.isAwake()], types: [W.plates[i].body && W.plates[i].body.getType(), W.plates[j].body && W.plates[j].body.getType()] }; }
    }
  }
}
console.log('worstPP', JSON.stringify(worst));
