// 导入透明图形生成关卡测试：3 张样例图 → 生成、截图、自动通关
import { chromium } from 'playwright-core'; import fs from 'fs'; import { execSync } from 'child_process';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const ONLY = process.env.ONLY; const cases0 = [['heart', { partStyle: 'strip', baseFill: 'color' }], ['star_hole', { partStyle: 'voronoi', baseFill: 'color', imgLayers: 2 }], ['cat', { partStyle: 'strip', baseFill: 'image', plateTint: 'image', partAngle: 75, imgLayers: 2 }]];
const cases = ONLY ? cases0.filter(c => c[0] === ONLY) : cases0;
const out = []; let fail = 0;
for (const [n, opt] of cases) {
  const url = 'data:image/png;base64,' + fs.readFileSync(`test/assets/shapes/${n}.png`).toString('base64');
  // v1.7.2：记录生成耗时（物理求解验证）。set 同步部分 = 图片未加载时先用默认图形生成一次；之后图片 onload 再生成目标关卡
  const gen = await p.evaluate(([u, o]) => new Promise(res => { Object.assign(__game.S, o); const t0 = performance.now(); __game.set('shapeImg', u); const t1 = performance.now(), L1 = __game.L;
    const poll = () => { const L = __game.L; if (L !== L1 && L.name === 'image' && L.base.inner !== undefined) return res({ syncMs: Math.round(t1 - t0), totalMs: Math.round(performance.now() - t0) }); if (performance.now() - t0 > 180000) return res({ syncMs: Math.round(t1 - t0), totalMs: -1 }); setTimeout(poll, 5); }; setTimeout(poll, 0); }), [url, opt]);
  await p.waitForTimeout(500);
  const info = await p.evaluate(() => ({ name: __game.L.name, plates: __game.L.plates.length, screws: __game.L.screws.length, holes: __game.L.holes.length, inner: (__game.L.base.inner || []).length, outer: __game.L.base.polys.length, layers: Math.max(...__game.L.plates.map(q => q.layer)) + 1, attempts: __game.L.attempts }));
  info.genMs = gen.totalMs; info.genSyncMs = gen.syncMs;
  fs.writeFileSync(`/tmp/shape_${n}.png`, Buffer.from((await p.evaluate(() => stage.toDataURL())).split(',')[1], 'base64'));
  await p.evaluate(() => { window.__finished = false; Object.assign(__game.S, { autoSpeed: 4, delayMin: 0, delayMax: 20, moveMin: 60, moveMax: 60, autoSelectGap: 0, autoStartDelay: 0, liftDur: 40, flyDur: 80, screwInDur: 40, fallDelay: 0 }); __game.autoSolve(); });
  const t0 = Date.now(); while (!(await p.evaluate(() => window.__finished)) && Date.now() - t0 < 300000) { await p.waitForTimeout(200); }
  const st = await p.evaluate(() => ({ removed: __game.st.removed.size, plates: __game.L.plates.length }));
  info.solved = st.removed === st.plates; info.ms = Date.now() - t0; if (!info.solved || info.name !== 'image') fail++;
  // 等上一轮自动通关的收尾（手指回到空闲位置）结束，否则下一次 autoSolve() 会被当作“停止”
  await p.waitForFunction(() => !document.getElementById('btnAuto').classList.contains('on'), null, { timeout: 10000 }).catch(() => {});
  out.push([n, info]); console.log(n, JSON.stringify(info));
}
await b.close();
execSync(`python3 -c "
from PIL import Image,ImageDraw
ims=[Image.open('/tmp/shape_'+n+'.png').convert('RGB') for n in ['heart','star_hole','cat']]
srcs=[Image.open('test/assets/shapes/'+n+'.png').convert('RGBA') for n in ['heart','star_hole','cat']]
W=ims[0].width;H=ims[0].height;o=Image.new('RGB',(W*3,H+260),'white')
for i,(im,s) in enumerate(zip(ims,srcs)):
  bg=Image.new('RGBA',s.size,(200,200,200,255));bg.alpha_composite(s);o.paste(bg.convert('RGB').resize((240,240)),(i*W+240,5));o.paste(im,(i*W,255))
o.resize((W*3//2,(H+260)//2)).save('screenshots/import_shape_samples.jpg',quality=88)"`);
console.log(JSON.stringify({ errs, fail }));
if (errs.length || fail) process.exit(1);
