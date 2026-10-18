import TRACE from './ref_trace.json';
import { smoothPoly, offsetPoly } from './geom.js';
import { massProps } from './physics.js';
// 关卡数据与逻辑。坐标系 720x1280。参考关卡由 ref/frames/g_004.jpg (t=2.93s) 逐点描绘：crop 偏移 (110,310)
const OX = 0, OY = 0;
const P = (pts) => pts.map(([x, y]) => [x + OX, y + OY]);

// 手指：分段边界点(指尖→根部，全分辨率 720x1280 坐标)、宽度
const FINGERS = [
  { name: '拇指', pts: [[116, 566], [190, 642], [228, 718], [276, 794]], w: 88 },
  { name: '食指', pts: [[243, 364], [263, 432], [282, 496], [298, 558], [314, 620]], w: 72 },
  { name: '中指', pts: [[385, 324], [387, 400], [388, 468], [388, 537], [386, 607]], w: 64 },
  { name: '无名指', pts: [[497, 344], [487, 420], [475, 492], [462, 560], [447, 632]], w: 62 },
  { name: '小指', pts: [[592, 438], [573, 508], [551, 568], [527, 620], [501, 668]], w: 58 },
];
const PALM = [
  { pts: [[252, 620], [340, 614], [366, 646], [360, 697], [247, 676]], screws: [[280, 645], [327, 670]] },
  { pts: [[240, 678], [360, 702], [381, 721], [376, 776], [250, 757], [234, 712]], screws: [[292, 716], [345, 740]] },
  { pts: [[436, 682], [461, 655], [546, 665], [553, 721], [440, 714]], screws: [[470, 694], [516, 694]] },
  { pts: [[384, 726], [543, 731], [538, 781], [388, 779]], screws: [[426, 754], [482, 757]] },
  { pts: [[391, 785], [531, 785], [515, 842], [396, 846]], screws: [[452, 806]] },
  { pts: [[285, 765], [386, 781], [390, 846], [316, 841], [275, 802]], screws: [[327, 808]] },
];
const BASE_PALM = [[235, 620], [300, 560], [400, 545], [500, 580], [562, 652], [556, 722], [542, 792], [528, 850], [503, 862], [503, 924], [302, 924], [302, 862], [262, 832], [232, 770], [222, 700]];
const EMPTY = [[400, 668]];
// 隐藏底孔：被板盖住，板掉落后露出（保证 1 个初始空孔也可解）
const HIDDEN = [[500, 812], [300, 812], [128, 576]];

