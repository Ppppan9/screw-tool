// 绘制：背景（纸纹+薄荷叶线稿）、底板、板块、螺丝
import { mulberry } from './level.js';
import { smoothPathCtx } from './geom.js';
// 平滑轮廓(点密)直接 lineTo；粗多边形用圆角
export function shapePath(ctx, poly, r, smooth) { if (smooth) { ctx.beginPath(); smoothPathCtx(ctx, poly); } else rrPath(ctx, poly, r); }
export function rrPath(ctx, poly, r) {
  const n = poly.length; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n];
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) / l1 * rr, p1[1] + (p0[1] - p1[1]) / l1 * rr];
    if (i === 0) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
    ctx.arcTo(p1[0], p1[1], p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr, rr);
  }
  ctx.closePath();
}
export const mixHex = (a, b, t) => { const p = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }; const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
export const shade = (h, f) => { const n = parseInt(h.slice(1), 16); const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))); return `rgb(${c})`; };

function leaf(ctx, len, wid, rnd) {
  // 宽卵形薄荷叶，细锯齿；双线手绘感
  const N = 8, pts = [];
  const half = (sgn) => { const out = []; for (let i = 0; i <= N * 2; i++) { const t = i / (N * 2), w = Math.sin(Math.PI * Math.pow(t, 0.75)) * wid * (1 - 0.15 * t); const tooth = i % 2 ? 1.0 : 0.88; out.push([t * len, sgn * w * tooth]); } return out; };
  for (let pass = 0; pass < 2; pass++) {
    const j = pass ? 1.2 : 0; ctx.globalAlpha = pass ? 0.45 : 1;
    const up = half(-1), dn = half(1).reverse();
    ctx.beginPath(); ctx.moveTo(j, j); up.forEach(p => ctx.lineTo(p[0] + j, p[1] + j)); dn.forEach(p => ctx.lineTo(p[0] + j, p[1] + j)); ctx.closePath(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, wid * 0.06, len * 0.92, 0); ctx.stroke();
  for (let i = 1; i < 5; i++) { const x = len * i / 5.8, w = wid * 0.7 * Math.sin(Math.PI * (i + 0.5) / 6); ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + len * 0.08, -w * 0.5, x + len * 0.2, -w); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + len * 0.08, w * 0.5, x + len * 0.2, w); ctx.stroke(); }
}
function sprig(ctx, x, y, rot, sc, rnd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -80, 0, -170); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(11, -80, 3, -170); ctx.stroke();
  const nodes = [[-40, 95, 46], [-110, 80, 40], [-165, 48, 26]];
  nodes.forEach(([yy, L, W]) => {
    for (const side of [-1, 1]) { ctx.save(); ctx.translate(2, yy); ctx.rotate(side < 0 ? Math.PI + 0.45 + rnd() * 0.35 : -0.45 - rnd() * 0.35); leaf(ctx, L * (0.85 + rnd() * 0.3), W * (0.9 + rnd() * 0.2), rnd); ctx.restore(); }
  });
  ctx.save(); ctx.translate(1, -170); ctx.rotate(-Math.PI / 2); leaf(ctx, 40, 18, rnd); ctx.restore();
  ctx.restore();
}
export const LEAVES = [[300, 120, 0.2, 1.0], [640, 380, -0.6, 1.25], [10, 300, 1.1, 0.9], [130, 1180, 0.35, 1.3], [610, 1080, -0.3, 0.9], [740, 1250, -0.8, 1.0]];
// v1.8 经典款背景：米白亚麻布纹 + 成束流动的细丝线（参考：左上斜向一束、右侧竖向一束、左下大团），全部程序化、固定种子
export const SILK = [
  // [经过点（Catmull-Rom）, 束宽, 线数]，两端都在画面外（720x1280 设计坐标；参考：左上细束、右侧竖向大束、左下大团）
  [[[-60, 60], [150, 90], [330, 190], [470, 300], [560, 480]], 70, 120],
  [[[470, -80], [560, 120], [640, 330], [630, 560], [560, 780], [640, 960], [800, 1050]], 150, 320],
  [[[-90, 560], [110, 610], [270, 760], [380, 880], [520, 960], [650, 1060], [820, 1100]], 150, 300],
  [[[-90, 760], [100, 860], [200, 1010], [190, 1180], [140, 1370]], 170, 300],
  [[[-90, 1040], [70, 1100], [150, 1220], [110, 1370]], 100, 160],
];
function crPath(P, n) {
  const out = [], Q = [P[0], ...P, P[P.length - 1]];
  for (let i = 1; i < Q.length - 2; i++) for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, a = Q[i - 1], b = Q[i], c = Q[i + 1], d = Q[i + 2]; out.push([0, 1].map(e => 0.5 * (2 * b[e] + (-a[e] + c[e]) * t + (2 * a[e] - 5 * b[e] + 4 * c[e] - d[e]) * t2 + (-a[e] + 3 * b[e] - 3 * c[e] + d[e]) * t3))); }
  out.push(P[P.length - 1]); return out;
}
function drawSilk(ctx, S, W, H, k) {
  const rnd = mulberry(23);
  // 亚麻布纹：细横竖线 + 噪点
  if (S.linen > 0) {
    ctx.save(); ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 2 + rnd() * 2) { ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,250' : '120,112,90'},${(0.05 + rnd() * 0.09) * S.linen})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + (rnd() - 0.5) * 2); ctx.stroke(); }
    for (let x = 0; x < W; x += 2 + rnd() * 2.5) { ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,250' : '120,112,90'},${(0.03 + rnd() * 0.06) * S.linen})`; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (rnd() - 0.5) * 2, H); ctx.stroke(); }
    ctx.restore();
  }
  if (S.bgNoise > 0) { const img = ctx.getImageData(0, 0, W, H), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 255 * S.bgNoise; d[i] += n; d[i + 1] += n; d[i + 2] += n; } ctx.putImageData(img, 0, 0); }
  // 丝线束：每束 N 条沿中心线、法向错开的细线（偏移随弧长缓慢变化 → 线与线交叉、像丝绸褶皱），颜色在丝线色上下浮动
  ctx.save(); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = parseInt(S.silkColor.slice(1), 16), base = [n >> 16, n >> 8 & 255, n & 255];
  for (const [pts, wid, N] of SILK) {
    const C = crPath(pts, 24), M = C.length;
    const nr = C.map((p, i) => { const a = C[Math.max(0, i - 1)], b = C[Math.min(M - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
    for (let i = 0; i < N; i++) {
      const u = (rnd() - 0.5) * 2, o0 = Math.sign(u) * Math.pow(Math.abs(u), 1.2) * wid / 2, a1 = (rnd() - 0.5) * wid * 0.12, f1 = 1 + rnd() * 2, p1 = rnd() * 6.28, a2 = (rnd() - 0.5) * 5, f2 = 3 + rnd() * 4;
      const f = 0.5 + rnd() * 0.7, col = base.map(v => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1) * 1.5))));
      ctx.strokeStyle = `rgba(${col},${S.silkOpacity * (0.3 + rnd() * 0.7) * (1 - Math.abs(u) * 0.5)})`; ctx.lineWidth = 0.35 + rnd() * 0.5;
      ctx.beginPath();
      for (let j = 0; j < M; j++) { const t = j / (M - 1), off = o0 + a1 * Math.sin(t * f1 * Math.PI + p1) + a2 * Math.sin(t * f2 * Math.PI + p1 * 2); const x = C[j][0] + nr[j][0] * off, y = C[j][1] + nr[j][1] * off; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
export function drawBackground(c, S, W, H, k, bgImg) {
  const ctx = c.getContext('2d'); ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H);
  if (S.bgMode === 'silk') return drawSilk(ctx, S, W, H, k);
  if (S.bgMode === 'image' && bgImg && bgImg.complete && bgImg.naturalWidth) { const sc = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight); ctx.drawImage(bgImg, (W - bgImg.naturalWidth * sc) / 2, (H - bgImg.naturalHeight * sc) / 2, bgImg.naturalWidth * sc, bgImg.naturalHeight * sc); return; }
  const rnd = mulberry(7);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 255 * S.bgNoise; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  // 大尺度斑驳
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${0.025 * S.bgNoise * 10})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 40 + rnd() * 120, 0, 7); ctx.fill(); }
  ctx.save(); ctx.scale(k, k); ctx.strokeStyle = hexA(S.leafColor, S.leafOpacity); ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  LEAVES.forEach(([x, y, r, s]) => sprig(ctx, x, y, r, s * S.leafScale, rnd));
  ctx.restore();
}
function grain(ctx, bb, color, alpha, rnd, angle, density, wMin = 0.6, wRange = 1.4, lMin = 8, lRange = 30, blur = 0) {
  if (blur > 0) {
    // 先画到临时层，再整体模糊合成一次（逐笔 filter 很慢）
    const t = document.createElement('canvas'); t.width = ctx.canvas.width; t.height = ctx.canvas.height; const tg = t.getContext('2d'); const m = ctx.getTransform(); tg.setTransform(m);
    grain(tg, bb, color, 1, rnd, angle, density, wMin, wRange, lMin, lRange, 0);
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${(blur * Math.hypot(m.a, m.b)).toFixed(2)}px)`; ctx.drawImage(t, 0, 0); ctx.restore(); return;
  }
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineCap = 'round';
  const n = Math.floor((bb.w * bb.h) / 900 * density);
  for (let i = 0; i < n; i++) {
    const x = bb.x + rnd() * bb.w, y = bb.y + rnd() * bb.h, L = lMin + rnd() * lRange;
    ctx.lineWidth = wMin + rnd() * wRange; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * L, y + Math.sin(angle) * L); ctx.stroke();
  }
  ctx.restore();
}
const bbox = (poly) => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
function capsulePath(ctx, pts, w) {
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
}
export function basePath(ctx, L) {
  ctx.beginPath();
  L.base.polys.forEach(p => { if (L.base.smooth) smoothPathCtx(ctx, p); else rrPath(ctx, p, 18); });
  (L.base.inner || []).forEach(p => smoothPathCtx(ctx, p));
}
export function drawBase(ctx, L, S) {
  const rnd = mulberry(11), eo = 'evenodd';
  const shapes = (fill) => { ctx.fillStyle = fill; ctx.strokeStyle = fill; basePath(ctx, L); ctx.fill(eo); L.base.capsules.forEach(c => { capsulePath(ctx, c.pts, c.w); ctx.stroke(); }); };
  // 绘制到独立图层，保证 source-atop 只作用在底板上
  const c2 = document.createElement('canvas'); c2.width = ctx.canvas.width; c2.height = ctx.canvas.height; const g = c2.getContext('2d'); g.setTransform(ctx.getTransform());
  const o = ctx; ctx = g;
  ctx.save(); ctx.translate(0, 5); shapes('rgba(30,20,20,0.30)'); ctx.restore();
  o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(c2, 0, 0); o.restore(); ctx.clearRect(-1e4, -1e4, 2e4, 2e4);
  shapes(S.baseColor);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const T = L.base.tex; if (T) ctx.drawImage(T.img, T.sx, T.sy, T.sw, T.sh, T.dx, T.dy, T.dw, T.dh);
  const all = L.base.polys.flat().concat(L.base.capsules.flatMap(c => c.pts)); const bb = bbox(all); bb.x -= 50; bb.y -= 50; bb.w += 100; bb.h += 100;
  // M-C 实测：参考底板亮笔触 #ebc4c6、暗笔触仅 #b07b71（亮度 sd 17）→ 暗纹弱、亮纹强且细密
  if (S.baseStyle === 'wood') {
    // 经典款：缝里露出的棕色木底（参考缝内 #847466，竖向木纹，亮暗条交替）
    grain(ctx, bb, shade(S.baseColor, -0.45), S.baseGrain * 0.9, rnd, 1.45, 3, 0.8, 1.8, 20, 60, 0.6);
    grain(ctx, bb, shade(S.baseColor, 0.45), S.baseGrain * 0.9, rnd, 1.45, 2.5, 0.8, 1.6, 20, 60, 0.6);
  } else {
  grain(ctx, bb, '#7a3f33', S.baseGrain * 0.45, rnd, -0.62, 3, 0.8, 1.6, 10, 26);
  grain(ctx, bb, '#fff1ee', S.baseGrain * 2.6, rnd, -0.62, 5, 0.8, 2.2, 8, 26, 1.0);
  }
  // 玻璃感内高光边（参考右缘/下缘可见白色亮边）
  ctx.save(); ctx.translate(-1.2, -1.6); ctx.lineJoin = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = `rgba(255,248,246,${S.baseGloss})`; basePath(ctx, L); ctx.stroke(); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW + 3.5; ctx.strokeStyle = `rgba(235,245,235,${S.edgeHalo})`; basePath(ctx, L); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = S.baseOutline; ctx.lineWidth = S.outlineW; ctx.lineJoin = 'round'; basePath(ctx, L); ctx.stroke();
  o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(c2, 0, 0); o.restore();
}
export function plateSprite(pl, S0, idx, dpr, holePts = []) {
  let S = pl.tint ? { ...S0, plateColor: mixHex(S0.plateColor, pl.tint, S0.plateTintAmt ?? 0.35) } : S0;
  if (pl.mat === 'alt') S = { ...S, plateColor: S0.plateAltColor || '#c8b896', _alt: true };
  if (S.plateStyle === 'metal') return metalSprite(pl, S, idx, dpr, holePts);
  const bb = bbox(pl.poly), pad = 14 + S.plateThick;
  const c = document.createElement('canvas'); c.width = Math.ceil((bb.w + pad * 2) * dpr); c.height = Math.ceil((bb.h + pad * 2) * dpr);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.translate(pad - bb.x, pad - bb.y);
  const r = pl.radius * S.plateRadius, rnd = mulberry(100 + idx);
  // 外侧浅色光晕（参考描边外有一圈浅色，bg halo p95 #90a595 vs 远处 #668572）
  if (S.edgeHalo > 0) { shapePath(ctx, pl.poly, r, pl.smooth); ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW + 3.5; ctx.strokeStyle = `rgba(235,240,250,${S.edgeHalo})`; ctx.stroke(); }
  // 厚度（参考几乎不可见：底部 1~2px 暗边）
  if (S.plateThick > 0) { ctx.save(); ctx.translate(0, S.plateThick); shapePath(ctx, pl.poly, r, pl.smooth); ctx.fillStyle = S.plateShade; ctx.fill(); ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke(); ctx.restore(); }
  // 面：薰衣草，中心 #bdb5ea，左上更亮
  shapePath(ctx, pl.poly, r, pl.smooth);
  const g = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w * 0.6, bb.y + bb.h); g.addColorStop(0, shade(S.plateColor, 0.3)); g.addColorStop(0.45, S.plateColor); g.addColorStop(1, shade(S.plateColor, -0.1));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // 铅笔排线（参考亮度 sd≈51：亮白/暗紫斜向细笔触，对比强）
  grain(ctx, bb, '#ffffff', S.plateGrain * 1.8, rnd, -0.6, 3.5, 0.6, 1.6, 12, 40, 0.5);
  grain(ctx, bb, '#463a7c', S.plateGrain * 1.0, rnd, -0.6, 1.6, 0.5, 1.0, 8, 30, 0.5);
  // 光泽白边：沿轮廓内侧的强白高光（参考 p95 ≈ #fef9ff），左上更强
  if (S.plateGloss > 0) {
    ctx.save(); ctx.filter = 'blur(1.2px)';
    shapePath(ctx, pl.poly, r, pl.smooth); ctx.lineWidth = 12; ctx.strokeStyle = `rgba(255,255,255,${S.plateGloss * 0.5})`; ctx.stroke();
    ctx.translate(1.5, 1.8); shapePath(ctx, pl.poly, r, pl.smooth); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,253,255,${S.plateGloss})`; ctx.stroke();
    ctx.restore();
    // 右下内侧淡暗边（立体感）
    ctx.save(); ctx.translate(-2.5, -3.5); shapePath(ctx, pl.poly, r, pl.smooth); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(70,55,120,0.28)'; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  shapePath(ctx, pl.poly, r, pl.smooth); ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke();
  // v1.6 板孔 = 真正的镂空（参考：透过板孔看到粉色底板 / 下层板 / 对准时底板的暗孔），带孔缘描边、上沿孔壁阴影、外圈光泽
  holePts.forEach(([hx, hy]) => plateHoleCut(ctx, hx, hy, S));
  return { c, x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
}
// v1.8 经典款板块：拉丝金属（近水平的细长划痕，亮/暗交替）、内侧强白倒角高光（参考边缘 p95 纯白）、右下暗倒角、黑色细描边；
// 第二板材（脚跟米色板）：沙粒/软木斑点纹理
function metalSprite(pl, S, idx, dpr, holePts) {
  const bb = bbox(pl.poly), pad = 14 + S.plateThick;
  const c = document.createElement('canvas'); c.width = Math.ceil((bb.w + pad * 2) * dpr); c.height = Math.ceil((bb.h + pad * 2) * dpr);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.translate(pad - bb.x, pad - bb.y);
  const r = pl.radius * S.plateRadius, rnd = mulberry(300 + idx), path = () => shapePath(ctx, pl.poly, r, pl.smooth);
  if (S.edgeHalo > 0) { path(); ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW + 3; ctx.strokeStyle = `rgba(255,255,250,${S.edgeHalo})`; ctx.stroke(); }
  if (S.plateThick > 0) { ctx.save(); ctx.translate(0, S.plateThick); path(); ctx.fillStyle = S.plateShade; ctx.fill(); ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke(); ctx.restore(); }
  path();
  const g = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w * 0.5, bb.y + bb.h);
  g.addColorStop(0, shade(S.plateColor, 0.22)); g.addColorStop(0.5, S.plateColor); g.addColorStop(1, shade(S.plateColor, -0.12));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  if (S._alt) {
    // 沙粒斑点：大小不一的亮/暗小斑 + 少量横向纹
    const n = Math.floor(bb.w * bb.h / 18 * (0.4 + S.plateGrain));
    for (let i = 0; i < n; i++) { const x = bb.x + rnd() * bb.w, y = bb.y + rnd() * bb.h, rr = 0.6 + rnd() * 2.2, lt = rnd() < 0.5; ctx.fillStyle = lt ? `rgba(255,248,225,${0.35 * rnd()})` : `rgba(90,72,40,${0.32 * rnd()})`; ctx.beginPath(); ctx.ellipse(x, y, rr * 1.6, rr, 0, 0, 7); ctx.fill(); }
    grain(ctx, bb, '#6b5a3a', S.plateGrain * 0.5, rnd, -0.08, 1.2, 0.6, 1.0, 10, 30, 0.6);
  } else {
    // 拉丝：近水平长划痕（参考划痕方向略向右上），白色为主、暗色次之，整体轻微模糊
    grain(ctx, bb, '#ffffff', S.plateGrain * 0.75, rnd, -0.18, 3.2, 0.8, 2.0, 10, 40, 1.1);
    grain(ctx, bb, '#3a3636', S.plateGrain * 0.55, rnd, -0.18, 2.4, 0.7, 1.8, 8, 34, 1.1);
    grain(ctx, bb, '#ffffff', S.plateGrain * 0.35, rnd, -0.1, 1.2, 0.4, 0.6, 20, 50, 0.3);
  }
  if (S.plateGloss > 0) {
    ctx.save(); ctx.filter = 'blur(1.4px)';
    path(); ctx.lineWidth = 13; ctx.strokeStyle = `rgba(255,255,255,${S.plateGloss * 0.45})`; ctx.stroke();
    ctx.translate(1.6, 1.9); path(); ctx.lineWidth = 6.5; ctx.strokeStyle = `rgba(255,255,255,${S.plateGloss})`; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.filter = 'blur(1px)'; ctx.translate(-2.6, -3.4); path(); ctx.lineWidth = 4.5; ctx.strokeStyle = `rgba(40,36,36,${0.4 * S.plateGloss})`; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  path(); ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke();
  holePts.forEach(([hx, hy]) => plateHoleCut(ctx, hx, hy, S));
  return { c, x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
}
export function plateHoleCut(ctx, x, y, S) {
  const rh = (S.plateHoleSize || S.holeSize + 3) / 2, wall = S.plateHoleWall ?? 2.6;
  // 外圈光泽（孔缘被倒角受光，参考板孔外一圈白亮边，右下更亮）
  ctx.save(); ctx.filter = 'blur(0.8px)'; ctx.beginPath(); ctx.arc(x + 0.6, y + 0.9, rh + 2.4, 0, 7); ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(255,253,255,${0.7 * (S.plateGloss ?? 1)})`; ctx.stroke(); ctx.restore();
  // 镂空
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, rh, 0, 7); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  // 孔壁：上沿可见一条板厚的暗壁（孔圆 − 下移 wall 的孔圆）
  if (wall > 0) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, rh, 0, 7); ctx.clip(); ctx.beginPath(); ctx.arc(x, y, rh + 1, 0, 7); ctx.arc(x, y + wall, rh, 0, 7, true); ctx.fillStyle = shade(S.plateShade || '#7b70ad', -0.15); ctx.globalAlpha = 0.92; ctx.fill('evenodd'); ctx.restore(); }
  // 孔缘描边
  ctx.beginPath(); ctx.arc(x, y, rh, 0, 7); ctx.lineWidth = Math.max(1.2, S.outlineW * 0.75); ctx.strokeStyle = S.plateOutline; ctx.stroke();
}
export function drawHole(ctx, x, y, S) {
  // 参考：深红棕孔内 #2c160f，下缘奶白色斜面月牙（孔壁受光），上缘略暗凹陷
  const r = S.holeSize / 2;
  if (S.holeStyle === 'black') {
    // 经典款：黑色深孔（参考孔内 #1f1c20 很平），下沿一道细亮斜面，上沿最暗
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); const gb = ctx.createLinearGradient(x, y - r, x, y + r + 2); gb.addColorStop(0, 'rgba(0,0,0,0.6)'); gb.addColorStop(0.6, 'rgba(60,58,58,0.5)'); gb.addColorStop(1, 'rgba(235,235,235,0.85)'); ctx.fillStyle = gb; ctx.fill();
    ctx.beginPath(); ctx.arc(x + 0.4, y - 1.2, r, 0, 7); const g2 = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r); g2.addColorStop(0, shade(S.holeColor, 0.08)); g2.addColorStop(0.8, S.holeColor); g2.addColorStop(1, '#050404'); ctx.fillStyle = g2; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.arc(x, y, r + 3.2, 0, 7); const gr = ctx.createLinearGradient(x, y - r - 3, x, y + r + 3); gr.addColorStop(0, 'rgba(90,40,35,0.35)'); gr.addColorStop(0.45, 'rgba(255,235,228,0.35)'); gr.addColorStop(1, 'rgba(255,250,246,0.8)'); ctx.fillStyle = gr; ctx.fill();
  ctx.beginPath(); ctx.arc(x + 0.6, y - 1.2, r, 0, 7); const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r * 1.05); g.addColorStop(0, S.holeColor); g.addColorStop(0.75, S.holeColor); g.addColorStop(1, shade(S.holeColor, 0.18)); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,5,5,0.55)'; ctx.stroke();
}
// part: 'all' | 'shadow' | 'shank' | 'head' | 'cross'（AE 导出把螺丝拆成独立图层）
export function drawScrew(ctx, x, y, S, ang, lift, sc, part = 'all') {
  const R = S.screwSize / 2 * sc, all = part === 'all';
  if (lift > 0.5 || !all) {
    // 投影
    if (all || part === 'shadow') { ctx.beginPath(); ctx.ellipse(x + lift * 0.25, y + 2, R * 0.9, R * 0.55, 0, 0, 7); ctx.fillStyle = all ? `rgba(20,10,30,${Math.min(0.35, lift / 60)})` : 'rgb(20,10,30)'; ctx.fill(); }
    // 螺杆（带螺纹）
    if (all || part === 'shank') {
      const w = R * 0.42, top = y - lift;
      ctx.fillStyle = S.screwDark; ctx.fillRect(x - w, top, w * 2, lift);
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(S.screwColor, -0.35)); g.addColorStop(0.4, shade(S.screwColor, 0.4)); g.addColorStop(1, shade(S.screwColor, -0.5));
      ctx.fillStyle = g; ctx.fillRect(x - w, top, w * 2, lift);
      ctx.strokeStyle = 'rgba(40,30,60,0.55)'; ctx.lineWidth = 1.2;
      const ph = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * 6;
      for (let yy = top + ph; yy < y; yy += 6) { ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy - 3); ctx.stroke(); }
      ctx.strokeStyle = S.plateOutline; ctx.lineWidth = 1.2; ctx.strokeRect(x - w, top, w * 2, lift);
    }
    y = y - lift;
  }
  const chrome = S.screwStyle === 'chrome';
  if (chrome && (all || part === 'head')) {
    // v1.8 经典款：镜面银（锥形明暗：左上/右下亮、右上/左下暗，反光方向固定）、粗黑外边 + 内侧白细环
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7);
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.05, x, y, R); g.addColorStop(0, shade(S.screwColor, 0.6)); g.addColorStop(0.65, S.screwColor); g.addColorStop(1, shade(S.screwColor, -0.25));
    ctx.fillStyle = g; ctx.fill();
    if (S.screwBrush > 0 && ctx.createConicGradient) {
      const cg = ctx.createConicGradient(-0.5, x, y), b = S.screwBrush;
      [[0, `rgba(255,255,255,${0.95 * b})`], [0.12, `rgba(255,255,255,${0.6 * b})`], [0.25, `rgba(70,66,67,${0.75 * b})`], [0.38, `rgba(150,146,147,${0.3 * b})`], [0.5, `rgba(255,255,255,${0.95 * b})`], [0.62, `rgba(255,255,255,${0.6 * b})`], [0.75, `rgba(70,66,67,${0.75 * b})`], [0.88, `rgba(150,146,147,${0.3 * b})`], [1, `rgba(255,255,255,${0.95 * b})`]].forEach(([o, c]) => cg.addColorStop(o, c));
      ctx.save(); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, R * 0.94, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, R - S.screwRimW - 0.9, 0, 7); ctx.stroke();
    ctx.lineWidth = S.screwRimW; ctx.strokeStyle = S.screwRim; ctx.beginPath(); ctx.arc(x, y, R - S.screwRimW / 2, 0, 7); ctx.stroke();
  }
  if (!chrome && (all || part === 'head')) {
    // 参考：拉丝银（扇形明暗交替，随螺丝旋转），主体 #9f9ac2、高光近白、细暗边 #30274d，无内圈
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7);
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); g.addColorStop(0, shade(S.screwColor, 0.55)); g.addColorStop(0.6, S.screwColor); g.addColorStop(1, S.screwDark);
    ctx.fillStyle = g; ctx.fill();
    if (S.screwBrush > 0 && ctx.createConicGradient) {
      const cg = ctx.createConicGradient(0.6, x, y), K = 4; // 反光方向固定（不随螺丝旋转），AE 螺帽素材因此可静态
      for (let i = 0; i <= K * 2; i++) { const lt = i % 2 === 0; cg.addColorStop(Math.min(1, (i + (lt ? 0 : 0.2)) / (K * 2)), lt ? `rgba(255,255,255,${0.9 * S.screwBrush})` : `rgba(50,42,90,${0.7 * S.screwBrush})`); }
      ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, R * 0.97, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.lineWidth = S.screwRimW; ctx.strokeStyle = S.screwRim; ctx.beginPath(); ctx.arc(x, y, R - S.screwRimW / 2, 0, 7); ctx.stroke();
  }
  if (!all && part !== 'cross') return;
  // 十字槽
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // 参考：细十字（臂长≈0.56R、宽≈0.22R），两端略收窄，下侧细亮边
  const L = R * S.crossLen, T = R * S.crossW / 2;
  if (chrome) {
    // 经典款：粗直十字（圆头），右下侧亮边（槽壁受光）
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = T * 2; ctx.beginPath(); ctx.moveTo(-L + 0.9, 1.1); ctx.lineTo(L + 0.9, 1.1); ctx.moveTo(0.9, -L + 1.1); ctx.lineTo(0.9, L + 1.1); ctx.stroke();
    ctx.strokeStyle = S.screwCross; ctx.lineWidth = T * 2; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke();
    ctx.restore(); return;
  }
  for (const a of [0, Math.PI / 2]) {
    ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-L, -T * 0.7); ctx.quadraticCurveTo(0, -T * 1.25, L, -T * 0.7); ctx.arc(L, 0, T * 0.7, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(0, T * 1.25, -L, T * 0.7); ctx.arc(-L, 0, T * 0.7, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = S.screwCross; ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-L, T + 0.9); ctx.lineTo(-T, T + 0.9); ctx.moveTo(T + 0.9, L); ctx.lineTo(T + 0.9, T); ctx.stroke();
  ctx.restore();
}
