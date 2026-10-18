import { chromium } from 'playwright-core'; import fs from 'fs';
const img = n => 'data:image/png;base64,' + fs.readFileSync('test/assets/shapes/' + n + '.png').toString('base64');
const cases = [['reference', { level: 'reference' }], ['random1', { level: 'random', seed: 1 }], ['random42x3', { level: 'random', seed: 42, genLayers: 3 }], ['random7', { level: 'random', seed: 7 }],
 ['heart', { shapeImg: img('heart'), partStyle: 'strip', imgLayers: 1 }], ['star_hole', { shapeImg: img('star_hole'), partStyle: 'voronoi', imgLayers: 2 }], ['cat', { shapeImg: img('cat'), partStyle: 'strip', baseFill: 'image', plateTint: 'image', partAngle: 75, imgLayers: 2 }]];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const [name, opt] of cases) {
  const p = await b.newPage({ viewport: { width: 900, height: 1300 } });
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300);
  await p.evaluate((o) => { const G = __game; const { shapeImg, level, ...rest } = o; Object.assign(G.S, rest); if (shapeImg) G.set('shapeImg', shapeImg); else { G.set('level', level); G.newGame(); } }, opt);
  if (opt.shapeImg) { await p.waitForFunction(() => __game.L.name === 'image', null, { timeout: 60000 }); await p.waitForTimeout(500); }
  const r = await p.evaluate(() => { const c = __game.plateVis.map(q => q.fixCover), ci = __game.plateVis.map(q => q.fixCoverIns); return { minIns: Math.min(...ci), maxIns: Math.max(...ci), n: c.length, min: Math.min(...c), max: Math.max(...c), npts: Math.max(...__game.L.plates.map(q => q.poly.length)) }; });
  console.log(name, JSON.stringify(r)); await p.close();
}
await b.close();
