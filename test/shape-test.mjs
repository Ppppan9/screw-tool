// 导入透明图形生成关卡测试：3 张样例图 → 生成、截图、自动通关
import { chromium } from 'playwright-core'; import fs from 'fs'; import { execSync } from 'child_process';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(400);
const cases = [['heart', { partStyle: 'strip', baseFill: 'color' }], ['star_hole', { partStyle: 'voronoi', baseFill: 'color', imgLayers: 2 }], ['cat', { partStyle: 'strip', baseFill: 'image', plateTint: 'image', partAngle: 75 }]];
const out = []; let fail = 0;
for (const [n, opt] of cases) {
  const url = 'data:image/png;base64,' + fs.readFileSync(`test/assets/shapes/${n}.png`).toString('base64');
  await p.evaluate(([u, o]) => { Object.assign(__game.S, o); __game.set('shapeImg', u); }, [url, opt]);
  await p.waitForFunction(() => __game.L.name === 'image' && __game.L.base.inner !== undefined, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const info = await p.evaluate(() => ({ name: __game.L.name, plates: __game.L.plates.length, screws: __game.L.screws.length, holes: __game.L.holes.length, inner: (__game.L.base.inner || []).length, outer: __game.L.base.polys.length, layers: Math.max(...__game.L.plates.map(q => q.layer)) + 1, attempts: __game.L.attempts }));
  fs.writeFileSync(`/tmp/shape_${n}.png`, Buffer.from((await p.evaluate(() => stage.toDataURL())).split(',')[1], 'base64'));
  await p.evaluate(() => { window.__finished = false; Object.assign(__game.S, { autoSpeed: 4, autoStepMin: 0, autoStepMax: 20, autoMoveDur: 60, autoSelectGap: 0, autoStartDelay: 0, liftDur: 40, flyDur: 80, screwInDur: 40, fallDelay: 0 }); __game.autoSolve(); });
  const t0 = Date.now(); while (!(await p.evaluate(() => window.__finished)) && Date.now() - t0 < 300000) await p.waitForTimeout(200);
  const st = await p.evaluate(() => ({ removed: __game.st.removed.size, plates: __game.L.plates.length }));
  info.solved = st.removed === st.plates; info.ms = Date.now() - t0; if (!info.solved || info.name !== 'image') fail++;
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
