import { useState, useEffect, useRef } from "react";

export default function CropModal({ imageSrc, onDone, onCancel }) {
  const [mode, setMode] = useState("portrait");
  const [crop, setCrop] = useState({ x:0, y:0, w:0, h:0 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [cropStart, setCropStart] = useState(null);
  const containerRef = useRef(); const imgRef = useRef();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!imgLoaded) return;
    const el = containerRef.current;
    const W = el.offsetWidth; const H = el.offsetHeight;
    let w, h;
    if (mode === "portrait") { w = Math.min(W*0.7, H*0.7*0.75); h = w*(4/3); if (h>H*0.85) { h=H*0.85; w=h*(3/4); } }
    else if (mode === "square") { w = h = Math.min(W,H)*0.7; }
    else { w = W*0.7; h = H*0.7; }
    setCrop({ x:(W-w)/2, y:(H-h)/2, w, h });
  }, [imgLoaded, mode]);

  useEffect(() => {
    if (!imgLoaded || crop.w < 10 || crop.h < 10) return;
    const img = imgRef.current; const container = containerRef.current;
    const ia = img.naturalWidth/img.naturalHeight; const ca = container.offsetWidth/container.offsetHeight;
    let iW, iH, iX, iY;
    if (ia>ca) { iW=container.offsetWidth; iH=iW/ia; iX=0; iY=(container.offsetHeight-iH)/2; }
    else { iH=container.offsetHeight; iW=iH*ia; iX=(container.offsetWidth-iW)/2; iY=0; }
    const cx=(crop.x-iX)*(img.naturalWidth/iW); const cy=(crop.y-iY)*(img.naturalHeight/iH);
    const cw=crop.w*(img.naturalWidth/iW); const ch=crop.h*(img.naturalHeight/iH);
    if (cw<1||ch<1) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1,cw); canvas.height = Math.max(1,ch);
    canvas.getContext("2d").drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.7));
  }, [crop, imgLoaded]);

  function getPos(e) { const rect=containerRef.current.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; return{x:cx-rect.left,y:cy-rect.top}; }
  function clamp(c) { const el=containerRef.current; const W=el.offsetWidth; const H=el.offsetHeight; return{x:Math.max(0,Math.min(c.x,W-Math.max(c.w,20))),y:Math.max(0,Math.min(c.y,H-Math.max(c.h,20))),w:Math.max(20,Math.min(c.w,W)),h:Math.max(20,Math.min(c.h,H))}; }

  function onPD(e) {
    e.preventDefault(); const pos=getPos(e); const handle=e.target.dataset?.handle;
    if (handle) { setResizing(handle); setDragStart(pos); setCropStart({...crop}); return; }
    if (pos.x>=crop.x&&pos.x<=crop.x+crop.w&&pos.y>=crop.y&&pos.y<=crop.y+crop.h) { setDragging(true); setDragStart(pos); setCropStart({...crop}); return; }
    setDragStart(pos); setCropStart({x:pos.x,y:pos.y,w:0,h:0}); setCrop({x:pos.x,y:pos.y,w:0,h:0});
  }
  function onPM(e) {
    if (!dragStart) return; e.preventDefault(); const pos=getPos(e); const dx=pos.x-dragStart.x; const dy=pos.y-dragStart.y;
    if (dragging) { setCrop(clamp({...cropStart,x:cropStart.x+dx,y:cropStart.y+dy})); return; }
    if (resizing) {
      let{x,y,w,h}=cropStart;
      if(resizing.includes("e"))w=Math.max(20,w+dx); if(resizing.includes("s"))h=Math.max(20,h+dy);
      if(resizing.includes("w")){w=Math.max(20,w-dx);x=x+dx;} if(resizing.includes("n")){h=Math.max(20,h-dy);y=y+dy;}
      if(mode==="portrait")h=w*(4/3); if(mode==="square")h=w; setCrop(clamp({x,y,w,h})); return;
    }
    let w=pos.x-cropStart.x; let h=pos.y-cropStart.y;
    if(mode==="portrait")h=Math.abs(w)*(4/3)*(h<0?-1:1);
    if(mode==="square"){const s=Math.max(Math.abs(w),Math.abs(h));w=w<0?-s:s;h=h<0?-s:s;}
    setCrop(clamp({x:w<0?cropStart.x+w:cropStart.x,y:h<0?cropStart.y+h:cropStart.y,w:Math.abs(w),h:Math.abs(h)}));
  }
  function onPU() { setDragging(false); setResizing(null); setDragStart(null); setCropStart(null); }

  function applyCrop() {
    const img=imgRef.current; const container=containerRef.current;
    const ia=img.naturalWidth/img.naturalHeight; const ca=container.offsetWidth/container.offsetHeight;
    let iW,iH,iX,iY;
    if(ia>ca){iW=container.offsetWidth;iH=iW/ia;iX=0;iY=(container.offsetHeight-iH)/2;}
    else{iH=container.offsetHeight;iW=iH*ia;iX=(container.offsetWidth-iW)/2;iY=0;}
    const cx=(crop.x-iX)*(img.naturalWidth/iW); const cy=(crop.y-iY)*(img.naturalHeight/iH);
    const cw=crop.w*(img.naturalWidth/iW); const ch=crop.h*(img.naturalHeight/iH);
    const canvas=document.createElement("canvas"); canvas.width=Math.max(1,cw); canvas.height=Math.max(1,ch);
    canvas.getContext("2d").drawImage(img,cx,cy,cw,ch,0,0,cw,ch); onDone(canvas.toDataURL("image/jpeg",1.0));
  }

  const HANDLES = ["nw","n","ne","e","se","s","sw","w"]; const hSize = 14;
  function hStyle(h) {
    const p={nw:{left:crop.x-hSize/2,top:crop.y-hSize/2},n:{left:crop.x+crop.w/2-hSize/2,top:crop.y-hSize/2},ne:{left:crop.x+crop.w-hSize/2,top:crop.y-hSize/2},e:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h/2-hSize/2},se:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h-hSize/2},s:{left:crop.x+crop.w/2-hSize/2,top:crop.y+crop.h-hSize/2},sw:{left:crop.x-hSize/2,top:crop.y+crop.h-hSize/2},w:{left:crop.x-hSize/2,top:crop.y+crop.h/2-hSize/2}};
    const c={nw:"nwse-resize",n:"ns-resize",ne:"nesw-resize",e:"ew-resize",se:"nwse-resize",s:"ns-resize",sw:"nesw-resize",w:"ew-resize"};
    return{position:"absolute",width:hSize,height:hSize,background:"#e8e2d8",borderRadius:2,zIndex:10,cursor:c[h],touchAction:"none",...p[h]};
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1a1a1a",flexShrink:0}}>
        <button onClick={onCancel} style={{background:"transparent",border:"none",color:"#888",fontSize:11,cursor:"pointer"}}>Cancel</button>
        <div style={{display:"flex",gap:6}}>
          {[["portrait","3:4"],["square","1:1"],["free","Free"]].map(([m,label])=>(
            <button key={m} onClick={()=>setMode(m)} style={{background:mode===m?"#e8e2d8":"#1a1a1a",color:mode===m?"#111":"#666",border:`1px solid ${mode===m?"#e8e2d8":"#2a2a2a"}`,borderRadius:20,padding:"4px 12px",fontSize:10,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",userSelect:"none",touchAction:"none",cursor:"crosshair"}}
          onMouseDown={onPD} onMouseMove={onPM} onMouseUp={onPU} onMouseLeave={onPU}
          onTouchStart={onPD} onTouchMove={onPM} onTouchEnd={onPU}>
          <img ref={imgRef} src={imageSrc} onLoad={()=>setImgLoaded(true)} style={{width:"100%",height:"100%",objectFit:"contain",display:"block",pointerEvents:"none"}}/>
          {imgLoaded && crop.w > 10 && (<>
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              <defs><mask id="cm"><rect width="100%" height="100%" fill="white"/><rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black"/></mask></defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cm)"/>
              <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#e8e2d8" strokeWidth="1.5"/>
            </svg>
            {HANDLES.map(h=><div key={h} data-handle={h} style={hStyle(h)}/>)}
          </>)}
          {!imgLoaded && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:11}}>Loading...</div>}
        </div>
        <div style={{width:100,background:"#080808",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:10,borderLeft:"1px solid #1a1a1a",flexShrink:0}}>
          <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#444"}}>Preview</div>
          {previewUrl
            ? <img src={previewUrl} style={{width:80,height:mode==="portrait"?80*(4/3):80,objectFit:"cover",borderRadius:2,border:"1px solid #222",maxHeight:120}}/>
            : <div style={{width:80,height:80,background:"#111",borderRadius:2}}/>
          }
        </div>
      </div>
      <div style={{padding:"12px 16px",borderTop:"1px solid #1a1a1a",flexShrink:0}}>
        <div style={{textAlign:"center",color:"#444",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Drag to crop · Handles to resize</div>
        <button onClick={applyCrop} style={{width:"100%",background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"14px",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:2,textTransform:"uppercase"}}>Apply</button>
      </div>
    </div>
  );
}
