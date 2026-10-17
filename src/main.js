import { referenceLevel, generateLevel, initState, holeUsable, screwFree, applyMove, pickHole, solve, done } from './level.js';
import { GROUPS, DEFS, loadSettings, saveSettings, migrate, exportJSON } from './settings.js';
import { drawBackground, drawBase, plateSprite, drawHole, drawScrew } from './render.js';
import { Sfx } from './audio.js';

let S = loadSettings();
const cv = document.getElementById('stage'), ctx = cv.getContext('2d');
const sfx = new Sfx();
let L, st, plateVis, screwVis, sprites, bgCanvas, baseCanvas, active = null, lastVacated = -1, autoRunning = false, autoToken = 0, endShownAt = 0, finishedAt = 0;
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
function newGame() {
  autoToken++; autoRunning = false; updAutoBtn();
  L = S.level === 'random' ? generateLevel(S, S.seed) : referenceLevel();
  st = initState(L); active = null; lastVacated = -1; finishedAt = 0; endShownAt = 0;
  plateVis = L.plates.map(() => ({ s: 'on', y: 0, vy: 0, rot: 0, t0: 0 }));
  screwVis = L.screws.map((s, i) => ({ ang: (i * 1.7) % (Math.PI / 2) - 0.3, lift: 0, sc: 1, x: 0, y: 0, anim: null }));
  rebuild();
  status(`板 ${L.plates.length} 块，螺丝 ${L.screws.length} 颗，孔 ${L.holes.length} 个`);
}
function rebuild() {
  cv.width = S.canvasW; cv.height = S.canvasH;
  const dpr = view().k * S.boardScale;
  bgCanvas = document.createElement('canvas'); bgCanvas.width = cv.width; bgCanvas.height = cv.height;
  drawBackground(bgCanvas, S, cv.width, cv.height, view().k);
  sprites = L.plates.map((p, i) => plateSprite(p, S, i, Math.max(1, dpr)));
  baseCanvas = document.createElement('canvas'); baseCanvas.width = Math.ceil(720 * dpr); baseCanvas.height = Math.ceil(1280 * dpr);
  const bc = baseCanvas.getContext('2d'); bc.scale(dpr, dpr); drawBase(bc, L, S);
}

// ---------- 动画 ----------
function screwPos(si) { const h = L.holes[st.screwHole[si]]; return [h.x, h.y]; }
function liftScrew(si) {
  const v = screwVis[si], t0 = now(); const [x, y] = screwPos(si);
  v.x = x; v.y = y; v.anim = { k: 'lift', t0, a0: v.ang, l0: v.lift };
  sfx.ratchet(S.liftDur / 1000, S, true);
}
function dropBack(si) { const v = screwVis[si]; v.anim = { k: 'down', t0: now(), a0: v.ang, l0: v.lift }; sfx.ratchet(S.screwInDur / 1000, S, false); }
function sendScrew(si, hi) {
  const v = screwVis[si], from = screwPos(si), to = [L.holes[hi].x, L.holes[hi].y];
  const vac = st.screwHole[si];
  const fell = applyMove(L, st, si, hi); lastVacated = vac;
  const t0 = now();
  v.anim = { k: 'fly', t0, from, to, a0: v.ang, l0: v.lift || S.liftH, sc0: v.sc };
  const tLand = t0 + S.flyDur + S.screwInDur;
  fell.forEach(pi => { plateVis[pi].s = 'wait'; plateVis[pi].t0 = tLand + S.fallDelay; });
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
      if (p >= 1) { v.anim = { k: 'in', t0: t, a0: v.ang, l0: v.lift }; sfx.ratchet(S.screwInDur / 1000, S, false); }
    } else if (a.k === 'in') {
      const p = Math.min(1, (t - a.t0) / S.screwInDur), e = easeIO(p);
      v.lift = a.l0 * (1 - e); v.ang = a.a0 + S.screwInTurns * Math.PI * 2 * e;
      v.sc = S.liftScale + (1 - S.liftScale) * e;
      if (p >= 1) { v.anim = { k: 'settle', t0: t }; sfx.thunk(S); }
    } else if (a.k === 'settle') {
      const p = Math.min(1, (t - a.t0) / 160); v.sc = 1 - S.settle * Math.sin(Math.PI * p) ; v.lift = 0;
      if (p >= 1) { v.anim = null; v.sc = 1; }
    }
  });
  plateVis.forEach((pv, pi) => {
    if (pv.s === 'wait' && t >= pv.t0) { pv.s = 'falling'; pv.vy = 0; sfx.fall(S); }
    if (pv.s === 'falling') { pv.vy += S.gravity * dt; pv.y += pv.vy * dt; pv.rot += S.fallSpin * Math.PI / 180 * dt; if (pv.y > 1600) pv.s = 'gone'; }
  });
  if (!finishedAt && done(L, st) && plateVis.every(p => p.s === 'gone')) { finishedAt = t; onFinish(); }
}
const busy = () => screwVis.some(v => v.anim && v.anim.k !== 'hover');

