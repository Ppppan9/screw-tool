// v1.7 板块刚体世界：planck.js（Box2D 的 JS 移植，打包进单文件，无 CDN）。
// 每块板 = 一个刚体（凸分解后的多个多边形夹具；板孔不参与碰撞——见 ref/ANALYSIS.md v1.7）；每颗插在底板里的螺丝 = 静态圆（螺丝杆）。
// 状态：≥2 钉 → 静态；由多钉减到 1 钉 → 动态 + 绕钉铰接（±swingMax 限位）；0 钉 → 自由刚体下落。
// 碰撞规则：某块板变为动态（摆动/释放）的瞬间与之重叠的板/螺丝（叠放的板，或螺丝杆在板轮廓内）记为“穿过对”，
//   互不碰撞，直到两者分开后才恢复碰撞；其余所有对（下落-下落、下落-摆动、下落-固定、摆动-固定、板-螺丝）都碰撞。
import { World, Vec2, Polygon, Circle, RevoluteJoint, testOverlap } from 'planck';
import decomp from 'poly-decomp';
import { rdpClosed, polyArea, offsetPoly } from './geom.js';
import { syncPose, toWorld, toLocal, inPoly } from './physics.js';

export const PX = 50; // 1 m = 50 px（Box2D 适合 0.1–10 m 的物体）
const D2R = Math.PI / 180;