function segQuad(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

// M-C：参考帧中手指处几乎看不到粉色底板露边（实测板边到底板边中位 4~5px → 内缩 3px）
export const REF_BASE_INSET = 3;
// v1.1：板块轮廓与手型由 tools/trace_plates.py 从参考帧自动分割得到（ref_trace.json）
export function referenceLevel() {
  const plates = [], holes = [], screws = [], base = { polys: [offsetPoly(smoothPoly(TRACE.base, 1.8, 3), REF_BASE_INSET)], capsules: [], smooth: true };
  TRACE.plates.forEach(tp => {
    const hs = tp.screws.map(([x, y]) => { holes.push({ x, y }); return holes.length - 1; });
    plates.push({ poly: smoothPoly(tp.poly, 1.2, 2), smooth: true, layer: 0, holes: hs, radius: 3 });
  });
  for (const [x, y] of EMPTY) holes.push({ x, y });
  for (const [x, y] of HIDDEN) holes.push({ x, y });
  plates.forEach(pl => pl.holes.forEach(h => screws.push({ hole: h })));
  return { plates, holes, screws, base, name: 'reference' };
}

// ---------- 几何 ----------
export function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ---------- 逻辑状态 ----------
// state: { removed:Set(plateIdx), screwHole: int[] (screw -> hole, -1 none) }
export function initState(L) { const st = { removed: new Set(), screwHole: L.screws.map(s => s.hole), lifted: new Set(), swing: new Map(), rest: new Map(), npins: null }; st.npins = L.plates.map((_, pi) => platePins(L, st, pi).length); return st; }
// ---------- v1.5 孔位固定在底板 ----------
// L.holes 是底板上的孔（固定不动）。板在静止位姿时自己的孔对准 p.holes 里的底板孔。
// 板由多钉减到 1 钉后绕剩下那颗摆到 ±swingMax（与画面物理一致），记录在 st.swing：之后用摆动后的轮廓/孔位判断覆盖与对齐。
let SWING_MAX = 17 * Math.PI / 180, RELEASE = 'seat';
export const ALIGN_TOL = 6;   // 板孔与底板孔对准容差(px) ≈ 螺丝半径×0.3
export const EDGE_TOL = 9;    // 摆动板边缘离底板孔中心小于此值也算压住（部分遮挡）
export function setPhysicsRules(o = {}) { if (o.swingMax != null) SWING_MAX = o.swingMax * Math.PI / 180; if (o.releaseAt) RELEASE = o.releaseAt; }
export function getRelease() { return RELEASE; }
function rotPt(x, y, sw) { const c = Math.cos(sw.ang), s = Math.sin(sw.ang), ux = x - sw.px, uy = y - sw.py; return [sw.px + c * ux - s * uy, sw.py + s * ux + c * uy]; }
function swingPose(L, pi, hi) {
  // 位姿只取决于 (板, 支点孔, swingMax) → 缓存（求解器/生成器会反复走到同一状态）
  const key = pi + ':' + hi + ':' + SWING_MAX; L._swc = L._swc || new Map();
  if (!L._swc.has(key)) L._swc.set(key, swingPose0(L, pi, hi));
  return L._swc.get(key);
}
function swingPose0(L, pi, hi) {
  const p = L.plates[pi], h = L.holes[hi], m = p._mp || (p._mp = massProps(p.poly)), rx = m.cx - h.x;
  return swingPoseAt(L, pi, hi, Math.abs(rx) < 1 ? 0 : Math.sign(rx) * SWING_MAX);
}
function swingPoseAt(L, pi, hi, ang) {
  const p = L.plates[pi], h = L.holes[hi];
  const sw = { px: h.x, py: h.y, ang, hi };
  sw.poly = p.poly.map(([x, y]) => rotPt(x, y, sw)); sw.holes = p.holes.map(k => rotPt(L.holes[k].x, L.holes[k].y, sw));
  // 预先算好摆动后对准/覆盖的底板孔（求解器/生成器会大量调用）
  sw.al = new Set(); sw.cov = new Set(); sw.inn = new Set();
  L.holes.forEach((h, k) => {
    if (sw.holes.some(([x, y]) => Math.hypot(x - h.x, y - h.y) <= ALIGN_TOL)) { sw.al.add(k); sw.cov.add(k); sw.inn.add(k); }
    else if (pointInPoly(h.x, h.y, sw.poly)) { sw.cov.add(k); sw.inn.add(k); } else if (distToPoly(h.x, h.y, sw.poly) < edgeTol(L, pi, k)) sw.cov.add(k);
  });
  return sw;
}
// v1.7.1：位姿变化后“边缘压住”容差不超过该孔在静止位姿时离板边的距离 − 2px：
// 紧密排列的关卡里邻板的孔本来就离板边只有几 px（静止时不算压住），摆动被挡在 ~0° 时不能突然算作压住
// （否则那颗螺丝既固定这块板、又被这块板压住 → 死锁无解）。
function edgeTol(L, pi, k) {
  const p = L.plates[pi]; if (!p._rd) p._rd = L.holes.map((h, j) => p.holes.includes(j) || pointInPoly(h.x, h.y, p.poly) ? Infinity : distToPoly(h.x, h.y, p.poly));
  return Math.max(0, Math.min(EDGE_TOL, p._rd[k] - 2));
}
function distToPoly(x, y, poly) { let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(ax + t * dx - x, ay + t * dy - y)); } return d; }
// 板 pi 在当前位姿下是否有自己的孔对准底板孔 hi
export function plateAligned(L, st, pi, hi) {
  const sw = st.swing && st.swing.get(pi); if (!sw) return L.plates[pi].holes.includes(hi);
  return sw.al.has(hi);
}
// 板 pi 在当前位姿下是否覆盖底板孔 hi（材料或孔）
// v1.7.1：strict=true 用于“已插着螺丝的孔”（固定/压住判定）：只有孔中心在板轮廓内（或对准）才算。
//   螺丝杆与板有物理碰撞，摆动板的边只会贴着螺丝杆停下（距孔中心≈杆半径）——贴边不是压住，否则
//   “板压住螺丝、螺丝又固定板”死锁（heart 关卡自动通关卡在 22/25）。空孔仍用边缘容差（部分遮挡的孔不能放螺丝）。
export function plateCovers(L, st, pi, hi, strict) {
  const sw = st.swing && st.swing.get(pi); if (!sw) return coverInfo(L)[hi].includes(pi);
  return strict && sw.inn ? sw.inn.has(hi) : sw.cov.has(hi);
}
// 当前位姿下可能覆盖底板孔 hi 的板（静止覆盖表 ∪ 摆动板）
function coverCands(L, st, hi) { const c = coverInfo(L)[hi]; if (!st.swing || !st.swing.size) return c; const out = new Set(c); st.swing.forEach((_, pi) => out.add(pi)); return [...out]; }
const isLifted = (st, si) => RELEASE === 'lift' && st.lifted && st.lifted.has(si);
export function coverInfo(L) {
  // 每个孔被哪些板覆盖，以及板在该点是否有孔
  if (L._cover) return L._cover;
  L._cover = L.holes.map((h, hi) => L.plates.map((p, pi) => pointInPoly(h.x, h.y, p.poly) || p.holes.includes(hi) ? pi : -1).filter(i => i >= 0));
  return L._cover;
}
export function holeOccupied(st, hi) { return st.screwHole.indexOf(hi) >= 0; }
// v1.2 螺丝阻挡判定（可在设置里关闭，关闭后回到 v1.1 规则：板只被自己孔里的螺丝固定）
let BLOCK = true;
export function setBlocking(v) { BLOCK = !!v; }
export function getBlocking() { return BLOCK; }
// 孔所在层：拥有该孔的板的最高层；不属于任何板 = 底板(-1)
export function holeLayer(L, hi) {
  if (!L._hl) L._hl = L.holes.map((_, h) => Math.max(-1, ...L.plates.filter(p => p.holes.includes(h)).map(p => p.layer)));
  return L._hl[hi];
}
// 孔可用：没有螺丝，且所有覆盖该点（未掉落）的板要么在此处有孔，要么（阻挡判定开启时）在孔所在层之下（螺丝穿过它直到底板）
export function holeUsable(L, st, hi) {
  if (holeOccupied(st, hi)) return false;
  const hl = holeLayer(L, hi);
  if (restCovers(st, hi, false)) return false;
  return coverCands(L, st, hi).every(pi => st.removed.has(pi) || !plateCovers(L, st, pi, hi) || plateAligned(L, st, pi, hi) || (BLOCK && L.plates[pi].layer < hl && !st.swing.has(pi)));
}
// 螺丝可取：其位置上方没有更高层且未开孔的板压住
export function screwFree(L, st, si) {
  const hi = st.screwHole[si]; if (hi < 0) return false;
  if (restCovers(st, hi, true)) return false;
  const cov = coverCands(L, st, hi).filter(pi => !st.removed.has(pi) && plateCovers(L, st, pi, hi, true));
  const pinnedTop = Math.max(-1, ...cov.filter(pi => plateAligned(L, st, pi, hi)).map(pi => L.plates[pi].layer));
  return !cov.some(pi => !plateAligned(L, st, pi, hi) && L.plates[pi].layer > pinnedTop);
}
export function plateScrews(L, st, pi) { return st.screwHole.map((h, si) => h >= 0 && plateAligned(L, st, pi, h) && !isLifted(st, si) ? si : -1).filter(i => i >= 0); }
// 固定某块板的螺丝：自己孔里的螺丝 + （阻挡判定）任何位置落在该板轮廓内的螺丝（螺丝贯穿该点所有重叠板直到底板）
export function platePins(L, st, pi) {
  if (!BLOCK) return plateScrews(L, st, pi);
  return st.screwHole.map((h, si) => h >= 0 && !isLifted(st, si) && plateCovers(L, st, pi, h, true) ? si : -1).filter(i => i >= 0);
}
// 执行移动，返回掉落板列表。每次螺丝移动后重新评估所有板（不动点迭代）：
// 目标孔里的螺丝会立即挡住覆盖该点的板；拔出的螺丝会释放所有被它贯穿的板
// v1.2.1（对齐参考 3.97s 点击→4.17s 板开始下落）：螺丝一旦拧出（离开孔）就不再固定任何板，
// 先在“螺丝不在任何孔”的状态下结算掉落，再把螺丝放入目标孔
export function settle(L, st) {
  releaseRest(L, st);
  const fell = []; let changed = true;
  if (!st.swing) st.swing = new Map();
  if (!st.npins) st.npins = L.plates.map(() => 0);
  while (changed) {
    changed = false;
    L.plates.forEach((p, pi) => {
      if (st.removed.has(pi)) return;
      const pins = platePins(L, st, pi);
      if (pins.length === 0) { st.removed.add(pi); fell.push(pi); changed = true; if (st.pred) { const [P, H] = curPoly(L, st, pi), d = predictDrop(L, st, pi, P, H); if (d) { if (!st.rest) st.rest = new Map(); st.rest.set(pi, d); } } return; }
      // v1.5：由多钉减到 1 钉 → 绕剩下那颗摆动，其它孔不再对准底板孔
      if (pins.length === 1 && st.npins[pi] >= 2 && !st.swing.has(pi)) { st.swing.set(pi, swingPose(L, pi, st.screwHole[pins[0]])); changed = true; }
      st.npins[pi] = platePins(L, st, pi).length;
    });
  }
  releaseRest(L, st);
  return fell;
}
// v1.7：物理决定摆动板实际停下的角度（可能被其它板/螺丝挡在 < swingMax 处）。游戏里摆动板静止后把逻辑位姿同步为实际角度，再结算。
// 求解器/生成器仍按 ±swingMax 的确定性假设规划；自动通关遇到计划失效时从当前（已同步的）状态重新求解。
export function setSwingAngle(L, st, pi, ang) {
  const sw = st.swing && st.swing.get(pi); if (!sw) return [];
  const a = Math.round(ang / (Math.PI / 1800)) * (Math.PI / 1800); if (Math.abs(a - sw.ang) < 1e-9) return [];
  const k = pi + ':' + sw.hi + '@' + a; L._swc = L._swc || new Map();
  if (!L._swc.has(k)) L._swc.set(k, swingPoseAt(L, pi, sw.hi, a));
  st.swing.set(pi, L._swc.get(k));
  return settle(L, st);
}
// v1.7.1：通用位姿（直接取物理刚体的变换 x' = R(ang)(x−C) + C + (dx,dy)），用于：
//  ① 逻辑同步摆动板/重新固定板实际停下的位姿（板可能先绕钉 A 摆、再被别的钉固定、又绕钉 B 摆，单一“绕原支点转角”描述不了）；
//  ② 画面判定“哪些螺丝固定这块板”时用板的实际位姿（与逻辑同一套覆盖/对准规则，避免逻辑认为被固定而画面上已掉落）。
export function poseFromXf(L, pi, xf) {
  const p = L.plates[pi], c = Math.cos(xf.ang), s = Math.sin(xf.ang);
  const T = (x, y) => { const ux = x - xf.C[0], uy = y - xf.C[1]; return [xf.C[0] + c * ux - s * uy + xf.dx, xf.C[1] + s * ux + c * uy + xf.dy]; };
  const sw = { ang: xf.ang, dx: xf.dx, dy: xf.dy, C: xf.C, hi: xf.hi ?? -1, xf: true };
  sw.poly = p.poly.map(([x, y]) => T(x, y)); sw.holes = p.holes.map(k => T(L.holes[k].x, L.holes[k].y));
  sw.al = new Set(); sw.cov = new Set(); sw.inn = new Set();
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const [x, y] of sw.poly) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  L.holes.forEach((h, k) => {
    if (h.x < bx0 - EDGE_TOL - ALIGN_TOL || h.x > bx1 + EDGE_TOL + ALIGN_TOL || h.y < by0 - EDGE_TOL - ALIGN_TOL || h.y > by1 + EDGE_TOL + ALIGN_TOL) return;
    if (sw.holes.some(([x, y]) => Math.hypot(x - h.x, y - h.y) <= ALIGN_TOL)) { sw.al.add(k); sw.cov.add(k); sw.inn.add(k); }
    else if (pointInPoly(h.x, h.y, sw.poly)) { sw.cov.add(k); sw.inn.add(k); } else if (distToPoly(h.x, h.y, sw.poly) < edgeTol(L, pi, k)) sw.cov.add(k);
  });
  return sw;
}
// 把逻辑里板 pi 的位姿同步为物理实际位姿并结算（返回新掉落的板）
export function setPlatePose(L, st, pi, xf) {
  if (!st.swing) st.swing = new Map();
  const old = st.swing.get(pi); st.swing.set(pi, poseFromXf(L, pi, { ...xf, hi: old ? old.hi : xf.hi }));
  return settle(L, st);
}
// 逻辑位姿与物理位姿的最大偏差（px，按板孔/轮廓采样点）
export function poseDiff(L, st, pi, xf) {
  const sw = st.swing && st.swing.get(pi), p = L.plates[pi], c = Math.cos(xf.ang), s = Math.sin(xf.ang);
  const T = (x, y) => { const ux = x - xf.C[0], uy = y - xf.C[1]; return [xf.C[0] + c * ux - s * uy + xf.dx, xf.C[1] + s * ux + c * uy + xf.dy]; };
  const pts = p.holes.map(k => [L.holes[k].x, L.holes[k].y]).concat(p.poly.filter((_, i) => i % Math.max(1, Math.floor(p.poly.length / 8)) === 0));
  if (!sw) return Math.max(0, ...pts.map(([x, y]) => { const w = T(x, y); return Math.hypot(w[0] - x, w[1] - y); }));
  const R = sw.xf ? ((x, y) => { const cc = Math.cos(sw.ang), ss = Math.sin(sw.ang), ux = x - sw.C[0], uy = y - sw.C[1]; return [sw.C[0] + cc * ux - ss * uy + sw.dx, sw.C[1] + ss * ux + cc * uy + sw.dy]; }) : ((x, y) => rotPt(x, y, sw));
  return Math.max(0, ...pts.map(([x, y]) => { const a = T(x, y), b = R(x, y); return Math.hypot(a[0] - b[0], a[1] - b[1]); }));
}
export function liftOut(L, st, si) { (st.lifted || (st.lifted = new Set())).add(si); return RELEASE === 'lift' ? settle(L, st) : []; }
export function cancelLift(st, si) { if (st.lifted) st.lifted.delete(si); }
export function applyMove(L, st, si, hi) {
  if (st.lifted) st.lifted.delete(si);
  // v1.5（参考：螺丝在目标孔落座后板才释放）：直接移到目标孔再结算；旧的 'lift' 模式先在“螺丝不在孔里”的状态下结算
  if (RELEASE !== 'lift') { st.screwHole[si] = hi; return settle(L, st); }
  st.screwHole[si] = -1;
  const fell = settle(L, st);
  st.screwHole[si] = hi;
  return fell.concat(settle(L, st));
}
export function usableHoles(L, st) { return L.holes.map((_, i) => i).filter(i => holeUsable(L, st, i)); }
export function done(L, st) { return st.removed.size === L.plates.length && !(st.rest && st.rest.size); }
// v1.7.2：被托住的板（0 钉，但还在画面上、被螺丝杆/其它板托住）。逻辑上已“释放”（在 removed 里），但仍按物理实际位姿
// 挡住其下的底板孔（空孔用边缘容差，已插螺丝用严格规则；自己对准的孔照常可用），直到它的某个支撑被移走（假设随即掉出，物理静止后再同步）。
//   st.rest: pi → { pose, scr: [[si, hole]], pl: [pj] }
function restCovers(st, hi, strict) {
  if (!st.rest || !st.rest.size) return false;
  for (const r of st.rest.values()) if (r.pose.inn.has(hi) && !r.pose.al.has(hi)) return true; // 被托住的板只挡中心在其轮廓内的孔（贴边不挡，避免堆积时整盘无孔可用）
  return false;
}
export function setRest(L, st, pi, xf, sup) {
  if (!st.rest) st.rest = new Map();
  st.rest.set(pi, { pose: poseFromXf(L, pi, xf), scr: sup.s.filter(si => st.screwHole[si] >= 0).map(si => [si, st.screwHole[si]]), pl: sup.p.slice() });
}
export function clearRest(st, pi) { if (st.rest) st.rest.delete(pi); }
// 支撑被移走（螺丝离开原孔 / 支撑板已离开）→ 不再托住。st.pred（求解器/生成器）：从当前位姿重新预测下落落点
function releaseRest(L, st) {
  if (!st.rest || !st.rest.size) return;
  let ch = true;
  while (ch) { ch = false; for (const [pi, r] of [...st.rest]) if (r.scr.some(([si, h]) => st.screwHole[si] !== h) || r.pl.some(pj => st.removed.has(pj) && !st.rest.has(pj)) || (st.pred && !r.scr.length)) {
    st.rest.delete(pi); ch = true;
    if (st.pred) { const d = predictDrop(L, st, pi, r.pose.poly, r.pose.holes); if (d) st.rest.set(pi, d); }
  } }
}
// v1.7.2 落点预测（求解器/生成器用，解析近似）：板沿竖直方向平移下落，直到轮廓第一次碰到某颗插在底板里的螺丝杆圆（半径 SHAFT_R）。
// 碰到 → 被这颗螺丝永久托住（pose = 平移后的轮廓，挡住中心在其内的孔）；碰不到 → 掉出。
// 只被板托住的板在实际物理里 ppStuckMs 后穿过板继续下落，所以预测里忽略板-板支撑（与之一致）。
// 实际物理可能绕接触点转动/滑落到更下面的螺丝：自动通关每步按物理同步的真实状态重新求解。
export let SHAFT_R = 6; const STAB = 6;
export function setShaftR(r) { SHAFT_R = r; }
function densify(P, step = 3) { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; }
function predictDrop(L, st, pi, poly, ownPts) {
  const R = SHAFT_R, D = densify(poly);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9; for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  const own = ownPts || [];
  const hits = [];
  st.screwHole.forEach((h, si) => {
    if (h < 0) return; const c = L.holes[h];
    if (c.x < x0 - R || c.x > x1 + R || c.y + R < y0) return;
    if (own.some(([x, y]) => Math.hypot(x - c.x, y - c.y) <= ALIGN_TOL)) return;
    if (pointInPoly(c.x, c.y, poly)) return; // 已在轮廓内（不应发生）：忽略
    let t = Infinity;
    for (const [x, y] of D) { const dx = x - c.x; if (Math.abs(dx) > R) continue; const tt = c.y - Math.sqrt(R * R - dx * dx) - y; if (tt >= -1.5 && tt < t) t = tt; }
    if (t < 1500) hits.push([t, si, c.x]);
  });
  // 稳定性：质心落在接触螺丝的水平范围内（±STAB px）才停住；否则绕接触点翻落——忽略这些螺丝继续往下找
  hits.sort((a, b) => a[0] - b[0]);
  let A = 0, cx = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const cr = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; A += cr; cx += (poly[j][0] + poly[i][0]) * cr; } cx /= (3 * A || 1);
  let best = Infinity, sup = null;
  for (let i = 0; i < hits.length;) {
    const t1 = hits[i][0], grp = []; while (i < hits.length && hits[i][0] <= t1 + 3) grp.push(hits[i++]);
    const lo = Math.min(...grp.map(g => g[2])), hi2 = Math.max(...grp.map(g => g[2]));
    if (cx >= lo - STAB && cx <= hi2 + STAB) { best = t1; sup = grp.map(g => g[1]); break; }
  }
  if (!sup) return null;
  const t = Math.max(0, best), P = poly.map(([x, y]) => [x, y + t]), H = own.map(([x, y]) => [x, y + t]);
  const pose = { ang: 0, dx: 0, dy: t, C: [0, 0], poly: P, holes: H, al: new Set(), cov: new Set(), inn: new Set(), pred: true };
  L.holes.forEach((h, k) => { if (H.some(([x, y]) => Math.hypot(x - h.x, y - h.y) <= ALIGN_TOL)) { pose.al.add(k); pose.cov.add(k); pose.inn.add(k); } else if (pointInPoly(h.x, h.y, P)) { pose.cov.add(k); pose.inn.add(k); } });
  return { pose, scr: sup.map(si => [si, st.screwHole[si]]), pl: [] };
}
// 板 pi 刚被释放时的当前轮廓与自己孔的位置（摆动位姿或静止位姿）
function curPoly(L, st, pi) { const sw = st.swing && st.swing.get(pi), p = L.plates[pi]; return sw ? [sw.poly, sw.holes] : [p.poly, p.holes.map(k => [L.holes[k].x, L.holes[k].y])]; }
export function restSupporters(st) { const m = new Set(); if (st.rest) for (const r of st.rest.values()) r.scr.forEach(([si]) => m.add(si)); return m; }

