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
export function newBody(poly, C) { const m = massProps(poly); return { s: 'on', ang: 0, dx: 0, dy: 0, om: 0, vx: 0, vy: 0, C, m, n: -1, piv: null, ang0: 0, lastPiv: null, posed: false }; }
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
export function stepBody(b, nPins, pinW, dt, S) {
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
      b.vx = 0; b.vy = 0;
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
    b.vy += S.gravity * dt; b.dx += b.vx * dt; b.dy += b.vy * dt; b.ang += b.om * dt;
    if (b.dy > 1600) { b.s = 'gone'; ev = 'gone'; }
  }
  return ev;
}