// ---------- 绘制 ----------
function draw(t) {
  const v = view();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(v.k * v.b, 0, 0, v.k * v.b, v.k * v.tx, v.oy + v.k * v.ty);
  ctx.drawImage(baseCanvas, 0, 0, 720, 1280);
  L.holes.forEach(h => drawHole(ctx, h.x, h.y, S));
  const visOn = (pi) => plateVis[pi].s === 'on' || plateVis[pi].s === 'wait';
  const screwLayer = (si) => { const h = st.screwHole[si]; let lay = -1; L.plates.forEach((p, pi) => { if (visOn(pi) && p.holes.includes(h)) lay = Math.max(lay, p.layer); }); return lay; };
  const moving = [];
  const drawS = (si) => { const sv = screwVis[si]; if (sv.anim) { moving.push(si); return; } const [x, y] = screwPos(si); drawScrew(ctx, x, y, S, sv.ang, 0, sv.sc); };
  // 飞行中的螺丝：其原板上的位置（逻辑已移走）在旧板上应显示为孔
  const maxLayer = Math.max(0, ...L.plates.map(p => p.layer));
  for (let lay = -1; lay <= maxLayer; lay++) {
    if (lay >= 0) L.plates.forEach((p, pi) => {
      if (p.layer !== lay || !visOn(pi)) return;
      const sp = sprites[pi]; ctx.save(); ctx.globalAlpha = 1;
      ctx.shadowColor = `rgba(20,10,30,${S.plateShadow})`; ctx.shadowBlur = 6 * v.k; ctx.shadowOffsetY = 3 * v.k;
      ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h); ctx.restore();
      p.holes.forEach(h => drawHole(ctx, L.holes[h].x, L.holes[h].y, S));
    });
    L.screws.forEach((_, si) => { if (screwLayer(si) === lay) drawS(si); });
  }
  plateVis.forEach((pv, pi) => {
    if (pv.s !== 'falling') return; const sp = sprites[pi], p = L.plates[pi];
    ctx.save(); if (S.fallFade) ctx.globalAlpha = Math.max(0, 1 - pv.y / 800);
    const cx = sp.x + sp.w / 2, cy = sp.y + sp.h / 2; ctx.translate(cx, cy + pv.y); ctx.rotate(pv.rot); ctx.translate(-cx, -cy);
    ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h); p.holes.forEach(h => drawHole(ctx, L.holes[h].x, L.holes[h].y, S)); ctx.restore();
  });
  moving.forEach(si => { const sv = screwVis[si]; drawScrew(ctx, sv.x, sv.y, S, sv.ang, sv.lift, sv.sc); });
  // 设计坐标层（文字、波纹、手指）
  ctx.setTransform(v.k, 0, 0, v.k, 0, v.oy);
  ripples.forEach(r => { const p = (t - r.t0) / 350; if (p > 1) return; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + 30 * p, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 3; ctx.stroke(); });
  while (ripples.length && t - ripples[0].t0 > 400) ripples.shift();
  drawTexts();
  if (finishedAt && S.endCard && t - finishedAt > S.endDelay) drawEnd(t);
  drawHand();
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
function drawEnd(t) {
  const p = Math.min(1, (t - finishedAt - S.endDelay) / 400);
  ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, -200, 720, 1700);
  ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.roundRect(160, 600, 400, 100, 50); ctx.fill();
  ctx.fillStyle = '#4a2a00'; ctx.font = 'bold 34px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.endText, 360, 650);
  ctx.restore();
}
function drawHand() {
  if (!S.handShow || !hand.img || !hand.visible) return;
  const im = hand.img, sc = S.handScale * (1 - (1 - S.handPress) * hand.press), w = im.width * sc, h = im.height * sc;
  ctx.drawImage(im, hand.x - S.handAnchorX * w, hand.y - S.handAnchorY * h, w, h);
}

