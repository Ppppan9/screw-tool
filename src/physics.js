// 板块位姿工具（v1.7 起实际刚体模拟在 world.js，用 planck.js / Box2D）。参考实测见 ref/ANALYSIS.md「物理反馈」。
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
export function newBody(poly, C, holes = []) { const m = massProps(poly); return { s: 'on', ang: 0, dx: 0, dy: 0, om: 0, vx: 0, vy: 0, C, m, poly, holes, n: -1, piv: null, ang0: 0, lastPiv: null, posed: false, tf: 0, hits: 0, pHits: 0, cx: 0, cy: 0 }; }
export function toWorld(b, x, y) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = x - b.C[0], uy = y - b.C[1];
  return [b.C[0] + c * ux - s * uy + b.dx, b.C[1] + s * ux + c * uy + b.dy];
}
export function toLocal(b, x, y) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = x - b.dx - b.C[0], uy = y - b.dy - b.C[1];
  return [b.C[0] + c * ux + s * uy, b.C[1] - s * ux + c * uy];
}
// 位姿由质心 (cx, cy) + ang 反推 (dx, dy)
export function syncPose(b) { const c = Math.cos(b.ang), s = Math.sin(b.ang), ux = b.m.cx - b.C[0], uy = b.m.cy - b.C[1]; b.dx = b.cx - b.C[0] - (c * ux - s * uy); b.dy = b.cy - b.C[1] - (s * ux + c * uy); }
export function inPoly(x, y, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
