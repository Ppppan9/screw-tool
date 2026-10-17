# 参考 vs 工具：同一时刻（按第一手 tap1 对齐）板块物理反馈并排 → screenshots/physics_ref_vs_tool.jpg
import cv2,numpy as np,json
v=json.load(open('/tmp/physfr/view.json'))
rows=[("Move1 plate23 (1 screw)",(360,640,600,1000),[17,25,31,35,38,40,42,44,46]),("Move2 plate22 (2 screws)",(360,640,600,880),[63,70,75,81,85,86,87,88,95])]
def crop_tool(f,x0,y0,x1,y1):
    im=cv2.imread(f'/tmp/physfr/f{f}.jpg'); k,b,tx,ty,oy=v['k'],v['b'],v['tx'],v['ty'],v['oy']
    X=lambda x:int(k*(b*x+tx)); Y=lambda y:int(k*(b*y+ty)+oy)
    return im[Y(y0):Y(y1),X(x0):X(x1)]
out=[]
for name,(x0,y0,x1,y1),fr in rows:
    for src in ('ref','tool'):
        tiles=[]
        for f in fr:
            im=cv2.imread(f'/tmp/phys/f_{f:03d}.jpg')[y0:y1,x0:x1] if src=='ref' else crop_tool(f,x0,y0,x1,y1)
            im=cv2.resize(im,(170,int(170*(y1-y0)/(x1-x0))))
            cv2.rectangle(im,(0,0),(170,18),(0,0,0),-1)
            cv2.putText(im,f'{src} +{(f-17)*1000/30:.0f}ms f{f}',(3,13),0,0.4,(0,255,255) if src=='tool' else (255,255,255),1)
            tiles.append(cv2.copyMakeBorder(im,0,2,0,2,0))
        out.append(np.hstack(tiles))
    hdr=np.zeros((22,out[-1].shape[1],3),np.uint8); cv2.putText(hdr,name+'  (top=reference, bottom=tool v1.4.1, same ms after first tap)',(5,16),0,0.55,(255,255,255),1); out.insert(len(out)-2,hdr)
cv2.imwrite('/workspace/screw-tool/screenshots/physics_ref_vs_tool.jpg',np.vstack(out),[cv2.IMWRITE_JPEG_QUALITY,88])
