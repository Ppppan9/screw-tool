// v1.7 板块刚体世界：planck.js（Box2D 的 JS 移植，打包进单文件，无 CDN）。
// 每块板 = 一个刚体（凸分解后的多个多边形夹具；板孔不参与碰撞——见 ref/ANALYSIS.md v1.7）；每颗插在底板里的螺丝 = 静态圆（螺丝杆）。
// 状态：≥2 钉 → 静态；由多钉减到 1 钉 → 动态 + 绕钉铰接（±swingMax 限位）；0 钉 → 自由刚体下落。
// 碰撞规则：某块板变为动态（摆动/释放）的瞬间与之重叠的板/螺丝（叠放的板，或螺丝杆在板轮廓内）记为“穿过对”，
//   互不碰撞，直到两者分开后才恢复碰撞；其余所有对（下落-下落、下落-摆动、下落-固定、摆动-固定、板-螺丝）都碰撞。
import { World, Vec2, Polygon, Circle, RevoluteJoint } from 'planck';
import { rdpClosed, polyArea, offsetPoly } from './geom.js';
import { syncPose, toWorld, toLocal, inPoly } from './physics.js';

export const PX = 50; // 1 m = 50 px（Box2D 适合 0.1–10 m 的物体）
const D2R = Math.PI / 180;

// ---------- 凸分解 ----------
// v1.7.1：图形关卡的板轮廓很密（96–232 点、大量近共线点），旧的 quickDecomp/earClip 会静默失败，
// 碰撞夹具只覆盖板面积的 1–57%（板-板穿模的根本原因）。现在：清理重复/近共线点 → 保证推进的耳切 → Hertel–Mehlhorn 合并为 ≤8 边凸块。
const cross3 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function cleanPoly(poly) {
  const P = poly.map(([x, y]) => [x, y]); if (polyArea(P) < 0) P.reverse();
  let changed = true;
  while (changed && P.length > 3) {
    changed = false;
    for (let i = 0; i < P.length && P.length > 3; i++) {
      const n = P.length, a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.25 || Math.abs(cross3(a, b, c)) / l < 0.04) { P.splice(i, 1); i--; changed = true; }
    }
  }
  return P;
}
function earClipIdx(P) {
  const idx = P.map((_, i) => i), tris = [];
  const inTri = (p, a, b, c) => cross3(a, b, p) > 1e-9 && cross3(b, c, p) > 1e-9 && cross3(c, a, p) > 1e-9;
  while (idx.length > 3) {
    const n = idx.length; let pick = -1, best = -1, bestCr = -Infinity;
    for (let k = 0; k < n; k++) {
      const ia = idx[(k - 1 + n) % n], ib = idx[k], ic = idx[(k + 1) % n], cr = cross3(P[ia], P[ib], P[ic]);
      if (cr > bestCr) { bestCr = cr; best = k; }
      if (cr <= 1e-9) continue;
      let ok = true; for (const j of idx) if (j !== ia && j !== ib && j !== ic && inTri(P[j], P[ia], P[ib], P[ic])) { ok = false; break; }
      if (ok) { pick = k; break; }
    }
    if (pick < 0) pick = best; // 退化（自交/全共线）：仍然切掉最凸的顶点，保证终止
    const ia = idx[(pick - 1 + n) % n], ib = idx[pick], ic = idx[(pick + 1) % n];
    if (cross3(P[ia], P[ib], P[ic]) > 1e-9) tris.push([ia, ib, ic]);
    idx.splice(pick, 1);
  }
  if (idx.length === 3 && cross3(P[idx[0]], P[idx[1]], P[idx[2]]) > 1e-9) tris.push(idx.slice());
  return tris;
}
function isConvexIdx(P, r) { const n = r.length; for (let i = 0; i < n; i++) if (cross3(P[r[(i - 1 + n) % n]], P[r[i]], P[r[(i + 1) % n]]) < -1e-6) return false; return true; }
function mergeHM(P, pieces, maxV = 8) {
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < pieces.length; a++) for (let b = a + 1; b < pieces.length; b++) {
      const A = pieces[a], B = pieces[b];
      if (A.length + B.length - 2 > maxV) continue;
      for (let i = 0; i < A.length; i++) {
        const u = A[i], v = A[(i + 1) % A.length], j = B.indexOf(v);
        if (j < 0 || B[(j + 1) % B.length] !== u) continue;
        const ring = []; for (let k = 0; k < A.length; k++) ring.push(A[(i + 1 + k) % A.length]); // v … u
        for (let k = 2; k < B.length; k++) ring.push(B[(j + k) % B.length]); // B 中 u 之后到 v 之前
        if (!isConvexIdx(P, ring)) continue;
        pieces[a] = ring; pieces.splice(b, 1); merged = true; break outer;
      }
    }
  }
  return pieces;
}
export function convexParts(poly) {
  let p = cleanPoly(rdpClosed(poly, 0.6));
  if (p.length < 3) p = cleanPoly(poly);
  const P = p, tris = earClipIdx(P);
  return mergeHM(P, tris).map(r => r.map(i => P[i])).filter(c => Math.abs(polyArea(c)) > 0.5);
}

