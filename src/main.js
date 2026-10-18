import { levelFromImage, defaultShapeCanvas, buildOnce } from './shapegen.js';
import { newBody, toWorld as bodyToWorld } from './physics.js';
import { genStats, createSim, simTick, simEvent, stateFromBodies, visBlockedBy, solvePhys, forceFreeze, DT, LIVE_CAP } from './sim.js';
import { referenceLevel, generateLevel, initState, holeUsable, screwFree, applyMove, pickHole, solve, done, setBlocking, platePins, coverInfo, liftOut, cancelLift, setPhysicsRules, setSwingAngle, poseFromXf, setPlatePose, poseDiff, setRest, clearRest, setShaftR, pointInPoly, ALIGN_TOL, EDGE_TOL } from './level.js';
import { toLocal as bodyToLocal } from './physics.js';
import { GROUPS, DEFS, loadSettings, saveSettings, migrate, exportJSON } from './settings.js';
import { drawBackground, drawBase, plateSprite, drawHole, drawScrew } from './render.js';
import { Sfx } from './audio.js';
import BG_REF from './bg_ref.jpg';
import { createAERecorder } from './ae/recorder.js';
import { export3D } from './export3d/export3d.js';
const bgImg = new Image(); bgImg.src = BG_REF; bgImg.onload = () => { if (L) rebuild(); };

let S = loadSettings();
setBlocking(S.screwBlock);
const cv = document.getElementById('stage'); let ctx = cv.getContext('2d');
const sfx = new Sfx();
let sim = null, physAcc = 0, syncedSnap = null, vHole = [], pend = [], L, st, plateVis, screwVis, sprites, bgCanvas, baseCanvas, active = null, lastVacated = -1, autoRunning = false, autoToken = 0, endShownAt = 0, finishedAt = 0;
const hand = { x: 820, y: 1450, press: 0, img: null, visible: false };
const ripples = [];
const now = () => performance.now();
const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
const easeIO = t => t < 0 ? 0 : t > 1 ? 1 : t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const status = (t) => { document.getElementById('status').textContent = t; };

// ---------- 坐标 ----------
function view() {
  const k = cv.width / 720, oy = (cv.height - 1280 * k) / 2;
  const b = S.boardScale;
  return { k, oy, b, tx: 360 + S.boardOffX - 360 * b, ty: 640 + S.boardOffY - 640 * b };
}
function toWorld(px, py) { const v = view(); const x = px / v.k, y = (py - v.oy) / v.k; return { dx: x, dy: y, x: (x - v.tx) / v.b, y: (y - v.ty) / v.b }; }
function worldToDesign(x, y) { const v = view(); return { x: x * v.b + v.tx, y: y * v.b + v.ty }; }

// ---------- 关卡 ----------
// v1.3 图形关卡：图片缓存（异步加载完成后重新开局）
const shapeCache = { src: null, img: null };
function imageLevel() {
  if (!S.shapeImg) return levelFromImage(defaultShapeCanvas(), S, S.shapeSeed);
  if (shapeCache.src !== S.shapeImg) { shapeCache.src = S.shapeImg; shapeCache.img = null; const im = new Image(); im.onload = () => { if (shapeCache.src === im.src || shapeCache.src === S.shapeImg) { shapeCache.img = im; newGameUI(); } }; im.src = S.shapeImg; }
  // v1.7.3：图片还在加载 → 不先生成默认图形关卡（以前要多花一整轮生成时间），保留当前关卡，加载完成后 newGame
  if (!shapeCache.img) return L ? null : referenceLevel();
  return levelFromImage(shapeCache.img, S, S.shapeSeed);
}
let genToken = 0;
function newGame() {
  genToken++;
  setBlocking(S.screwBlock); setPhysicsRules({ swingMax: S.swingMax, releaseAt: S.releaseAt }); setShaftR(S.collShaftR ?? 6);
  autoToken++; autoRunning = false; updAutoBtn();
  const t0 = performance.now();
  const Lnew = S.level === 'random' ? generateLevel(S, S.seed) : S.level === 'image' ? imageLevel() : referenceLevel();
  if (!Lnew) return;
  startLevel(Lnew);
  const ms = performance.now() - t0; if (genBusy) { genBusy = false; toastHide(); } if (ms > 1500 && S.level !== 'reference') toast(`关卡已生成（${(ms / 1000).toFixed(1)}s${Lnew.attempts ? '，尝试 ' + Lnew.attempts + ' 次' : ''}）`);
}
// v1.7.3：界面触发的重新生成（随机/图形关卡要做物理求解校验，可能要几秒）：先显示进度提示，等它画出来再同步生成；期间又调用 newGame() 则作废
let genBusy = false;
function newGameUI() {
  if (S.level === 'reference' || (S.level === 'image' && S.shapeImg && !shapeCache.img)) return newGame(); // 图片未加载：只发起加载（onload 再走这里）
  const tok = ++genToken; genBusy = true;
  toast(S.level === 'image' ? '正在生成图形关卡（求解校验中，约 5–20 秒）…' : '正在生成随机关卡（求解校验中）…', 0);
  requestAnimationFrame(() => setTimeout(() => { if (tok === genToken) newGame(); }, 30));
}
// v1.7.2：测试钩子 __game.loadLevel(L) 也走这里（自定义关卡）
function startLevel(Lnew) {
  L = Lnew;
  st = initState(L); active = null; lastVacated = -1; finishedAt = 0; endShownAt = 0;
  plateVis = null; vHole = st.screwHole.slice(); pend = [];
  screwVis = L.screws.map((s, i) => ({ ang: (i * 1.7) % (Math.PI / 2) - 0.3, lift: 0, sc: 1, x: 0, y: 0, anim: null }));
  rebuild();
  // v1.4.2：与麻将工具一致——打开页面/重新开始/自动通关都不再自动开始 AE 记录。
  // 记录中重新开局：记录保持进行（按钮继续计时），时间轴从新关卡重新开始（AE 工程只描述一个关卡）
  if (aeActive()) { aeRec.start(); updateAEButtons(); }
  status(`板 ${L.plates.length} 块，螺丝 ${L.screws.length} 颗，孔 ${L.holes.length} 个`);
}
function rebuild() {
  cv.width = S.canvasW; cv.height = S.canvasH;
  const dpr = view().k * S.boardScale * Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  bgCanvas = document.createElement('canvas'); bgCanvas.width = cv.width; bgCanvas.height = cv.height;
  drawBackground(bgCanvas, S, cv.width, cv.height, view().k, bgImg);
  sprites = L.plates.map((p, i) => plateSprite(p, S, i, Math.max(1, dpr), p.holes.map(h => [L.holes[h].x, L.holes[h].y])));
  if (!plateVis || plateVis.length !== L.plates.length) {
    // v1.7.2：物理 = sim.js 固定步长模拟（与求解器预测同一套代码）；板位姿原点 = 贴图中心（求解器模板也用它：p._C）
    L.plates.forEach((p, i) => { p._C = [sprites[i].x + sprites[i].w / 2, sprites[i].y + sprites[i].h / 2]; }); L._simCache = null;
    plateVis = L.plates.map((p, i) => newBody(p.poly, p._C, p.holes.map(h => [L.holes[h].x, L.holes[h].y])));
    sim = createSim(L, S, plateVis); vHole = sim.vHole; physAcc = 0; syncedSnap = null; syncLogic();
  }
  baseCanvas = document.createElement('canvas'); baseCanvas.width = Math.ceil(720 * dpr); baseCanvas.height = Math.ceil(1280 * dpr);
  const bc = baseCanvas.getContext('2d'); bc.scale(dpr, dpr); drawBase(bc, L, S);
}

