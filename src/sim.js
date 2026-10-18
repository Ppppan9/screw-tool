// v1.7.2 预测 == 实际：无界面、固定步长的同一套物理。实时游戏（main.js 累加器）与求解器/生成器都用这里的
// simEvent（某颗螺丝从孔 A 换到孔 B，即视觉落座+releaseDelay 那一刻）→ simTick × N → 全部静止（freeze）→ 快照。
// 有物理变化的事件：实时与预测都先从上一次静止快照重建世界（restoreWorld），所以起点完全相同、步数完全相同 → 结果逐位一致。
// 没有物理变化的事件（钉数变化不引起状态转换、新旧孔附近没有动态板）：两边都不积分，只更新快照。
import { createWorld, applyPins, stepFixed, pinsChange, worldSettled, snapWorld, restoreWorld, pointNearDynamic, DT } from './world.js';
import { newBody, toWorld as bToWorld, toLocal as bToLocal } from './physics.js';
import { platePins, poseFromXf, holeUsable, screwFree, coverInfo, pointInPoly, ALIGN_TOL, EDGE_TOL, setValidator } from './level.js';
export { DT };
export const SIM_CAP = 3;      // 求解器：一步最多模拟 3s（不静止 → 视为不可预测，不走这一步）
export const LIVE_CAP = 6;     // 实时：6s 还不静止 → 强制冻结（只是兜底）
const hxy = (L, h) => [L.holes[h].x, L.holes[h].y];
function bboxC(P) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of P) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [(a + c) / 2, (b + d) / 2]; }
export function templateBodies(L) { return L.plates.map(p => newBody(p.poly, p._C || bboxC(p.poly), p.holes.map(h => hxy(L, h)))); }
function obstOf(sim) { const k = sim.vHole.join(','); if (sim._obK === k) return sim._ob; sim._obK = k; const o = sim._ob = []; sim.vHole.forEach((h, si) => { if (h >= 0) o.push({ id: si, x: sim.L.holes[h].x, y: sim.L.holes[h].y }); }); return o; }
function poseKey(b) { return b.ang.toFixed(4) + ',' + b.dx.toFixed(2) + ',' + b.dy.toFixed(2); }
function isPosed(b) { return b.posed && (Math.abs(b.ang) > 1e-4 || Math.abs(b.dx) > 0.05 || Math.abs(b.dy) > 0.05); }
function poseOf(L, b, pi) { const k = poseKey(b); if (b._pk !== k) { b._pk = k; b._pose = poseFromXf(L, pi, b); } return b._pose; }
// 物理用的钉：与逻辑同一套 platePins 规则，板位姿取刚体实际位姿
export function pinsOf(L, bodies, vHole) {
  const vsw = new Map(); bodies.forEach((b, pi) => { if ((b.s === 'swing' || b.s === 'on') && isPosed(b)) vsw.set(pi, poseOf(L, b, pi)); });
  const vst = { screwHole: vHole, removed: new Set(), lifted: null, swing: vsw };
  return L.plates.map((_, pi) => (bodies[pi].s === 'on' || bodies[pi].s === 'swing') ? platePins(L, vst, pi) : []);
}
const pinWOf = (L, pins, vh) => pins.map(p => p.length === 1 ? hxy(L, vh[p[0]]) : null);
function makeSnap(sim) { const s = snapWorld(sim.W); s.vHole = sim.vHole.slice(); return s; }
export function createSim(L, S, bodies) {
  bodies = bodies || templateBodies(L);
  const sim = { L, S, bodies, vHole: L.screws.map(s => s.hole), frozen: false, t: 0, ticks: 0, W: null, snap: null };
  sim.W = createWorld(L, bodies, S);
  while (!sim.frozen && sim.t < SIM_CAP) simTick(sim);
  if (!sim.frozen) freeze(sim);
  return sim;
}
function freeze(sim) { sim.frozen = true; sim.snap = makeSnap(sim); }
export function forceFreeze(sim) { if (!sim.frozen) freeze(sim); }
function pinsCached(sim) {
  const k = sim.vHole.join(',') + '|' + sim.bodies.map(b => (b.s === 'on' || b.s === 'swing') && isPosed(b) ? poseKey(b) : b.s[0]).join(';');
  if (sim._pinK !== k) { sim._pinK = k; sim._pins = pinsOf(sim.L, sim.bodies, sim.vHole); }
  return sim._pins;
}
export function simTick(sim) {
  const { L, S, W } = sim, pins = pinsCached(sim);
  const ev = applyPins(W, pins.map(p => p.length), pinWOf(L, pins, sim.vHole), S, obstOf(sim));
  stepFixed(W, S).forEach((e, i) => { if (e) ev[i] = e; });
  sim.t += DT; sim.ticks++;
  if (sim.ticks >= 2 && worldSettled(W)) freeze(sim);
  return ev;
}
function wake(bodies) { bodies.forEach(b => { if (b.s === 'fall') { b.rest = false; b.sup = null; b.restT = 0; } else if (b.s === 'swing') { b.settled = false; b.settleT = 0; b.setRef = null; b.setT2 = 0; } }); }
// 静止状态下这一步是否“物理上什么都不发生”（只看快照里的位姿/字段 → 实时与预测判定相同）
function quietMove(L, S, bodies, vHole, si, h) {
  const vh = vHole.slice(); vh[si] = h; const pins = pinsOf(L, bodies, vh), pinW = pinWOf(L, pins, vh), r = (S.collShaftR ?? 6) + 2, old = vHole[si];
  const q = !pinsChange(bodies, pins.map(p => p.length), pinW) && !(old >= 0 && pointNearDynamic(L, bodies, L.holes[old].x, L.holes[old].y, r)) && !(h >= 0 && pointNearDynamic(L, bodies, L.holes[h].x, L.holes[h].y, r));
  return q ? { pins, pinW } : null;
}
// 实时与预测共用：螺丝 si 的物理位置变为孔 h（-1 = 离开）
export function simEvent(sim, si, h) {
  if (sim.vHole[si] === h) return 'same';
  const { L, S } = sim;
  if (sim.frozen) {
    const q = quietMove(L, S, sim.bodies, sim.vHole, si, h);
    if (q) { sim.vHole[si] = h; applyPins(sim.W, q.pins.map(p => p.length), q.pinW, S, obstOf(sim)); sim.snap = makeSnap(sim); return 'quiet'; }
    sim.W = restoreWorld(L, sim.bodies, S, sim.snap, obstOf(sim));
  }
  sim.vHole[si] = h; sim.frozen = false; sim.t = 0; sim.ticks = 0; wake(sim.bodies);
  return 'run';
}
// 把模拟器设为某个快照（求解器用；不建 planck 世界，直到真的需要积分）
function loadSnap(sim, snap) {
  sim.snap = snap; sim.vHole = snap.vHole.slice(); sim.frozen = true;
  snap.bodies.forEach((r, pi) => Object.assign(sim.bodies[pi], { s: r.s, ang: r.ang, dx: r.dx, dy: r.dy, cx: r.cx, cy: r.cy, n: r.n, lastPiv: r.lastPiv && r.lastPiv.slice(), pivW: r.pivW && r.pivW.slice(), piv: r.piv && r.piv.slice(), ang0: r.ang0, posed: r.posed, ppGhost: r.ppGhost, ghost: r.ghost, rest: r.rest, sup: r.sup, relAng: r.relAng, tf: r.tf }));
}
// 从静止快照推出一步的结果快照（null = 3s 内不静止）
export function predictMove(sim, snap, si, h) {
  loadSnap(sim, snap);
  const { L, S } = sim, q = quietMove(L, S, sim.bodies, sim.vHole, si, h);
  if (q) {
    const n = JSON.parse(JSON.stringify(snap)); n.vHole[si] = h;
    n.bodies.forEach((r, pi) => { if (r.s === 'on' || r.s === 'swing') { r.n = q.pins[pi].length; if (r.n === 1) r.lastPiv = q.pinW[pi].slice(); } });
    if (h < 0 || true) n.pass = n.pass.filter(k => !k.split('|').includes('s' + si));
    return n;
  }
  sim.W = restoreWorld(L, sim.bodies, S, snap, obstOf(sim));
  sim.vHole[si] = h; sim.frozen = false; sim.t = 0; sim.ticks = 0; wake(sim.bodies);
  while (!sim.frozen && sim.t < SIM_CAP) simTick(sim);
  return sim.frozen ? sim.snap : null;
}
// ---------- 逻辑状态 = 物理静止时的状态 ----------
// removed = 已释放（下落/被托住/消失）；swing = 有位姿的固定/摆动板；rest = 被托住（0 钉、静止在画面上）的板 + 支撑者
export function stateFromBodies(L, bodies, vHole, st = {}) {
  st.removed = new Set(); st.swing = new Map(); st.rest = new Map(); if (!st.lifted) st.lifted = new Set();
  const pins = pinsOf(L, bodies, vHole);
  bodies.forEach((b, pi) => {
    if (b.s === 'fall' || b.s === 'gone') st.removed.add(pi);
    if ((b.s === 'on' || b.s === 'swing') && isPosed(b)) { const ps = poseFromXf(L, pi, { ang: b.ang, dx: b.dx, dy: b.dy, C: b.C, hi: pins[pi].length === 1 ? vHole[pins[pi][0]] : -1 }); st.swing.set(pi, ps); }
    if (b.s === 'fall') { const sup = b.sup || { s: [], p: [] }; st.rest.set(pi, { pose: poseFromXf(L, pi, b), scr: sup.s.filter(si => vHole[si] >= 0).map(si => [si, vHole[si]]), pl: sup.p.slice() }); }
  });
  st.npins = pins.map(p => p.length);
  return st;
}
export function stateFromSnap(sim, snap) { loadSnap(sim, snap); const st = stateFromBodies(sim.L, sim.bodies, snap.vHole); st.screwHole = snap.vHole.slice(); return st; }
// 画面遮挡（实时点击判定与求解器同一函数）：下落/被托住/有位姿的板盖住底板孔 hi
export function visBlockedBy(L, bodies, st, hi) {
  const h = L.holes[hi];
  return L.plates.some((p, pi) => {
    const b = bodies[pi]; if (b.s === 'gone' || !(st.removed.has(pi) || b.s === 'fall' || b.posed)) return false;
    if (b.s === 'fall' && st.rest.has(pi) && b.rest) return false; // 被托住的板由逻辑 st.rest 判定遮挡（holeUsable/screwFree）
    const [lx, ly] = b.posed ? bToLocal(b, h.x, h.y) : [h.x, h.y];
    const covered = pointInPoly(lx, ly, p.poly) || p.poly.some((q, i) => { const r = p.poly[(i + 1) % p.poly.length], dx = r[0] - q[0], dy = r[1] - q[1], t = Math.max(0, Math.min(1, ((lx - q[0]) * dx + (ly - q[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(q[0] + t * dx - lx, q[1] + t * dy - ly) < EDGE_TOL; });
    if (!covered) return false;
    if (b.s === 'fall' || st.removed.has(pi)) return true;
    return !p.holes.some(k => { const w = bToWorld(b, L.holes[k].x, L.holes[k].y); return Math.hypot(w[0] - h.x, w[1] - h.y) <= ALIGN_TOL; });
  });
}
// ---------- 预测求解器 ----------
const allGone = snap => snap.bodies.every(r => r.s === 'gone');
function roughKey(snap) { return snap.vHole.join(',') + '|' + snap.bodies.map(r => r.s[0] + (r.s === 'on' && !r.posed ? '' : Math.round(r.dx) + ',' + Math.round(r.dy) + ',' + Math.round(r.ang * 90))).join(';'); }
const KEYS = new WeakMap(); function exactKey(snap) { let k = KEYS.get(snap); if (!k) KEYS.set(snap, k = JSON.stringify(snap)); return k; }
export function legalMoves(sim, L, st, snap) {
  const bodies = sim.bodies;
  const holes = L.holes.map((_, i) => i).filter(h => holeUsable(L, st, h) && !visBlockedBy(L, bodies, st, h) && !L.plates.some((p, pi) => !st.removed.has(pi) && p.holes.includes(h)));
  const cands = [], sups = new Set(); st.rest.forEach(r => r.scr.forEach(([si]) => sups.add(si)));
  st.screwHole.forEach((h, si) => {
    if (h < 0 || !screwFree(L, st, si) || visBlockedBy(L, bodies, st, h)) return;
    const pls = L.plates.map((p, pi) => pi).filter(pi => !st.removed.has(pi) && L.plates[pi].holes.includes(h));
    if (!pls.length) { if (sups.has(si)) cands.push({ si, score: -1000 - L.holes[h].y / 1000 }); return; }
    const rem = Math.max(...pls.map(pi => st.npins[pi]));
    const lay = Math.max(...pls.map(pi => L.plates[pi].layer));
    cands.push({ si, score: rem * 10 - lay - L.holes[h].y / 1000 });
  });
  cands.sort((a, b) => a.score - b.score);
  return { holes, cands };
}
export function solvePhys(L, S, snap0, opts = {}) {
  const T0 = Date.now(), budget = opts.timeMs ?? 8000, maxNodes = opts.maxNodes ?? 3000, NC = opts.cands ?? 5, NH = opts.holes ?? 2;
  const sim = opts.sim || createSim(L, S); let nodes = 0;
  const cache = L._simCache || (L._simCache = new Map()); if (cache.size > 4000) cache.clear();
  const seen = new Set();
  const out = (snap, si, h) => { const k = exactKey(snap) + '#' + si + '>' + h; if (cache.has(k)) return cache.get(k); const r = predictMove(sim, snap, si, h); cache.set(k, r); return r; };
  const score = s => s.bodies.reduce((a, r) => a + (r.s === 'gone' ? 3 : r.s === 'fall' ? -1 : r.s === 'swing' ? 0.2 : 0), 0);
  function rec(snap, depth) {
    if (allGone(snap)) return [];
    if (++nodes > maxNodes || Date.now() - T0 > budget || depth > L.screws.length * 5 + 20) return null;
    const rk = roughKey(snap); if (seen.has(rk)) return null; seen.add(rk);
    const st = stateFromSnap(sim, snap), { holes, cands } = legalMoves(sim, L, st, snap);
    if (!holes.length || !cands.length) return null;
    const moves = [];
    for (const { si } of cands.slice(0, NC)) {
      const from = L.holes[st.screwHole[si]], covN = h => coverInfo(L)[h].filter(pi => !st.removed.has(pi)).length;
      const hs = holes.slice().sort((a, b) => (covN(a) - covN(b)) || Math.hypot(L.holes[a].x - from.x, L.holes[a].y - from.y) - Math.hypot(L.holes[b].x - from.x, L.holes[b].y - from.y));
      hs.slice(0, NH).forEach((h, k) => moves.push({ si, h, ord: moves.length + k * 100 }));
    }
    // 按启发顺序逐个预测：一旦某步让板离开且没有新增被托住的板就先深入（少做预测）；其余按得分排序后回溯
    moves.sort((a, b) => a.ord - b.ord);
    const base = score(snap), kids = [];
    for (const m of moves) {
      const r = out(snap, m.si, m.h); if (!r) continue;
      const k = { ...m, r, sc: score(r) - base };
      if (k.sc >= 2.9) { k.done = true; const p = rec(k.r, depth + 1); if (p) return [[k.si, k.h, k.r]].concat(p); }
      kids.push(k);
    }
    kids.sort((a, b) => (b.sc - a.sc) || (a.ord - b.ord));
    for (const k of kids) { if (k.done) continue; const r = rec(k.r, depth + 1); if (r) return [[k.si, k.h, k.r]].concat(r); }
    return null;
  }
  const plan = rec(snap0, 0);
  if (opts.stats) Object.assign(opts.stats, { nodes, ms: Date.now() - T0 });
  return plan;
}
// 生成器校验：从初始状态用预测求解器求解（有时间预算）
export function validateLevel(L, S, timeMs = 6000) { const sim = createSim(L, S); return !!solvePhys(L, S, sim.snap, { sim, timeMs }); }
setValidator((L, S, timeMs) => validateLevel(L, S, timeMs));
