import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file:///workspace/screw-tool/index.html'); await p.waitForTimeout(500);
const r = await p.evaluate(() => { const L = __game.L; return { holes: L.holes, screws: L.screws, plates: L.plates.map(p => ({ poly: p.poly, holes: p.holes, layer: p.layer })), base: L.base.polys, caps: L.base.capsules }; }); fs.writeFileSync(process.argv[2] || "/tmp/level.json", JSON.stringify(r));

await b.close();
