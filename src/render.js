// 绘制：背景（纸纹+薄荷叶线稿）、底板、板块、螺丝
import { mulberry } from './level.js';
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
function grain(ctx, bb, color, alpha, rnd, angle, density) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const n = Math.floor((bb.w * bb.h) / 900 * density);
  for (let i = 0; i < n; i++) {
    const x = bb.x + rnd() * bb.w, y = bb.y + rnd() * bb.h, L = 8 + rnd() * 30;
    ctx.lineWidth = 0.6 + rnd() * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * L, y + Math.sin(angle) * L); ctx.stroke();
  }
  ctx.restore();
}
const bbox = (poly) => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
function capsulePath(ctx, pts, w) {
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
}
export function drawBase(ctx, L, S) {
  // 剪影：先描边（外扩），再填充
  const rnd = mulberry(11);
  const shapes = (fill, extra) => {
    ctx.fillStyle = fill; ctx.strokeStyle = fill;
    L.base.polys.forEach(p => { rrPath(ctx, p, 18); ctx.fill(); if (extra) { ctx.lineWidth = extra; ctx.lineJoin = 'round'; ctx.stroke(); } });
    L.base.capsules.forEach(c => { capsulePath(ctx, c.pts, c.w + extra); ctx.stroke(); });
  };
  ctx.save(); ctx.translate(0, 5); shapes('rgba(30,20,20,0.30)', 0); ctx.restore();
  shapes(S.baseColor, 0);
  // 木纹：只画在底板内（source-atop）
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const all = L.base.polys.flat().concat(L.base.capsules.flatMap(c => c.pts)); const bb = bbox(all); bb.x -= 50; bb.y -= 50; bb.w += 100; bb.h += 100;
  grain(ctx, bb, '#5a2c22', S.baseGrain, rnd, -0.5, 4); grain(ctx, bb, '#ffe0d0', S.baseGrain * 0.8, rnd, -0.5, 2);
  ctx.restore();
  ctx.strokeStyle = S.baseOutline; ctx.lineWidth = S.outlineW; ctx.lineJoin = 'round'; L.base.polys.forEach(p => { rrPath(ctx, p, 18); ctx.stroke(); });
}
export function plateSprite(pl, S, idx, dpr) {
  const bb = bbox(pl.poly), pad = 14 + S.plateThick;
  const c = document.createElement('canvas'); c.width = Math.ceil((bb.w + pad * 2) * dpr); c.height = Math.ceil((bb.h + pad * 2) * dpr);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.translate(pad - bb.x, pad - bb.y);
  const r = pl.radius * S.plateRadius, rnd = mulberry(100 + idx);
  // 厚度
  ctx.save(); ctx.translate(0, S.plateThick); rrPath(ctx, pl.poly, r); ctx.fillStyle = S.plateShade; ctx.fill(); ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke(); ctx.restore();
  // 面
  rrPath(ctx, pl.poly, r);
  const g = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w * 0.6, bb.y + bb.h); g.addColorStop(0, shade(S.plateColor, 0.35)); g.addColorStop(0.5, S.plateColor); g.addColorStop(1, shade(S.plateColor, -0.08));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  grain(ctx, bb, '#ffffff', S.plateGrain, rnd, -0.42, 3);
  grain(ctx, bb, '#6b5f9c', S.plateGrain * 0.45, rnd, -0.42, 2);
  // 内高光边
  rrPath(ctx, pl.poly, r); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  ctx.restore();
  rrPath(ctx, pl.poly, r); ctx.lineWidth = S.outlineW; ctx.strokeStyle = S.plateOutline; ctx.stroke();
  return { c, x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
}
export function drawHole(ctx, x, y, S) {
  const r = S.holeSize / 2;
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fillStyle = 'rgba(255,240,235,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); const g = ctx.createRadialGradient(x, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, S.holeColor); g.addColorStop(1, shade(S.holeColor, 0.15)); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
}
export function drawScrew(ctx, x, y, S, ang, lift, sc) {
  const R = S.screwSize / 2 * sc;
  if (lift > 0.5) {
    // 投影
    ctx.beginPath(); ctx.ellipse(x + lift * 0.25, y + 2, R * 0.9, R * 0.55, 0, 0, 7); ctx.fillStyle = `rgba(20,10,30,${Math.min(0.35, lift / 60)})`; ctx.fill();
    // 螺杆（带螺纹）
    const w = R * 0.42, top = y - lift;
    ctx.fillStyle = S.screwDark; ctx.fillRect(x - w, top, w * 2, lift);
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(S.screwColor, -0.35)); g.addColorStop(0.4, shade(S.screwColor, 0.4)); g.addColorStop(1, shade(S.screwColor, -0.5));
    ctx.fillStyle = g; ctx.fillRect(x - w, top, w * 2, lift);
    ctx.strokeStyle = 'rgba(40,30,60,0.55)'; ctx.lineWidth = 1.2;
    const ph = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * 6;
    for (let yy = top + ph; yy < y; yy += 6) { ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy - 3); ctx.stroke(); }
    ctx.strokeStyle = S.plateOutline; ctx.lineWidth = 1.2; ctx.strokeRect(x - w, top, w * 2, lift);
    y = top;
  }
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7);
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); g.addColorStop(0, shade(S.screwColor, 0.6)); g.addColorStop(0.65, S.screwColor); g.addColorStop(1, S.screwDark);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, S.outlineW * 0.9); ctx.strokeStyle = S.plateOutline; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, R * 0.78, 0, 7); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,70,110,0.45)'; ctx.stroke();
  // 十字槽
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const L = R * 0.62, T = R * 0.17;
  for (const a of [0, Math.PI / 2]) {
    ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-L, -T, L * 2, T * 2, T) : ctx.rect(-L, -T, L * 2, T * 2); ctx.fillStyle = S.screwCross; ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-L, T + 1); ctx.lineTo(-T, T + 1); ctx.moveTo(T + 1, L); ctx.lineTo(T + 1, T); ctx.stroke();
  ctx.restore();
}
