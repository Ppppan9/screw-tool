# 经典款（大脚掌）：从朋友圈广告截图（ref/bigfoot/ref_720.png，游戏区 9:16 放大到 720x1280）分割板块与脚型 -> src/bigfoot_trace.json
# 种子 = 检测到的螺丝（Hough）按板分组；分隔 = 深色描边/缝；底板 = 黑色外轮廓内部（去掉右下角触控笔）
import cv2, numpy as np, json, sys
im = cv2.imread('ref/bigfoot/ref_720.png')
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); V = hsv[..., 2].astype(int); S = hsv[..., 1].astype(int)
b, g, r = [im[..., i].astype(int) for i in range(3)]
pen = (b > r + 8) & (V < 140)
yy, xx = np.mgrid[0:H, 0:W]; pen &= (xx > 470) & (yy > 1030)  # 只在右下角触控笔区域
pen = cv2.dilate(pen.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
dark = (V < 75) & ~pen
dk = cv2.morphologyEx(dark.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
# 外部 = 从画面边缘泛洪到的非深色像素
ff = 255 - dk; ff[pen] = 0  # 触控笔当作障碍（它贴着脚跟描边），之后从脚型里去掉
mask = np.zeros((H + 2, W + 2), np.uint8)
out = ff.copy(); cv2.floodFill(out, mask, (5, 5), 128)
foot = ((out != 128) & ~pen).astype(np.uint8) * 255
foot = cv2.morphologyEx(foot, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(foot); k = 1 + np.argmax(st[1:, 4]); foot = (lab == k).astype(np.uint8) * 255
cs, _ = cv2.findContours(foot, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
base = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].tolist()
G = json.load(open('tools/bigfoot_groups.json'))
groups, empty = G['plates'], G['empty']
markers = np.zeros((H, W), np.int32)
markers[cv2.erode(255 - foot, np.ones((5, 5), np.uint8)) > 0] = 1
sep = (V < 95) | ((S > 60) & (V < 170))  # 描边 + 缝里露出的棕色底板
im2 = im.copy()
for i, pl in enumerate(groups):
    pts = pl['screws'] + pl.get('holes', [])
    for p in pts: cv2.circle(markers, (int(p[0]), int(p[1])), 12, i + 2, -1); cv2.circle(im2, (int(p[0]), int(p[1])), 27, (190, 190, 190), -1)
    for a, bb in zip(pts, pts[1:]): cv2.line(markers, tuple(map(int, a)), tuple(map(int, bb)), i + 2, 8)
for p in G.get('seeds_sep', []): cv2.circle(markers, (int(p[0]), int(p[1])), 4, 1, -1)
ws = cv2.watershed(cv2.GaussianBlur(im2, (3, 3), 0), markers)
plates = []
for i, pl in enumerate(groups):
    m = (ws == i + 2).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    plates.append({'poly': cv2.approxPolyDP(c, 1.4, True)[:, 0, :].tolist(), 'screws': pl['screws'], 'holes': pl.get('holes', []), 'mat': pl.get('mat', 'metal'), 'name': pl.get('name', '')})
json.dump({'plates': plates, 'base': base, 'empty': empty, 'src': 'ref/bigfoot/ref_720.png'}, open('src/bigfoot_trace.json', 'w'))
vis = im.copy()
for i, p in enumerate(plates):
    col = tuple(int(v) for v in np.random.default_rng(i + 3).integers(0, 255, 3)); a = np.array(p['poly'])
    ov = vis.copy(); cv2.fillPoly(ov, [a], col); vis = cv2.addWeighted(ov, 0.45, vis, 0.55, 0); cv2.polylines(vis, [a], True, (0, 0, 255), 1)
cv2.polylines(vis, [np.array(base)], True, (0, 255, 0), 2)
cv2.imwrite(sys.argv[1] if len(sys.argv) > 1 else '/tmp/foot_ws.jpg', vis[100:1150, 120:620])
print(len(plates), 'plates', sum(len(p['screws']) for p in plates), 'screws')
