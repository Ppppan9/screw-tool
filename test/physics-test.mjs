// v1.4 物理反馈测试：按参考视频前两手的点击节奏操作，检查（1）悬停/飞行期间板不动、落座后才掉落；
// （2）双钉板拧走一颗后绕剩余钉摆动到 ~17° 且支点不动。同时按参考帧时刻截图 → /tmp/physfr/*.jpg
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
const r = await p.evaluate((REC) => new Promise(res => {
  const G = __game, L = G.L, H = (x, y) => L.holes.findIndex(h => Math.hypot(h.x - x, h.y - y) < 4);
  const h23 = H(452, 806), hEmpty = H(400, 668), h22r = H(482, 757), h22l = H(426, 754);
  const pl = (x, y) => L.plates.findIndex(q => q.holes.includes(H(x, y)));
  const P23 = pl(452, 806), P22 = pl(426, 754);
  // 参考节奏（帧 → ms，相对第一手 tap1=f17）：tap1 f17, tap2 f31；第二手 tap1 f63, tap2 f75
  const F = f => (f - 17) * 1000 / 30;
  const plan = [[F(17), h23], [F(31), hEmpty], [F(63), h22r], [F(75), h23]];
  const shots = [17, 25, 31, 35, 38, 40, 42, 44, 46, 63, 70, 75, 81, 85, 86, 87, 88, 95].map(f => ({ f, t: F(f) }));
  const log = []; const t0 = performance.now(); let k = 0, sh = 0; const out = { shots: [] };
  const tick = () => {
    const t = performance.now() - t0;
    while (k < plan.length && t >= plan[k][0]) { G.tapHole(plan[k][1]); log.push(['tap', k, Math.round(t)]); k++; }
    const b23 = G.plateVis[P23], b22 = G.plateVis[P22];
    const sv = G.screwVis.map(v => v.anim ? v.anim.k : '').join(',');
    log.push([Math.round(t), b23.s, +b23.dy.toFixed(1), b22.s, +(b22.ang * 180 / Math.PI).toFixed(2), G.holeWorld(h22l).map(v => +v.toFixed(2)), G.holeWorld(h22r).map(v => +v.toFixed(1)), sv.replace(/,+/g, ',')]);
    while (sh < shots.length && t >= shots[sh].t) { out.shots.push({ f: shots[sh].f, t: Math.round(t), url: stage.toDataURL('image/jpeg', 0.9) }); sh++; }
    if (REC && t > F(10)) (out.all = out.all || []).push([Math.round(t), stage.toDataURL('image/jpeg', 0.85)]);
    if (t > F(110)) { out.log = log; out.view = G.view(); out.P = { P23, P22, h22l, h22r }; return res(out); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), !!process.env.REC);
await b.close();
fs.mkdirSync('/tmp/physfr', { recursive: true });
r.shots.forEach(s => fs.writeFileSync(`/tmp/physfr/f${s.f}.jpg`, Buffer.from(s.url.split(',')[1], 'base64')));
fs.writeFileSync('/tmp/physfr/view.json', JSON.stringify(r.view));
if (r.all) { fs.mkdirSync('/tmp/physfr/all', { recursive: true }); r.all.forEach(([t, u], i) => fs.writeFileSync(`/tmp/physfr/all/${String(i).padStart(4, '0')}_${t}.jpg`, Buffer.from(u.split(',')[1], 'base64'))); }
const L = r.log.filter(e => typeof e[0] === 'number'), taps = r.log.filter(e => e[0] === 'tap').map(e => e[2]);
const seatT = (after) => { let w = false; for (const e of L) { if (e[0] < after) continue; if (e[7].includes('in')) w = true; else if (w) return e[0]; } return null; };
const fall23 = L.find(e => e[1] === 'fall'), swing22 = L.find(e => e[3] === 'swing');
const seat1 = seatT(taps[1]), seat2 = seatT(taps[3]);
const before = L.filter(e => e[0] < (fall23 ? fall23[0] : 1e9));
const res = {
  taps, seat1, fall23At: fall23 && fall23[0], fallAfterSeatMs: fall23 && fall23[0] - seat1, fallAfterTap1Ms: fall23 && fall23[0] - taps[0],
  movedBeforeRelease: before.some(e => e[2] !== 0), seat2, swingAt: swing22 && swing22[0], swingAfterSeatMs: swing22 && swing22[0] - seat2,
  swingAngles: L.filter(e => swing22 && e[0] >= swing22[0] && e[0] < swing22[0] + 300).filter((_, i) => i % 2 === 0).map(e => [e[0] - swing22[0], e[4]]),
  finalAngle: L[L.length - 1][4], pivotDrift: Math.max(...L.map(e => Math.hypot(e[5][0] - 426, e[5][1] - 754))), rightHole: L[L.length - 1][6],
};
const firstAfter = (t0, f) => { const e = L.find(e => e[0] >= t0 && f(e[7])); return e ? e[0] : null; };
const tm = (k) => { const tTap1 = taps[k * 2], tTap2 = taps[k * 2 + 1], hov = firstAfter(tTap1, x => x.includes('hover')), inn = firstAfter(tTap2, x => x.includes('in')), seat = k ? seat2 : seat1; return { liftMs: hov - tTap1, flyMs: inn - tTap2, screwInMs: seat - inn, tap2ToSeatMs: seat - tTap2 }; };
res.screw = [tm(0), tm(1)];
// 参考（相对第一手 tap1=3.333s）：板23 开始掉落 +767ms(4.100s)，板22 开始摆动 +2300ms(5.633s)
res.vsRef = { fall23: [res.fall23At - taps[0], 767], swing22: [res.swingAt - taps[0], 2300] };
console.log(JSON.stringify(res));
const ok = res.fall23At && res.fallAfterSeatMs >= 0 && res.fallAfterSeatMs < 150 && res.fallAfterTap1Ms > 600 && !res.movedBeforeRelease
  && res.swingAt && res.swingAfterSeatMs >= 0 && res.finalAngle > 12 && res.finalAngle < 22 && res.pivotDrift < 1.5 && Math.hypot(res.rightHole[0] - 482, res.rightHole[1] - 757) > 8;
console.log(ok ? 'PHYSICS OK' : 'PHYSICS FAIL'); process.exit(ok ? 0 : 1);