// 目标孔选择规则
export function pickHole(L, st, si, rule, lastVacated, rnd = Math.random) {
  const from = L.holes[st.screwHole[si]];
  const pinned = new Set(L.plates.map((p, pi) => pi).filter(pi => !st.removed.has(pi) && L.plates[pi].holes.includes(st.screwHole[si])));
  let c = usableHoles(L, st).filter(h => h !== st.screwHole[si]);
  // 优先不把螺丝放回仍未掉落的板（避免无效步）
  const free = c.filter(h => !L.plates.some((p, pi) => !st.removed.has(pi) && p.holes.includes(h)));
  if (free.length) c = free;
  if (!c.length) return -1;
  if (rule === 'vacated' && lastVacated >= 0 && c.includes(lastVacated)) return lastVacated;
  if (rule === 'random') return c[Math.floor(rnd() * c.length)];
  c.sort((a, b) => Math.hypot(L.holes[a].x - from.x, L.holes[a].y - from.y) - Math.hypot(L.holes[b].x - from.x, L.holes[b].y - from.y));
  return c[0];
}

// 自动求解：贪心 + 回溯。返回 [[screw, hole], ...] 或 null
// 解析求解器（静态逻辑模型，logic-test 用）；游戏/生成器用 sim.js 的物理预测求解器（validateLevel / solvePhys）
export function solve(L, st0, maxNodes = 20000, pred = false) {
  let nodes = 0;
  const clone = (s) => ({ removed: new Set(s.removed), screwHole: s.screwHole.slice(), swing: new Map(s.swing), rest: new Map(s.rest || []), pred, npins: s.npins ? s.npins.slice() : null });
  const seen = new Set(), maxDepth = L.screws.length * 6 + 20;
  function rec(st, path) {
    if (done(L, st)) return path;
    if (++nodes > maxNodes || path.length > maxDepth) return null;
    const sk = st.screwHole.join(',') + '|' + [...st.removed].sort((a, b) => a - b).join(',') + '|' + (st.rest ? [...st.rest].map(([k, r]) => k + ':' + Math.round(r.pose.dy || 0)).sort().join(',') : '');
    if (seen.has(sk)) return null; seen.add(sk);
    const holes = usableHoles(L, st).filter(h => !L.plates.some((p, pi) => !st.removed.has(pi) && p.holes.includes(h)));
    if (!holes.length) return null;
    // 候选螺丝：在未掉落板上且可取，按所在板剩余螺丝数、层级排序
    const cands = [], sups = restSupporters(st);
    st.screwHole.forEach((h, si) => {
      if (h < 0 || !screwFree(L, st, si)) return;
      const pls = L.plates.map((p, pi) => pi).filter(pi => !st.removed.has(pi) && L.plates[pi].holes.includes(h));
      if (!pls.length) { if (sups.has(si)) cands.push({ si, score: -1000 - L.holes[h].y / 1000 }); return; }
      const rem = Math.max(...pls.map(pi => platePins(L, st, pi).length));
      const lay = Math.max(...pls.map(pi => L.plates[pi].layer));
      cands.push({ si, score: rem * 10 - lay - L.holes[h].y / 1000 });
    });
    cands.sort((a, b) => a.score - b.score);
    for (const { si } of cands.slice(0, 4)) {
      const from = L.holes[st.screwHole[si]];
      const covN = h => coverInfo(L)[h].filter(pi => !st.removed.has(pi)).length;
      // v1.7.2：支撑螺丝不要放到被托住板的正下方（否则板又落在它上面）
      const col = [...(st.rest || new Map()).values()].filter(r => r.scr.some(([q]) => q === si)).map(r => { let a = 1e9, b = -1e9; for (const [x] of r.pose.poly) { a = Math.min(a, x); b = Math.max(b, x); } return [a - 8, b + 8]; });
      const under = h => col.some(([a, b]) => L.holes[h].x > a && L.holes[h].x < b) ? 1 : 0;
      const hs = holes.slice().sort((a, b) => (under(a) - under(b)) || (covN(a) - covN(b)) || Math.hypot(L.holes[a].x - from.x, L.holes[a].y - from.y) - Math.hypot(L.holes[b].x - from.x, L.holes[b].y - from.y));
      const s2 = clone(st); applyMove(L, s2, si, hs[0]);
      const r = rec(s2, path.concat([[si, hs[0]]]));
      if (r) return r;
    }
    return null;
  }
  return rec(clone(st0), []);
}

