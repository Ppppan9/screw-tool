// 导出 After Effects 工程：游戏时间轴记录器（每帧采样）+ 素材渲染 + timeline.json / build_ae_project.jsx 打包
// 设计坐标（合成坐标）= 720×1280；棋盘世界坐标经 view() 的整体缩放/偏移变到设计坐标。
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav } from '../audio.js';
import { drawHole, drawScrew } from '../render.js';

const LABEL = { bg: 15, base: 14, hole: 16, plate: 9, shadow: 7, fall: 11, screw: 2, move: 1, ui: 15, end: 5, hand: 12, audio: 16 };
const r3 = v => Math.round(v * 1000) / 1000;
const SFX_ZH = { ratchet_up: '拧出棘轮', ratchet_down: '拧入棘轮', thunk: '拧紧到位', fall: '板掉落' };
export const SHANK_REF = 100; // 螺杆素材按 100px 长渲染，图层 Y 缩放 = 抬起高度

export function createAERecorder(api) {
  let R = null;
  function start(opt = {}) {
    const E = api.env();
    R = { t0: performance.now(), lastT: 0, frames: 0, plates: E.L.plates.map(() => []), screws: E.L.screws.map(() => []), hand: [], end: [], sfx: [], snaps: [], snapEvery: opt.snapEvery || window.__aeSnapEvery || 0, maxSnaps: opt.maxSnaps || 40, L: E.L, S: { ...E.S }, view: E.view() };
    api.sfx.hook = (name, o) => { if (R) R.sfx.push({ t: (performance.now() - R.t0) / 1000, name, dur: o.dur }); };
  }
  function stop() { const r = R; R = null; return r; }
  function sample(now) {
    if (!R) return;
    const E = api.env(); if (E.L !== R.L) { R = null; return; }
    const t = Math.max(R.lastT + 1e-4 * (R.frames > 0), (now - R.t0) / 1000);
    E.plateVis.forEach((pv, pi) => R.plates[pi].push([t, pv.s === 'falling' ? 1 : pv.s === 'gone' ? 2 : 0, r3(pv.y), r3(pv.rot)]));
    E.screwVis.forEach((sv, si) => {
      if (sv.anim) R.screws[si].push([t, 1, r3(sv.x), r3(sv.y), r3(sv.ang), r3(sv.lift), r3(sv.sc), 99]);
      else { const h = E.L.holes[E.st.screwHole[si]]; R.screws[si].push([t, 0, h.x, h.y, r3(sv.ang), 0, r3(sv.sc), api.screwLayer(si)]); }
    });
    const hq = api.handState(); R.hand.push(hq ? [t, r3(hq.x), r3(hq.y), r3(hq.s), 1] : [t, 0, 0, 1, 0]);
    R.end.push([t, r3(api.endAlpha(now))]);
    if (R.snapEvery && R.frames % R.snapEvery === R.snapEvery - 1 && R.snaps.length < R.maxSnaps) R.snaps.push({ t, url: E.canvas.toDataURL('image/png') });
    R.lastT = t; R.frames++;
  }

  async function exportZip(rec = R) {
    if (!rec || rec.frames < 2) throw new Error('没有可导出的记录：请先自动通关或手动游玩');
    const E = api.env(), S = rec.S, L = rec.L, v = rec.view;
    const fps = +S.aeFps || 30, bake = S.aeSampling === 'bake';
    const CW = 720, CH = 1280;
    const D = Math.max(1 / fps, Math.ceil((rec.lastT + 1 / fps) * fps - 1e-6) / fps);
    const r = Math.max(1, v.k * v.b); // 棋盘素材分辨率：每世界单位像素
    const WS = v.b / r * 100;            // 棋盘素材在合成中的缩放(%)
    const DS = 100 / v.k;                // 设计坐标素材（画布分辨率）缩放(%)
    const P = (x, y) => [x * v.b + v.tx, y * v.b + v.ty]; // 世界 → 合成
    const assets = [], assetFiles = [], pending = [];
    const folders = [
      { id: 'root', name: '打螺丝_AE工程' }, { id: 'img', name: '素材', parent: 'root' }, { id: 'plates', name: '板块', parent: 'img' },
      { id: 'screw', name: '螺丝', parent: 'img' }, { id: 'ui', name: '界面', parent: 'img' }, { id: 'aud', name: '音频', parent: 'root' }, { id: 'pre', name: '预合成', parent: 'root' },
    ];
    const toPng = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
    function addAsset(id, folder, canvas, name) { const file = 'assets/' + id + '.png'; const a = { id, file, folder, w: canvas.width, h: canvas.height, name: name || id + '.png' }; assets.push(a); pending.push(toPng(canvas).then(data => assetFiles.push({ name: file, data }))); return a; }
    // 以世界坐标 (0,0) 为中心的局部素材（螺丝部件、孔）：返回素材 + 锚点
    function local(id, folder, half, fn) { const c = mk(half * 2 * r, half * 2 * r), g = c.getContext('2d'); g.setTransform(r, 0, 0, r, half * r, half * r); fn(g); const a = addAsset(id, folder, c); a.ax = half * r; a.ay = half * r; return a; }

    // ---- 素材 ----
    const A = {};
    A.bg = addAsset('background', 'ui', E.bgCanvas, '背景.png');
    A.base = addAsset('hand_base', 'ui', E.baseCanvas, '手形底板.png');
    const HR = S.holeSize / 2 + 4;
    A.hole = local('hole', 'screw', HR, g => drawHole(g, 0, 0, S));
    const SR = S.screwSize / 2 + 3;
    A.head = local('screw_head', 'screw', SR, g => drawScrew(g, 0, 0, S, 0, 0, 1, 'head'));
    A.cross = local('screw_cross', 'screw', SR, g => drawScrew(g, 0, 0, S, 0, 0, 1, 'cross'));
    A.shadow = local('screw_shadow', 'screw', SR, g => drawScrew(g, 0, -2, S, 0, 0, 1, 'shadow')); // 投影中心在 (x+lift/4, y+2)
    { const half = Math.max(SR, SHANK_REF / 2 + 4); const c = mk(SR * 2 * r, (SHANK_REF + 8) * r), g = c.getContext('2d'); g.setTransform(r, 0, 0, r, SR * r, (SHANK_REF + 4) * r); drawScrew(g, 0, 0, S, 0, SHANK_REF, 1, 'shank'); A.shank = addAsset('screw_shank', 'screw', c); A.shank.ax = SR * r; A.shank.ay = (SHANK_REF + 4) * r; }
    // 板块：贴图 = 板面 + 自身的孔；投影单独一层（只在板未掉落时）
    const plateA = L.plates.map((p, pi) => {
      const sp = E.sprites[pi], c = mk(sp.c.width, sp.c.height), g = c.getContext('2d');
      g.drawImage(sp.c, 0, 0); g.setTransform(sp.c.width / sp.w, 0, 0, sp.c.height / sp.h, -sp.x * sp.c.width / sp.w, -sp.y * sp.c.height / sp.h);
      p.holes.forEach(h => drawHole(g, L.holes[h].x, L.holes[h].y, S));
      const a = addAsset('plate_' + String(pi + 1).padStart(2, '0'), 'plates', c, `板块_${pi + 1}.png`);
      // 投影：与网页相同的 shadowBlur/offset（画布像素），只保留阴影
      const pad = Math.ceil(12 * v.k), sc = mk(sp.c.width + pad * 2, sp.c.height + pad * 2), sg = sc.getContext('2d');
      sg.shadowColor = `rgba(20,10,30,${S.plateShadow})`; sg.shadowBlur = 6 * v.k; sg.shadowOffsetY = 3 * v.k; sg.shadowOffsetX = 20000; sg.drawImage(sp.c, pad - 20000, pad);
      const sa = addAsset('plate_' + String(pi + 1).padStart(2, '0') + '_shadow', 'plates', sc, `板块_${pi + 1}_投影.png`);
      a.cx = sp.x + sp.w / 2; a.cy = sp.y + sp.h / 2; sa.pad = pad; return { a, sa, sp };
    });
    const hostCtx = (fn) => { const c = mk(CW * v.k, CH * v.k), g = c.getContext('2d'); g.setTransform(v.k, 0, 0, v.k, 0, 0); fn(g); return c; };
    if (S.discShow || S.vertShow) A.text = addAsset('disclaimer_text', 'ui', hostCtx(g => api.drawTextsTo(g)), '免责声明文字.png');
    const hasEnd = rec.end.some(e => e[1] > 0);
    if (hasEnd) A.end = addAsset('end_card', 'ui', hostCtx(g => api.drawEndTo(g, 1)), '结束卡.png');
    const handImg = E.handImg && rec.hand.some(e => e[4]);
    if (handImg) { const c = mk(E.handImg.width, E.handImg.height); c.getContext('2d').drawImage(E.handImg, 0, 0); A.hand = addAsset('hand_cursor', 'ui', c, '手指光标.png'); }

    // ---- 关键帧工具（与麻将工具相同：重采样到 fps 网格，线性插值误差内删减）----
    function frames(s) {
      const f0 = Math.round(s[0][0] * fps), f1 = Math.max(f0, Math.round(s[s.length - 1][0] * fps)), out = []; let j = 0;
      for (let f = f0; f <= f1; f++) { const tau = f / fps; while (j < s.length - 2 && s[j + 1][0] <= tau + 1e-9) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0; out.push({ t: tau, v: a.map((x, i) => i === 0 ? tau : x + (b[i] - x) * u) }); }
      return { f0, f1, list: out, in: f0 / fps, out: (f1 + 1) / fps };
    }
    const rnd = v => Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100) : Math.round(v * 100) / 100;
    const r4 = x => Math.round(x * 10000) / 10000;
    function prop(fr, get, tol, hold = false) {
      const t = fr.list.map(o => o.t), vv = fr.list.map(o => get(o.v));
      const same = (a, b, e) => Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= e) : Math.abs(a - b) <= e;
      if (vv.every(x => same(x, vv[0], 1e-6))) return rnd(vv[0]);
      let keep;
      if (hold) { keep = [0]; for (let i = 1; i < vv.length; i++) if (!same(vv[i], vv[i - 1], 1e-6)) keep.push(i); }
      else if (bake) keep = vv.map((_, i) => i);
      else {
        keep = [0]; let a = 0;
        for (let b = 2; b < vv.length; b++) { let ok = true; for (let m = a + 1; m < b && ok; m++) { const u = (t[m] - t[a]) / (t[b] - t[a]); const lin = Array.isArray(vv[a]) ? vv[a].map((x, i) => x + (vv[b][i] - x) * u) : vv[a] + (vv[b] - vv[a]) * u; ok = same(lin, vv[m], tol); } if (!ok) { keep.push(b - 1); a = b - 1; } }
        if (vv.length > 1) keep.push(vv.length - 1);
      }
      const o = { t: keep.map(i => r4(t[i])), v: keep.map(i => rnd(vv[i])) }; if (hold) o.hold = true; return o;
    }
    const TOL = { pos: 0.25, scale: 0.25, rot: 0.2, op: 0.5 };
    const keyCount = p => (p && typeof p === 'object' && !Array.isArray(p) && p.t) ? p.t.length : 0;
    const FR = x => Math.round(x * fps) / fps;
    const Ly = (name, src, o = {}) => ({ name, src, ...o });
    const layers = [], markers = [], comps = [];
    // 区间工具：返回 [[i0,i1],...]（样本下标连续满足 pred）
    const runs = (s, pred) => { const out = []; let a = -1; s.forEach((e, i) => { const ok = pred(e); if (ok && a < 0) a = i; if (!ok && a >= 0) { out.push([a, i - 1]); a = -1; } }); if (a >= 0) out.push([a, s.length - 1]); return out; };
    const tEnd = (s, i1) => i1 + 1 < s.length ? s[i1 + 1][0] : D;

    layers.push(Ly('背景', { asset: A.bg.id }, { label: LABEL.bg, tr: { anchor: [0, 0], position: [0, 0], scale: [DS, DS] } }));
    layers.push(Ly('手形底板', { asset: A.base.id }, { label: LABEL.base, tr: { anchor: [0, 0], position: P(0, 0), scale: [720 / E.baseCanvas.width * v.b * 100, 720 / E.baseCanvas.width * v.b * 100] } }));
    // 孔：在覆盖它的最后一块板开始下落时露出（无覆盖的孔从 0 开始可见）
    const cov = api.coverInfo(L);
    L.holes.forEach((h, hi) => {
      let tin = 0; for (const pi of cov[hi]) { const s = rec.plates[pi]; const k = s.findIndex(e => e[1] > 0); const tp = s[0][1] > 0 ? 0 : k < 0 ? Infinity : s[k][0]; tin = Math.max(tin, tp); }
      if (tin === Infinity) return;
      layers.push(Ly(`孔 ${hi + 1}`, { asset: A.hole.id }, { in: FR(tin), label: LABEL.hole, markers: tin > 0 ? [[r4(FR(tin)), '露出']] : undefined, tr: { anchor: [A.hole.ax, A.hole.ay], position: rnd(P(h.x, h.y)), scale: [WS, WS] } }));
    });
    // 板块（静止）+ 投影，按层；同层内静止螺丝段落在其上
    const maxLayer = Math.max(0, ...L.plates.map(p => p.layer));
    const segs = []; // 螺丝段 {si, kind:'static'|'move', i0, i1, lay}
    rec.screws.forEach((s, si) => { for (const [i0, i1] of runs(s, e => e[1] === 0)) segs.push({ si, kind: 'static', i0, i1, lay: s[i0][7] }); for (const [i0, i1] of runs(s, e => e[1] === 1)) segs.push({ si, kind: 'move', i0, i1 }); });
    let nMove = 0;
    const screwStatic = (sg) => {
      const s = rec.screws[sg.si], e = s[sg.i0], tin = FR(s[sg.i0][0]), tout = Math.min(D, Math.max(tin + 1 / fps, FR(tEnd(s, sg.i1))));
      const pos = rnd(P(e[2], e[3])), base = { in: tin, out: tout, label: LABEL.screw };
      const nm = `螺丝 ${sg.si + 1} @孔${rec.L.holes.findIndex(h => h.x === e[2] && h.y === e[3]) + 1}`;
      layers.push(Ly(nm + ' 螺帽', { asset: A.head.id }, { ...base, tr: { anchor: [A.head.ax, A.head.ay], position: pos, scale: [WS * e[6], WS * e[6]] } }));
      layers.push(Ly(nm + ' 十字槽', { asset: A.cross.id }, { ...base, tr: { anchor: [A.cross.ax, A.cross.ay], position: pos, scale: [WS * e[6], WS * e[6]], rotation: rnd(e[4] * 180 / Math.PI) } }));
    };
    for (let lay = -1; lay <= maxLayer; lay++) {
      if (lay >= 0) L.plates.forEach((p, pi) => {
        if (p.layer !== lay) return; const s = rec.plates[pi]; if (s[0][1] !== 0) return;
        const k = s.findIndex(e => e[1] > 0), tout = k < 0 ? D : Math.max(1 / fps, FR(s[k][0]));
        const { a, sa, sp } = plateA[pi], base = { out: tout, label: LABEL.plate };
        layers.push(Ly(`板块 ${pi + 1} 投影`, { asset: sa.id }, { ...base, label: LABEL.shadow, tr: { anchor: [sa.pad, sa.pad], position: rnd(P(sp.x, sp.y)), scale: [WS, WS] } }));
        layers.push(Ly(`板块 ${pi + 1}`, { asset: a.id }, { ...base, markers: k >= 0 ? [[r4(tout), '开始下落']] : undefined, tr: { anchor: [0, 0], position: rnd(P(sp.x, sp.y)), scale: [WS, WS] } }));
      });
      segs.filter(sg => sg.kind === 'static' && (sg.lay === lay || (lay === maxLayer && sg.lay > maxLayer))).forEach(screwStatic);
    }
    // 下落中的板（网页里画在静止螺丝之上）：重力逐帧烘焙到位置关键帧（精简模式在误差 0.25px 内删减）
    L.plates.forEach((p, pi) => {
      const s = rec.plates[pi]; const rr = runs(s, e => e[1] === 1); if (!rr.length) return;
      const [i0, i1] = rr[0], seg = s.slice(i0, i1 + 2), fr = frames(seg.length > 1 ? seg : [seg[0], [seg[0][0] + 1 / fps, ...seg[0].slice(1)]]);
      const { a, sp } = plateA[pi], tin = FR(s[i0][0]), tout = Math.min(D, Math.max(tin + 1 / fps, FR(tEnd(s, i1))));
      const tr = { anchor: [(a.cx - sp.x) * r, (a.cy - sp.y) * r], position: prop(fr, e => P(a.cx, a.cy + e[2]), TOL.pos), scale: [WS, WS], rotation: prop(fr, e => e[3] * 180 / Math.PI, TOL.rot) };
      if (S.fallFade) tr.opacity = prop(fr, e => Math.max(0, 1 - e[2] / 800) * 100, TOL.op);
      layers.push(Ly(`板块 ${pi + 1} 下落`, { asset: a.id }, { in: tin, out: tout, label: LABEL.fall, markers: [[r4(tin), '掉落']], tr }));
    });
    // 移动中的螺丝（抬起/悬停/飞行/拧入/回弹）：投影、螺杆、螺帽、十字槽 4 层
    for (const sg of segs.filter(x => x.kind === 'move')) {
      const s = rec.screws[sg.si]; nMove++;
      const seg = s.slice(sg.i0, sg.i1 + 1), fr = frames(seg.length > 1 ? seg : [seg[0], [seg[0][0] + 1 / fps, ...seg[0].slice(1)]]);
      const tin = FR(s[sg.i0][0]), tout = Math.min(D, Math.max(tin + 1 / fps, FR(tEnd(s, sg.i1))));
      const nm = `螺丝 ${sg.si + 1} 移动#${nMove}`, base = { in: tin, out: tout, label: LABEL.move };
      const head = e => P(e[2], e[3] - e[5]);
      const shown = e => e[5] > 0.5 ? 100 : 0;
      layers.push(Ly(nm + ' 投影', { asset: A.shadow.id }, { ...base, tr: { anchor: [A.shadow.ax, A.shadow.ay], position: prop(fr, e => P(e[2] + e[5] * 0.25, e[3] + 2), TOL.pos), scale: prop(fr, e => [WS * e[6], WS * e[6]], TOL.scale), opacity: prop(fr, e => e[5] > 0.5 ? Math.min(0.35, e[5] / 60) * 100 : 0, TOL.op) } }));
      layers.push(Ly(nm + ' 螺杆', { asset: A.shank.id }, { ...base, tr: { anchor: [A.shank.ax, A.shank.ay], position: prop(fr, e => P(e[2], e[3]), TOL.pos), scale: prop(fr, e => [WS * e[6], WS * Math.max(0, e[5]) / SHANK_REF], TOL.scale), opacity: prop(fr, shown, 0, true) } }));
      layers.push(Ly(nm + ' 螺帽', { asset: A.head.id }, { ...base, markers: [[r4(tin), '拧出']], tr: { anchor: [A.head.ax, A.head.ay], position: prop(fr, head, TOL.pos), scale: prop(fr, e => [WS * e[6], WS * e[6]], TOL.scale) } }));
      layers.push(Ly(nm + ' 十字槽', { asset: A.cross.id }, { ...base, tr: { anchor: [A.cross.ax, A.cross.ay], position: prop(fr, head, TOL.pos), scale: prop(fr, e => [WS * e[6], WS * e[6]], TOL.scale), rotation: prop(fr, e => e[4] * 180 / Math.PI, TOL.rot) } }));
    }
    if (A.text) layers.push(Ly('免责声明文字', { asset: A.text.id }, { label: LABEL.ui, tr: { anchor: [0, 0], position: [0, 0], scale: [DS, DS] } }));
    if (A.end) {
      const k = rec.end.findIndex(e => e[1] > 0), seg = rec.end.slice(Math.max(0, k - 1)), fr = frames(seg);
      layers.push(Ly('结束卡', { asset: A.end.id }, { in: FR(seg[0][0]), label: LABEL.end, markers: [[r4(FR(seg[0][0])), '结束卡']], tr: { anchor: [0, 0], position: [0, 0], scale: [DS, DS], opacity: prop(fr, e => e[1] * 100, TOL.op) } }));
    }
    if (A.hand) {
      const s = rec.hand, k0 = s.findIndex(e => e[4]); let k1 = s.length - 1; while (k1 > k0 && !s[k1][4]) k1--;
      const seg = s.slice(k0, Math.min(s.length, k1 + 2)).map((e, i, arr) => e[4] ? e : [e[0], ...arr[i - 1].slice(1, 4), 0]);
      const fr = frames(seg.length > 1 ? seg : [seg[0], [seg[0][0] + 1 / fps, ...seg[0].slice(1)]]);
      const aw = E.handImg.width, ah = E.handImg.height;
      layers.push(Ly('手指/触控笔', { asset: A.hand.id }, { in: FR(s[k0][0]), out: Math.min(D, Math.max(FR(s[k0][0]) + 1 / fps, FR(tEnd(s, k1)))), label: LABEL.hand, tr: { anchor: [S.handAnchorX * aw, S.handAnchorY * ah], position: prop(fr, e => [e[1], e[2]], TOL.pos), scale: prop(fr, e => [e[3] * 100, e[3] * 100], TOL.scale), opacity: prop(fr, e => e[4] ? 100 : 0, 0, true) } }));
    }
    // 音频
    const audioFiles = [];
    if (S.aeAudio !== 'none' && rec.sfx.length) {
      try {
        if (S.aeAudio === 'both' || S.aeAudio === 'mixed') {
          const buf = await renderSfxOffline(rec.sfx, D, S);
          if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); layers.push(Ly('混合音轨（默认静音，与逐事件二选一）', { asset: 'mix' }, { label: LABEL.audio, audioEnabled: S.aeAudio === 'mixed' })); }
        }
        if (S.aeAudio === 'both' || S.aeAudio === 'events') {
          const kinds = new Map(); rec.sfx.forEach(e => { const k = e.name + (e.dur ? '_' + Math.round(e.dur * 1000) : ''); if (!kinds.has(k)) kinds.set(k, e); e.k = k; });
          for (const [k, e] of kinds) { const buf = await renderSfxOffline([{ t: 0, name: e.name, dur: e.dur }], e.name === 'fall' ? 0.6 : (e.dur || 0) + 0.15, S); if (!buf) continue; audioFiles.push({ name: `audio/sfx_${k}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + k, file: `audio/sfx_${k}.wav`, folder: 'aud', name: `sfx_${k}.wav` }); }
          const al = rec.sfx.map((e, i) => { const st = r4(e.t); return Ly(`音效 ${i + 1} ${SFX_ZH[e.name] || e.name}`, { asset: 'sfx_' + e.k }, { start: st, in: st, label: LABEL.audio }); });
          comps.push({ id: 'sfx', name: '音效_逐事件', w: CW, h: CH, duration: D, fps, folder: 'pre', layers: al });
          layers.push(Ly('音效_逐事件', { comp: 'sfx' }, { label: LABEL.audio }));
        }
      } catch (e) { console.warn('audio export', e); }
    }
    for (const e of rec.sfx) if (e.name === 'fall') markers.push([r4(e.t), '板掉落']);
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: '主合成_打螺丝', w: CW, h: CH, duration: D, fps, folder: 'root', bg: [0, 0, 0], layers, markers });
    const stats = { comps: comps.length, layers: 0, keys: 0, perComp: {}, plates: L.plates.length, screws: L.screws.length, holes: L.holes.length, moves: nMove, sfx: rec.sfx.length };
    for (const c of comps) { stats.perComp[c.id] = c.layers.length; stats.layers += c.layers.length; for (const l of c.layers) if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const kc = keyCount(l.tr[k]); if (kc > 1) stats.keys += kc; } }
    const timeline = {
      meta: { tool: 'screw-tool', format: 1, created: d.toISOString(), fps, width: CW, height: CH, duration: D, canvas: [E.canvas.width, E.canvas.height], sampling: bake ? 'bake' : 'reduce', screwBlock: !!S.screwBlock,
        saveAep: true, aepName: `screw_${stamp}.aep`, newProject: true, stats, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素（合成坐标 720×1280）；缩放为百分比' },
      folders, assets: assets.map(({ id, file, folder, w, h, name }) => ({ id, file, folder, w, h, name })), comps, mainComp: 'main',
    };
    await Promise.all(pending);
    const enc = new TextEncoder();
    const files = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...assetFiles.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(files), name: `screw_ae_export_${stamp}.zip`, timeline, stats, files: files.length, fileList: files, snaps: rec.snaps.map(s => s.t) };
  }
  return { start, stop, sample, exportZip, get rec() { return R; }, set rec(v) { R = v; } };
}