// ---------- 动画 ----------
// 孔的世界坐标：属于被摆动/移位的板时随板变换
// v1.5：可放螺丝的孔都在底板上，位置固定（板自己的孔随板移动，只用于绘制）
function holeWorld(hi) { const h = L.holes[hi]; return [h.x, h.y]; }
// 画面上此刻是否有板压住底板孔 hi：逻辑上已掉落/正在下落的板仍在画面里时，只要材料盖住该孔就不能放（下落板不提供任何孔位）
function visBlocked(hi) { return visBlockedBy(L, plateVis, st, hi); }
// 物理静止（且没有螺丝在途）时：逻辑状态 = 物理状态（释放/摆动位姿/被托住 + 支撑者）
function syncLogic() { const d = stateFromBodies(L, plateVis, sim.vHole); st.removed = d.removed; st.swing = d.swing; st.rest = d.rest; st.npins = d.npins; syncedSnap = sim.snap; }
function holeTargetable(hi) { return holeUsable(L, st, hi) && !visBlocked(hi); }
function screwPos(si) { return holeWorld(st.screwHole[si]); }
// 视觉固定：vHole[si] = 该螺丝视觉上“坐在”的孔（-1 = 不固定）。参考：拧走的螺丝在目标孔落座后 releaseDelay 才释放原板
function schedPin(si, hi, t) { pend = pend.filter(q => q.si !== si); pend.push({ si, hi, t }); }
function liftScrew(si) {
  const v = screwVis[si], t0 = now(); const [x, y] = screwPos(si);
  v.x = x; v.y = y; v.anim = { k: 'lift', t0, a0: v.ang, l0: v.lift };
  sfx.ratchet(S.liftDur / 1000, S, true);
  liftOut(L, st, si);
  if (S.releaseAt === 'lift') schedPin(si, -1, t0 + S.liftDur + S.releaseDelay);
}
function dropBack(si) { cancelLift(st, si); pend = pend.filter(q => q.si !== si); simEvent(sim, si, st.screwHole[si]); const v = screwVis[si]; v.anim = { k: 'down', t0: now(), a0: v.ang, l0: v.lift }; sfx.ratchet(S.screwInDur / 1000, S, false); }
function sendScrew(si, hi) {
  const v = screwVis[si], from = screwPos(si), to = [L.holes[hi].x, L.holes[hi].y];
  const vac = st.screwHole[si];
  const to2 = holeWorld(hi); to[0] = to2[0]; to[1] = to2[1];
  const fell = applyMove(L, st, si, hi); lastVacated = vac;
  const t0 = now();
  v.anim = { k: 'fly', t0, from, to, a0: v.ang, l0: v.lift || S.liftH, sc0: v.sc, hi };
  return fell;
}
function step(t, dt) {
  screwVis.forEach((v, si) => {
    const a = v.anim; if (!a) return;
    if (a.k === 'lift') {
      const p = Math.min(1, (t - a.t0) / S.liftDur), e = ease(p);
      v.lift = a.l0 + (S.liftH - a.l0) * e; v.sc = 1 + (S.liftScale - 1) * e; v.ang = a.a0 - S.unscrewTurns * Math.PI * 2 * e;
      if (p >= 1) { v.anim = { k: 'hover', t0: t, base: v.lift }; }
    } else if (a.k === 'hover') {
      v.lift = a.base + Math.sin((t - a.t0) / 180) * S.hoverBob;
    } else if (a.k === 'down') {
      const p = Math.min(1, (t - a.t0) / S.screwInDur), e = easeIO(p);
      v.lift = a.l0 * (1 - e); v.sc = S.liftScale + (1 - S.liftScale) * e; v.ang = a.a0 + S.screwInTurns * Math.PI * 2 * e;
      if (p >= 1) { v.anim = null; v.lift = 0; v.sc = 1; }
    } else if (a.k === 'fly') {
      const p = Math.min(1, (t - a.t0) / S.flyDur), e = easeIO(p);
      const mx = (a.from[0] + a.to[0]) / 2, my = (a.from[1] + a.to[1]) / 2 - S.arcBend;
      v.x = (1 - e) * (1 - e) * a.from[0] + 2 * (1 - e) * e * mx + e * e * a.to[0];
      v.y = (1 - e) * (1 - e) * a.from[1] + 2 * (1 - e) * e * my + e * e * a.to[1];
      v.lift = a.l0;
      if (p >= 1) { v.anim = { k: 'in', t0: t, a0: v.ang, l0: v.lift, hi: a.hi }; sfx.ratchet(S.screwInDur / 1000, S, false); }
    } else if (a.k === 'in') {
      const p = Math.min(1, (t - a.t0) / S.screwInDur), e = easeIO(p);
      v.lift = a.l0 * (1 - e); v.ang = a.a0 + S.screwInTurns * Math.PI * 2 * e;
      v.sc = S.liftScale + (1 - S.liftScale) * e;
      if (p >= 1) { v.anim = { k: 'settle', t0: t }; sfx.thunk(S); schedPin(si, a.hi, t + S.releaseDelay); }
    } else if (a.k === 'settle') {
      const p = Math.min(1, (t - a.t0) / 160); v.sc = 1 - S.settle * Math.sin(Math.PI * p) ; v.lift = 0;
      if (p >= 1) { v.anim = null; v.sc = 1; }
    }
  });
  // 物理里已提前判定离开的板：画面上按抛体继续落出屏幕（不再参与碰撞）
  plateVis.forEach(b => { if (!b.out || b.s !== 'gone') { b.out = null; return; } const o = b.out; o.vy += S.gravity * dt; b.dx += o.vx * dt; b.dy += o.vy * dt; b.ang += o.om * dt; if (b.dy > 1600 || b.C[1] + b.dy > 1750) b.out = null; });
  pend = pend.filter(q => { if (t >= q.t) { simEvent(sim, q.si, q.hi); return false; } return true; });
  // v1.7.2：固定步长 DT 累加器（与渲染帧率无关）；物理只在事件之后运行到全部静止，然后冻结（预测 == 实际）
  if (!sim.frozen) {
    physAcc += dt; let n = 0;
    while (!sim.frozen && physAcc >= DT - 1e-9 && n++ < 40) { physAcc -= DT; simTick(sim).forEach(ev => { if (ev === 'fall') sfx.fall(S); }); }
    if (!sim.frozen && sim.t > LIVE_CAP) forceFreeze(sim);
  } else physAcc = 0;
  if (sim.frozen && sim.snap !== syncedSnap && st.screwHole.every((h, si) => h === sim.vHole[si])) syncLogic();
  if (!finishedAt && done(L, st) && plateVis.every(p => p.s === 'gone')) { finishedAt = t; onFinish(); }
}
const busy = () => screwVis.some(v => v.anim && v.anim.k !== 'hover');
const physBusy = () => sim && !sim.frozen;

