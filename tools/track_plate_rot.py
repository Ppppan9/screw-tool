import cv2,numpy as np,json,sys
L=json.load(open('/tmp/phys/level.json'))
d=sys.argv[1]; pi=int(sys.argv[2]); ref=int(sys.argv[3]); a,b=int(sys.argv[4]),int(sys.argv[5]); t0=float(sys.argv[6])
poly=np.array(L['plates'][pi]['poly'],np.float32)
bx0,by0=poly.min(0)-60; bx1,by1=poly.max(0)+[60,200]; bx0,by0=int(bx0),int(by0); bx1,by1=int(bx1),min(1280,int(by1))
ld=lambda i: cv2.imread(f'{d}/f_{i:03d}.jpg')[by0:by1,bx0:bx1].astype(np.float32)
tpl=ld(ref); mask=np.zeros(tpl.shape[:2],np.float32); pp=poly-[bx0,by0]
cv2.fillPoly(mask,[pp.astype(np.int32)],1.0); mask=cv2.erode(mask,np.ones((5,5),np.uint8))
for h in L['plates'][pi]['holes']: cv2.circle(mask,(int(L['holes'][h]['x']-bx0),int(L['holes'][h]['y']-by0)),18,0,-1)
cx,cy=pp.mean(0); H,W=tpl.shape[:2]
def sc(cur,th,dx,dy):
    M=cv2.getRotationMatrix2D((float(cx),float(cy)),-th,1.0); M[0,2]+=dx; M[1,2]+=dy
    wt=cv2.warpAffine(tpl,M,(W,H)); wm=cv2.warpAffine(mask,M,(W,H))>0.5
    if wm.sum()<300: return 1e9
    return float(np.percentile(np.abs(cur[wm]-wt[wm]).mean(1),50))
th0=dx0=dy0=0; vy=0
for i in range(a,b+1):
    cur=ld(i); best=None
    for st,rng,tr,ts in [(3,24,12,4),(1,3,3,1),(0.25,1,1,0.5)]:
        py=dy0+vy if st==3 else dy0
        for th in np.arange(th0-rng,th0+rng+1e-6,st):
            for dx in np.arange(dx0-tr,dx0+tr+1e-6,ts):
                for dy in np.arange(py-tr,py+tr*2+1e-6,ts):
                    s=sc(cur,th,dx,dy)
                    if best is None or s<best[0]: best=(s,th,dx,dy)
        th0,dx0n,dyn=best[1:]
        vy2=dyn-dy0; dx0,dy0=dx0n,dyn
    vy=max(vy,vy2)
    print(dict(f=i,t=round(t0+(i-1)/30,3),th=float(best[1]),dx=float(best[2]),dy=float(best[3]),err=round(best[0],1)),flush=True)
