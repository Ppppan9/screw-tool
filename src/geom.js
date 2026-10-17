// 几何工具：RDP 简化 + Chaikin 平滑（闭合多边形），用于把描绘/蒙版得到的阶梯轮廓变成平滑矢量路径
export function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const d = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9; return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L; };
  let mi = 0, md = 0; for (let i = 1; i < pts.length - 1; i++) { const v = d(pts[i], pts[0], pts[pts.length - 1]); if (v > md) { md = v; mi = i; } }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  const a = rdp(pts.slice(0, mi + 1), eps), b = rdp(pts.slice(mi), eps); return a.slice(0, -1).concat(b);
}
export function rdpClosed(poly, eps) {
  // 从最远两点切开，分别简化
  let fi = 0, fd = 0; for (let i = 1; i < poly.length; i++) { const v = Math.hypot(poly[i][0] - poly[0][0], poly[i][1] - poly[0][1]); if (v > fd) { fd = v; fi = i; } }
  const a = rdp(poly.slice(0, fi + 1), eps), b = rdp(poly.slice(fi).concat([poly[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
export function chaikin(poly, iters = 3) {
  let p = poly; for (let k = 0; k < iters; k++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } p = o; }
  return p.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
}
export const smoothPoly = (poly, eps = 1.6, iters = 3) => poly.length < 4 ? poly : chaikin(rdpClosed(poly, eps), iters);
export function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
export function smoothPathCtx(ctx, poly) { ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); }