// ---------- 绘制 ----------
const visOnG = (pi) => plateVis[pi].s === 'on' || plateVis[pi].s === 'swing';
function screwLayer(si) { const h = st.screwHole[si]; let lay = -1; L.plates.forEach((p, pi) => { if (visOnG(pi) && p.holes.includes(h)) lay = Math.max(lay, p.layer); }); return lay; }
function draw(t) {
  const v = view();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(v.k * v.b, 0, 0, v.k * v.b, v.k * v.tx, v.oy + v.k * v.ty);
  ctx.drawImage(baseCanvas, 0, 0, 720, 1280);
  L.holes.forEach(h => drawHole(ctx, h.x, h.y, S));
  const visOn = visOnG;
  const moving = [];
  const drawS = (si) => { const sv = screwVis[si]; if (sv.anim) { moving.push(si); return; } const [x, y] = screwPos(si); drawScrew(ctx, x, y, S, sv.ang, 0, sv.sc); };
  // 飞行中的螺丝：其原板上的位置（逻辑已移走）在旧板上应显示为孔
  const maxLayer = Math.max(0, ...L.plates.map(p => p.layer));
  for (let lay = -1; lay <= maxLayer; lay++) {
    if (lay >= 0) L.plates.forEach((p, pi) => {
      if (p.layer !== lay || !visOn(pi)) return;
      const sp = sprites[pi], b = plateVis[pi]; ctx.save(); ctx.globalAlpha = 1;
      if (b.posed) { ctx.translate(b.C[0] + b.dx, b.C[1] + b.dy); ctx.rotate(b.ang); ctx.translate(-b.C[0], -b.C[1]); }
      ctx.shadowColor = `rgba(20,10,30,${S.plateShadow})`; ctx.shadowBlur = 6 * v.k; ctx.shadowOffsetY = 3 * v.k;
      ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h); ctx.shadowColor = 'transparent';
      ctx.restore();
    });
    L.screws.forEach((_, si) => { if (screwLayer(si) === lay) drawS(si); });
  }
  plateVis.forEach((pv, pi) => {
    if (pv.s !== 'fall' && !pv.out) return; const sp = sprites[pi], p = L.plates[pi];
    ctx.save(); if (S.fallFade) ctx.globalAlpha = Math.max(0, 1 - pv.dy / 800);
    ctx.translate(pv.C[0] + pv.dx, pv.C[1] + pv.dy); ctx.rotate(pv.ang); ctx.translate(-pv.C[0], -pv.C[1]);
    ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h); ctx.restore();
  });
  moving.forEach(si => { const sv = screwVis[si]; drawScrew(ctx, sv.x, sv.y, S, sv.ang, sv.lift, sv.sc); });
  if (S.debugPins) drawPinDebug();
  // 设计坐标层（文字、波纹、手指）
  ctx.setTransform(v.k, 0, 0, v.k, 0, v.oy);
  ripples.forEach(r => { const p = (t - r.t0) / 350; if (p > 1) return; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + 30 * p, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 3; ctx.stroke(); });
  while (ripples.length && t - ripples[0].t0 > 400) ripples.shift();
  drawTexts();
  if (finishedAt && S.endCard && t - finishedAt > S.endDelay) drawEnd(t);
  drawHand();
}
// 调试叠加：每块未掉落的板 → 固定它的螺丝连线（红=别的板的螺丝贯穿挡住；绿=自己的螺丝）
function drawPinDebug() {
  ctx.save(); ctx.lineWidth = 2; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  L.plates.forEach((p, pi) => {
    if (st.removed.has(pi)) return;
    const cx = p.poly.reduce((a, q) => a + q[0], 0) / p.poly.length, cy = p.poly.reduce((a, q) => a + q[1], 0) / p.poly.length;
    const pins = platePins(L, st, pi);
    pins.forEach(si => { const h = L.holes[st.screwHole[si]], own = p.holes.includes(st.screwHole[si]); ctx.strokeStyle = own ? 'rgba(40,220,90,.85)' : 'rgba(255,40,40,.95)'; ctx.setLineDash(own ? [] : [6, 4]); ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(cx, cy); ctx.stroke(); });
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill(); ctx.fillStyle = pins.some(si => !p.holes.includes(st.screwHole[si])) ? '#ff6060' : '#fff'; ctx.fillText(pins.length, cx, cy);
  });
  ctx.restore();
}
function drawTexts() {
  ctx.save(); ctx.globalAlpha = S.textOpacity; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3;
  if (S.discShow) { ctx.font = `bold ${S.discSize}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(S.discText, 360, 1280 - S.discY); }
  if (S.vertShow) {
    ctx.font = `${S.vertSize}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const chars = [...S.vertText], h = chars.length * S.vertSize * 1.05; chars.forEach((c, i) => ctx.fillText(c, 720 - S.vertSize * 0.8, 640 - h / 2 + i * S.vertSize * 1.05));
  }
  ctx.restore();
}
function endAlpha(t) { return finishedAt && S.endCard && t - finishedAt > S.endDelay ? Math.min(1, (t - finishedAt - S.endDelay) / 400) : 0; }
function withCtx(g, fn) { const save = ctx; ctx = g; try { fn(); } finally { ctx = save; } }
function drawEnd(t, pv, noDim) {
  const p = pv != null ? pv : endAlpha(t);
  ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = 'rgba(0,0,0,.55)'; if (!noDim) ctx.fillRect(0, -200, 720, 1700);
  ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.roundRect(160, 600, 400, 100, 50); ctx.fill();
  ctx.fillStyle = '#4a2a00'; ctx.font = 'bold 34px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.endTitle, 360, 650);
  ctx.restore();
}
// 手指大小 = 画面宽比例（与麻将工具 handSize 一致）
function handScaleOf() { return hand.img ? S.handSize * 720 / hand.img.width : 1; }
const handHiddenByEnd = () => !S.endCardHand && endAlpha(now()) > 0;
function handState() { if (!S.handShow || !hand.img || !hand.visible || handHiddenByEnd()) return null; return { x: hand.x, y: hand.y, s: handScaleOf() * (1 - S.pressDepth * hand.press) }; }
function drawHand() {
  if (!S.handShow || !hand.img || !hand.visible || handHiddenByEnd()) return;
  const im = hand.img, sc = handScaleOf() * (1 - S.pressDepth * hand.press), w = im.width * sc, h = im.height * sc;
  ctx.drawImage(im, hand.x - S.handAnchorX * w, hand.y - S.handAnchorY * h, w, h);
}