// ---------- 交互 ----------
function hitScrew(x, y) { let best = -1, bd = S.screwSize * 0.65; st.screwHole.forEach((h, si) => { const d = Math.hypot(L.holes[h].x - x, L.holes[h].y - y); if (d < bd && screwFree(L, st, si)) { bd = d; best = si; } }); return best; }
function hitHole(x, y) { let best = -1, bd = Math.max(S.holeSize, S.screwSize) * 0.8; L.holes.forEach((h, hi) => { const d = Math.hypot(h.x - x, h.y - y); if (d < bd && holeUsable(L, st, hi)) { bd = d; best = hi; } }); return best; }
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
cv.addEventListener('pointerdown', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; if (S.tapFx) pressHand(); tapAt(p.x, p.y); });
cv.addEventListener('pointermove', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; });
cv.addEventListener('pointerleave', () => { if (!autoRunning) hand.visible = false; });
function pressHand() { const t0 = now(); hand.pressT0 = t0; }
function updPress(t) { if (!S.tapFx || hand.pressT0 == null) { hand.press = 0; return; } const p = (t - hand.pressT0) / 180; hand.press = p < 0 || p > 1 ? 0 : Math.sin(Math.PI * p); }

// ---------- 自动通关 ----------
const wait = (ms, tok) => new Promise((res, rej) => setTimeout(() => tok === autoToken ? res() : rej('stop'), ms / S.autoSpeed));
const rr = (a, b) => a + Math.random() * Math.max(0, b - a);
async function moveHand(tx, ty, tok) {
  const x0 = hand.x, y0 = hand.y, dur = S.autoMoveDur / S.autoSpeed, t0 = now();
  const cx = (x0 + tx) / 2 + (Math.random() - 0.3) * 60, cy = (y0 + ty) / 2 + 40 + Math.random() * 40;
  while (true) {
    if (tok !== autoToken) throw 'stop';
    const p = Math.min(1, (now() - t0) / dur), e = easeIO(p);
    hand.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * tx; hand.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * ty;
    if (p >= 1) return; await new Promise(r => requestAnimationFrame(r));
  }
}
async function tapWorld(wx, wy, tok) {
  const d = worldToDesign(wx, wy), j = S.autoJitter;
  const x = d.x + (Math.random() - 0.5) * j, y = d.y + (Math.random() - 0.5) * j;
  await moveHand(x, y, tok); if (S.tapFx) pressHand(); await wait(60, tok); tapAt(d.x, d.y); await wait(90, tok);
}
async function waitIdle(tok) { while (busy() || plateVis.some(p => p.s === 'wait')) { if (tok !== autoToken) throw 'stop'; await new Promise(r => requestAnimationFrame(r)); } }
async function autoSolve() {
  if (autoRunning) { autoToken++; autoRunning = false; hand.visible = false; updAutoBtn(); return; }
  if (finishedAt || done(L, st)) newGame();
  if (active !== null) { dropBack(active); active = null; }
  const plan = solve(L, st); if (!plan) { status('当前局面无解，请重新开始'); return; }
  const tok = ++autoToken; autoRunning = true; updAutoBtn(); sfx.resume();
  hand.x = 820; hand.y = 1450; hand.visible = true;
  if (S.autoRec && !rec) startRec();
  sfx.playBgm();
  try {
    await wait(S.autoStartDelay, tok);
    for (const [si, hi] of plan) {
      await waitIdle(tok);
      const h0 = L.holes[st.screwHole[si]], h1 = L.holes[hi];
      if (S.moveRule === 'tap2') {
        await tapWorld(h0.x, h0.y, tok); await wait(S.autoSelectGap, tok);
        await tapWorld(h1.x, h1.y, tok);
      } else {
        const save = S.moveRule; S.moveRule = 'tap2';
        await tapWorld(h0.x, h0.y, tok); await wait(S.liftDur, tok); await tapWorld(h1.x, h1.y, tok); S.moveRule = save;
      }
      await wait(rr(S.autoStepMin, S.autoStepMax), tok);
    }
    await waitIdle(tok);
    if (S.handRest === 'br') await moveHand(820, 1450, tok); hand.visible = false;
  } catch (e) { if (e !== 'stop') console.error(e); }
  if (tok === autoToken) { autoRunning = false; updAutoBtn(); }
}
function onFinish() {
  status('通关！'); window.__finished = true;
  if (rec) setTimeout(stopRec, S.recTail + (S.endCard ? S.endDelay : 0));
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
  };
  rec.start(250); recT0 = now(); updRecBtn();
}
function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
function updRecBtn() { const b = document.getElementById('btnRec'); b.textContent = rec ? '■ 停止录制' : '⏺ 开始录制'; b.classList.toggle('on', !!rec); }

