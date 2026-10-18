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
export function drawBackground(c, S, W, H, k, bgImg) {
  const ctx = c.getContext('2d'); ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H);
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
  grain(ctx, bb, '#7a3f33', S.baseGrain * 0.45, rnd, -0.62, 3, 0.8, 1.6, 10, 26);
  grain(ctx, bb, '#fff1ee', S.baseGrain * 2.6, rnd, -0.62, 5, 0.8, 2.2, 8, 26, 1.0);
  // 玻璃感内高光边（参考右缘/下缘可见白色亮边）
  ctx.save(); ctx.translate(-1.2, -1.6); ctx.lineJoin = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = `rgba(255,248,246,${S.baseGloss})`; basePath(ctx, L); ctx.stroke(); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.lineJoin = 'round'; ctx.lineWidth = S.outlineW + 3.5; ctx.strokeStyle = `rgba(235,245,235,${S.edgeHalo})`; basePath(ctx, L); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = S.baseOutline; ctx.lineWidth = S.outlineW; ctx.lineJoin = 'round'; basePath(ctx, L); ctx.stroke();
  o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(c2, 0, 0); o.restore();
}
export function plateSprite(pl, S0, idx, dpr, holePts = []) {
  const S = pl.tint ? { ...S0, plateColor: mixHex(S0.plateColor, pl.tint, S0.plateTintAmt ?? 0.35) } : S0;
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
  if (all || part === 'head') {
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
  for (const a of [0, Math.PI / 2]) {
    ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-L, -T * 0.7); ctx.quadraticCurveTo(0, -T * 1.25, L, -T * 0.7); ctx.arc(L, 0, T * 0.7, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(0, T * 1.25, -L, T * 0.7); ctx.arc(-L, 0, T * 0.7, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = S.screwCross; ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-L, T + 0.9); ctx.lineTo(-T, T + 0.9); ctx.moveTo(T + 0.9, L); ctx.lineTo(T + 0.9, T); ctx.stroke();
  ctx.restore();
}