// ---------- 交互 ----------
function hitScrew(x, y) { let best = -1, bd = S.screwSize * 0.65; st.screwHole.forEach((h, si) => { const hw = holeWorld(h), d = Math.hypot(hw[0] - x, hw[1] - y); if (d < bd && screwFree(L, st, si) && !visBlocked(h)) { bd = d; best = si; } }); return best; }
function hitHole(x, y) { let best = -1, bd = Math.max(S.holeSize, S.screwSize) * 0.8; L.holes.forEach((h, hi) => { const hw = holeWorld(hi), d = Math.hypot(hw[0] - x, hw[1] - y); if (d < bd && holeTargetable(hi)) { bd = d; best = hi; } }); return best; }
function tapAt(px, py) { // 设计坐标
  sfx.resume();
  const v = view(), w = { x: (px - v.tx) / v.b, y: (py - v.ty) / v.b };
  if (S.tapRipple) ripples.push({ x: px, y: py, t0: now() });
  if (busy() || finishedAt) return false;
  const si = hitScrew(w.x, w.y);
  if (S.moveRule === 'tap2') {
    if (active !== null) {
      const hi = hitHole(w.x, w.y);
      if (hi >= 0) { sendScrew(active, hi); active = null; return true; }
      if (si === active) { dropBack(active); active = null; return true; }
      dropBack(active); active = null;
      if (si >= 0) { setTimeout(() => { if (!busy()) { active = si; liftScrew(si); } }, S.screwInDur + 10); }
      return true;
    }
    if (si >= 0) { active = si; liftScrew(si); return true; }
    return false;
  }
  if (si < 0) return false;
  const hi = pickHole(L, st, si, S.moveRule, lastVacated);
  if (hi < 0) { status('没有可用空孔'); return false; }
  liftScrew(si); const ok = si;
  setTimeout(() => sendScrew(ok, hi), S.liftDur + 40);
  return true;
}
function evtPos(e) { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * cv.width, py = (e.clientY - r.top) / r.height * cv.height; const v = view(); return { x: px / v.k, y: (py - v.oy) / v.k }; }
cv.addEventListener('pointerdown', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; if (S.pressEnabled) pressHand(); tapAt(p.x, p.y); });
cv.addEventListener('pointermove', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; });
cv.addEventListener('pointerleave', () => { if (!autoRunning) hand.visible = false; });
function pressHand() { const t0 = now(); hand.pressT0 = t0; }
function updPress(t) { if (!S.pressEnabled || hand.pressT0 == null) { hand.press = 0; return; } const p = (t - hand.pressT0) / 180; hand.press = p < 0 || p > 1 ? 0 : Math.sin(Math.PI * p); }

