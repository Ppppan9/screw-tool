// v1.4 板块 2D 刚体物理（解析积分，无外部库）。参考实测见 ref/ANALYSIS.md「物理反馈」。
// 位姿：板上局部点 p → 世界 C + R(ang)(p − C) + (dx, dy)，C = 板贴图中心（AE 锚点/3D 节点原点）。
export function massProps(poly) {
  // 多边形面积、质心、绕质心的转动惯量/质量 (k2 = I/m)
  let A = 0, cx = 0, cy = 0, ixx = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n], c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    ixx += (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1) * c;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A; ixx /= 12;
  return { area: Math.abs(A), cx, cy, k2: Math.abs(ixx / A - (cx * cx + cy * cy)) };
}
export function newBody(poly, C, holes = []) { const m = massProps(poly); return { s: 'on', ang: 0, dx: 0, dy: 0, om: 0, vx: 0, vy: 0, C, m, poly, holes, n: -1, piv: null, ang0: 0, lastPiv: null, posed: false, tf: 0, hits: 0, ign: null }; }
export function toWorld(b, x, y) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = x - b.C[0], uy = y - b.C[1];
  return [b.C[0] + c * ux - s * uy + b.dx, b.C[1] + s * ux + c * uy + b.dy];
}
export function toLocal(b, x, y) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = x - b.dx - b.C[0], uy = y - b.dy - b.C[1];
  return [b.C[0] + c * ux + s * uy, b.C[1] - s * ux + c * uy];
}
const D2R = Math.PI / 180;
// 每帧：nPins = 当前“坐在孔里”的固定螺丝数，pinW = 唯一那颗的世界坐标；返回事件 'swing'|'fall'|null
export function stepBody(b, nPins, pinW, dt, S, obst = []) {
  let ev = null;
  if (b.s === 'gone') return null;
  if (b.s === 'on' || b.s === 'swing') {
    if (nPins >= 2) { if (b.s === 'swing') { b.s = 'on'; b.om = 0; } }
    else if (nPins === 1) {
      // 只有“由多钉减到单钉”才摆动（参考：开局单钉板不摆，直到最后一颗离开才掉）
      if (b.s === 'on' && b.n >= 2) { b.s = 'swing'; b.piv = toLocal(b, pinW[0], pinW[1]); b.ang0 = b.ang; ev = 'swing'; const cm = toWorld(b, b.m.cx, b.m.cy); b.om += Math.sign(cm[0] - pinW[0]) * (S.swingKick || 0) * D2R; }
      else if (b.s === 'swing' && (!b.piv || Math.hypot(...(([x, y]) => [x - pinW[0], y - pinW[1]])(toWorld(b, b.piv[0], b.piv[1]))) > 3)) { b.piv = toLocal(b, pinW[0], pinW[1]); b.ang0 = b.ang; }
      b.lastPiv = pinW.slice();
    } else {
      // 释放：保持当前角速度 + 最后一颗钉相对质心的力矩带来的初始旋转（参考：偏 9px ≈ 75°/s）
      const cm = toWorld(b, b.m.cx, b.m.cy), rx = b.lastPiv ? cm[0] - b.lastPiv[0] : 0;
      b.s = 'fall'; b.posed = true; ev = 'fall';
      b.om += Math.max(-360, Math.min(360, (S.releaseSpinK || 0) * rx)) * D2R + (S.fallSpin || 0) * D2R;
      // 下落用质心速度/位置积分（碰撞冲量作用于质心 + 角速度）
      const c0 = toWorld(b, b.m.cx, b.m.cy); b.cx = c0[0]; b.cy = c0[1]; b.vx = 0; b.vy = 0; b.tf = 0;
      // 释放瞬间已经和材料重叠的螺丝（只在关闭阻挡判定等情况下出现）不参与碰撞，避免弹飞
      b.ign = new Set(obst.filter(o => contact(b, o, S) && contact(b, o, S).pen > 0.5).map(o => o.id));
    }
    b.n = nPins;
  }
  if (b.s === 'swing') {
    b.posed = true;
    const P = toWorld(b, b.piv[0], b.piv[1]), cm = toWorld(b, b.m.cx, b.m.cy), rx = cm[0] - P[0], ry = cm[1] - P[1];
    // 物理摆：α = boost · g · rx / (k2 + r²)（y 向下，正角 = 顺时针）
    const al = (S.swingBoost || 1) * S.gravity * rx / (b.m.k2 + rx * rx + ry * ry);
    b.om += al * dt; b.om *= Math.exp(-(S.swingDamp || 0) * dt);
    b.ang += b.om * dt;
    const lim = (S.swingMax || 90) * D2R;
    if (b.ang - b.ang0 > lim) { b.ang = b.ang0 + lim; if (b.om > 0) b.om = -b.om * (S.swingBounce || 0); }
    if (b.ang - b.ang0 < -lim) { b.ang = b.ang0 - lim; if (b.om < 0) b.om = -b.om * (S.swingBounce || 0); }
    // 支点保持不动
    const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = b.piv[0] - b.C[0], uy = b.piv[1] - b.C[1];
    b.dx = P[0] - b.C[0] - (c * ux - s * uy); b.dy = P[1] - b.C[1] - (s * ux + c * uy);
  } else if (b.s === 'fall') {
    b.tf += dt;
    const coll = S.collide !== false && obst.length && b.tf * 1000 < (S.collMaxMs ?? 1500);
    const n = coll ? 6 : 1, h = dt / n;
    for (let k = 0; k < n; k++) {
      b.vy += S.gravity * h; b.cx += b.vx * h; b.cy += b.vy * h; b.ang += b.om * h; syncPose(b);
      if (coll) for (const o of obst) { if (b.ign && b.ign.has(o.id)) continue; const c = contact(b, o, S); if (c && c.pen > 0) { resolve(b, o, c, S); b.hits++; } }
    }
    if (b.cy > 1750 || b.dy > 1600) { b.s = 'gone'; ev = 'gone'; }
  }
  return ev;
}