// ---------- 随机关卡生成（保证可解）----------
export function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// v1.7.2：生成器用物理预测求解器校验可解（sim.js 注册；没注册时退回解析求解）
let VALIDATE = (L, S, ms, n) => !!solve(L, initState(L), n || 6000);
export function setValidator(f) { VALIDATE = f; }
export function validate(L, S, ms, n) { return VALIDATE(L, S, ms, n); }
export function generateLevel(o, seed) {
  for (let tries = 0; tries < 30; tries++) {
    // v1.7.2：物理预测求解（有时间预算 genSolveMs）失败 → 每次失败多加 1 个空孔；只接受求解成功的关卡
    const L = buildRandom({ ...o, emptyHoles: (o.emptyHoles || 2) + tries }, mulberry(seed + tries * 7919)); if (!L) continue;
    L.attempts = tries + 1;
    const st = initState(L);
    if (VALIDATE(L, o, o.genSolveMs ?? 4000, 6000)) return L;
  }
  return referenceLevel();
}
export function buildRandom(o, rnd) {
  {
    const L = { plates: [], holes: [], screws: [], base: { polys: [], capsules: [] }, name: 'random' };
    const cx = 360, cy = o.genCenterY, W = o.genCols * (o.genPlateW + o.genGap), H = o.genRows * (o.genPlateH + o.genGap);
    const x0 = cx - W / 2, y0 = cy - H / 2;
    L.base.polys.push([[x0 - 24, y0 - 24], [x0 + W + 24, y0 - 24], [x0 + W + 24, y0 + H + 24], [x0 - 24, y0 + H + 24]]);
    const holeAt = (x, y) => { let i = L.holes.findIndex(h => Math.hypot(h.x - x, h.y - y) < 6); if (i < 0) { L.holes.push({ x, y }); i = L.holes.length - 1; } return i; };
    for (let layer = 0; layer < o.genLayers; layer++) {
      const occ = new Set(); // v1.7.1：同一层的格子只能被一块板占用（以前 2 格板与下一格的板会完全叠在同一层 → 同层穿模）
      for (let r = 0; r < o.genRows; r++) for (let c = 0; c < o.genCols; c++) {
        if (rnd() > o.genDensity) continue;
        const span = rnd() < 0.35 ? 2 : 1, horiz = rnd() < 0.5;
        const cw = horiz ? span : 1, ch = horiz ? 1 : span;
        if (c + cw > o.genCols || r + ch > o.genRows) continue;
        const cells = []; for (let dr = 0; dr < ch; dr++) for (let dc = 0; dc < cw; dc++) cells.push((r + dr) * 1000 + c + dc);
        if (cells.some(k => occ.has(k))) continue;
        const off = layer * 0.5;
        const px = x0 + (c + off * (layer % 2)) * (o.genPlateW + o.genGap), py = y0 + (r + off * (layer % 2)) * (o.genPlateH + o.genGap);
        const pw = cw * (o.genPlateW + o.genGap) - o.genGap, ph = ch * (o.genPlateH + o.genGap) - o.genGap;
        if (px + pw > x0 + W + 4 || py + ph > y0 + H + 4) continue;
        const poly = [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]];
        const n = Math.max(1, Math.min(o.screwsPerPlate, span * 2));
        const hp = [];
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : 0.22 + 0.56 * k / (n - 1);
          hp.push([horiz ? px + pw * t : px + pw / 2, horiz ? py + ph / 2 : py + ph * t]);
        }
        // v1.7 修复：上层板不能盖住下层已有的孔（阻挡规则下那颗螺丝既固定上层板又被它压住 → 必然无解）
        if (L.holes.some(h => !hp.some(([x, y]) => Math.hypot(h.x - x, h.y - y) < 6) && (pointInPoly(h.x, h.y, poly) || distToPoly(h.x, h.y, poly) < 18))) continue;
        const hs = hp.map(([x, y]) => holeAt(x, y));
        cells.forEach(k => occ.add(k));
        L.plates.push({ poly, layer, holes: [...new Set(hs)], radius: 12 });
      }
    }
    if (!L.plates.length) return null;
    // v1.7 修复（自 v1.4 起随机关总是因为空孔落在板下而无解、回退成参考关卡）：空孔必须露在外面。
    // 先找没有任何板覆盖的空白位置；不够时随机拿掉一块最上层的板，它的孔若未被其它板覆盖就成为空孔。
    const uncovered = (x, y, m) => !L.plates.some(p => pointInPoly(x, y, p.poly) || distToPoly(x, y, p.poly) < m);
    const openHoles = () => L.holes.filter(h => uncovered(h.x, h.y, 4) && !L.plates.some(p => p.holes.some(k => L.holes[k] === h))).length;
    let tries2 = 0, guard = 0;
    while (openHoles() < o.emptyHoles && guard++ < 40) {
      let placed = false;
      while (tries2++ < 400) { const x = x0 + rnd() * W, y = y0 + rnd() * H; if (L.holes.some(h => Math.hypot(h.x - x, h.y - y) < 46) || !uncovered(x, y, 18)) continue; L.holes.push({ x, y }); placed = true; break; }
      if (placed) continue;
      const top = Math.max(...L.plates.map(p => p.layer)), cand = L.plates.map((p, i) => p.layer === top ? i : -1).filter(i => i >= 0);
      if (L.plates.length <= 2) break; L.plates.splice(cand[Math.floor(rnd() * cand.length)], 1);
    }
    L.plates.forEach(p => p.holes.forEach(h => { if (!L.screws.some(s => s.hole === h)) L.screws.push({ hole: h }); }));
    // 把空孔设为不被覆盖：若被板覆盖则无效，交给求解器判定
    return L;
  }
}
