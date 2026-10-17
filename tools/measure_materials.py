# 材质取样：python3 tools/measure_materials.py ref.png tool.png level.json  （level.json 由 node test/dump-level.mjs 生成）
import sys, json, numpy as np, cv2
L = json.load(open(sys.argv[3]))
def load(p): return cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB).astype(np.float32)
H, W = 1280, 720
pm = np.zeros((H, W), np.uint8)
for p in L['plates']: cv2.fillPoly(pm, [np.round(np.array(p['poly'])).astype(np.int32)], 1)
bm = np.zeros((H, W), np.uint8)
for p in L['base']: cv2.fillPoly(bm, [np.round(np.array(p)).astype(np.int32)], 1)
for c in L.get('caps') or []: cv2.polylines(bm, [np.round(np.array(c['pts'])).astype(np.int32)], False, 1, int(c['w']))
sm = np.zeros((H, W), np.uint8)
scr = [L['holes'][s['hole']] for s in L['screws']]
for h in scr: cv2.circle(sm, (int(h['x']), int(h['y'])), 24, 1, -1)
din = cv2.distanceTransform(pm, cv2.DIST_L2, 5); dout = cv2.distanceTransform(1 - pm, cv2.DIST_L2, 5)
bout = cv2.distanceTransform(1 - bm, cv2.DIST_L2, 5); bin_ = cv2.distanceTransform(bm, cv2.DIST_L2, 5)
hexs = lambda v: '#%02x%02x%02x' % tuple(int(round(min(255, max(0, x)))) for x in v)
lum = lambda a: a @ np.array([0.299, 0.587, 0.114])
yy, xx = np.mgrid[0:H, 0:W]
def stats(img, m, mode='med'):
    px = img[m.astype(bool)]
    if len(px) == 0: return 'n/a'
    l = lum(px)
    if mode == 'med': return hexs(np.median(px, 0))
    if mode == 'hi': return hexs(px[l >= np.percentile(l, 95)].mean(0))
    if mode == 'lo': return hexs(px[l <= np.percentile(l, 10)].mean(0))
    if mode == 'sd': return '%.1f' % l.std()
def ring(r0, r1):
    m = np.zeros((H, W), bool)
    for h in scr: d = np.hypot(xx - h['x'], yy - h['y']); m |= (d >= r0) & (d < r1)
    return m
def off(dx, dy, r=3):
    m = np.zeros((H, W), bool)
    for h in scr: m |= np.hypot(xx - h['x'] - dx, yy - h['y'] - dy) < r
    return m
h29 = L['holes'][29]; dh = np.hypot(xx - h29['x'], yy - h29['y'])
free = (sm == 0)
wr = (bm > 0) & (pm == 0) & (yy > 860) & (yy < 915) & (bin_ > 6)
M = [('plate center (d>9)', (din > 9) & free, 'med'), ('plate center lum sd (hatch)', (din > 9) & free, 'sd'),
     ('plate edge band (d 2.5-5)', (din > 2.5) & (din <= 5) & free, 'med'), ('plate highlight p95', (din > 1.5) & free, 'hi'),
     ('plate hatch dark p10', (din > 9) & free, 'lo'),
     ('plate outline (abs d<1.5, darkest10%)', ((din > 0) & (din < 1.5) | (dout > 0) & (dout < 1.5)) & free, 'lo'),
     ('seam (outside plates, in base, d 1.5-3.5)', (pm == 0) & (bm > 0) & (dout > 1.5) & (dout < 3.5) & free, 'med'),
     ('screw head body (r 8-15)', ring(8, 15), 'med'), ('screw head top-left (-9,-9)', off(-9, -9), 'med'),
     ('screw head bottom-right (+9,+9)', off(9, 9), 'med'), ('screw head p95', ring(0, 16), 'hi'),
     ('cross slot (r<9, darkest10%)', ring(0, 9), 'lo'), ('screw rim (r 17-21.5, darkest10%)', ring(17, 21.5), 'lo'),
     ('empty hole interior (r<7)', dh < 7, 'med'), ('empty hole rim p95 (r 10-15)', (dh >= 10) & (dh < 15), 'hi'),
     ('base wrist median', wr, 'med'), ('base wrist p95 (light strokes)', wr, 'hi'), ('base wrist p10 (dark strokes)', wr, 'lo'),
     ('base wrist lum sd', wr, 'sd'),
     ('base outline (y>900, abs d<2, darkest10%)', (((bout > 0) & (bout < 2)) | ((bin_ > 0) & (bin_ < 2))) & (yy > 900), 'lo'),
     ('base inner edge (d 2-4, y>880) p95', (bin_ > 2) & (bin_ < 4) & (yy > 880) & (pm == 0), 'hi'),
     ('bg halo outside base (d 1.5-3, y>880) p95', (bout > 1.5) & (bout < 3) & (yy > 880), 'hi'),
     ('bg shadow just below base (d 3-8, y>900)', (bout > 3) & (bout < 8) & (yy > 900), 'med'),
     ('bg far (d 25-40, y>880)', (bout > 25) & (bout < 40) & (yy > 880), 'med')]
imgs = [load(p) for p in sys.argv[1:3]]
print('| 取样 | 参考 2.93s | 工具 |\n|---|---|---|')
for n, m, mode in M: print(f'| {n} | {stats(imgs[0], m, mode)} | {stats(imgs[1], m, mode)} |')