// ---------- v1.6 下落板 vs 螺丝杆碰撞 ----------
// 位姿由质心 (cx, cy) + ang 反推 (dx, dy)
function syncPose(b) { const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = b.m.cx - b.C[0], uy = b.m.cy - b.C[1]; b.dx = b.cx - b.C[0] - (c * ux - s * uy); b.dy = b.cy - b.C[1] - (s * ux + c * uy); }
function inPoly(x, y, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
function closestOnPoly(x, y, poly) { let best = null; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px - x, py - y); if (!best || d < best[2]) best = [px, py, d]; } return best; }
// 螺丝杆圆 o={x,y} 与板材料（多边形 − 板孔圆）的接触：返回 { nx, ny (世界, 板应被推开的方向), pen }
export function contact(b, o, S) {
  const rs = S.collShaftR ?? 6, rh = (S.plateHoleSize || 33) / 2;
  const [qx, qy] = toLocal(b, o.x, o.y); let nl = null, pen = 0;
  const hk = b.holes.find(([hx, hy]) => Math.hypot(qx - hx, qy - hy) < rh);
  if (hk) {
    // 螺丝在板孔里：孔壁卡住螺丝杆
    const d = Math.hypot(qx - hk[0], qy - hk[1]); pen = d - (rh - rs); if (pen <= 0) return null;
    nl = [(qx - hk[0]) / (d || 1), (qy - hk[1]) / (d || 1)];
  } else {
    const cp = closestOnPoly(qx, qy, b.poly); if (!cp) return null;
    if (inPoly(qx, qy, b.poly)) { pen = cp[2] + rs; nl = [(qx - cp[0]) / (cp[2] || 1), (qy - cp[1]) / (cp[2] || 1)]; }
    else { if (cp[2] >= rs) return null; pen = rs - cp[2]; nl = [(cp[0] - qx) / (cp[2] || 1), (cp[1] - qy) / (cp[2] || 1)]; }
  }
  const c = Math.cos(b.ang), s = Math.sin(b.ang);
  return { nx: c * nl[0] - s * nl[1], ny: s * nl[0] + c * nl[1], pen };
}
// 冲量：恢复系数 + 库仑摩擦；质量归一 m=1，I = k2
function resolve(b, o, ct, S) {
  const e = S.collRest ?? 0.2, mu = S.collFric ?? 0.3, I = Math.max(1, b.m.k2), { nx, ny } = ct;
  b.cx += nx * ct.pen; b.cy += ny * ct.pen; syncPose(b); // 位置修正：推出螺丝杆
  if (Math.abs(b.cx - o.x) < 0.5 && ny < -0.9) b.cx += 0.5; // 正好压在螺丝正上方的不稳定平衡：轻微打破对称，让板自己翻下去
  const rx = o.x - b.cx, ry = o.y - b.cy;
  const vcx = b.vx - b.om * ry, vcy = b.vy + b.om * rx, vn = vcx * nx + vcy * ny;
  if (vn >= 0) return;
  const rn = rx * ny - ry * nx, j = -(1 + e) * vn / (1 + rn * rn / I);
  b.vx += j * nx; b.vy += j * ny; b.om += rn * j / I;
  const tx = -ny, ty = nx, vt = (b.vx - b.om * ry) * tx + (b.vy + b.om * rx) * ty, rt = rx * ty - ry * tx;
  let jt = -vt / (1 + rt * rt / I); jt = Math.max(-mu * j, Math.min(mu * j, jt));
  b.vx += jt * tx; b.vy += jt * ty; b.om += rt * jt / I;
}
