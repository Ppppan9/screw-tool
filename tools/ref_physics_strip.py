import cv2,numpy as np
rows=[("Move1 plate23 (1 screw)", '/tmp/phys',2.8,(360,640,600,1000),[(17,'tap1 lift'),(25,'hover: plate stays'),(31,'tap2 fly'),(35,'screw-in'),(38,'seated'),(40,'release'),(42,'dy 11'),(44,'dy 37'),(46,'dy 79, 0deg')]),
      ("Move2 plate22 (2 screws)", '/tmp/phys',2.8,(360,640,600,880),[(63,'tap1 lift'),(70,'hover: no swing'),(75,'tap2 fly'),(81,'descend'),(85,'seated'),(86,'swing 2.5deg'),(87,'7.75deg'),(88,'16.75deg max'),(95,'hold 16.75')]),
      ("plate24 last screw fall", '/tmp/phys2',10.0,(200,700,440,1060),[(13,'hover: stays'),(20,'seated'),(21,''),(22,'rel -2deg dy5'),(23,'-3.3 dy12'),(24,'-6.5 dy25'),(26,'-11.5 dy62'),(28,'-18 dy114'),(29,'-20 dy146')])]
out=[]
for name,d,t0,(x0,y0,x1,y1),fr in rows:
    tiles=[]
    for f,lab in fr:
        im=cv2.imread(f'{d}/f_{f:03d}.jpg')[y0:y1,x0:x1]; s=200/im.shape[1]; im=cv2.resize(im,None,fx=s,fy=s)
        im=cv2.resize(im,(200,int(200*(y1-y0)/(x1-x0))))
        cv2.rectangle(im,(0,0),(200,36),(0,0,0),-1)
        cv2.putText(im,f't={t0+(f-1)/30:.3f}s f{f}',(3,14),0,0.45,(255,255,255),1)
        cv2.putText(im,lab,(3,31),0,0.45,(0,255,255),1)
        tiles.append(im)
    h=max(t.shape[0] for t in tiles); tiles=[cv2.copyMakeBorder(t,0,h-t.shape[0],0,2,0) for t in tiles]
    row=np.hstack(tiles); hdr=np.zeros((26,row.shape[1],3),np.uint8); cv2.putText(hdr,name,(5,19),0,0.65,(255,255,255),2)
    out+= [hdr,row]
W=max(r.shape[1] for r in out); out=[cv2.copyMakeBorder(r,0,0,0,W-r.shape[1],0) for r in out]
cv2.imwrite('/workspace/screw-tool/screenshots/ref_physics_frames.jpg',np.vstack(out),[cv2.IMWRITE_JPEG_QUALITY,88])
