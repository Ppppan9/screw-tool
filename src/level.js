import TRACE from './ref_trace.json';
import { smoothPoly } from './geom.js';
// 关卡数据与逻辑。坐标系 720x1280。参考关卡由 ref/frames/g_004.jpg (t=2.93s) 逐点描绘：crop 偏移 (110,310)
const OX = 0, OY = 0;
const P = (pts) => pts.map(([x, y]) => [x + OX, y + OY]);

// 手指：分段边界点(指尖→根部，全分辨率 720x1280 坐标)、宽度
const FINGERS = [
  { name: '拇指', pts: [[116, 566], [190, 642], [228, 718], [276, 794]], w: 88 },
  { name: '食指', pts: [[243, 364], [263, 432], [282, 496], [298, 558], [314, 620]], w: 72 },
  { name: '中指', pts: [[385, 324], [387, 400], [388, 468], [388, 537], [386, 607]], w: 64 },
  { name: '无名指', pts: [[497, 344], [487, 420], [475, 492], [462, 560], [447, 632]], w: 62 },
  { name: '小指', pts: [[592, 438], [573, 508], [551, 568], [527, 620], [501, 668]], w: 58 },
];
const PALM = [
  { pts: [[252, 620], [340, 614], [366, 646], [360, 697], [247, 676]], screws: [[280, 645], [327, 670]] },
  { pts: [[240, 678], [360, 702], [381, 721], [376, 776], [250, 757], [234, 712]], screws: [[292, 716], [345, 740]] },
  { pts: [[436, 682], [461, 655], [546, 665], [553, 721], [440, 714]], screws: [[470, 694], [516, 694]] },
  { pts: [[384, 726], [543, 731], [538, 781], [388, 779]], screws: [[426, 754], [482, 757]] },
  { pts: [[391, 785], [531, 785], [515, 842], [396, 846]], screws: [[452, 806]] },
  { pts: [[285, 765], [386, 781], [390, 846], [316, 841], [275, 802]], screws: [[327, 808]] },
];
const BASE_PALM = [[235, 620], [300, 560], [400, 545], [500, 580], [562, 652], [556, 722], [542, 792], [528, 850], [503, 862], [503, 924], [302, 924], [302, 862], [262, 832], [232, 770], [222, 700]];
const EMPTY = [[400, 668]];
// 隐藏底孔：被板盖住，板掉落后露出（保证 1 个初始空孔也可解）
const HIDDEN = [[500, 812], [300, 812], [128, 576]];