// ---------- 自动通关 ----------
const wait = (ms, tok) => new Promise((res, rej) => setTimeout(() => tok === autoToken ? res() : rej('stop'), ms / S.autoSpeed));
const rr = (a, b) => a + Math.random() * Math.max(0, b - a);
async function moveHand(tx, ty, tok) {
  const x0 = hand.x, y0 = hand.y, dur = rr(S.moveMin, S.moveMax) / S.autoSpeed, t0 = now();
  const cx = (x0 + tx) / 2 + (Math.random() - 0.3) * 60, cy = (y0 + ty) / 2 + 40 + Math.random() * 40;
  while (true) {
    if (tok !== autoToken) throw 'stop';
    const p = Math.min(1, (now() - t0) / dur), e = easeIO(p);
    hand.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * tx; hand.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * ty;
    if (p >= 1) return; await new Promise(r => requestAnimationFrame(r));
  }
}
async function tapWorld(wx, wy, tok) {
  const d = worldToDesign(wx, wy), j = S.jitter;
  const x = d.x + (Math.random() - 0.5) * j, y = d.y + (Math.random() - 0.5) * j;
  await moveHand(x, y, tok); if (S.pressEnabled) pressHand(); await wait(60, tok); tapAt(d.x, d.y); await wait(90, tok);
}
async function waitIdle(tok) { while (busy() || pend.length) { if (tok !== autoToken) throw 'stop'; await new Promise(r => requestAnimationFrame(r)); } }
async function autoSolve() {
  if (autoRunning) { autoToken++; autoRunning = false; hand.visible = false; updAutoBtn(); return; }
  if (finishedAt || done(L, st)) newGame();
  if (active !== null) { dropBack(active); active = null; }
  const planNow = () => sim.frozen ? solvePhys(L, S, sim.snap, { timeMs: S.autoSolveMs ?? 12000 }) : null;
  const plan = planNow(); if (!plan) { status('当前局面无解，请重新开始'); return; }
  const tok = ++autoToken; autoRunning = true; updAutoBtn(); sfx.resume();
  hand.x = 820; hand.y = 1450; hand.visible = true;
  if (S.autoRec && !rec) startRec();
  sfx.playBgm();
  try {
    await wait(S.autoStartDelay, tok);
    // v1.7：物理决定画面（摆动板可能停在更小角度、下落板可能被托住一会儿）→ 每步前确认计划仍合法，否则从当前状态重新求解
    // v1.7.2：计划里每一步都带物理预测的结果快照；每步结束（物理静止）后与实际快照比较，不一致（不应发生）就从实际状态重新求解
    let plan2 = plan.slice(), tries = 0, expect = null; window.__autoStats = { replan: 0, abort: 0, dev: 0, nudge: 0, mispredict: 0, moves: 0 };
    const legal = ([si, hi]) => st.screwHole[si] >= 0 && screwFree(L, st, si) && holeUsable(L, st, hi) && !visBlocked(hi) && !visBlocked(st.screwHole[si]);
    const waitUntil = async (f, ms) => { const tw = now(); while (!f() && now() - tw < ms) { if (tok !== autoToken) throw 'stop'; await new Promise(r => requestAnimationFrame(r)); } };
    while (!done(L, st) || !plateVis.every(b => b.s === 'gone')) {
      await waitIdle(tok); await waitUntil(() => !physBusy(), (LIVE_CAP + 1) * 1000); if (sim.frozen && sim.snap !== syncedSnap) syncLogic();
      if (expect && JSON.stringify(expect) !== JSON.stringify(sim.snap)) { window.__autoStats.mispredict++; plan2 = []; if (window.__DBGP) console.log('MISPREDICT', JSON.stringify(expect.bodies.map((r, i) => [i, r.s, +r.dx.toFixed(2), +r.dy.toFixed(2)]).filter((r, i) => JSON.stringify(expect.bodies[i]) !== JSON.stringify(sim.snap.bodies[i]))), JSON.stringify(sim.snap.bodies.map((r, i) => [i, r.s, +r.dx.toFixed(2), +r.dy.toFixed(2)]).filter((r, i) => JSON.stringify(expect.bodies[i]) !== JSON.stringify(sim.snap.bodies[i])))); }
      expect = null;
      if (done(L, st) && plateVis.every(b => b.s === 'gone')) break;
      if (!plan2.length || !legal(plan2[0])) {
        plan2 = planNow() || []; window.__autoStats.replan++;
        if (!plan2.length) { if (++tries > 3) { status('当前局面无解，请重新开始'); break; } await wait(250, tok); continue; }
      }
      tries = 0;
      const [si, hi, exp] = plan2.shift(); expect = exp; window.__autoStats.moves++;
      await waitUntil(() => !visBlocked(st.screwHole[si]), 4000);
      const w0 = holeWorld(st.screwHole[si]), w1 = holeWorld(hi), h0 = { x: w0[0], y: w0[1] }, h1 = { x: w1[0], y: w1[1] };
      if (S.moveRule === 'tap2') {
        await tapWorld(h0.x, h0.y, tok); await waitIdle(tok); await wait(S.autoSelectGap, tok);
        await waitUntil(() => holeTargetable(hi), 4000);
        // 目标孔仍被画面上的板挡住：不要点（会落到旁边别的孔、偏离计划），把螺丝放回、重新规划
        if (!holeTargetable(hi) || active !== si) { if (active !== null) await tapWorld(h0.x, h0.y, tok); window.__autoStats.abort++; plan2 = []; expect = null; continue; }
        await tapWorld(h1.x, h1.y, tok);
        if (st.screwHole[si] !== hi) { window.__autoStats.dev++; expect = null; }
      } else {
        const save = S.moveRule; S.moveRule = 'tap2';
        await tapWorld(h0.x, h0.y, tok); await waitIdle(tok); await tapWorld(h1.x, h1.y, tok); S.moveRule = save;
      }
      await wait(rr(S.delayMin, S.delayMax) + (Math.random() < S.thinkChance ? Math.random() * S.thinkMax : 0), tok);
    }
    await waitIdle(tok);
    if (S.handRest === 'br') await moveHand(820, 1450, tok); hand.visible = false;
  } catch (e) { if (e !== 'stop') console.error(e); }
  if (tok === autoToken) { autoRunning = false; updAutoBtn(); }
}
function onFinish() {
  status('通关！'); window.__finished = true;
  if (rec && S.autoStop) setTimeout(stopRec, S.tailSec * 1000 + (S.endCard ? S.endDelay : 0));
}
function updAutoBtn() { const b = document.getElementById('btnAuto'); if (b) { b.textContent = autoRunning ? '■ 停止' : '▶ 自动通关'; b.classList.toggle('on', autoRunning); } }