// ---------- 凸分解 ----------
function earClip(poly) {
  const P = poly.slice(); if (polyArea(P) < 0) P.reverse(); const out = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (P.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let i = 0; i < P.length; i++) {
      const a = P[(i - 1 + P.length) % P.length], b = P[i], c = P[(i + 1) % P.length];
      if (cross(a, b, c) <= 1e-9) continue;
      if (P.some(q => q !== a && q !== b && q !== c && cross(a, b, q) > 0 && cross(b, c, q) > 0 && cross(c, a, q) > 0)) continue;
      out.push([a, b, c]); P.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (P.length === 3) out.push(P);
  return out;
}
function splitFan(piece, maxV = 8) {
  if (piece.length <= maxV) return [piece];
  const out = []; for (let i = 1; i < piece.length - 1; i += maxV - 2) out.push([piece[0], ...piece.slice(i, Math.min(piece.length, i + maxV - 1))]);
  return out.filter(q => q.length >= 3);
}
export function convexParts(poly) {
  let p = rdpClosed(poly, 0.6).map(([x, y]) => [x, y]);
  if (p.length < 3) p = poly.map(([x, y]) => [x, y]);
  const A = Math.abs(polyArea(p));
  let parts = null;
  try {
    const q = p.map(v => v.slice()); decomp.makeCCW(q); decomp.removeCollinearPoints(q, 0.01); decomp.removeDuplicatePoints(q, 0.01);
    const d = decomp.quickDecomp(q);
    const sum = d.reduce((s, c) => s + Math.abs(polyArea(c)), 0);
    if (d.length && Math.abs(sum - A) / A < 0.03) parts = d;
  } catch (e) { parts = null; }
  if (!parts) parts = earClip(p);
  return parts.flatMap(c => splitFan(c)).filter(c => Math.abs(polyArea(c)) > 0.5);
}

// ---------- 世界 ----------
const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
export function createWorld(L, bodies, S) {
  const pw = new World({ gravity: Vec2(0, (S.gravity || 3600) / PX) });
  const W = { pw, L, S, bodies, ground: pw.createBody(), plates: [], screws: new Map(), pass: new Map(), steps: 0 };
  bodies.forEach((b, pi) => {
    const ins = S.ppInset ?? 1.5, parts = convexParts(ins > 0 ? offsetPoly(L.plates[pi].poly, ins) : L.plates[pi].poly), m = b.m, c0 = toWorld(b, m.cx, m.cy);
    const body = pw.createBody({ type: 'static', position: Vec2(c0[0] / PX, c0[1] / PX), angle: b.ang });
    for (const c of parts) { try { body.createFixture(new Polygon(c.map(([x, y]) => Vec2((x - m.cx) / PX, (y - m.cy) / PX))), { density: 1, friction: S.ppFric ?? 0.4, restitution: S.ppRest ?? 0.1 }); } catch (e) { } }
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
// 板 pi（刚变为动态）与谁重叠 → 记为穿过对（板-板：任何重叠；板-螺丝：螺丝中心在板轮廓内=深重叠。轻微擦边由求解器温和推开）
function markOverlaps(W, pi) {
  const me = W.plates[pi].body, b = W.bodies[pi], xf = me.getTransform();
  const ov = (o) => { for (let fa = me.getFixtureList(); fa; fa = fa.getNext()) for (let fb = o.getFixtureList(); fb; fb = fb.getNext()) if (testOverlap(fa.getShape(), 0, fb.getShape(), 0, xf, o.getTransform())) return true; return false; };
  W.plates.forEach((q, pj) => { if (pj === pi || !q.body || W.bodies[pj].s === 'gone') return; if (ov(q.body)) W.pass.set(key('p' + pi, 'p' + pj), W.steps); });
  W.screws.forEach((sb, id) => { const p = sb.getPosition(), [lx, ly] = toLocal(b, p.x * PX, p.y * PX); if (inPoly(lx, ly, W.L.plates[pi].poly) && ov(sb)) W.pass.set(key('p' + pi, 's' + id), W.steps); });
}
// 新出现的螺丝（落座）与正在动的板深重叠 → 穿过对（例如螺丝拧进摆动板错位的孔下方：随后它会把板固定）
function screwOverlaps(W, id, sb) {
  const p = sb.getPosition();
  W.plates.forEach((q, pi) => { const b = W.bodies[pi]; if (!q.body || (b.s !== 'swing' && b.s !== 'fall')) return; const [lx, ly] = toLocal(b, p.x * PX, p.y * PX); if (inPoly(lx, ly, W.L.plates[pi].poly)) W.pass.set(key('p' + pi, 's' + id), W.steps); });
}
function syncScrews(W, obst, S) {
  const seen = new Set(), r = (S.collShaftR ?? 6) / PX;
  for (const o of obst) {
    seen.add(o.id); let sb = W.screws.get(o.id);
    if (sb) { const p = sb.getPosition(); if (Math.hypot(p.x * PX - o.x, p.y * PX - o.y) > 0.5) { W.pw.destroyBody(sb); W.screws.delete(o.id); for (const k of [...W.pass.keys()]) if (k.split('|').includes('s' + o.id)) W.pass.delete(k); sb = null; } }
    if (!sb) {
      sb = W.pw.createBody({ type: 'static', position: Vec2(o.x / PX, o.y / PX) });
      sb.createFixture(new Circle(r), { friction: S.collFric ?? 0.3, restitution: S.collRest ?? 0.2 }); sb.setUserData({ k: 's', id: 's' + o.id, sid: o.id }); sb._r = r;
      W.screws.set(o.id, sb); screwOverlaps(W, o.id, sb);
    } else if (Math.abs(sb._r - r) > 1e-6) { sb.destroyFixture(sb.getFixtureList()); sb.createFixture(new Circle(r), { friction: S.collFric ?? 0.3 }); sb._r = r; }
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
// 每帧：pins[pi] = 视觉上固定该板的钉数，pinW[pi] = 唯一那颗的世界坐标；obst = 插在底板里的螺丝 {id,x,y}。返回事件数组（'swing'|'fall'|'gone'|null）
export function stepWorld(W, pins, pinW, dt, S, obst) {
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
        } else if (b.s === 'swing' && (!b.pivW || Math.hypot(b.pivW[0] - pinW[pi][0], b.pivW[1] - pinW[pi][1]) > 3)) makeJoint(W, pi, pinW[pi], S);
        b.lastPiv = pinW[pi].slice();
      } else {
        const cm = toWorld(b, b.m.cx, b.m.cy), rx = b.lastPiv ? cm[0] - b.lastPiv[0] : 0, wasStatic = b.s === 'on';
        b.s = 'fall'; b.posed = true; ev[pi] = 'fall'; b.tf = 0; b.prog = { cy: cm[1], t: 0 }; b.ghost = false;
        if (q.joint) { W.pw.destroyJoint(q.joint); q.joint = null; }
        if (wasStatic) { body.setType('dynamic'); body.setLinearVelocity(Vec2(0, 0)); body.setAngularVelocity(0); }
        body.setAngularDamping(S.angDamp ?? 1.5); body.setBullet(true); body.setAwake(true);
        body.setAngularVelocity(body.getAngularVelocity() + Math.max(-360, Math.min(360, (S.releaseSpinK || 0) * rx)) * D2R + (S.fallSpin || 0) * D2R);
        markOverlaps(W, pi);
      }
      b.n = n;
    }
  });
  // 固定子步（1/360 s）积分
  const h = Math.min(dt, 0.05), ns = Math.max(1, Math.ceil(h * 360)), hs = h / ns, g = S.gravity / PX;
  for (let k = 0; k < ns; k++) {
    W.bodies.forEach((b, pi) => {
      if (b.s !== 'swing') return; const body = W.plates[pi].body, c = body.getWorldCenter(), rx = c.x - b.pivW[0] / PX;
      // 参考里的摆比真实物理摆更快：额外力矩 (boost−1)·m·g·rx（绕铰点等效角加速度 = boost · g · rx / (k2 + r²)）
      body.applyTorque(((S.swingBoost || 1) - 1) * body.getMass() * g * rx, true);
    });
    W.pw.step(hs, 10, 4); W.steps++;
  }
  // 读回位姿；摆动静止检测；下落卡住检测；出屏
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
        if (b.om * ra > 0) { b.om = -b.om * (S.swingBounce || 0); body.setAngularVelocity(b.om); const v = body.getLinearVelocity(); body.setLinearVelocity(Vec2(-b.om * (b.cy - b.pivW[1]) / PX, b.om * (b.cx - b.pivW[0]) / PX)); void v; }
      }
      b.relAng = b.ang - b.ang0;
      if (Math.abs(b.om) < 0.15) { b.settleT += h; if (b.settleT > 0.08) b.settled = true; } else { b.settleT = 0; b.settled = false; }
    } else if (b.s === 'fall') {
      b.tf += h;
      if (b.cy > b.prog.cy + 20) b.prog = { cy: b.cy, t: b.tf };
      else if (!b.ghost && (b.tf - b.prog.t) * 1000 > (S.collStuckMs ?? 1200)) {
        // 卡住（被板/螺丝托住太久）：关闭它的碰撞，让它穿过障碍掉出画面——保证画面上不会永久留下逻辑上已掉落的板
        b.ghost = true; for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: 0, categoryBits: 1, maskBits: 0 });
        body.setAwake(true);
      }
      if (b.cy > 1750 || b.dy > 1600) { b.s = 'gone'; ev[pi] = 'gone'; W.pw.destroyBody(body); q.body = null; for (const k of [...W.pass.keys()]) if (k.split('|').includes('p' + pi)) W.pass.delete(k); }
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
function bodyOf(W, id) { return id[0] === 'p' ? W.plates[+id.slice(1)].body : W.screws.get(+id.slice(1)); }
// 当前是否有动态板在运动（自动通关在摆动板静止后再走下一步，以便逻辑同步实际停下的角度）
export function swingMoving(W) { return W.bodies.some(b => b.s === 'swing' && !b.settled); }
