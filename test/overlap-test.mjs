// v1.7.1：全程自动通关中，同层板块之间、板材料与插在底板里的螺丝杆之间的穿透深度必须 ≈0（npm run test:overlap）
// 每帧测量：至少一块在动（摆动/下落且未进入卡住穿过）的同层板对 → 栅格采样两板可见轮廓的公共区域，深度 = min(到 A 边距离, 到 B 边距离)；
// 螺丝：插在底板里的螺丝杆圆（collShaftR）与板材料的穿透深度（排除该板自己孔里的螺丝）。
import { chromium } from 'playwright-core'; import fs from 'fs';
const TOL = +(process.env.TOL || 2);
const heart = 'data:image/png;base64,' + fs.readFileSync('test/assets/shapes/heart.png').toString('base64');
const all = [['heart', { shapeImg: heart, partStyle: 'strip', baseFill: 'color', imgLayers: 1 }],
  ['heart-s2', { shapeImg: heart, partStyle: 'strip', baseFill: 'color', imgLayers: 1, shapeSeed: 2 }],
  ['reference', { level: 'reference' }], ['random1', { level: 'random', seed: 1 }], ['random42x3', { level: 'random', seed: 42, genLayers: 3 }]];
const cases = process.env.ONLY ? all.filter(c => process.env.ONLY.split(',').includes(c[0])) : all;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
let fails = 0;
for (const [name, opt] of cases) {
  const p = await b.newPage({ viewport: { width: 900, height: 1300 } });
  const errs = []; p.on('pageerror', e => { errs.push(String(e)); if (process.env.DBG) console.log('PAGEERR', e.stack || e); }); if (process.env.DBG) p.on('console', m => console.log('  [page]', m.text()));
  if (process.env.DBG) { const cdp = await p.context().newCDPSession(p); await cdp.send('Debugger.enable'); cdp.on('Debugger.paused', e => { console.log('STACK\n' + e.callFrames.slice(0, 12).map(f => f.functionName + ' @' + f.location.lineNumber + ':' + f.location.columnNumber).join('\n')); process.exit(3); });
    const cdp2 = await p.context().newCDPSession(p); let hb = Date.now(); setInterval(async () => { const t = Date.now(); const ok = await Promise.race([cdp2.send('Runtime.evaluate', { expression: '1' }).then(() => 1), new Promise(r => setTimeout(() => r(0), 3000))]); if (!ok) { console.log('HUNG'); cdp.send('Debugger.pause'); } }, 4000); }
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300); if (process.env.DBG) await p.evaluate(() => window.__DBG = 1);
  await p.evaluate((o) => { const G = __game; const { shapeImg, level, ...rest } = o; Object.assign(G.S, rest); if (shapeImg) G.set('shapeImg', shapeImg); else { G.set('level', level); G.newGame(); } }, opt);
  if (opt.shapeImg) { await p.waitForFunction(() => __game.L.name === 'image' && __game.L.base.inner !== undefined, null, { timeout: 15000 }); await p.waitForTimeout(400); }
  const r = await p.evaluate((TOL) => new Promise(res => {
    const G = __game, L = G.L, pv = G.plateVis, S = G.S;
    const W = (bd, x, y) => { const c = Math.cos(bd.ang), s = Math.sin(bd.ang), ux = x - bd.C[0], uy = y - bd.C[1]; return [bd.C[0] + c * ux - s * uy + bd.dx, bd.C[1] + s * ux + c * uy + bd.dy]; };
    const inP = (x, y, P) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) k = !k; } return k; };
    const dE = (x, y, P) => { let m = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1))); m = Math.min(m, Math.hypot(x - ax - t * vx, y - ay - t * vy)); } return m; };
    const bb = (P) => { let a = 1e9, b2 = 1e9, c = -1e9, d = -1e9; for (const [x, y] of P) { a = Math.min(a, x); b2 = Math.min(b2, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b2, c, d]; };
    const moving = (bd) => (bd.s === 'swing' || (bd.s === 'fall' && !bd.ghost));
    const trace = []; let worstPP = { d: 0 }, worstPS = { d: 0 }, frames = 0, badFrames = 0, swings = 0, minSwing = [], t0 = performance.now();
    const seenSwing = new Set();
    const hist = []; let dumped = null;
    const measure = () => {
      frames++; if (window.__DBG) { hist.push([Math.round(performance.now() - t0), pv.map(q => [q.s[0], +(q.ang * 57.3).toFixed(1), Math.round(q.cx), Math.round(q.cy), q.pivW && q.pivW.map(Math.round).join(','), q.n])]); if (hist.length > 60) hist.shift(); }
      const polys = pv.map((bd, i) => bd.s === 'gone' ? null : L.plates[i].poly.map(([x, y]) => W(bd, x, y)));
      const boxes = polys.map(P => P && bb(P));
      let bad = false;
      for (let i = 0; i < pv.length; i++) {
        if (!polys[i]) continue;
        if (pv[i].s === 'swing' && !seenSwing.has(i)) { seenSwing.add(i); swings++; }
        for (let j = i + 1; j < pv.length; j++) {
          if (!polys[j] || L.plates[i].layer !== L.plates[j].layer || !(moving(pv[i]) || moving(pv[j]))) continue;
          if (pv[i].ghost || pv[j].ghost) continue;
          const A = boxes[i], B = boxes[j], x0 = Math.max(A[0], B[0]), y0 = Math.max(A[1], B[1]), x1 = Math.min(A[2], B[2]), y1 = Math.min(A[3], B[3]);
          if (x0 >= x1 || y0 >= y1) continue;
          let d = 0, area = 0;
          for (let y = Math.ceil(y0); y <= y1; y++) for (let x = Math.ceil(x0); x <= x1; x++) if (inP(x, y, polys[i]) && inP(x, y, polys[j])) { area++; d = Math.max(d, Math.min(dE(x, y, polys[i]), dE(x, y, polys[j]))); }
          if (d > worstPP.d) worstPP = { d: +d.toFixed(2), area, a: i, b: j, sa: pv[i].s, sb: pv[j].s, angA: +(pv[i].ang * 57.3).toFixed(1), angB: +(pv[j].ang * 57.3).toFixed(1), t: Math.round(performance.now() - t0), pass: G.world.pass.has('p' + Math.min(i, j) + '|p' + Math.max(i, j)) || G.world.pass.has('p' + i + '|p' + j) || G.world.pass.has('p' + j + '|p' + i) };
          if (d > TOL) { bad = true; if (!dumped && d > 6) dumped = hist.map(([t, a]) => [t, a[i], a[j]]); if (trace.length < 3 && d > 6) trace.push(['pp', Math.round(performance.now() - t0), i, j, pv[i].s, pv[j].s, +d.toFixed(1), +(pv[i].ang * 57.3).toFixed(1), +(pv[j].ang * 57.3).toFixed(1), G.world.pass.has('p' + i + '|p' + j) || G.world.pass.has('p' + j + '|p' + i), pv[i].tf && +pv[i].tf.toFixed(2)]); }
        }
        if (!moving(pv[i])) continue;
        const R = S.collShaftR ?? 6, own = pv[i].holes.map(([x, y]) => W(pv[i], x, y));
        G.st.screwHole.forEach((h, si) => {
          if (h < 0) return; const a = G.screwVis[si].anim; if (a && (a.k === 'lift' || a.k === 'hover' || a.k === 'fly')) return;
          const [sx, sy] = G.holeWorld(h); if (own.some(([x, y]) => Math.hypot(x - sx, y - sy) < 10)) return;
          const P = polys[i], e = dE(sx, sy, P), d = inP(sx, sy, P) ? R + e : R - e;
          if (d > worstPS.d) worstPS = { d: +d.toFixed(2), plate: i, s: pv[i].s, screw: si, pass: G.world.pass.has('p' + i + '|s' + si) || G.world.pass.has('s' + si + '|p' + i), t: Math.round(performance.now() - t0) };
          if (d > TOL) bad = true;
        });
      }
      if (bad) badFrames++;
    };
    Object.assign(S, { autoSpeed: 2 }); window.__finished = false; G.autoSolve();
    let lastLog = 0; const tick = () => { try { tick0(); } catch (e) { res({ error: String(e.stack || e) }); } }; const tick0 = () => { const tm = performance.now(); measure(); const mt = performance.now() - tm; if (tm - lastLog > 5000 || mt > 200) { lastLog = tm; console.log('prog', Math.round(tm - t0), 'measureMs', Math.round(mt), 'removed', G.st.removed.size, pv.map(q => q.s[0]).join('')); } const fin = window.__finished && pv.every(q => q.s === 'gone'); if (fin || performance.now() - t0 > 200000) { const sw = [...seenSwing].map(i => +(G.st.swing.get(i)?.ang * 57.3 || 0).toFixed(1)); return res({ fin: !!fin, ms: Math.round(performance.now() - t0), plates: pv.length, removed: G.st.removed.size, layers: Math.max(...L.plates.map(q => q.layer)) + 1, frames, badFrames, swings, worstPP, worstPS, ghosts: pv.filter(q => q.ghost).length, auto: window.__autoStats, trace: window.__DBG ? trace : undefined, dumped }); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), TOL);
  const ok = r.fin && r.worstPP.d <= TOL && r.worstPS.d <= TOL && !errs.length;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(r) + (errs.length ? ' errs=' + errs.join(';') : ''));
  await p.close();
}
await b.close();
console.log(fails ? 'OVERLAP FAIL' : 'OVERLAP OK'); process.exit(fails ? 1 : 0);