// ---------- 录制 ----------
let rec = null, recChunks = [], recT0 = 0;
function pickMime() {
  const mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'], webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const list = S.recFormat === 'webm' ? webm : S.recFormat === 'mp4' ? mp4.concat(webm) : mp4.concat(webm);
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function startRec() {
  if (!window.MediaRecorder) { status('浏览器不支持录制'); return; }
  sfx.ensure();
  const vs = cv.captureStream(S.recFps), tracks = [...vs.getVideoTracks()];
  if (sfx.recDest) tracks.push(...sfx.recDest.stream.getAudioTracks());
  const mime = pickMime();
  rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime || undefined, videoBitsPerSecond: S.recBitrate * 1e6 });
  recChunks = []; rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recChunks, { type }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `screw_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`; a.textContent = `⬇ ${a.download} (${(blob.size / 1e6).toFixed(1)}MB)`;
    document.getElementById('recList').prepend(a); window.__lastRec = { size: blob.size, type }; rec = null; updRecBtn();
    // 与麻将工具一致：录制视频时同步记录 AE 时间轴，停止录制后自动导出
    if (aeByRec && aeActive()) aeStopAndExport().catch(e => console.error(e));
    aeByRec = false;
  };
  rec.start(250); recT0 = now(); updRecBtn(); aeByRec = false; if (S.aeWithRec && !aeActive()) { recStart(); aeByRec = true; }
}
function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
function updRecBtn() { const b = document.getElementById('btnRec'); b.textContent = rec ? '■ 停止录制' : '⏺ 开始录制'; b.classList.toggle('on', !!rec); }

