# 从参考帧分割板块（分水岭，按已知螺丝位置做种子）与手型轮廓 -> src/ref_trace.json
import cv2, numpy as np, json, sys
groups = json.load(open('tools/screw_groups.json'))  # [[ [x,y],... ], ...] 每块板的螺丝
im = cv2.imread('ref/frames/g_004.jpg')
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
H, S, V = [hsv[..., i].astype(int) for i in range(3)]
bg = (H > 35) & (H < 90) & (S > 25)
hand = cv2.morphologyEx((~bg).astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(hand)
k = 1 + np.argmax(st2[1:, 4]); hm = (lab2 == k).astype(np.uint8) * 255
hm = cv2.morphologyEx(hm, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
cs, _ = cv2.findContours(hm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
base = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].tolist()
pink = (((H < 14) | (H > 160)) & (S > 30) & (V > 120))
pink = cv2.morphologyEx(pink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)) > 0
markers = np.zeros(H.shape, np.int32)
markers[cv2.erode(255 - hm, np.ones((5, 5), np.uint8)) > 0] = 1
markers[cv2.erode(pink.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 1
for i, g in enumerate(groups):
    for p in g: cv2.circle(markers, (int(p[0]), int(p[1])), 10, i + 2, -1)
    if len(g) == 2: cv2.line(markers, tuple(map(int, g[0])), tuple(map(int, g[1])), i + 2, 8)
im2 = im.copy()
for g in groups:
    for q in g: cv2.circle(im2, (int(q[0]), int(q[1])), 22, (222, 190, 200), -1)
for q in []: cv2.circle(im2, (int(q[0]), int(q[1])), 18, (222, 190, 200), -1)
ws = cv2.watershed(cv2.GaussianBlur(im2, (3, 3), 0), markers)
plates = []
for i, g in enumerate(groups):
    m = (ws == i + 2).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) & hm
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    plates.append({'poly': cv2.approxPolyDP(c, 1.4, True)[:, 0, :].tolist(), 'screws': g})
cv2.imwrite('/tmp/handmask.png', hm)  # make_bg.py 使用
json.dump({'plates': plates, 'base': base}, open('src/ref_trace.json', 'w'))
vis = im.copy()
for i, p in enumerate(plates):
    col = tuple(int(v) for v in np.random.default_rng(i).integers(0, 255, 3)); a = np.array(p['poly'])
    ov = vis.copy(); cv2.fillPoly(ov, [a], col); vis = cv2.addWeighted(ov, 0.5, vis, 0.5, 0); cv2.polylines(vis, [a], True, (0, 0, 0), 1)
cv2.imwrite(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ws.png', vis[290:960, 90:640])
print(len(plates))