function segQuad(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

// v1.1：板块轮廓与手型由 tools/trace_plates.py 从参考帧自动分割得到（ref_trace.json）
export function referenceLevel() {
  const plates = [], holes = [], screws = [], base = { polys: [smoothPoly(TRACE.base, 1.8, 3)], capsules: [], smooth: true };
  TRACE.plates.forEach(tp => {
    const hs = tp.screws.map(([x, y]) => { holes.push({ x, y }); return holes.length - 1; });
    plates.push({ poly: smoothPoly(tp.poly, 1.2, 2), smooth: true, layer: 0, holes: hs, radius: 3 });
  });
  for (const [x, y] of EMPTY) holes.push({ x, y });
  for (const [x, y] of HIDDEN) holes.push({ x, y });
  plates.forEach(pl => pl.holes.forEach(h => screws.push({ hole: h })));
  return { plates, holes, screws, base, name: 'reference' };
}

// ---------- 几何 ----------
export function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ---------- 逻辑状态 ----------
// state: { removed:Set(plateIdx), screwHole: int[] (screw -> hole, -1 none) }
export function initState(L) { return { removed: new Set(), screwHole: L.screws.map(s => s.hole) }; }
export function coverInfo(L) {
  // 每个孔被哪些板覆盖，以及板在该点是否有孔
  if (L._cover) return L._cover;
  L._cover = L.holes.map((h, hi) => L.plates.map((p, pi) => pointInPoly(h.x, h.y, p.poly) || p.holes.includes(hi) ? pi : -1).filter(i => i >= 0));
  return L._cover;
}
export function holeOccupied(st, hi) { return st.screwHole.indexOf(hi) >= 0; }
// v1.2 螺丝阻挡判定（可在设置里关闭，关闭后回到 v1.1 规则：板只被自己孔里的螺丝固定）
let BLOCK = true;
export function setBlocking(v) { BLOCK = !!v; }
export function getBlocking() { return BLOCK; }
// 孔所在层：拥有该孔的板的最高层；不属于任何板 = 底板(-1)
export function holeLayer(L, hi) {
  if (!L._hl) L._hl = L.holes.map((_, h) => Math.max(-1, ...L.plates.filter(p => p.holes.includes(h)).map(p => p.layer)));
  return L._hl[hi];
}
// 孔可用：没有螺丝，且所有覆盖该点（未掉落）的板要么在此处有孔，要么（阻挡判定开启时）在孔所在层之下（螺丝穿过它直到底板）
export function holeUsable(L, st, hi) {
  if (holeOccupied(st, hi)) return false;
  const hl = holeLayer(L, hi);
  return coverInfo(L)[hi].every(pi => st.removed.has(pi) || L.plates[pi].holes.includes(hi) || (BLOCK && L.plates[pi].layer < hl));
}
// 螺丝可取：其位置上方没有更高层且未开孔的板压住
export function screwFree(L, st, si) {
  const hi = st.screwHole[si]; if (hi < 0) return false;
  const cov = coverInfo(L)[hi].filter(pi => !st.removed.has(pi));
  const pinnedTop = Math.max(-1, ...cov.filter(pi => L.plates[pi].holes.includes(hi)).map(pi => L.plates[pi].layer));
  return !cov.some(pi => !L.plates[pi].holes.includes(hi) && L.plates[pi].layer > pinnedTop);
}
export function plateScrews(L, st, pi) { return st.screwHole.map((h, si) => L.plates[pi].holes.includes(h) ? si : -1).filter(i => i >= 0); }
// 固定某块板的螺丝：自己孔里的螺丝 + （阻挡判定）任何位置落在该板轮廓内的螺丝（螺丝贯穿该点所有重叠板直到底板）
export function platePins(L, st, pi) {
  if (!BLOCK) return plateScrews(L, st, pi);
  const cov = coverInfo(L);
  return st.screwHole.map((h, si) => h >= 0 && cov[h].includes(pi) ? si : -1).filter(i => i >= 0);
}
// 执行移动，返回掉落板列表。每次螺丝移动后重新评估所有板（不动点迭代）：
// 目标孔里的螺丝会立即挡住覆盖该点的板；拔出的螺丝会释放所有被它贯穿的板
export function applyMove(L, st, si, hi) {
  st.screwHole[si] = hi;
  const fell = [];
  let changed = true;
  while (changed) {
    changed = false;
    L.plates.forEach((p, pi) => {
      if (st.removed.has(pi)) return;
      if (platePins(L, st, pi).length === 0) { st.removed.add(pi); fell.push(pi); changed = true; }
    });
  }
  return fell;
}
export function usableHoles(L, st) { return L.holes.map((_, i) => i).filter(i => holeUsable(L, st, i)); }
export function done(L, st) { return st.removed.size === L.plates.length; }

// 目标孔选择规则
export function pickHole(L, st, si, rule, lastVacated, rnd = Math.random) {
  const from = L.holes[st.screwHole[si]];
  const pinned = new Set(L.plates.map((p, pi) => pi).filter(pi => !st.removed.has(pi) && L.plates[pi].holes.includes(st.screwHole[si])));
  let c = usableHoles(L, st).filter(h => h !== st.screwHole[si]);
  // 优先不把螺丝放回仍未掉落的板（避免无效步）
  const free = c.filter(h => !L.plates.some((p, pi) => !st.removed.has(pi) && p.holes.includes(h)));
  if (free.length) c = free;
  if (!c.length) return -1;
  if (rule === 'vacated' && lastVacated >= 0 && c.includes(lastVacated)) return lastVacated;
  if (rule === 'random') return c[Math.floor(rnd() * c.length)];
  c.sort((a, b) => Math.hypot(L.holes[a].x - from.x, L.holes[a].y - from.y) - Math.hypot(L.holes[b].x - from.x, L.holes[b].y - from.y));
  return c[0];
}

// 自动求解：贪心 + 回溯。返回 [[screw, hole], ...] 或 null
export function solve(L, st0, maxNodes = 20000) {
  let nodes = 0;
  const clone = (s) => ({ removed: new Set(s.removed), screwHole: s.screwHole.slice() });
  function rec(st, path) {
    if (done(L, st)) return path;
    if (++nodes > maxNodes) return null;
    const holes = usableHoles(L, st).filter(h => !L.plates.some((p, pi) => !st.removed.has(pi) && p.holes.includes(h)));
    if (!holes.length) return null;
    // 候选螺丝：在未掉落板上且可取，按所在板剩余螺丝数、层级排序
    const cands = [];
    st.screwHole.forEach((h, si) => {
      if (h < 0 || !screwFree(L, st, si)) return;
      const pls = L.plates.map((p, pi) => pi).filter(pi => !st.removed.has(pi) && L.plates[pi].holes.includes(h));
      if (!pls.length) return;
      const rem = Math.max(...pls.map(pi => platePins(L, st, pi).length));
      const lay = Math.max(...pls.map(pi => L.plates[pi].layer));
      cands.push({ si, score: rem * 10 - lay - L.holes[h].y / 1000 });
    });
    cands.sort((a, b) => a.score - b.score);
    for (const { si } of cands.slice(0, 4)) {
      const from = L.holes[st.screwHole[si]];
      const covN = h => coverInfo(L)[h].filter(pi => !st.removed.has(pi)).length;
      const hs = holes.slice().sort((a, b) => (covN(a) - covN(b)) || Math.hypot(L.holes[a].x - from.x, L.holes[a].y - from.y) - Math.hypot(L.holes[b].x - from.x, L.holes[b].y - from.y));
      const s2 = clone(st); applyMove(L, s2, si, hs[0]);
      const r = rec(s2, path.concat([[si, hs[0]]]));
      if (r) return r;
    }
    return null;
  }
  return rec(clone(st0), []);
}

// ---------- 随机关卡生成（保证可解）----------
export function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function generateLevel(o, seed) {
  for (let tries = 0; tries < 60; tries++) {
    const rnd = mulberry(seed + tries * 7919);
    const L = { plates: [], holes: [], screws: [], base: { polys: [], capsules: [] }, name: 'random' };
    const cx = 360, cy = o.genCenterY, W = o.genCols * (o.genPlateW + o.genGap), H = o.genRows * (o.genPlateH + o.genGap);
    const x0 = cx - W / 2, y0 = cy - H / 2;
    L.base.polys.push([[x0 - 24, y0 - 24], [x0 + W + 24, y0 - 24], [x0 + W + 24, y0 + H + 24], [x0 - 24, y0 + H + 24]]);
    const holeAt = (x, y) => { let i = L.holes.findIndex(h => Math.hypot(h.x - x, h.y - y) < 6); if (i < 0) { L.holes.push({ x, y }); i = L.holes.length - 1; } return i; };
    for (let layer = 0; layer < o.genLayers; layer++) {
      for (let r = 0; r < o.genRows; r++) for (let c = 0; c < o.genCols; c++) {
        if (rnd() > o.genDensity) continue;
        const span = rnd() < 0.35 ? 2 : 1, horiz = rnd() < 0.5;
        const cw = horiz ? span : 1, ch = horiz ? 1 : span;
        if (c + cw > o.genCols || r + ch > o.genRows) continue;
        const off = layer * 0.5;
        const px = x0 + (c + off * (layer % 2)) * (o.genPlateW + o.genGap), py = y0 + (r + off * (layer % 2)) * (o.genPlateH + o.genGap);
        const pw = cw * (o.genPlateW + o.genGap) - o.genGap, ph = ch * (o.genPlateH + o.genGap) - o.genGap;
        if (px + pw > x0 + W + 4 || py + ph > y0 + H + 4) continue;
        const poly = [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]];
        const n = Math.max(1, Math.min(o.screwsPerPlate, span * 2));
        const hs = [];
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : 0.22 + 0.56 * k / (n - 1);
          hs.push(holeAt(horiz ? px + pw * t : px + pw / 2, horiz ? py + ph / 2 : py + ph * t));
        }
        L.plates.push({ poly, layer, holes: [...new Set(hs)], radius: 12 });
      }
    }
    if (!L.plates.length) continue;
    L.plates.forEach(p => p.holes.forEach(h => { if (!L.screws.some(s => s.hole === h)) L.screws.push({ hole: h }); }));
    // 空孔：放在空白处
    let tries2 = 0, made = 0;
    while (made < o.emptyHoles && tries2++ < 400) {
      const x = x0 + rnd() * W, y = y0 + rnd() * H;
      if (L.holes.some(h => Math.hypot(h.x - x, h.y - y) < 46)) continue;
      L.holes.push({ x, y }); made++;
    }
    // 把空孔设为不被覆盖：若被板覆盖则无效，交给求解器判定
    const st = initState(L);
    if (solve(L, st, 6000)) return L;
  }
  return referenceLevel();
}