// ---------- 世界 ----------
const PARTS = new WeakMap(); // 板 → { inset: 凸块 }（求解器每次预测都重建世界，凸分解只做一次）
function partsOf(pl, ins) { let m = PARTS.get(pl); if (!m) PARTS.set(pl, m = {}); return m[ins] || (m[ins] = convexParts(ins > 0 ? offsetPoly(pl.poly, ins) : pl.poly)); }
const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
export function createWorld(L, bodies, S) {
  const pw = new World({ gravity: Vec2(0, (S.gravity || 3600) / PX), allowSleep: false, continuousPhysics: false }); // 固定 1/120s 步长下板（≥30px）不会一步穿过螺丝杆，关闭 TOI 省时 // v1.7.2：不休眠——被托住的板在支撑移走后必须立即下落
  const W = { pw, L, S, bodies, ground: pw.createBody(), plates: [], screws: new Map(), pass: new Map(), steps: 0 };
  bodies.forEach((b, pi) => {
    if (b.s === 'gone') { W.plates.push({ body: null, joint: null }); return; } // 恢复快照：已离开的板不建刚体（否则实时/预测两边插入-删除的位置不同 → 宽相树结构不同 → 接触顺序不同 → 结果不逐位一致）
    const ins = S.ppInset ?? 1.5, parts = partsOf(L.plates[pi], ins), m = b.m, c0 = toWorld(b, m.cx, m.cy);
    const body = pw.createBody({ type: 'static', position: Vec2(c0[0] / PX, c0[1] / PX), angle: b.ang });
    let fa = 0; for (const c of parts) { try { body.createFixture(new Polygon(c.map(([x, y]) => Vec2((x - m.cx) / PX, (y - m.cy) / PX))), { density: 1, friction: S.ppFric ?? 0.4, restitution: S.ppRest ?? 0.1 }); fa += Math.abs(polyArea(c)); } catch (e) { } }
    if (b.fixCover == null) { b.fixCover = fa / Math.max(1, Math.abs(polyArea(L.plates[pi].poly))); b.fixCoverIns = fa / Math.max(1, Math.abs(polyArea(ins > 0 ? offsetPoly(L.plates[pi].poly, ins) : L.plates[pi].poly))); }
    body.setUserData({ k: 'p', id: 'p' + pi, pi });
    W.plates.push({ body, joint: null });
  });
  pw.on('pre-solve', (c) => {
    const A = c.getFixtureA().getBody().getUserData(), B = c.getFixtureB().getBody().getUserData();
    if (!A || !B) return;
    if (W.pass.has(key(A.id, B.id))) { c.setEnabled(false); return; }
    const S = W.S, scr = A.k === 's' || B.k === 's';
    if (scr) { if (S.collide === false) { c.setEnabled(false); return; } c.setFriction(S.collFric ?? 0.3); c.setRestitution(S.collRest ?? 0.2); }
    else { if (S.plateCollide === false) { c.setEnabled(false); return; } c.setFriction(S.ppFric ?? 0.4); c.setRestitution(S.ppRest ?? 0.1); }
  });
  pw.on('post-solve', (c) => {
    const A = c.getFixtureA().getBody().getUserData(), B = c.getFixtureB().getBody().getUserData();
    const scr = A.k === 's' || B.k === 's';
    for (const U of [A, B]) if (U.k === 'p') { const b = bodies[U.pi]; if (scr) b.hits++; else b.pHits++; }
  });
  return W;
}
// 板 pi（刚变为动态）与谁重叠 → 穿过对。v1.7.1 规则：
//  板-板：只有不同层、且两板可见轮廓真的重叠（面积 > ppPassArea px²）才穿过；同层板永不穿过（紧贴的邻板会挡住摆动/下落）。
//  板-螺丝：只有该板自己孔里的螺丝（含摆动的支点钉、穿过它对齐孔的螺丝）穿过；其它插在底板里的螺丝都会挡住板材料。
function worldPoly(W, pi) { const b = W.bodies[pi]; return W.L.plates[pi].poly.map(([x, y]) => toWorld(b, x, y)); }
function bbox(P) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of P) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; }
export function overlapArea(A, B, step = 2) {
  const a = bbox(A), b = bbox(B), x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
  if (x0 >= x1 || y0 >= y1) return 0;
  let n = 0; for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) if (inPoly(x, y, A) && inPoly(x, y, B)) n++;
  return n * step * step;
}
function ownHole(W, pi, x, y) { const b = W.bodies[pi]; return (b.holes || []).some(([hx, hy]) => { const w = toWorld(b, hx, hy); return Math.hypot(w[0] - x, w[1] - y) < (W.S.ownHoleTol ?? 9); }); }
function markOverlaps(W, pi) {
  const me = W.plates[pi].body, lay = W.L.plates[pi].layer || 0, P = worldPoly(W, pi), thr = W.S.ppPassArea ?? 40;
  W.plates.forEach((q, pj) => {
    if (pj === pi || !q.body || W.bodies[pj].s === 'gone') return;
    if ((W.L.plates[pj].layer || 0) === lay) return;
    if (overlapArea(P, worldPoly(W, pj)) > thr) W.pass.set(key('p' + pi, 'p' + pj), W.steps);
  });
  void me;
  W.screws.forEach((sb, id) => { const p = sb.getPosition(); if (ownHole(W, pi, p.x * PX, p.y * PX)) W.pass.set(key('p' + pi, 's' + id), W.steps); });
}
// 新出现的螺丝（落座）与正在动的板深重叠 → 穿过对（例如螺丝拧进摆动板错位的孔下方：随后它会把板固定）
function screwOverlaps(W, id, sb) {
  const p = sb.getPosition();
  W.plates.forEach((q, pi) => { const b = W.bodies[pi]; if (!q.body || (b.s !== 'swing' && b.s !== 'fall')) return; const [lx, ly] = toLocal(b, p.x * PX, p.y * PX); if (ownHole(W, pi, p.x * PX, p.y * PX) || inPoly(lx, ly, W.L.plates[pi].poly)) W.pass.set(key('p' + pi, 's' + id), W.steps); });
}
function syncScrews(W, obst, S, restoring) {
  const sk = obst.map(o => o.id + ':' + o.x + ',' + o.y).join(';') + '|' + (S.collShaftR ?? 6); if (W._sk === sk) return; W._sk = sk;
  const seen = new Set(), r = (S.collShaftR ?? 6) / PX;
  for (const o of obst) {
    seen.add(o.id); let sb = W.screws.get(o.id);
    if (sb) { const p = sb.getPosition(); if (Math.hypot(p.x * PX - o.x, p.y * PX - o.y) > 0.5) { W.pw.destroyBody(sb); W.screws.delete(o.id); for (const k of [...W.pass.keys()]) if (k.split('|').includes('s' + o.id)) W.pass.delete(k); sb = null; } }
    if (!sb) {
      sb = W.pw.createBody({ type: 'static', position: Vec2(o.x / PX, o.y / PX) });
      sb.createFixture(new Circle(r), { friction: S.collFric ?? 0.3, restitution: S.collRest ?? 0.2, filterCategoryBits: 4 }); sb.setUserData({ k: 's', id: 's' + o.id, sid: o.id }); sb._r = r;
      W.screws.set(o.id, sb); if (!restoring) screwOverlaps(W, o.id, sb);
    } else if (Math.abs(sb._r - r) > 1e-6) { sb.destroyFixture(sb.getFixtureList()); sb.createFixture(new Circle(r), { friction: S.collFric ?? 0.3, filterCategoryBits: 4 }); sb._r = r; }
  }
  for (const [id, sb] of [...W.screws]) if (!seen.has(id)) { W.pw.destroyBody(sb); W.screws.delete(id); for (const k of [...W.pass.keys()]) if (k.split('|').includes('s' + id)) W.pass.delete(k); }
}
function makeJoint(W, pi, pinW, S) {
  const q = W.plates[pi], b = W.bodies[pi];
  if (q.joint) { W.pw.destroyJoint(q.joint); q.joint = null; }
  const lim = (S.swingMax ?? 17) * D2R;
  q.joint = W.pw.createJoint(new RevoluteJoint({ enableLimit: lim < Math.PI, lowerAngle: -lim, upperAngle: lim }, W.ground, q.body, Vec2(pinW[0] / PX, pinW[1] / PX)));
  b.piv = toLocal(b, pinW[0], pinW[1]); b.ang0 = b.ang; b.pivW = pinW.slice();
}
// v1.7.2：固定步长（DT）确定性模拟。applyPins（钉数变化 → 状态转换）与 stepFixed（一步积分 + 读回 + 静止/托住检测）分开，
// 实时游戏（累加器）与求解器预测（sim.js 无界面模拟）走完全相同的代码与步数 → 预测 == 实际。
export const DT = 1 / 120;
// 钉数变化会不会引起状态转换（求解器/实时都用它判定“这一步物理上什么都不会发生”）
export function pinsChange(bodies, pins, pinW) {
  return bodies.some((b, pi) => {
    const n = pins[pi]; if (b.s !== 'on' && b.s !== 'swing') return false;
    if (n === 0) return true;
    if (b.s === 'on') return n === 1 && b.n >= 2;
    if (n >= 2) return true;
    return !b.pivW || Math.hypot(b.pivW[0] - pinW[pi][0], b.pivW[1] - pinW[pi][1]) > 3;
  });
}
export function applyPins(W, pins, pinW, S, obst) {
  W.S = S; W.pw.setGravity(Vec2(0, S.gravity / PX));
  syncScrews(W, obst, S);
  const ev = W.bodies.map(() => null);
  W.bodies.forEach((b, pi) => {
    const q = W.plates[pi], body = q.body, n = pins[pi];
    if (b.s === 'gone' || !body) return;
    if (b.s === 'on' || b.s === 'swing') {
      if (n >= 2) { if (b.s === 'swing') { b.s = 'on'; if (q.joint) { W.pw.destroyJoint(q.joint); q.joint = null; } body.setType('static'); b.om = 0; } }
      else if (n === 1) {
        if (b.s === 'on' && b.n >= 2) {
          b.s = 'swing'; ev[pi] = 'swing'; b.posed = true; body.setType('dynamic'); body.setLinearVelocity(Vec2(0, 0));
          body.setAngularDamping(S.swingDamp || 0); makeJoint(W, pi, pinW[pi], S);
          const cm = toWorld(b, b.m.cx, b.m.cy); body.setAngularVelocity(Math.sign(cm[0] - pinW[pi][0]) * (S.swingKick || 0) * D2R);
          b.settleT = 0; b.settled = false; markOverlaps(W, pi);
        } else if (b.s === 'swing' && (!b.pivW || Math.hypot(b.pivW[0] - pinW[pi][0], b.pivW[1] - pinW[pi][1]) > 3)) { makeJoint(W, pi, pinW[pi], S); b.settleT = 0; b.settled = false; }
        b.lastPiv = pinW[pi].slice();
      } else {
        const cm = toWorld(b, b.m.cx, b.m.cy), rx = b.lastPiv ? cm[0] - b.lastPiv[0] : 0, wasStatic = b.s === 'on';
        b.s = 'fall'; b.posed = true; ev[pi] = 'fall'; b.tf = 0; b.prog = { cy: cm[1], t: 0 }; b.ghost = false; b.restT = 0; b.rest = false; b.sup = null; b.ppT = 0;
        if (q.joint) { W.pw.destroyJoint(q.joint); q.joint = null; }
        if (wasStatic) { body.setType('dynamic'); body.setLinearVelocity(Vec2(0, 0)); body.setAngularVelocity(0); }
        body.setAngularDamping(S.angDamp ?? 1.5); body.setAwake(true);
        body.setAngularVelocity(body.getAngularVelocity() + Math.max(-360, Math.min(360, (S.releaseSpinK || 0) * rx)) * D2R + (S.fallSpin || 0) * D2R);
        markOverlaps(W, pi);
      }
      b.n = n;
    }
  });
  return ev;
}
// 一个固定步：返回事件数组（'gone'|null）
export function stepFixed(W, S) {
  const h = DT, g = S.gravity / PX, ev = W.bodies.map(() => null);
  W.bodies.forEach((b, pi) => {
    if (b.s !== 'swing') return; const body = W.plates[pi].body, c = body.getWorldCenter(), rx = c.x - b.pivW[0] / PX;
    // 参考里的摆比真实物理摆更快：额外力矩 (boost−1)·m·g·rx（绕铰点等效角加速度 = boost · g · rx / (k2 + r²)）
    body.applyTorque(((S.swingBoost || 1) - 1) * body.getMass() * g * rx, true);
  });
  W.pw.step(h, 6, 2); W.steps++;
  W.bodies.forEach((b, pi) => {
    const q = W.plates[pi], body = q.body; if (!body || b.s === 'gone' || b.s === 'on') return;
    const p = body.getPosition(); b.cx = p.x * PX; b.cy = p.y * PX; b.ang = body.getAngle(); b.om = body.getAngularVelocity(); syncPose(b);
    if (b.s === 'swing') {
      // Box2D 关节限位允许 ~0.5° 的角度松弛：硬性夹到 ±swingMax（绕铰点旋转修正），与逻辑假设一致
      const lim = (S.swingMax ?? 17) * D2R, ra = b.ang - b.ang0;
      if (Math.abs(ra) > lim) {
        const a = b.ang0 + Math.sign(ra) * lim, c = Math.cos(a), s2 = Math.sin(a), ux = b.piv[0] - b.C[0], uy = b.piv[1] - b.C[1];
        b.ang = a; b.dx = b.pivW[0] - b.C[0] - (c * ux - s2 * uy); b.dy = b.pivW[1] - b.C[1] - (s2 * ux + c * uy);
        const cm = toWorld(b, b.m.cx, b.m.cy); b.cx = cm[0]; b.cy = cm[1]; body.setTransform(Vec2(b.cx / PX, b.cy / PX), a);
        if (b.om * ra > 0) { b.om = -b.om * (S.swingBounce || 0); body.setAngularVelocity(b.om); body.setLinearVelocity(Vec2(-b.om * (b.cy - b.pivW[1]) / PX, b.om * (b.cx - b.pivW[0]) / PX)); }
      }
      b.relAng = b.ang - b.ang0;
      if (Math.abs(b.om) < 0.15) { b.settleT = (b.settleT || 0) + h; if (b.settleT > 0.08) b.settled = true; } else { b.settleT = 0; b.settled = false; }
    } else if (b.s === 'fall') {
      b.tf += h;
      if (b.cy > b.prog.cy + 20) b.prog = { cy: b.cy, t: b.tf };
      // 被托住（几乎不动 0.15s）→ rest；支撑者 = 正在接触的螺丝/板（planck 接触）
      const v = body.getLinearVelocity(), still = Math.hypot(v.x, v.y) * PX < 25 && Math.abs(b.om) < 0.3 && !b.ghost;
      b.restT = still ? (b.restT || 0) + h : 0;
      if (b.restT > 0.15) {
        const sup = { s: [], p: [] };
        for (let e = body.getContactList(); e; e = e.next) { if (!e.contact.isTouching() || !e.contact.isEnabled()) continue; const u = e.other.getUserData(); if (!u) continue; if (u.k === 's') sup.s.push(u.sid); else if (u.k === 'p') sup.p.push(u.pi); }
        sup.s = [...new Set(sup.s)].sort((x, y) => x - y); sup.p = [...new Set(sup.p)].sort((x, y) => x - y);
        b.rest = true; b.sup = sup; if (sup.s.length) b.everRest = true;
      } else if (!still) { b.rest = false; b.sup = null; }
      // 托住规则（实时与预测同一套）：接触到插着的螺丝 → 永久托住（直到支撑移走）；只被板托住（或悬空静止）超过 ppStuckMs（模拟时间）
      //   → 只关闭它与板的碰撞（螺丝 category 4，仍被螺丝杆挡住）
      const plateOnly = b.rest && b.sup && !b.sup.s.length;
      if (plateOnly && !b.ppGhost) { b.ppT = (b.ppT || 0) + h; if (b.ppT * 1000 > (S.ppStuckMs ?? 1200)) { b.ppGhost = true; b.rest = false; b.sup = null; b.restT = 0; W.ppGhosts = (W.ppGhosts || 0) + 1; ppGhostFilter(body); body.setAwake(true); } }
      else if (!plateOnly) b.ppT = 0;
      if (b.nudge && !b.ghost) b.ghostNow = true;
      if (!b.ghost && (b.ghostNow || ((S.collStuckMs ?? 0) > 0 && (b.tf - b.prog.t) * 1000 > S.collStuckMs))) {
        b.ghostNow = false; b.rest = false; b.sup = null; W.ghosts = (W.ghosts || 0) + 1;
        b.ghost = true; ghostFilter(body); body.setAwake(true);
      }
      // 已经在所有螺丝和其它板下方、还在往下掉 → 物理上再也碰不到任何东西：提前判定离开（画面上由 main.js 按抛体继续画完 b.out）
      const out = v.y > 0 && b.cy - radOf(W, pi) > lowestOther(W, pi) + 4;
      if (out) b.out = { vx: v.x * PX, vy: v.y * PX, om: b.om };
      if (out || b.cy > 1750 || b.dy > 1600) { b.s = 'gone'; ev[pi] = 'gone'; W.pw.destroyBody(body); q.body = null; b.rest = false; b.sup = null; for (const k of [...W.pass.keys()]) if (k.split('|').includes('p' + pi)) W.pass.delete(k); }
    }
  });
  // 穿过对：两者分开（没有任何接触在重叠）后恢复碰撞
  for (const [k, t0] of [...W.pass]) {
    if (W.steps - t0 < 3) continue;
    const [a, c] = k.split('|'), ba = bodyOf(W, a), bc = bodyOf(W, c);
    if (!ba || !bc) { W.pass.delete(k); continue; }
    let touching = false;
    for (let e = ba.getContactList(); e; e = e.next) if (e.other === bc && e.contact.isTouching()) { touching = true; break; }
    if (!touching) W.pass.delete(k);
  }
  return ev;
}
function radOf(W, pi) { const b = W.bodies[pi]; if (b._rad == null) { let r = 0; for (const [x, y] of W.L.plates[pi].poly) r = Math.max(r, Math.hypot(x - b.m.cx, y - b.m.cy)); b._rad = r; } return b._rad; }
function lowestOther(W, pi) {
  let m = -1e9; const R = (W.S.collShaftR ?? 6);
  W.screws.forEach(sb => { const y = sb.getPosition().y * PX + R; if (y > m) m = y; });
  W.bodies.forEach((b, pj) => { if (pj === pi || b.s === 'gone') return; const c = toWorld(b, b.m.cx, b.m.cy); m = Math.max(m, c[1] + radOf(W, pj)); });
  return m;
}
function ppGhostFilter(body) { for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: 0, categoryBits: 2, maskBits: 4 }); }
function ghostFilter(body) { for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: 0, categoryBits: 1, maskBits: 0 }); }
// 单个板是否已有结论：固定 / 消失 / 摆动静止 / 被螺丝托住静止
export function bodySettled(b) { return b.s === 'on' || b.s === 'gone' || (b.s === 'swing' && b.settled) || (b.s === 'fall' && b.rest && b.sup && b.sup.s.length > 0); }
export function worldSettled(W) { return W.bodies.every(bodySettled); }
// 兼容旧接口（collision-test 等）：每帧 applyPins + 按固定步长累加积分
export function stepWorld(W, pins, pinW, dt, S, obst) {
  const ev = applyPins(W, pins, pinW, S, obst);
  W.acc = (W.acc || 0) + Math.min(dt, 0.05);
  while (W.acc >= DT - 1e-9) { W.acc -= DT; stepFixed(W, S).forEach((e, i) => { if (e) ev[i] = e; }); }
  return ev;
}
// ---------- 快照 / 恢复（实时与预测都从同一快照重建世界 → 同样的起点） ----------
export function snapWorld(W) {
  return {
    bodies: W.bodies.map((b, pi) => {
      // 已离开的板只记状态（画面上 b.out 抛体动画会继续改 dx/dy，不能进快照）
      if (b.s === 'gone') return { s: 'gone', ang: 0, dx: 0, dy: 0, cx: 0, cy: 0, n: 0, lastPiv: null, pivW: null, piv: null, ang0: 0, posed: true, ppGhost: false, ghost: !!b.ghost, rest: false, sup: null, relAng: 0, tf: 0 };
      const body = W.plates[pi].body, r = { s: b.s, ang: b.ang, dx: b.dx, dy: b.dy, cx: b.cx, cy: b.cy, n: b.n, lastPiv: b.lastPiv, pivW: b.pivW, piv: b.piv, ang0: b.ang0, posed: b.posed, ppGhost: !!b.ppGhost, ghost: !!b.ghost, rest: !!b.rest, sup: b.sup ? { s: b.sup.s.slice(), p: b.sup.p.slice() } : null, relAng: b.relAng, tf: b.tf || 0 };
      if (body && b.s !== 'on') { const p = body.getPosition(), v = body.getLinearVelocity(); r.px = p.x; r.py = p.y; r.a = body.getAngle(); r.vx = v.x; r.vy = v.y; r.w = body.getAngularVelocity(); }
      return r;
    }),
    pass: [...W.pass.keys()].sort(),
  };
}
export function restoreWorld(L, bodies, S, snap, obst) {
  snap.bodies.forEach((r, pi) => { const b = bodies[pi]; if (r.s === 'gone' && b.s === 'gone') return; Object.assign(b, { s: r.s, ang: r.ang, dx: r.dx, dy: r.dy, cx: r.cx, cy: r.cy, n: r.n, lastPiv: r.lastPiv && r.lastPiv.slice(), pivW: r.pivW && r.pivW.slice(), piv: r.piv && r.piv.slice(), ang0: r.ang0, posed: r.posed, ppGhost: r.ppGhost, ghost: r.ghost, rest: r.rest, sup: r.sup ? { s: r.sup.s.slice(), p: r.sup.p.slice() } : null, relAng: r.relAng, tf: r.tf, restT: 0, settleT: 0, settled: false, ppT: 0, prog: { cy: r.cy, t: r.tf }, om: r.w || 0, nudge: false, ghostNow: false }); });
  const W = createWorld(L, bodies, S);
  W.bodies.forEach((b, pi) => {
    const q = W.plates[pi], body = q.body;
    if (b.s === 'gone') return;
    if (b.s === 'on') return;
    const r = snap.bodies[pi];
    body.setType('dynamic'); body.setTransform(Vec2(r.px, r.py), r.a); body.setLinearVelocity(Vec2(r.vx, r.vy)); body.setAngularVelocity(r.w);
    if (b.s === 'swing') {
      body.setAngularDamping(S.swingDamp || 0);
      const lim = (S.swingMax ?? 17) * D2R;
      q.joint = W.pw.createJoint(new RevoluteJoint({ enableLimit: lim < Math.PI, lowerAngle: -lim, upperAngle: lim, referenceAngle: b.ang0 }, W.ground, body, Vec2(b.pivW[0] / PX, b.pivW[1] / PX)));
    } else {
      body.setAngularDamping(S.angDamp ?? 1.5);
      if (b.ghost) ghostFilter(body); else if (b.ppGhost) ppGhostFilter(body);
    }
    body.setAwake(true);
  });
  syncScrews(W, obst, S, true);
  for (const k of snap.pass) W.pass.set(k, 0);
  return W;
}
// 底板孔 (x,y) 附近（r px 内或轮廓内）有没有动态板（只用板位姿，不用 planck 接触 → 实时与预测判定一致）
export function pointNearDynamic(L, bodies, x, y, r) {
  return bodies.some((b, pi) => {
    if (b.s === 'on' || b.s === 'gone') return false;
    const [lx, ly] = toLocal(b, x, y), P = L.plates[pi].poly;
    if (inPoly(lx, ly, P)) return true;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((lx - ax) * dx + (ly - ay) * dy) / (dx * dx + dy * dy || 1))); if (Math.hypot(ax + t * dx - lx, ay + t * dy - ly) < r) return true; }
    return false;
  });
}
function bodyOf(W, id) { return id[0] === 'p' ? W.plates[+id.slice(1)].body : W.screws.get(+id.slice(1)); }
// 当前是否有动态板在运动（自动通关在摆动板静止后再走下一步，以便逻辑同步实际停下的角度）
// v1.7.2：刚开始下落、还不知道会掉出还是被托住的板（自动通关等它有结论再走下一步）
export function fallUnsettled(W) { return W.bodies.some(b => b.s === 'fall' && !bodySettled(b)); }
export function swingMoving(W) { return W.bodies.some(b => b.s === 'swing' && !b.settled); }