// ---------- AE / 3D 导出 ----------
const aeRec = createAERecorder({
  sfx, screwLayer, holeWorld, handState, endAlpha, coverInfo,
  env: () => ({ L, st, S, plateVis, screwVis, view, sprites, bgCanvas, baseCanvas, canvas: cv, handImg: hand.img }),
  drawTextsTo: (g) => withCtx(g, drawTexts), drawEndTo: (g, p) => withCtx(g, () => drawEnd(0, p)),
});
let recClosed = false, aeLastRec = null, aeByRec = false;
function recStart() { aeRec.start(); recClosed = false; updateAEButtons(); toast('开始记录 AE 时间轴'); }
function aeActive() { return !!aeRec.rec && !recClosed; }
// 停止记录：本段成为“最近记录”（导出 AE / 3D 默认用它）
function aeStop() { const r = aeRec.rec; recClosed = true; updateAEButtons(); if (r && r.frames > 1) aeLastRec = r; return r && r.frames > 1 ? r : null; }
async function aeStopAndExport() { const r = aeStop(); if (!r) { toast('没有记录到内容'); return null; } return doExportAE(true, r); }
const curRec = () => aeActive() ? aeRec.rec : aeLastRec && aeLastRec.L === L ? aeLastRec : null; // 最近记录只对同一关卡有效（素材按当前关卡渲染）
function updateAEButtons() { const b = document.getElementById('btn_aeToggle'); if (!b) return; b.textContent = aeActive() ? `■ 停止并导出（${((now() - (aeRec.rec.t0 || now())) / 1000).toFixed(1)}s）` : '● 开始记录'; b.classList.toggle('on', aeActive()); }
const PANEL_ACTIONS = { aeToggle: () => aeActive() ? aeStopAndExport() : recStart(), aeExport: () => doExportAE(), export3d: () => doExport3D() };
function recTailDone(t) { return finishedAt && t - finishedAt > (S.endCard ? S.endDelay + 400 : 0) + Math.max(800, S.tailSec * 1000); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = `⬇ ${name} (${(blob.size / 1e6).toFixed(1)}MB)`; document.getElementById('recList').prepend(a); a.click(); }
async function doExportAE(save = true, rec = curRec()) {
  if (!rec) { toast('请先用“开始记录”记录一段（自动通关或手动游玩）'); return null; }
  status('正在生成 AE 工程…'); const r = await aeRec.exportZip(rec); window.__aeLast = r;
  if (save) download(r.blob, r.name); status(`AE 工程：${r.stats.layers} 图层，${r.stats.keys} 关键帧`); return r;
}
async function doExport3D(save = true, rec = curRec()) {
  if (!rec) { toast('请先用“开始记录”记录一段（自动通关或手动游玩）'); return null; }
  // 与麻将工具一致：3D 导出复用 AE 记录，按 3D 帧率逐帧烘焙、英文命名、同画布尺寸、混合+逐事件音频
  status('正在生成 3D 动画…'); const ae = await aeRec.exportZip(rec, { aeFps: String(+S.export3dFps || 30), aeSize: 'canvas', aeSampling: 'bake', aeNames: 'en', aeAudio: 'both' });
  const r = await export3D({ S, ae, env: { L, view: view(), sprites, bgCanvas, baseCanvas, handImg: hand.img, rec }, drawTextsTo: (g) => withCtx(g, drawTexts), drawEndTo: (g, p, nd) => withCtx(g, () => drawEnd(0, p, nd)) });
  window.__e3dLast = r; if (save) download(r.blob, r.name); status(`3D 动画：${r.stats.plates} 板，${r.stats.screws} 螺丝，${r.duration.toFixed(2)}s`); return r;
}

// ---------- 主循环 ----------
let lastT = now();
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  step(t, dt); updPress(t); draw(t);
  if (aeActive()) { if (recTailDone(t)) aeStop(); else aeRec.sample(t); if (t - (loop.aeBtnT || 0) > 250) { loop.aeBtnT = t; updateAEButtons(); } }
  if (rec) document.getElementById('recInfo').textContent = `录制中 ${((t - recT0) / 1000).toFixed(1)}s`; else document.getElementById('recInfo').textContent = '';
  requestAnimationFrame(loop);
}

