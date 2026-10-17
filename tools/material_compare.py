# 材质对照：参考帧 2.93s vs 工具开局帧，相同比例放大裁切并排 → screenshots/material_compare*.jpg
import sys
from PIL import Image, ImageDraw, ImageFont
ref = Image.open(sys.argv[1]).convert('RGB'); tool = Image.open(sys.argv[2]).convert('RGB'); out = sys.argv[3]
# (名称, 中心x, 中心y, 半边长) 720x1280 坐标
REG = [('finger plate', 262, 405, 48), ('palm 2-screw plate', 410, 690, 56), ('screw head', 385, 363, 26),
       ('seam', 380, 470, 30), ('base / wrist cuff', 380, 880, 56), ('empty hole', 401, 667, 26),
       ('edge / thickness / shadow', 460, 850, 40)]
Z = 260
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception: F = ImageFont.load_default()
W = 3 * Z + 40; H = len(REG) * (Z + 26) + 30
img = Image.new('RGB', (W, H), (30, 30, 30)); d = ImageDraw.Draw(img)
d.text((10, 6), 'REF 2.93s', fill='white', font=F); d.text((Z + 20, 6), 'TOOL start', fill='white', font=F); d.text((2 * Z + 30, 6), '|diff| x3', fill='white', font=F)
from PIL import ImageChops
for i, (n, x, y, h) in enumerate(REG):
    box = (x - h, y - h, x + h, y + h); a = ref.crop(box).resize((Z, Z), Image.NEAREST if h < 30 else Image.LANCZOS); b = tool.crop(box).resize((Z, Z), Image.NEAREST if h < 30 else Image.LANCZOS)
    df = ImageChops.difference(a, b).point(lambda v: min(255, v * 3))
    oy = 30 + i * (Z + 26)
    img.paste(a, (10, oy)); img.paste(b, (Z + 20, oy)); img.paste(df, (2 * Z + 30, oy))
    d.text((10, oy + Z + 3), f'{n}  ({x},{y}) {2*h}px -> x{Z/(2*h):.1f}', fill=(220, 220, 120), font=F)
img.save(out, quality=90)
