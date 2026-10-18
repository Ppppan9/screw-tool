// v1.3 导入透明图形生成关卡：alpha 剪影 → 平滑底板轮廓（支持内孔/多块）→ 按参考风格切分板块（细缝）→ 螺丝/空孔/隐藏孔 → 求解器验证可解
import { smoothPoly, polyArea } from './geom.js';
import { mulberry, validate, initState, pointInPoly, referenceLevel } from './level.js';

// ---- 等值线（marching squares，线性插值，闭合环）----
export function marching(F, nx, ny) {
  const ex = new Map(), pos = new Map();
  const key = (t, i, j) => (t === 'h' ? 0 : 1) + 2 * (i + j * (nx + 1));
  const pt = (t, i, j) => { const k = key(t, i, j); if (!pos.has(k)) { const a = F[i + j * nx], b = t === 'h' ? F[i + 1 + j * nx] : F[i + (j + 1) * nx], u = a / (a - b); pos.set(k, t === 'h' ? [i + u, j] : [i, j + u]); } return k; };
  const link = (a, b) => { (ex.get(a) || ex.set(a, []).get(a)).push(b); (ex.get(b) || ex.set(b, []).get(b)).push(a); };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [F[i + j * nx], F[i + 1 + j * nx], F[i + 1 + (j + 1) * nx], F[i + (j + 1) * nx]], s = c.map(v => v > 0);
    const n = s.filter(Boolean).length; if (n === 0 || n === 4) continue;
    const E = [s[0] !== s[1] ? pt('h', i, j) : -1, s[1] !== s[2] ? pt('v', i + 1, j) : -1, s[3] !== s[2] ? pt('h', i, j + 1) : -1, s[0] !== s[3] ? pt('v', i, j) : -1];
    const cr = E.filter(e => e >= 0);
    if (cr.length === 2) link(cr[0], cr[1]);
    else { const cin = (c[0] + c[1] + c[2] + c[3]) > 0; const iso = s.map(v => v !== cin); // 与中心符号不同的角被隔离
      if (iso[0]) link(E[3], E[0]); if (iso[1]) link(E[0], E[1]); if (iso[2]) link(E[1], E[2]); if (iso[3]) link(E[2], E[3]); }
  }
  const seen = new Set(), loops = [];
  for (const k0 of ex.keys()) { if (seen.has(k0)) continue; const loop = []; let prev = -1, cur = k0;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(pos.get(cur)); const nb = ex.get(cur); const nxt = nb[0] !== prev ? nb[0] : nb[1]; prev = cur; cur = nxt; }
    if (loop.length > 3) loops.push(loop); }
  return loops;
}
function chamfer(nx, ny, seed) { // 到最近种子格的距离（格单位）
  const D = new Float32Array(nx * ny); const R2 = Math.SQRT2;
  for (let i = 0; i < D.length; i++) D[i] = seed(i) ? 0 : 1e9;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = i + j * nx; let v = D[k];
    if (i > 0) v = Math.min(v, D[k - 1] + 1); if (j > 0) { v = Math.min(v, D[k - nx] + 1); if (i > 0) v = Math.min(v, D[k - nx - 1] + R2); if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + R2); } D[k] = v; }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = i + j * nx; let v = D[k];
    if (i < nx - 1) v = Math.min(v, D[k + 1] + 1); if (j < ny - 1) { v = Math.min(v, D[k + nx] + 1); if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + R2); if (i > 0) v = Math.min(v, D[k + nx - 1] + R2); } D[k] = v; }
  return D;
}
// ---- 默认图形（未上传时）：心形 ----
export function defaultShapeCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d');
  g.fillStyle = '#e0607a'; g.beginPath(); g.moveTo(200, 360); g.bezierCurveTo(40, 250, 10, 150, 70, 80); g.bezierCurveTo(120, 30, 180, 50, 200, 110); g.bezierCurveTo(220, 50, 280, 30, 330, 80); g.bezierCurveTo(390, 150, 360, 250, 200, 360); g.fill();
  return c;
}
// 分区：返回 (x,y)->标签 的函数
function partitioner(S, rnd, inside, area, layer) {
  const size = S.plateSize * (1 + layer * 0.15), r = S.partRandom, th = (S.partAngle + layer * 55) * Math.PI / 180, ca = Math.cos(th), sa = Math.sin(th);
  const style = S.partStyle;
  if (style === 'voronoi') {
    const n = S.plateCount > 0 ? S.plateCount : Math.max(2, Math.round(area / (size * size) * (S.vorDensity ?? 1)));
    const seeds = []; let t = 0; const md = Math.sqrt(area / n) * 0.75;
    while (seeds.length < n && t++ < 20000) { const p = inside(rnd); if (!p) continue; if (seeds.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > md * (t < 8000 ? 1 : 0.6))) seeds.push(p); }
    const ani = 1 + r; // 沿主方向拉长 → 条状
    return (x, y) => { let b = 0, bd = 1e18; for (let i = 0; i < seeds.length; i++) { const dx = x - seeds[i][0], dy = y - seeds[i][1], u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d = u * u / (ani * ani) + v * v; if (d < bd) { bd = d; b = i; } } return b; };
  }
  // strip / grid：沿方向 th 的条带，每条带内按随机长度切段（grid 时切口对齐）
  const w = style === 'grid' ? size : size * 0.62, strips = new Map();
  const cuts = (k) => { if (strips.has(k)) return strips.get(k); const rr = mulberry(k * 7919 + 13 + layer * 31337 + S.shapeSeed * 101); const arr = []; let u = -2000 + (style === 'grid' ? 0 : rr() * size);
    while (u < 2000) { const len = style === 'grid' ? size : size * (1.1 + (rr() - 0.5) * 1.2 * r); arr.push([u, style === 'grid' ? 0 : (rr() - 0.5) * 0.9 * r]); u += len; } strips.set(k, arr); return arr; };
  const off = rnd() * w;
  return (x, y) => { const u = x * ca + y * sa, v = -x * sa + y * ca + off, k = Math.floor(v / w), vm = (v - (k + 0.5) * w); const cs = cuts(k); let s = 0; while (s < cs.length - 1 && cs[s + 1][0] + cs[s + 1][1] * vm < u) s++; return k * 10000 + s; };
}
// 主函数：img 为已加载的 Image/Canvas
export function levelFromImage(img, S, seed0) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const L = buildOnce(img, S, seed0 + attempt * 977, Math.floor(attempt / 4));
    if (!L) break;
    if (L.plates.length && validate(L, S, S.genSolveMs ?? 2500, 12000)) { L.seed = seed0 + attempt * 977; L.attempts = attempt + 1; return L; }
  }
  const R = referenceLevel(); R.name = 'reference(fallback)'; return R;
}
function buildOnce(img, S, seed, extraEmpty) {
  const rnd = mulberry(seed);
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return null;
  const k0 = Math.min(1, 1024 / Math.max(iw, ih)); const sw = Math.max(1, Math.round(iw * k0)), sh = Math.max(1, Math.round(ih * k0));
  const sc0 = document.createElement('canvas'); sc0.width = sw; sc0.height = sh; const g0 = sc0.getContext('2d', { willReadFrequently: true }); g0.drawImage(img, 0, 0, sw, sh);
  const id0 = g0.getImageData(0, 0, sw, sh).data; let bx0 = sw, by0 = sh, bx1 = -1, by1 = -1; const T = S.shapeThreshold * 255;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (id0[(x + y * sw) * 4 + 3] > T) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 < 0) return null;
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  const sc = Math.min((720 - 2 * S.shapeMargin) / bw, S.shapeMaxH / bh) * S.shapeScale;
  const ox = 360 - bw * sc / 2 + S.shapeOffX, oy = S.genCenterY - bh * sc / 2 + S.shapeOffY;
  const tex = { img: sc0, sx: bx0, sy: by0, sw: bw, sh: bh, dx: ox, dy: oy, dw: bw * sc, dh: bh * sc };
  // 网格（设计坐标，格距 g）
  const g = 2.5, pad = 4, gx0 = ox - pad * g, gy0 = oy - pad * g, nx = Math.ceil(bw * sc / g) + pad * 2, ny = Math.ceil(bh * sc / g) + pad * 2;
  const gc = document.createElement('canvas'); gc.width = nx; gc.height = ny; const gg = gc.getContext('2d', { willReadFrequently: true });
  gg.imageSmoothingQuality = 'high'; gg.drawImage(sc0, bx0, by0, bw, bh, pad, pad, bw * sc / g, bh * sc / g);
  const px = gg.getImageData(0, 0, nx, ny).data, N = nx * ny, A = new Float32Array(N);
  for (let i = 0; i < N; i++) A[i] = px[i * 4 + 3] / 255 - S.shapeThreshold;
  for (let i = 0; i < nx; i++) { A[i] = A[i + (ny - 1) * nx] = -1; } for (let j = 0; j < ny; j++) { A[j * nx] = A[nx - 1 + j * nx] = -1; }
  const toD = (p) => [gx0 + p[0] * g, gy0 + p[1] * g];
  // 底板轮廓
  const minA = 400 * S.shapeScale;
  let loops = marching(A, nx, ny).map(l => smoothPoly(l.map(toD), 0.8, 2)).filter(l => Math.abs(polyArea(l)) > minA);
  const outer = [], inner = [];
  loops.forEach((l, i) => { const depth = loops.filter((m, j) => j !== i && pointInPoly(l[0][0], l[0][1], m)).length; (depth % 2 ? inner : outer).push(l); });
  const isIn = new Uint8Array(N); for (let i = 0; i < N; i++) isIn[i] = A[i] > 0 ? 1 : 0;
  const dIn = chamfer(nx, ny, i => !isIn[i]); for (let i = 0; i < N; i++) dIn[i] = dIn[i] * g - g / 2;
  let area = 0; for (let i = 0; i < N; i++) if (dIn[i] > S.edgeInset) area++; area *= g * g;
  const L = { plates: [], holes: [], screws: [], base: { polys: outer, inner, capsules: [], smooth: true, tex: S.baseFill === 'image' ? tex : null }, name: 'image' };
  const holeMinD = S.holeSize + 10;
  const okHole = (x, y) => L.holes.every(h => Math.hypot(h.x - x, h.y - y) >= holeMinD);
  const cellsIn = []; for (let i = 0; i < N; i++) if (dIn[i] > S.edgeInset + S.seamW) cellsIn.push(i);
  const inside = (r) => { const i = cellsIn[Math.floor(r() * cellsIn.length)]; return i === undefined ? null : [gx0 + (i % nx) * g, gy0 + Math.floor(i / nx) * g]; };
  for (let layer = 0; layer < S.imgLayers; layer++) {
    const part = partitioner(S, rnd, inside, area, layer);
    // 1) 原始标签 → 连通分量
    const lab = new Int32Array(N).fill(-1), raw = new Map(); let rawN = 0;
    for (let i = 0; i < N; i++) if (dIn[i] > S.edgeInset) { const k = part(gx0 + (i % nx) * g, gy0 + Math.floor(i / nx) * g); if (!raw.has(k)) raw.set(k, rawN++); lab[i] = raw.get(k); }
    const comp = new Int32Array(N).fill(-1); let nc = 0; const q = [];
    for (let i = 0; i < N; i++) if (lab[i] >= 0 && comp[i] < 0) { comp[i] = nc; q.length = 0; q.push(i); while (q.length) { const c = q.pop(); for (const d of [1, -1, nx, -nx]) { const n2 = c + d; if (lab[n2] === lab[c] && comp[n2] < 0) { comp[n2] = nc; q.push(n2); } } } nc++; }
    // 2) 合并小碎片（面积不足 / 放不下螺丝）到共享边最长的邻块
    const par = Array.from({ length: nc }, (_, i) => i), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    for (let it = 0; it < 4; it++) {
      const cnt = new Map(); for (let i = 0; i < N; i++) if (comp[i] >= 0) { const c = find(comp[i]); cnt.set(c, (cnt.get(c) || 0) + 1); }
      const lb = (i) => comp[i] < 0 ? -1 : find(comp[i]);
      const dB = chamfer(nx, ny, i => comp[i] >= 0 && [1, -1, nx, -nx].some(d => lb(i + d) !== lb(i)));
      const maxD = new Map(); for (let i = 0; i < N; i++) if (comp[i] >= 0) { const c = lb(i); maxD.set(c, Math.max(maxD.get(c) || 0, dB[i] * g)); }
      const small = [...cnt.keys()].filter(c => cnt.get(c) * g * g < S.minPlateArea || (maxD.get(c) || 0) < S.screwEdgeMin + S.seamW / 2 + 2).sort((a, b) => cnt.get(a) - cnt.get(b));
      if (!small.length) break; let merged = 0;
      for (const c0 of small) { const c = find(c0); const nb = new Map(); for (let i = 0; i < N; i++) if (comp[i] >= 0 && find(comp[i]) === c) for (const d of [1, -1, nx, -nx]) { const o = comp[i + d]; if (o >= 0 && find(o) !== c) nb.set(find(o), (nb.get(find(o)) || 0) + 1); }
        if (nb.size) { const best = [...nb.entries()].sort((a, b) => b[1] - a[1])[0][0]; par[c] = best; merged++; } }
      if (!merged) break;
    }
    const fl = new Int32Array(N).fill(-1); const ids = new Map(); for (let i = 0; i < N; i++) if (comp[i] >= 0) { const c = find(comp[i]); if (!ids.has(c)) ids.set(c, ids.size); fl[i] = ids.get(c); }
    const dB = chamfer(nx, ny, i => fl[i] >= 0 && [1, -1, nx, -nx].some(d => fl[i + d] !== fl[i])); for (let i = 0; i < N; i++) dB[i] = dB[i] * g + g / 2;
    // 3) 每块：场 = 到块边界距离 - 缝宽/2 → 等值线 → 平滑
    const keepP = layer === 0 ? 1 : S.layerOverlap;
    for (let pi = 0; pi < ids.size; pi++) {
      if (layer > 0 && rnd() > keepP) continue;
      let x0 = nx, y0 = ny, x1 = 0, y1 = 0, rs = 0, gs = 0, bs = 0, n = 0;
      for (let i = 0; i < N; i++) if (fl[i] === pi) { const x = i % nx, y = (i / nx) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; rs += px[i * 4]; gs += px[i * 4 + 1]; bs += px[i * 4 + 2]; n++; }
      x0 -= 2; y0 -= 2; x1 += 2; y1 += 2; const w = x1 - x0 + 1, h = y1 - y0 + 1, F = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = x0 + x + (y0 + y) * nx; F[x + y * w] = (fl[i] === pi ? Math.min(dB[i], dIn[i] - S.edgeInset + S.seamW / 2) : -dB[i]) - S.seamW / 2; }
      for (let x = 0; x < w; x++) { F[x] = F[x + (h - 1) * w] = -1; } for (let y = 0; y < h; y++) { F[y * w] = F[w - 1 + y * w] = -1; }
      const ls = marching(F, w, h).map(l => l.map(p => [gx0 + (p[0] + x0) * g, gy0 + (p[1] + y0) * g]));
      if (!ls.length) continue; ls.sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)));
      const poly = smoothPoly(ls[0], 1.0, 3); if (Math.abs(polyArea(poly)) < S.minPlateArea * 0.5) continue;
      // 螺丝：距边 ≥ screwEdgeMin 的格，第一颗取内切最深处附近（带随机），第二颗取离第一颗最远
      const cand = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (F[x + y * w] >= S.screwEdgeMin) { const X = gx0 + (x + x0) * g, Y = gy0 + (y + y0) * g; if (pointInPoly(X, Y, poly)) cand.push([X, Y, F[x + y * w]]); }
      if (!cand.length) continue;
      const nS = Math.max(1, Math.min(S.imgScrewMax, S.imgScrewMin + Math.floor(rnd() * (S.imgScrewMax - S.imgScrewMin + 1))));
      cand.sort((a, b) => b[2] - a[2]); const hs = [];
      const top = cand.slice(0, Math.max(1, Math.ceil(cand.length * 0.15))).filter(c => okHole(c[0], c[1]));
      if (!top.length) continue; const first = top[Math.floor(rnd() * top.length)]; L.holes.push({ x: first[0], y: first[1] }); hs.push(L.holes.length - 1);
      for (let s = 1; s < nS; s++) { let best = null, bd = 0; for (const c of cand) { if (!okHole(c[0], c[1])) continue; const d = Math.min(...hs.map(hh => Math.hypot(L.holes[hh].x - c[0], L.holes[hh].y - c[1]))); if (d > bd) { bd = d; best = c; } } if (best && bd > S.plateSize * 0.45) { L.holes.push({ x: best[0], y: best[1] }); hs.push(L.holes.length - 1); } }
      const pl = { poly, smooth: true, layer, holes: hs, radius: 3 };
      if (S.plateTint === 'image' && n) { const c = [rs / n, gs / n, bs / n].map(v => Math.round(v)); pl.tint = '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
      L.plates.push(pl);
    }
  }
  if (!L.plates.length) return L;
  // 初始可见空孔：去掉若干块未被上层覆盖的小板，在其位置放空孔（同参考关卡露出底板的空孔）
  const nEmpty = S.imgEmpty + extraEmpty;
  const order = L.plates.map((p, i) => i).filter(i => L.plates[i].layer === 0).sort((a, b) => Math.abs(polyArea(L.plates[a].poly)) - Math.abs(polyArea(L.plates[b].poly)));
  const removed = new Set();
  for (const pi of order) { if (removed.size >= nEmpty) break; const p = L.plates[pi], h = L.holes[p.holes[0]];
    if (L.plates.some((o, oi) => oi !== pi && pointInPoly(h.x, h.y, o.poly))) continue; removed.add(pi); }
  L.plates = L.plates.filter((_, i) => !removed.has(i));
  const used = new Set(L.plates.flatMap(p => p.holes));
  // 空孔保留在被移除板的位置；其余移除的孔丢弃并重排编号
  const keepEmpty = new Set(); [...removed].forEach(pi => { }); 
  const remap = new Map(), holes2 = [];
  L.holes.forEach((h, i) => { if (used.has(i)) { remap.set(i, holes2.length); holes2.push(h); } });
  const emptyStart = holes2.length;
  L.holes.forEach((h, i) => { if (!used.has(i) && holes2.slice(emptyStart).length < nEmpty) holes2.push(h); });
  L.holes = holes2; L.plates.forEach(p => p.holes = p.holes.map(h => remap.get(h)));
  // 隐藏底孔：被板盖住
  let t = 0, made = 0; while (made < S.imgHidden && t++ < 500) { const p = inside(rnd); if (!p) break; const i = Math.round((p[0] - gx0) / g) + Math.round((p[1] - gy0) / g) * nx; if (dIn[i] < S.holeSize * 0.7) continue; if (!L.holes.every(h => Math.hypot(h.x - p[0], h.y - p[1]) >= holeMinD)) continue; if (!L.plates.some(pl => pointInPoly(p[0], p[1], pl.poly))) continue; L.holes.push({ x: p[0], y: p[1] }); made++; }
  L.plates.forEach(pl => pl.holes.forEach(h => L.screws.push({ hole: h })));
  return L;
}
