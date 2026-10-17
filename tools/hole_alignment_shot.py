# v1.5：摆动板错位孔不能放螺丝（工具画面） + 参考 5.93s 摆动后 → screenshots/hole_alignment.jpg
import cv2,numpy as np,json
v=json.load(open('/tmp/holeal/view.json')); k,b,tx,ty,oy=v['k'],v['b'],v['tx'],v['ty'],v['oy']
X=lambda x:int(k*(b*x+tx)); Y=lambda y:int(k*(b*y+ty)+oy)
x0,y0,x1,y1=330,330,600,880
def tile(path,lab,marks,tool=True):
    im=cv2.imread(path)
    if tool:
        for (mx,my,c,t) in marks: cv2.circle(im,(X(mx),Y(my)),int(16*k*b),c,2); cv2.putText(im,t,(X(mx)+int(18*k*b),Y(my)+5),0,0.45*k*b*1.6,c,2)
        im=im[Y(y0):Y(y1),X(x0):X(x1)]
    else:
        for (mx,my,c,t) in marks: cv2.circle(im,(mx,my),16,c,2); cv2.putText(im,t,(mx+18,my+5),0,0.45,c,2)
        im=im[y0:y1,x0:x1]
    im=cv2.resize(im,(300,int(300*(y1-y0)/(x1-x0))))
    cv2.rectangle(im,(0,0),(300,40),(0,0,0),-1)
    for i,l in enumerate(lab.split('|')): cv2.putText(im,l,(4,15+i*17),0,0.43,(255,255,255),1)
    return cv2.copyMakeBorder(im,0,0,0,3,0)
R=(0,0,255); G=(0,200,0)
t=[tile('/tmp/phys/f_095.jpg','reference 5.933s: plate swung 16.75deg|base hole partly under plate',[(482,757,(0,200,255),'base'),(495,770,(255,0,255),'plate')],False),
   tile('/tmp/holeal/moved_a.jpg','tool v1.5: swung 17deg, screw lifted|X = base hole covered / plate hole moved',[(482,757,R,'X base'),(478.7,773.2,R,'X plate')]),
   tile('/tmp/holeal/moved_b.jpg','tap on moved plate hole -> rejected|screw dropped back to its hole',[(478.7,773.2,R,'rejected')]),
   tile('/tmp/holeal/cleared_b.jpg','after plate fell: base hole exposed|-> screw accepted',[(482,757,G,'OK')])]
cv2.imwrite('/workspace/screw-tool/screenshots/hole_alignment.jpg',np.hstack(t),[cv2.IMWRITE_JPEG_QUALITY,90])
