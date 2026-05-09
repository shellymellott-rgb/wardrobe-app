import { useState, useRef, useEffect } from "react";
import { generateImageVersions } from "../utils/imageUtils.js";

// Composite a transparent PNG onto a white canvas and return a JPEG data URL.
// Keeps the pipeline JPEG-compatible and avoids giant PNG base64 strings.
function compositeOnWhite(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/jpeg", 1.0));
    };
    img.src = dataUrl;
  });
}

const CHECKERBOARD = [
  "linear-gradient(45deg,#2a2a2a 25%,transparent 25%)",
  "linear-gradient(-45deg,#2a2a2a 25%,transparent 25%)",
  "linear-gradient(45deg,transparent 75%,#2a2a2a 75%)",
  "linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
].join(",");

export default function ImageEditor({ imageData, onApply, onClose }) {
  const [current, setCurrent]         = useState(imageData);
  const [isTransparent, setIsTransparent] = useState(false);
  const [processing, setProcessing]   = useState(false);
  const [applying, setApplying]       = useState(false);
  const [error, setError]             = useState(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const changed = current !== imageData;

  async function removeBg() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/removebg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Background removal failed");
      setCurrent(data.result);
      setIsTransparent(true);
    } catch (e) {
      console.error("[editor] background removal failed:", e);
      setError(e.message || "Background removal failed");
    }
    setProcessing(false);
  }

  async function apply() {
    setApplying(true);
    try {
      // Composite transparent PNG on white before compressing
      const source = isTransparent ? await compositeOnWhite(current) : current;
      const { full, thumb } = await generateImageVersions(source);
      onApply(full, thumb);
    } catch (e) {
      console.error("[editor] apply failed:", e);
      setApplying(false);
    }
  }

  function reset() {
    setCurrent(imageData);
    setIsTransparent(false);
    setError(null);
    setEraseMode(false);
  }

  useEffect(() => {
    if (!eraseMode || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = current;
  }, [eraseMode, current]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function erase(e) {
    if (!isDrawing.current || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  }

  function startErase(e) {
    isDrawing.current = true;
    erase(e);
  }

  function stopErase() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setCurrent(dataUrl);
    setIsTransparent(true);
  }

  return (
    <div style={{
      position:"fixed",inset:0,background:"#000",zIndex:300,
      display:"flex",flexDirection:"column",
      fontFamily:"'DM Sans',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding:"12px 16px",display:"flex",justifyContent:"space-between",
        alignItems:"center",borderBottom:"1px solid #1a1a1a",flexShrink:0,
      }}>
        <button
          onClick={onClose}
          style={{background:"transparent",border:"none",color:"#888",fontSize:11,cursor:"pointer",letterSpacing:1}}
        >Cancel</button>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"#555"}}>Edit Photo</div>
        <button
          onClick={apply}
          disabled={applying || processing}
          style={{
            background: applying||processing ? "#1a1a1a" : "#e8e2d8",
            color: applying||processing ? "#444" : "#111",
            border:"none",borderRadius:3,padding:"6px 18px",
            fontSize:11,letterSpacing:2,textTransform:"uppercase",
            cursor: applying||processing ? "not-allowed" : "pointer",fontWeight:600,
          }}
        >{applying ? "Saving..." : "Apply"}</button>
      </div>

      {/* Preview area */}
      <div style={{
        flex:1,display:"flex",alignItems:"center",justifyContent:"center",
        overflow:"hidden",position:"relative",
        background: isTransparent ? "#1a1a1a" : "#0d0d0d",
        backgroundImage: isTransparent ? CHECKERBOARD : "none",
        backgroundSize: isTransparent ? "20px 20px" : "auto",
        backgroundPosition: isTransparent ? "0 0,0 10px,10px -10px,-10px 0" : "auto",
      }}>
        {processing ? (
          <div style={{textAlign:"center",color:"#b8976a",padding:32}}>
            <div style={{fontSize:32,marginBottom:14,animation:"pulse 1.2s ease-in-out infinite"}}>✦</div>
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>
              Removing background…
            </div>
            <div style={{fontSize:10,color:"#555",lineHeight:1.6}}>
              This may take 10–20 seconds.
            </div>
          </div>
        ) : eraseMode ? (
          <canvas
            ref={canvasRef}
            style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block",cursor:"crosshair",touchAction:"none"}}
            onMouseDown={startErase}
            onMouseMove={erase}
            onMouseUp={stopErase}
            onMouseLeave={stopErase}
            onTouchStart={startErase}
            onTouchMove={erase}
            onTouchEnd={stopErase}
          />
        ) : (
          <img
            src={current}
            style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block"}}
            alt="edit preview"
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin:"0 16px",background:"#2a1010",border:"1px solid #5a2020",
          borderRadius:6,padding:"10px 14px",fontSize:11,color:"#e07070",textAlign:"center",
        }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{padding:16,borderTop:"1px solid #1a1a1a",display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
        <button
          onClick={removeBg}
          disabled={processing || applying}
          style={{
            width:"100%",
            background: processing||applying ? "#111" : "#161616",
            border:`1px solid ${processing||applying ? "#1a1a1a" : "#333"}`,
            color: processing||applying ? "#444" : "#e8e2d8",
            borderRadius:8,padding:"14px",
            fontSize:11,letterSpacing:2.5,textTransform:"uppercase",
            cursor: processing||applying ? "not-allowed" : "pointer",fontWeight:600,
          }}
        >{processing ? "Processing…" : "✦  Remove Background"}</button>

        {!processing && !applying && (
          <>
            <button
              onClick={()=>setEraseMode(m=>!m)}
              style={{
                width:"100%",
                background:eraseMode?"#e8e2d8":"transparent",
                border:`1px solid ${eraseMode?"#e8e2d8":"#333"}`,
                color:eraseMode?"#111":"#e8e2d8",
                borderRadius:8,padding:"14px",
                fontSize:11,letterSpacing:2.5,textTransform:"uppercase",
                cursor:"pointer",fontWeight:600,
              }}
            >{eraseMode ? "✓ Done Erasing" : "✦ Erase"}</button>
            {eraseMode && (
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 4px"}}>
                <div style={{fontSize:9,color:"#555",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>Brush</div>
                <input type="range" min={5} max={60} value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}
                  style={{flex:1,accentColor:"#e8e2d8"}}/>
                <div style={{fontSize:9,color:"#555",width:20,textAlign:"right"}}>{brushSize}</div>
              </div>
            )}
          </>
        )}

        {changed && !processing && !applying && (
          <button
            onClick={reset}
            style={{
              width:"100%",background:"transparent",border:"1px solid #222",
              color:"#666",borderRadius:8,padding:"11px",
              fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",
            }}
          >Reset to Original</button>
        )}

        <div style={{fontSize:9,color:"#333",textAlign:"center",letterSpacing:1,lineHeight:1.6}}>
          Background removal runs on the server — image is not stored
        </div>
      </div>
    </div>
  );
}
