// v1.7.2：被螺丝托住的板保持托住（不穿过），移走那颗螺丝后才掉落。
// 自定义关卡：一块单钉横板 P；它正下方两颗插在底板空孔里的螺丝 S1/S2（托住 P）；侧上方 3 个空孔。
// 1) 拧走 P 的钉 → P 落到 S1/S2 上 → 5s 内位置不变（rest，支撑者含螺丝，0 ghost）
// 2) 移走 S1 → P 绕 S2 翻落离开画面。截图 screenshots/rest_on_screw.jpg
import { chromium } from 'playwright-core'; import fs from 'fs'; import { execFileSync } from 'child_process';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(800);
const W = ms => p.waitForTimeout(ms);
await p.evaluate(() => {
  const holes = [{ x: 360, y: 425 }, { x: 290, y: 520 }, { x: 430, y: 520 }, { x: 195, y: 330 }, { x: 525, y: 330 }, { x: 195, y: 380 }];
  const L = { name: 'rest-test', base: { polys: [[[160, 300], [560, 300], [560, 900], [160, 900]]], capsules: [] }, holes,
    plates: [{ poly: [[240, 400], [480, 400], [480, 450], [240, 450]], layer: 0, holes: [0], radius: 12 }],
    screws: [{ hole: 0 }, { hole: 1 }, { hole: 2 }] };
  __game.loadLevel(L);
});
await W(300);
const idle = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => !__game.screwVis.some(v => v.anim) && !__game.pending && !__game.physBusy())) return; await W(30); } };
const move = async (from, to) => { await p.evaluate(h => __game.tapHole(h), from); await W(250); await p.evaluate(h => __game.tapHole(h), to); };
const body = () => p.evaluate(() => { const v = __game.plateVis[0]; return { s: v.s, dx: +v.dx.toFixed(3), dy: +v.dy.toFixed(3), ang: +(v.ang * 180 / Math.PI).toFixed(3), rest: !!v.rest, sup: v.sup ? v.sup.s.slice() : null, ghosts: (__game.world && __game.world.ghosts) || 0 }; });
const shot = async () => Buffer.from((await p.evaluate(() => stage.toDataURL('image/jpeg', 0.92))).split(',')[1], 'base64');
fs.mkdirSync('/tmp/restscrew', { recursive: true });
const frames = []; const snap = async (label) => { const f = `/tmp/restscrew/${frames.length}.jpg`; fs.writeFileSync(f, await shot()); frames.push([f, label]); };
const R = {};
await snap('start: P pinned');
await move(0, 3); await W(1200); await idle();
R.landed = await body(); await snap(`P on screws (dy=${R.landed.dy.toFixed(1)})`);
const samples = [];
for (let i = 0; i < 10; i++) { await W(500); samples.push(await body()); }
R.after5s = samples[samples.length - 1]; await snap(`after 5s (dy=${R.after5s.dy.toFixed(1)})`);
R.maxDrift = Math.max(...samples.map(s => Math.hypot(s.dx - R.landed.dx, s.dy - R.landed.dy)));
R.maxAngDrift = Math.max(...samples.map(s => Math.abs(s.ang - R.landed.ang)));
R.logicRest = await p.evaluate(() => __game.st.rest && __game.st.rest.has(0));
R.notDone = await p.evaluate(() => !window.__finished);
// 移走 S1（孔 1 → 空孔 4）
await p.evaluate(h => __game.tapHole(h), 1); await W(250); await p.evaluate(h => __game.tapHole(h), 4);
let shotFall = false;
for (let i = 0; i < 100; i++) { await W(40); const s = await body(); if (!shotFall && s.dy > R.after5s.dy + 25) { shotFall = true; await snap(`S1 moved: P falls (ang=${s.ang.toFixed(0)}°)`); } if (s.s === 'gone') break; }
await W(800); R.final = await body(); await snap('P gone'); 
R.gone = R.final.s === 'gone'; R.logicRemoved = await p.evaluate(() => __game.st.removed.has(0) && !(__game.st.rest && __game.st.rest.size));
await b.close();
// 拼图
const out = process.cwd() + '/screenshots/rest_on_screw.jpg';
execFileSync('python3', ['-c', `
import sys,json
from PIL import Image, ImageDraw, ImageFont
fr=json.loads(sys.argv[1]); ims=[Image.open(f).convert('RGB') for f,_ in fr]
w,h=ims[0].size; box=(int(w*0.15),int(h*0.18),int(w*0.85),int(h*0.78))
ims=[im.crop(box) for im in ims]; cw,ch=ims[0].size; s=360/cw; ims=[im.resize((360,int(ch*s))) for im in ims]
H=ims[0].size[1]+34; out=Image.new('RGB',(360*len(ims),H),'white'); d=ImageDraw.Draw(out)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except Exception: font=None
for i,(im,(f,l)) in enumerate(zip(ims,fr)): out.paste(im,(360*i,34)); d.text((360*i+6,8),f'{i+1}. '+l,fill='black',font=font)
out.save(sys.argv[2],quality=90)`, JSON.stringify(frames), out]);
console.log(JSON.stringify(R), errs);
const ok = R.landed.s === 'fall' && R.landed.rest && R.landed.sup && R.landed.sup.length > 0 && R.landed.dy > 20 && R.maxDrift < 0.5 && R.maxAngDrift < 0.5 && R.after5s.rest && R.logicRest && R.notDone && R.after5s.ghosts === 0 && shotFall && R.gone && R.logicRemoved && !errs.length;
console.log('screenshot', out); console.log(ok ? 'RESTSCREW OK' : 'RESTSCREW FAIL'); process.exit(ok ? 0 : 1);