// ---------- 主循环 ----------
let lastT = now();
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  step(t, dt); updPress(t); draw(t);
  if (rec) document.getElementById('recInfo').textContent = `录制中 ${((t - recT0) / 1000).toFixed(1)}s`; else document.getElementById('recInfo').textContent = '';
  requestAnimationFrame(loop);
}

// ---------- 设置面板 ----------
const REBUILD_KEYS = /^(canvas|bg|leaf|base|plate|outline|board)/, NEWGAME_KEYS = /^(level|seed|emptyHoles|screwsPerPlate|gen)/;
function applyChange(k) {
  saveSettings(S);
  if (NEWGAME_KEYS.test(k)) newGame(); else if (REBUILD_KEYS.test(k)) rebuild();
  if (k === 'handImg') loadHand();
  if (k === 'bgm' || k === 'bgmVol') { if (k === 'bgm') sfx.setBgm(S.bgm, S.bgmVol); else if (sfx.bgmGain) sfx.bgmGain.gain.value = S.bgmVol; }
}
function loadHand() { if (!S.handImg) { hand.img = null; return; } const im = new Image(); im.onload = () => hand.img = im; im.src = S.handImg; }
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
function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1600); }
document.getElementById('btnAuto').onclick = autoSolve;
document.getElementById('btnNew').onclick = newGame;
document.getElementById('btnSeed').onclick = () => { S.seed = 1 + Math.floor(Math.random() * 9999); if (S.level !== 'random') S.level = 'random'; saveSettings(S); buildPanel(); newGame(); };
document.getElementById('btnRec').onclick = () => rec ? stopRec() : startRec();
document.getElementById('btnShot').onclick = () => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'screw_shot.png'; a.click(); };
document.getElementById('btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON(S)], { type: 'application/json' })); a.download = 'screw-tool-settings.json'; a.click(); };
document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = migrate(JSON.parse(t)); saveSettings(S); buildPanel(); loadHand(); sfx.setBgm(S.bgm, S.bgmVol); newGame(); toast('已导入设置'); }).catch(() => toast('导入失败')); };
document.getElementById('btnReset').onclick = () => { if (!confirm('恢复全部默认设置？')) return; S = { ...DEFS }; saveSettings(S); buildPanel(); loadHand(); newGame(); };
window.__game = { autoSolve, newGame, get S() { return S; }, set(k, v) { S[k] = v; applyChange(k); buildPanel(); }, get st() { return st; }, get L() { return L; }, startRec, stopRec };
buildPanel(); loadHand(); newGame(); if (S.bgm) sfx.setBgm(S.bgm, S.bgmVol);
requestAnimationFrame(loop);