// ---------- 设置面板 ----------
const REBUILD_KEYS = /^(canvas|bg|leaf|base|plate|outline|board)/, NEWGAME_KEYS = /^(level|seed|emptyHoles|screwsPerPlate|gen|screwBlock|shape|part|seamW|edgeInset|minPlateArea|img|screwEdgeMin|layerOverlap|plateSize|plateCount|plateTint|baseFill)/;
function applyChange(k) {
  if (k === 'shapeImg' && S.shapeImg) S.level = 'image';
  saveSettings(S); setPhysicsRules({ swingMax: S.swingMax, releaseAt: S.releaseAt });
  if (NEWGAME_KEYS.test(k)) newGameUI(); else if (REBUILD_KEYS.test(k)) rebuild();
  if (k === 'handImage') loadHand();
  if (k === 'bgm' || k === 'bgmVol') { if (k === 'bgm') sfx.setBgm(S.bgm, S.bgmVol); else if (sfx.bgmGain) sfx.bgmGain.gain.value = S.bgmVol; }
}
function loadHand() { if (!S.handImage) { hand.img = null; return; } const im = new Image(); im.onload = () => hand.img = im; im.src = S.handImage; }
function buildPanel() {
  const body = document.getElementById('panelBody'); body.innerHTML = '';
  GROUPS.forEach(([title, items], gi) => {
    const det = document.createElement('details'); if (gi < 1) det.open = true;
    det.innerHTML = `<summary>${title}</summary>`;
    items.forEach(([k, label, type, def, a, b, step]) => {
      const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<label title="${k}">${label}</label>`;
      if (type === 'range') {
        const r = document.createElement('input'); r.type = 'range'; r.min = a; r.max = b; r.step = step; r.value = S[k];
        const n = document.createElement('input'); n.type = 'number'; n.className = 'val'; n.step = step; n.value = S[k];
        r.oninput = () => { S[k] = +r.value; n.value = r.value; applyChange(k); }; n.onchange = () => { S[k] = +n.value; r.value = n.value; applyChange(k); };
        row.append(r, n); r.dataset.k = k;
      } else if (type === 'color') { const c = document.createElement('input'); c.type = 'color'; c.value = S[k]; c.oninput = () => { S[k] = c.value; applyChange(k); }; row.append(c); }
      else if (type === 'bool') { row.classList.add('t-switch'); const l = document.createElement('label'); l.className = 'switch'; l.innerHTML = `<input type="checkbox" class="switch-input" ${S[k] ? 'checked' : ''}><span class="slider"></span>`; l.querySelector('input').onchange = (e) => { S[k] = e.target.checked; applyChange(k); }; row.append(l); }
      else if (type === 'select') { const s = document.createElement('select'); a.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }); s.value = S[k]; s.onchange = () => { S[k] = s.value; applyChange(k); }; row.append(s); }
      else if (type === 'text') { const t = document.createElement('input'); t.type = 'text'; t.value = S[k]; t.oninput = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'button') { row.classList.add('t-btn'); const bt = document.createElement('button'); bt.id = 'btn' + k; bt.textContent = a; bt.onclick = () => Promise.resolve(PANEL_ACTIONS[def] && PANEL_ACTIONS[def]()).catch(e => { status('导出失败：' + e.message); console.error(e); }); row.append(bt); }
      else if (type === 'file') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = k === 'bgm' ? 'audio/*' : 'image/png,image/*'; f.id = 'file_' + k;
        f.onchange = () => { const file = f.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => { S[k] = fr.result; applyChange(k); }; fr.readAsDataURL(file); };
        const x = document.createElement('button'); x.textContent = '清除'; x.onclick = () => { S[k] = ''; f.value = ''; applyChange(k); };
        row.append(f, x);
      }
      det.append(row);
    });
    if (title.startsWith('手指')) det.insertAdjacentHTML('beforeend', '<div class="tip">上传透明背景PNG（手+触控笔），用锚点X/Y标定笔尖在图片中的相对位置。默认无内置手图。</div>');
    body.append(det);
  });
}
let toastT = 0;
function toast(t, dur = 1600) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); if (dur > 0) toastT = setTimeout(() => el.classList.remove('show'), dur); }
function toastHide() { clearTimeout(toastT); document.getElementById('toast').classList.remove('show'); }
document.getElementById('btnAuto').onclick = autoSolve;
document.getElementById('btnNew').onclick = newGame;
document.getElementById('btnShape').onclick = () => { S.shapeSeed = 1 + Math.floor(Math.random() * 9999); S.level = 'image'; saveSettings(S); buildPanel(); newGameUI(); };
document.getElementById('btnSeed').onclick = () => { S.seed = 1 + Math.floor(Math.random() * 9999); if (S.level !== 'random') S.level = 'random'; saveSettings(S); buildPanel(); newGameUI(); };
document.getElementById('btnRec').onclick = () => rec ? stopRec() : startRec();
document.getElementById('btnShot').onclick = () => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'screw_shot.png'; a.click(); };
document.getElementById('btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON(S)], { type: 'application/json' })); a.download = 'screw-tool-settings.json'; a.click(); };
document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = migrate(JSON.parse(t)); saveSettings(S); buildPanel(); loadHand(); sfx.setBgm(S.bgm, S.bgmVol); newGame(); toast('已导入设置'); }).catch(() => toast('导入失败')); };
document.getElementById('btnReset').onclick = () => { if (!confirm('恢复全部默认设置？')) return; S = { ...DEFS }; saveSettings(S); buildPanel(); loadHand(); newGame(); };
globalThis.__genStats = genStats;
window.__game = { buildOnce: (img, o, seed, ex) => buildOnce(img, o, seed, ex), levelFromImage: (img, o, seed) => levelFromImage(img, o || S, seed ?? S.shapeSeed), holeWorld: (hi) => holeWorld(hi), holeTargetable: (hi) => holeTargetable(hi), visBlocked: (hi) => visBlocked(hi), view: () => view(), tapXY: (x, y) => { const v = view(); return tapAt(x * v.b + v.tx, y * v.b + v.ty); }, tapHole: (hi) => { const w = holeWorld(hi), v = view(); return tapAt(w[0] * v.b + v.tx, w[1] * v.b + v.ty); }, get vHole() { return vHole; }, doExportAE, doExport3D, aeRec, aeStart: () => recStart(), aeStop: () => aeStop(), aeActive: () => aeActive(), get aeLastRec() { return aeLastRec; }, get mediaRec() { return rec; }, autoSolve, newGame, loadLevel: (Lnew) => { autoToken++; autoRunning = false; updAutoBtn(); startLevel(Lnew); }, get S() { return S; }, set(k, v) { S[k] = v; applyChange(k); buildPanel(); }, get st() { return st; }, get L() { return L; }, get plateVis() { return plateVis; }, get world() { return sim && sim.W; }, get sim() { return sim; }, solveNow: (o) => solvePhys(L, S, sim.snap, o || {}), lvl: { screwFree, holeUsable, platePins, solve }, physBusy: () => physBusy(), get screwVis() { return screwVis; }, startRec, stopRec };
buildPanel(); loadHand(); newGame(); if (S.bgm) sfx.setBgm(S.bgm, S.bgmVol);
requestAnimationFrame(loop);
