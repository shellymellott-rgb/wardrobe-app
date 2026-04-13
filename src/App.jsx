import { useState, useEffect, useRef } from "react";
const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories"];
const COLORS = ["Black", "White", "Cream", "Tan", "Camel", "Navy", "Grey", "Brown", "Olive", "Blush", "Red", "Blue", "Green", "Other"];
const SEASONS = ["All Year", "Spring/Summer", "Fall/Winter"];
const SLEEVE_LENGTHS = ["N/A", "Sleeveless", "Short Sleeve", "Long Sleeve"];
const LENGTHS = ["N/A", "Cropped", "Mini", "Midi", "Full"];
const MATERIALS = ["Cotton", "Linen", "Silk", "Wool", "Cashmere", "Denim", "Knit", "Leather", "Polyester", "Other"];
const PRESET_TAGS = {"Style":["Casual","Dressy","Work","Beach/Boat","Travel"],"Practical":["Needs Under Layer","Needs Tailoring","Travel-Friendly","Runs Small","Runs Large"]};
const STORAGE_KEY = "wardrobe-v3";
const WISHLIST_KEY = "wardrobe-wishlist";

const STYLE_SYSTEM = `You are Shelly's personal stylist. Her style: polished but not corporate, minimal but not boring, slightly edgy, never feminine or frilly. Loves clean lines, structure, good fabric, neutral palette. Wide-leg or straight-leg pants, defined waist, structured dresses. Supportive flat shoes only. Real-life elevated -- errands, boat, travel. Be direct, opinionated, no fluff.`;

const OUTFIT_PROMPT = (items, occasion) => `Shelly's wardrobe: ${items.map(i => `- [${i.category}] ${i.name}${i.color?` / ${i.color}`:""}${i.material?` / ${i.material}`:""} (worn ${i.wornDates?.length||0}x)`).join("\n")} ${occasion?`Occasion: ${occasion}`:"Everyday outfits."} Give 3 outfit combos using ONLY items listed above. For each outfit return JSON with this exact structure. Return ONLY a JSON array, nothing else: [{"name":"Outfit name","pieces":["exact item name 1","exact item name 2","exact item name 3"],"why":"one sentence why it works","tip":"one concrete styling tip"},...]`;

const EVALUATE_PROMPT = (item) => `Evaluate for Shelly:\n${item.name} / ${item.category}${item.brand?` / ${item.brand}`:""}${item.color?` / ${item.color}`:""}${item.material?` / ${item.material}`:""}${item.tags?.length?` / Tags: ${item.tags.join(", ")}`:""}

1. Verdict: KEEP/PASS/USE DIFFERENTLY\n2. What works\n3. What doesn’t\n4. Best outfit formula\nTwo sentences max per point. Direct.`;

const INSPO_PROMPT = (items) => `Shelly uploaded an outfit inspiration photo. Her wardrobe: ${items.map(i=>`- [${i.category}] ${i.name}${i.color?` / ${i.color}`:""}${i.material?` / ${i.material}`:""}`).join("\n")} Based on what you see in the inspiration photo, suggest how to recreate this look using ONLY items from her wardrobe above. Return JSON: {"outfitName":"name","pieces":["exact item name"],"why":"why this recreates the vibe","tip":"styling tip","gaps":["items she'd need to buy to complete this look"]}`;

const URL_PROMPT = `Extract clothing item details from this webpage content. Return ONLY valid JSON: {"name":"descriptive product name with color+style","brand":"brand name","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}`;

const IMAGE_SCAN_PROMPT = `Analyze this clothing product image or order screenshot. Extract all visible details. Return ONLY valid JSON: {"name":"descriptive name with color+style","brand":"brand name if visible or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string if visible or null","datePurchased":"YYYY-MM-DD if visible or null","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"} Read ALL text in the image including product titles, brand names, prices.`;

const RECEIPT_PROMPT = `Extract clothing items from this receipt or order confirmation. Return ONLY valid JSON: {"purchaseDate":"YYYY-MM-DD or null","items":[{"name":"descriptive name with color+style","brand":"brand name or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other or null","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","price":"numeric string or null"}]} Skip non-clothing. Make names descriptive. Extract brand from product name if present.`;

const emptyForm = () => ({name:"",brand:"",category:"Tops",color:"",customColor:"",season:"All Year",sleeveLength:"N/A",length:"N/A",material:"",customMaterial:"",tags:[],customTag:"",comments:"",datePurchased:"",price:"",imageData:null});

function loadFromStorage(){try{const r=localStorage.getItem(STORAGE_KEY);return r?JSON.parse(r):[]}catch{return[]}}
function saveToStorage(items){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}catch{}}
function loadWishlist(){try{const r=localStorage.getItem(WISHLIST_KEY);return r?JSON.parse(r):[]}catch{return[]}}
function saveWishlist(w){try{localStorage.setItem(WISHLIST_KEY,JSON.stringify(w))}catch{}}

async function callClaude(system,userContent,maxTokens=1000){
try{const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,system,messages:[{role:"user",content:userContent}]})});const data=await res.json();return data.content?.[0]?.text||""}catch(e){console.error(e);return""}
}
function readFile(file){return new Promise(resolve=>{const r=new FileReader();r.onload=e=>resolve(e.target.result);r.readAsDataURL(file)})}

function CropModal({imageSrc,onDone,onCancel}){
const [mode,setMode]=useState("portrait");
const [crop,setCrop]=useState({x:0,y:0,w:0,h:0});
const [dragging,setDragging]=useState(false);
const [resizing,setResizing]=useState(null);
const [dragStart,setDragStart]=useState(null);
const [cropStart,setCropStart]=useState(null);
const containerRef=useRef();const imgRef=useRef();
const [imgLoaded,setImgLoaded]=useState(false);
const [previewUrl,setPreviewUrl]=useState(null);
useEffect(()=>{if(!imgLoaded)return;const el=containerRef.current;const W=el.offsetWidth;const H=el.offsetHeight;let w,h;if(mode==="portrait"){w=Math.min(W*0.7,H*0.7*0.75);h=w*(4/3);if(h>H*0.85){h=H*0.85;w=h*(3/4)}}else if(mode==="square"){w=h=Math.min(W,H)*0.7}else{w=W*0.7;h=H*0.7}setCrop({x:(W-w)/2,y:(H-h)/2,w,h})},[imgLoaded,mode]);
useEffect(()=>{if(!imgLoaded||crop.w<10||crop.h<10)return;const img=imgRef.current;const container=containerRef.current;const ia=img.naturalWidth/img.naturalHeight;const ca=container.offsetWidth/container.offsetHeight;let iW,iH,iX,iY;if(ia>ca){iW=container.offsetWidth;iH=iW/ia;iX=0;iY=(container.offsetHeight-iH)/2}else{iH=container.offsetHeight;iW=iH*ia;iX=(container.offsetWidth-iW)/2;iY=0}const cx=(crop.x-iX)*(img.naturalWidth/iW);const cy=(crop.y-iY)*(img.naturalHeight/iH);const cw=crop.w*(img.naturalWidth/iW);const ch=crop.h*(img.naturalHeight/iH);if(cw<1||ch<1)return;const canvas=document.createElement("canvas");canvas.width=Math.max(1,cw);canvas.height=Math.max(1,ch);canvas.getContext("2d").drawImage(img,cx,cy,cw,ch,0,0,cw,ch);setPreviewUrl(canvas.toDataURL("image/jpeg",0.7))},[crop,imgLoaded]);
function getPos(e){const rect=containerRef.current.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;const cy=e.touches?e.touches[0].clientY:e.clientY;return{x:cx-rect.left,y:cy-rect.top}}
function clamp(c){const el=containerRef.current;const W=el.offsetWidth;const H=el.offsetHeight;return{x:Math.max(0,Math.min(c.x,W-Math.max(c.w,20))),y:Math.max(0,Math.min(c.y,H-Math.max(c.h,20))),w:Math.max(20,Math.min(c.w,W)),h:Math.max(20,Math.min(c.h,H))}}
function onPD(e){e.preventDefault();const pos=getPos(e);const handle=e.target.dataset?.handle;if(handle){setResizing(handle);setDragStart(pos);setCropStart({…crop});return}if(pos.x>=crop.x&&pos.x<=crop.x+crop.w&&pos.y>=crop.y&&pos.y<=crop.y+crop.h){setDragging(true);setDragStart(pos);setCropStart({…crop});return}setDragStart(pos);setCropStart({x:pos.x,y:pos.y,w:0,h:0});setCrop({x:pos.x,y:pos.y,w:0,h:0})}
function onPM(e){if(!dragStart)return;e.preventDefault();const pos=getPos(e);const dx=pos.x-dragStart.x;const dy=pos.y-dragStart.y;if(dragging){setCrop(clamp({…cropStart,x:cropStart.x+dx,y:cropStart.y+dy}));return}if(resizing){let{x,y,w,h}=cropStart;if(resizing.includes("e"))w=Math.max(20,w+dx);if(resizing.includes("s"))h=Math.max(20,h+dy);if(resizing.includes("w")){w=Math.max(20,w-dx);x=x+dx}if(resizing.includes("n")){h=Math.max(20,h-dy);y=y+dy}if(mode==="portrait")h=w*(4/3);if(mode==="square")h=w;setCrop(clamp({x,y,w,h}));return}let w=pos.x-cropStart.x;let h=pos.y-cropStart.y;if(mode==="portrait")h=Math.abs(w)*(4/3)*(h<0?-1:1);if(mode==="square"){const s=Math.max(Math.abs(w),Math.abs(h));w=w<0?-s:s;h=h<0?-s:s}setCrop(clamp({x:w<0?cropStart.x+w:cropStart.x,y:h<0?cropStart.y+h:cropStart.y,w:Math.abs(w),h:Math.abs(h)}))}
function onPU(){setDragging(false);setResizing(null);setDragStart(null);setCropStart(null)}
function applyCrop(){const img=imgRef.current;const container=containerRef.current;const ia=img.naturalWidth/img.naturalHeight;const ca=container.offsetWidth/container.offsetHeight;let iW,iH,iX,iY;if(ia>ca){iW=container.offsetWidth;iH=iW/ia;iX=0;iY=(container.offsetHeight-iH)/2}else{iH=container.offsetHeight;iW=iH*ia;iX=(container.offsetWidth-iW)/2;iY=0}const cx=(crop.x-iX)*(img.naturalWidth/iW);const cy=(crop.y-iY)*(img.naturalHeight/iH);const cw=crop.w*(img.naturalWidth/iW);const ch=crop.h*(img.naturalHeight/iH);const canvas=document.createElement("canvas");canvas.width=Math.max(1,cw);canvas.height=Math.max(1,ch);canvas.getContext("2d").drawImage(img,cx,cy,cw,ch,0,0,cw,ch);onDone(canvas.toDataURL("image/jpeg",0.92))}
const HANDLES=["nw","n","ne","e","se","s","sw","w"];const hSize=14;
function hStyle(h){const p={nw:{left:crop.x-hSize/2,top:crop.y-hSize/2},n:{left:crop.x+crop.w/2-hSize/2,top:crop.y-hSize/2},ne:{left:crop.x+crop.w-hSize/2,top:crop.y-hSize/2},e:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h/2-hSize/2},se:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h-hSize/2},s:{left:crop.x+crop.w/2-hSize/2,top:crop.y+crop.h-hSize/2},sw:{left:crop.x-hSize/2,top:crop.y+crop.h-hSize/2},w:{left:crop.x-hSize/2,top:crop.y+crop.h/2-hSize/2}};const c={nw:"nwse-resize",n:"ns-resize",ne:"nesw-resize",e:"ew-resize",se:"nwse-resize",s:"ns-resize",sw:"nesw-resize",w:"ew-resize"};return{position:"absolute",width:hSize,height:hSize,background:"#e8e2d8",borderRadius:2,zIndex:10,cursor:c[h],touchAction:"none",…p[h]}}
return(<div style={{position:"fixed",inset:0,background:"#000",zIndex:200,display:"flex",flexDirection:"column"}}><div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1a1a1a",flexShrink:0}}><button onClick={onCancel} style={{background:"transparent",border:"none",color:"#888",fontSize:11,cursor:"pointer"}}>Cancel</button><div style={{display:"flex",gap:6}}>{[["portrait","3:4"],["square","1:1"],["free","Free"]].map(([m,label])=>(<button key={m} onClick={()=>setMode(m)} style={{background:mode===m?"#e8e2d8":"#1a1a1a",color:mode===m?"#111":"#666",border:`1px solid ${mode===m?"#e8e2d8":"#2a2a2a"}`,borderRadius:20,padding:"4px 12px",fontSize:10,cursor:"pointer"}}>{label}</button>))}</div><button onClick={applyCrop} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"6px 16px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Apply</button></div><div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}><div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",userSelect:"none",touchAction:"none",cursor:"crosshair"}} onMouseDown={onPD} onMouseMove={onPM} onMouseUp={onPU} onMouseLeave={onPU} onTouchStart={onPD} onTouchMove={onPM} onTouchEnd={onPU}><img ref={imgRef} src={imageSrc} onLoad={()=>setImgLoaded(true)} style={{width:"100%",height:"100%",objectFit:"contain",display:"block",pointerEvents:"none"}}/>{imgLoaded&&crop.w>10&&<><svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}><defs><mask id="cm"><rect width="100%" height="100%" fill="white"/><rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cm)"/><rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#e8e2d8" strokeWidth="1.5"/></svg>{HANDLES.map(h=><div key={h} data-handle={h} style={hStyle(h)}/>)}</>}{!imgLoaded&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:11}}>Loading…</div>}</div><div style={{width:100,background:"#080808",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:10,borderLeft:"1px solid #1a1a1a",flexShrink:0}}><div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#444"}}>Preview</div>{previewUrl?<img src={previewUrl} style={{width:80,height:mode==="portrait"?80*(4/3):80,objectFit:"cover",borderRadius:2,border:"1px solid #222",maxHeight:120}}/>:<div style={{width:80,height:80,background:"#111",borderRadius:2}}/>}</div></div><div style={{padding:"8px 0",textAlign:"center",color:"#333",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>Drag · Handles to resize</div></div>);
}

const ghostBtn={background:"transparent",border:"none",color:"#888",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",padding:"4px 0"};
function chipStyle(active){return{background:active?"#e8e2d8":"#1a1a1a",color:active?"#111":"#666",border:`1px solid ${active?"#e8e2d8":"#2a2a2a"}`,borderRadius:20,padding:"4px 12px",fontSize:10,letterSpacing:1,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"‘DM Sans’, system-ui, sans-serif"}}
const inputStyle={width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#e8e2d8",borderRadius:3,padding:"11px 12px",fontSize:12,outline:"none",boxSizing:"border-box",fontFamily:"‘DM Sans’, system-ui, sans-serif",marginBottom:10};
const labelStyle={fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#666",display:"block",marginBottom:5,marginTop:10};
function navBtn(label,active,onClick){return<button onClick={onClick} style={{background:active?"#e8e2d8":"transparent",color:active?"#111":"#888",border:`1px solid ${active?"#e8e2d8":"#333"}`,borderRadius:20,padding:"6px 16px",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap"}}>{label}</button>}

function FormFields({form,setForm,onImageClick,brands=[],onAddBrand}){
const showSleeve=["Tops","Dresses"].includes(form.category);
const showLength=["Bottoms","Dresses"].includes(form.category);
function toggleTag(tag){setForm(f=>({…f,tags:f.tags.includes(tag)?f.tags.filter(t=>t!==tag):[…f.tags,tag]}))}
function addCustomTag(){if(!form.customTag?.trim())return;const tag=form.customTag.trim();if(!form.tags.includes(tag))setForm(f=>({…f,tags:[…f.tags,tag],customTag:""}));else setForm(f=>({…f,customTag:""}))}
return(<div>
<div onClick={onImageClick} style={{aspectRatio:"3/4",background:"#1a1a1a",border:"1px dashed #333",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginBottom:16,overflow:"hidden"}}>{form.imageData?<img src={form.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{textAlign:"center",color:"#444"}}><div style={{fontSize:28,marginBottom:8}}>+</div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase"}}>Upload & Crop Photo</div></div>}</div>
{form.imageData&&<button onClick={onImageClick} style={{…ghostBtn,color:"#666",fontSize:10,letterSpacing:1,marginBottom:12,display:"block"}}>↺ Change / Recrop</button>}
<label style={labelStyle}>Name *</label>
<input value={form.name} onChange={e=>setForm(f=>({…f,name:e.target.value}))} placeholder="e.g. Black Wide-Leg Trousers" style={inputStyle}/>
<label style={labelStyle}>Brand</label>
{brands.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{brands.map(b=><button key={b} onClick={()=>setForm(f=>({…f,brand:f.brand===b?"":b}))} style={{…chipStyle(form.brand===b),fontSize:10}}>{b}</button>)}</div>}
<div style={{display:"flex",gap:8,marginBottom:10}}>
<input value={form.brand} onChange={e=>setForm(f=>({…f,brand:e.target.value}))} placeholder={brands.length>0?"Or type new brand…":"e.g. Everlane, Madewell"} style={{…inputStyle,marginBottom:0,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&form.brand.trim()&&onAddBrand)onAddBrand(form.brand.trim())}}/>
{form.brand&&!brands.includes(form.brand)&&onAddBrand&&<button onClick={()=>onAddBrand(form.brand.trim())} style={{…chipStyle(false),padding:"4px 12px",flexShrink:0}}>Save</button>}
</div>
<label style={labelStyle}>Category</label>
<select value={form.category} onChange={e=>setForm(f=>({…f,category:e.target.value}))} style={inputStyle}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
<label style={labelStyle}>Color</label>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{COLORS.map(c=><button key={c} onClick={()=>setForm(f=>({…f,color:f.color===c?"":c}))} style={chipStyle(form.color===c)}>{c}</button>)}</div>
{form.color==="Other"&&<input value={form.customColor} onChange={e=>setForm(f=>({…f,customColor:e.target.value}))} placeholder="Enter color" style={inputStyle}/>}
<label style={labelStyle}>Material</label>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{MATERIALS.map(m=><button key={m} onClick={()=>setForm(f=>({…f,material:f.material===m?"":m}))} style={chipStyle(form.material===m)}>{m}</button>)}</div>
{form.material==="Other"&&<input value={form.customMaterial} onChange={e=>setForm(f=>({…f,customMaterial:e.target.value}))} placeholder="Enter material" style={inputStyle}/>}
<label style={labelStyle}>Season</label>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{SEASONS.map(s=><button key={s} onClick={()=>setForm(f=>({…f,season:s}))} style={chipStyle(form.season===s)}>{s}</button>)}</div>
{showSleeve&&<><label style={labelStyle}>Sleeve Length</label><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{SLEEVE_LENGTHS.map(s=><button key={s} onClick={()=>setForm(f=>({…f,sleeveLength:s}))} style={chipStyle(form.sleeveLength===s)}>{s}</button>)}</div></>}
{showLength&&<><label style={labelStyle}>Length</label><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{LENGTHS.map(l=><button key={l} onClick={()=>setForm(f=>({…f,length:l}))} style={chipStyle(form.length===l)}>{l}</button>)}</div></>}
<label style={labelStyle}>Tags</label>
{Object.entries(PRESET_TAGS).map(([group,tags])=>(<div key={group} style={{marginBottom:8}}><div style={{fontSize:9,color:"#444",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{group}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{tags.map(t=><button key={t} onClick={()=>toggleTag(t)} style={chipStyle(form.tags.includes(t))}>{t}</button>)}</div></div>))}
<div style={{display:"flex",gap:8,marginTop:4}}>
<input value={form.customTag||""} onChange={e=>setForm(f=>({…f,customTag:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addCustomTag()} placeholder="Custom tag…" style={{…inputStyle,marginBottom:0,flex:1}}/>
<button onClick={addCustomTag} style={{…chipStyle(false),padding:"4px 14px"}}>+</button>
</div>
{form.tags.filter(t=>!Object.values(PRESET_TAGS).flat().includes(t)).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>{form.tags.filter(t=>!Object.values(PRESET_TAGS).flat().includes(t)).map(t=>(<span key={t} style={{…chipStyle(true),display:"inline-flex",alignItems:"center",gap:4}}>{t}<span onClick={()=>setForm(f=>({…f,tags:f.tags.filter(x=>x!==t)}))} style={{cursor:"pointer",opacity:0.7}}>×</span></span>))}</div>}
<div style={{display:"flex",gap:10,marginTop:10}}>
<div style={{flex:1}}><label style={labelStyle}>Date Purchased</label><input type="date" value={form.datePurchased} onChange={e=>setForm(f=>({…f,datePurchased:e.target.value}))} style={inputStyle}/></div>
<div style={{flex:1}}><label style={labelStyle}>Price ($)</label><input type="number" value={form.price} onChange={e=>setForm(f=>({…f,price:e.target.value}))} placeholder="0.00" style={inputStyle}/></div>
</div>
<label style={labelStyle}>Comments</label>
<textarea value={form.comments} onChange={e=>setForm(f=>({…f,comments:e.target.value}))} placeholder="Fit notes, styling ideas, where to wear…" style={{…inputStyle,height:80,resize:"none"}}/>

  </div>);
}

export default function WardrobeApp(){
const [items,setItems]=useState(()=>loadFromStorage());
const [wishlist,setWishlist]=useState(()=>loadWishlist());
const [brands,setBrands]=useState(()=>{try{const b=localStorage.getItem("wardrobe-brands");return b?JSON.parse(b):[]}catch{return[]}});
const [activeCategory,setActiveCategory]=useState("All");
const [activeFilters,setActiveFilters]=useState({});
const [showFilters,setShowFilters]=useState(false);
const [view,setView]=useState("closet");
const [addMode,setAddMode]=useState("photo");
const [addForm,setAddForm]=useState(emptyForm());
const [cropSrc,setCropSrc]=useState(null);
const [cropTarget,setCropTarget]=useState(null);
const [pendingImageData,setPendingImageData]=useState(null);
const [scanningImage,setScanningImage]=useState(false);
const [urlInput,setUrlInput]=useState("");
const [fetchingUrl,setFetchingUrl]=useState(false);
const fileInputRef=useRef();
const [receiptData,setReceiptData]=useState(null);
const [receiptDate,setReceiptDate]=useState("");
const [scanning,setScanning]=useState(false);
const [receiptImages,setReceiptImages]=useState({});
const receiptFileRef=useRef();
const [selectedItem,setSelectedItem]=useState(null);
const [itemEval,setItemEval]=useState("");
const [loadingEval,setLoadingEval]=useState(false);
const [editing,setEditing]=useState(false);
const [editForm,setEditForm]=useState(null);
const [occasion,setOccasion]=useState("");
const [outfits,setOutfits]=useState([]);
const [outfitText,setOutfitText]=useState("");
const [loadingOutfit,setLoadingOutfit]=useState(false);
const [inspoImage,setInspoImage]=useState(null);
const [inspoResult,setInspoResult]=useState(null);
const [loadingInspo,setLoadingInspo]=useState(false);
const inspoRef=useRef();
const [wishForm,setWishForm]=useState({type:"general",note:"",url:"",targetPrice:"",name:"",brand:""});
const [addingWish,setAddingWish]=useState(false);
const importRef=useRef();

function persist(newItems){setItems(newItems);saveToStorage(newItems)}
function persistWishlist(w){setWishlist(w);saveWishlist(w)}
function addBrand(brand){if(!brand||brands.includes(brand))return;const updated=[…brands,brand].sort();setBrands(updated);try{localStorage.setItem("wardrobe-brands",JSON.stringify(updated))}catch{}}
function openFilePicker(target){setCropTarget(target);fileInputRef.current.click()}

async function fetchUrl(){
if(!urlInput.trim())return;
setFetchingUrl(true);
try{
const text=await callClaude(URL_PROMPT,[{type:"text",text:`Extract product details from this URL. The URL is: ${urlInput}\n\nPlease extract the clothing item details based on what you know about this product or URL.`}],500);
const clean=text.replace(/`json|`/g,"").trim();
const start=clean.indexOf("{");const end=clean.lastIndexOf("}");
const parsed=JSON.parse(clean.substring(start,end+1));
setAddForm(f=>({…f,name:parsed.name||f.name,brand:parsed.brand||f.brand,color:parsed.color||f.color,material:parsed.material||f.material,category:parsed.category||f.category,season:parsed.season||f.season,sleeveLength:parsed.sleeveLength||f.sleeveLength,length:parsed.length||f.length,price:parsed.price||f.price}));
if(parsed.brand)addBrand(parsed.brand);
}catch{}
setFetchingUrl(false);
}

async function onFileSelected(e){
const file=e.target.files[0];e.target.value="";if(!file)return;
const dataUrl=await readFile(file);setPendingImageData(dataUrl);
if(cropTarget==="add"){
setScanningImage(true);
try{const base64=dataUrl.split(",")[1];const text=await callClaude(IMAGE_SCAN_PROMPT,[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},{type:"text",text:"Analyze this clothing item."}],500);const parsed=JSON.parse(text.replace(/`json|`/g,"").trim());setAddForm(f=>({…f,name:parsed.name||f.name,brand:parsed.brand||f.brand,color:parsed.color||f.color,material:parsed.material||f.material,category:parsed.category||f.category,season:parsed.season||f.season,sleeveLength:parsed.sleeveLength||f.sleeveLength,length:parsed.length||f.length,price:parsed.price||f.price,datePurchased:parsed.datePurchased||f.datePurchased}));if(parsed.brand)addBrand(parsed.brand)}catch{}
setScanningImage(false);
}
setCropSrc(dataUrl);
}

function onCropDone(cropped){if(cropTarget==="add")setAddForm(f=>({…f,imageData:cropped}));else if(cropTarget==="edit")setEditForm(f=>({…f,imageData:cropped}));else setReceiptImages(prev=>({…prev,[cropTarget]:cropped}));setCropSrc(null);setCropTarget(null);setPendingImageData(null)}
function onCropCancel(){if(pendingImageData){if(cropTarget==="add")setAddForm(f=>({…f,imageData:pendingImageData}));else if(cropTarget==="edit")setEditForm(f=>({…f,imageData:pendingImageData}));else setReceiptImages(prev=>({…prev,[cropTarget]:pendingImageData}))}setCropSrc(null);setCropTarget(null);setPendingImageData(null)}
function buildItem(form){return{id:Date.now()+Math.random(),name:form.name,brand:form.brand,category:form.category,color:form.color==="Other"?form.customColor:form.color,material:form.material==="Other"?form.customMaterial:form.material,season:form.season,sleeveLength:form.sleeveLength,length:form.length,tags:form.tags,comments:form.comments,datePurchased:form.datePurchased,price:form.price?parseFloat(form.price):null,imageData:form.imageData,wornDates:[],addedAt:new Date().toISOString()}}
function addItem(){if(!addForm.name)return;if(addForm.brand)addBrand(addForm.brand);persist([…items,buildItem(addForm)]);setAddForm(emptyForm());setUrlInput("");setView("closet")}

async function scanReceipt(e){
const file=e.target.files[0];e.target.value="";if(!file)return;
setScanning(true);setReceiptData(null);setReceiptImages({});
const dataUrl=await readFile(file);const base64=dataUrl.split(",")[1];
try{const text=await callClaude(RECEIPT_PROMPT,[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64}},{type:"text",text:"Extract all clothing items from this receipt or order confirmation."}],1000);const clean=text.replace(/`json|`/g,"").trim();const start=clean.indexOf("{");const end=clean.lastIndexOf("}");const parsed=JSON.parse(clean.substring(start,end+1));setReceiptDate(parsed.purchaseDate||"");setReceiptData((parsed.items||[]).map((item,i)=>({…item,tempId:i,season:"All Year",sleeveLength:"N/A",length:"N/A",material:"",tags:[],comments:"",price:item.price||""})))}catch{setReceiptData([])}
setScanning(false);
}

function updateRI(tempId,field,value){setReceiptData(prev=>prev.map(i=>i.tempId===tempId?{…i,[field]:value}:i))}
function toggleRITag(tempId,tag){setReceiptData(prev=>prev.map(i=>i.tempId!==tempId?i:{…i,tags:i.tags.includes(tag)?i.tags.filter(t=>t!==tag):[…i.tags,tag]}))}
async function addReceiptItems(){const newItems=receiptData.map(item=>({id:Date.now()+item.tempId+Math.random(),name:item.name,brand:item.brand||"",category:item.category,color:item.color||"",material:item.material||"",season:item.season||"All Year",sleeveLength:item.sleeveLength||"N/A",length:item.length||"N/A",tags:item.tags||[],comments:item.comments||"",datePurchased:receiptDate||"",price:item.price?parseFloat(item.price):null,imageData:receiptImages[item.tempId]||null,wornDates:[],addedAt:new Date().toISOString()}));receiptData.forEach(item=>{if(item.brand)addBrand(item.brand)});persist([…items,…newItems]);setReceiptData(null);setReceiptDate("");setReceiptImages({});setView("closet")}

function markWorn(id){const today=new Date().toISOString().split("T")[0];const updated=items.map(i=>i.id===id?{…i,wornDates:[…(i.wornDates||[]),today]}:i);persist(updated);if(selectedItem?.id===id)setSelectedItem(updated.find(i=>i.id===id))}
function removeItem(id){persist(items.filter(i=>i.id!==id));setSelectedItem(null);setItemEval("");setEditing(false)}
function saveEdit(){const updated=items.map(i=>i.id===editForm.id?{…editForm,color:editForm.color==="Other"?editForm.customColor:editForm.color,material:editForm.material==="Other"?editForm.customMaterial:editForm.material}:i);if(editForm.brand)addBrand(editForm.brand);persist(updated);setSelectedItem(updated.find(i=>i.id===editForm.id));setEditing(false)}

async function evaluateItem(item){setSelectedItem(item);setItemEval("");setLoadingEval(true);setEditing(false);try{setItemEval(await callClaude(STYLE_SYSTEM,EVALUATE_PROMPT(item),500))}catch{setItemEval("Error. Try again.")}setLoadingEval(false)}

async function generateOutfits(){
if(items.length<2)return;
setLoadingOutfit(true);setOutfits([]);setOutfitText("");
try{
const text=await callClaude(STYLE_SYSTEM,OUTFIT_PROMPT(items,occasion),1000);
const clean=text.replace(/`json|`/g,"").trim();
const start=clean.indexOf("[");const end=clean.lastIndexOf("]");
const parsed=JSON.parse(clean.substring(start,end+1));
setOutfits(parsed);
}catch(e){
setOutfitText(await callClaude(STYLE_SYSTEM,`Shelly's wardrobe:\n${items.map(i=>`- [${i.category}] ${i.name}`).join("\n")}\n${occasion?`Occasion: ${occasion}`:"Everyday outfits."}\nGive 3 outfit combos. Direct, editorial.`,1000));
}
setLoadingOutfit(false);
}

async function analyzeInspo(e){
const file=e.target.files[0];e.target.value="";if(!file)return;
const dataUrl=await readFile(file);setInspoImage(dataUrl);setInspoResult(null);setLoadingInspo(true);
try{
const base64=dataUrl.split(",")[1];
const text=await callClaude(STYLE_SYSTEM,[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},{type:"text",text:INSPO_PROMPT(items)}],800);
const clean=text.replace(/`json|`/g,"").trim();
const start=clean.indexOf("{");const end=clean.lastIndexOf("}");
setInspoResult(JSON.parse(clean.substring(start,end+1)));
}catch{setInspoResult({outfitName:"Inspiration Look",pieces:[],why:"Could not analyze. Try again.",tip:"",gaps:[]})}
setLoadingInspo(false);
}

async function addWishItem(){
if(!wishForm.note&&!wishForm.url)return;
const item={id:Date.now()+Math.random(),type:wishForm.type,note:wishForm.note,url:wishForm.url,targetPrice:wishForm.targetPrice?parseFloat(wishForm.targetPrice):null,name:wishForm.name,brand:wishForm.brand,addedAt:new Date().toISOString()};
persistWishlist([…wishlist,item]);
setWishForm({type:"general",note:"",url:"",targetPrice:"",name:"",brand:""});
setAddingWish(false);
}

function exportWardrobe(){const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`wardrobe-${new Date().toISOString().split("T")[0]}.json`;a.click()}
function importWardrobe(e){const file=e.target.files[0];e.target.value="";if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{const imp=JSON.parse(ev.target.result);if(Array.isArray(imp)){persist([…items,…imp]);alert(`Imported ${imp.length} items.`)}}catch{alert("Invalid file.")}};reader.readAsText(file)}

const filtered=items.filter(i=>{if(activeCategory!=="All"&&i.category!==activeCategory)return false;if(activeFilters.color&&i.color!==activeFilters.color)return false;if(activeFilters.season&&i.season!==activeFilters.season)return false;if(activeFilters.material&&i.material!==activeFilters.material)return false;if(activeFilters.brand&&i.brand!==activeFilters.brand)return false;if(activeFilters.tag&&!(i.tags||[]).includes(activeFilters.tag))return false;return true});
const underloved=items.filter(i=>!i.wornDates?.length);
const allTags=[…new Set(items.flatMap(i=>i.tags||[]))];

return(<div style={{minHeight:"100vh",background:"#111",color:"#e8e2d8",fontFamily:"Georgia, ‘Times New Roman’, serif",maxWidth:480,margin:"0 auto"}}>
{cropSrc&&<CropModal imageSrc={cropSrc} onDone={onCropDone} onCancel={onCropCancel}/>}
<input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelected} style={{display:"none"}}/>
<input ref={receiptFileRef} type="file" accept="image/*" onChange={scanReceipt} style={{display:"none"}}/>
<input ref={inspoRef} type="file" accept="image/*" onChange={analyzeInspo} style={{display:"none"}}/>
<input ref={importRef} type="file" accept=".json" onChange={importWardrobe} style={{display:"none"}}/>

```
{/* Header */}
<div style={{padding:"28px 24px 18px",borderBottom:"1px solid #222"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
    <div><div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:10,letterSpacing:5,color:"#555",textTransform:"uppercase",marginBottom:5}}>Personal Closet</div><div style={{fontSize:28,fontStyle:"italic",letterSpacing:-0.5}}>Wardrobe</div></div>
    <div style={{textAlign:"right"}}><div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:20,fontWeight:300}}>{items.length}</div><div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase"}}>pieces</div>{underloved.length>0&&<div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:10,color:"#b8976a",marginTop:3}}>{underloved.length} unworn</div>}</div>
  </div>
  <div style={{display:"flex",gap:6,marginTop:18,fontFamily:"'DM Sans', system-ui, sans-serif",flexWrap:"wrap"}}>
    {navBtn("Closet",view==="closet",()=>setView("closet"))}
    {navBtn("Outfits",view==="outfits",()=>setView("outfits"))}
    {navBtn("Wishlist",view==="wishlist",()=>setView("wishlist"))}
    {navBtn("+ Add",view==="add",()=>{setView("add");setAddMode("photo");setReceiptData(null);setAddForm(emptyForm());setUrlInput("")})}
  </div>
</div>

{/* CLOSET */}
{view==="closet"&&(<div>
  <div style={{display:"flex",gap:6,padding:"14px 24px 6px",overflowX:"auto",scrollbarWidth:"none",fontFamily:"'DM Sans', system-ui, sans-serif"}}>{["All",...CATEGORIES].map(cat=>navBtn(cat,activeCategory===cat,()=>setActiveCategory(cat)))}</div>
  <div style={{padding:"8px 24px 12px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
    <button onClick={()=>setShowFilters(f=>!f)} style={{...ghostBtn,fontSize:10,letterSpacing:1.5}}>{showFilters?"▲ Hide":"▼ Filter"}{Object.keys(activeFilters).length>0&&<span style={{color:"#b8976a",marginLeft:6}}>({Object.keys(activeFilters).length})</span>}</button>
    {showFilters&&(<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>{[{key:"color",opts:COLORS},{key:"season",opts:SEASONS},{key:"material",opts:MATERIALS},...(brands.length?[{key:"brand",opts:brands}]:[]),...(allTags.length?[{key:"tag",opts:allTags}]:[])].map(({key,opts})=>(<div key={key}><div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>{key}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{opts.map(o=><button key={o} onClick={()=>setActiveFilters(f=>f[key]===o?Object.fromEntries(Object.entries(f).filter(([k])=>k!==key)):{...f,[key]:o})} style={chipStyle(activeFilters[key]===o)}>{o}</button>)}</div></div>))}{Object.keys(activeFilters).length>0&&<button onClick={()=>setActiveFilters({})} style={{...ghostBtn,color:"#8a4a4a",fontSize:10}}>Clear filters</button>}</div>)}
  </div>
  <div style={{padding:"0 24px 12px",display:"flex",gap:10,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
    <button onClick={exportWardrobe} style={{...ghostBtn,fontSize:9,letterSpacing:1.5,color:"#555"}}>↓ Export</button>
    <button onClick={()=>importRef.current.click()} style={{...ghostBtn,fontSize:9,letterSpacing:1.5,color:"#555"}}>↑ Import</button>
  </div>
  {filtered.length===0?(<div style={{textAlign:"center",padding:"60px 24px",color:"#444",fontFamily:"'DM Sans', system-ui, sans-serif"}}><div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{items.length>0?"No matches":"Nothing here yet"}</div><div style={{fontSize:11,color:"#333"}}>{items.length>0?"Try different filters":"Add your first piece"}</div></div>):(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1}}>
      {filtered.map(item=>(<div key={item.id} onClick={()=>evaluateItem(item)} style={{position:"relative",aspectRatio:"3/4",background:"#1a1a1a",cursor:"pointer",overflow:"hidden"}}>
        {item.imageData?<img src={item.imageData} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8,boxSizing:"border-box"}}>{item.color&&<div style={{fontSize:8,color:"#555"}}>{item.color}</div>}<div style={{fontSize:9,color:"#444",textAlign:"center",lineHeight:1.3}}>{item.name}</div></div>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent, rgba(8,8,8,0.95))",padding:"14px 6px 6px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
          {item.name&&<div style={{fontSize:9,fontWeight:500,marginBottom:1,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>}
          <div style={{fontSize:8,color:"#666",letterSpacing:0.5,textTransform:"uppercase"}}>{item.brand||item.category}</div>
        </div>
        {!item.wornDates?.length&&<div style={{position:"absolute",top:4,right:4,background:"#b8976a",color:"#111",borderRadius:2,padding:"1px 4px",fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>New</div>}
        {item.wornDates?.length>0&&<div style={{position:"absolute",top:4,left:4,background:"#ffffff12",color:"#ffffff55",borderRadius:2,padding:"1px 5px",fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:8}}>×{item.wornDates.length}</div>}
      </div>))}
    </div>
  )}
</div>)}

{/* OUTFITS */}
{view==="outfits"&&(<div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
  <label style={labelStyle}>Occasion (optional)</label>
  <input value={occasion} onChange={e=>setOccasion(e.target.value)} placeholder="e.g. boat day, errands, travel..." style={inputStyle}/>
  <button onClick={generateOutfits} disabled={loadingOutfit||items.length<2} style={{width:"100%",background:items.length<2?"#1a1a1a":"#e8e2d8",color:items.length<2?"#444":"#111",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:items.length<2?"not-allowed":"pointer",fontWeight:600,marginBottom:20}}>{loadingOutfit?"Styling...":"Generate Outfits"}</button>
  {items.length<2&&<div style={{textAlign:"center",color:"#444",fontSize:12,marginBottom:16}}>Add at least 2 pieces first</div>}

  {/* Visual outfit cards */}
  {outfits.length>0&&outfits.map((outfit,oi)=>{
    const outfitItems=outfit.pieces.map(name=>items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase())).filter(Boolean);
    return(<div key={oi} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:4,marginBottom:16,overflow:"hidden"}}>
      <div style={{padding:"12px 14px 8px"}}>
        <div style={{fontSize:12,fontWeight:600,color:"#e8e2d8",marginBottom:2}}>{outfit.name}</div>
        <div style={{fontSize:11,color:"#888",lineHeight:1.5,marginBottom:6}}>{outfit.why}</div>
      </div>
      {outfitItems.length>0&&(<div style={{display:"flex",gap:1,padding:"0 1px 1px"}}>
        {outfitItems.map((item,ii)=>(<div key={ii} style={{flex:1,aspectRatio:"3/4",background:"#111",overflow:"hidden",position:"relative"}}>
          {item.imageData?<img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}><div style={{fontSize:8,color:"#555",textAlign:"center",lineHeight:1.3}}>{item.name}</div></div>}
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.7)",padding:"4px 4px 3px"}}><div style={{fontSize:7,color:"#e8e2d8aa",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div></div>
        </div>))}
      </div>)}
      <div style={{padding:"8px 14px 12px"}}><div style={{fontSize:10,color:"#b8976a",lineHeight:1.5}}>✦ {outfit.tip}</div></div>
    </div>);
  })}

  {outfitText&&<div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:3,padding:18,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap"}}>{outfitText}</div>}

  {/* Outfit Inspiration */}
  <div style={{marginTop:28,borderTop:"1px solid #222",paddingTop:20}}>
    <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#666",marginBottom:12}}>Outfit Inspiration</div>
    <div onClick={()=>inspoRef.current.click()} style={{background:"#1a1a1a",border:"1px dashed #333",borderRadius:3,padding:"24px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",marginBottom:12}}>
      {inspoImage?<img src={inspoImage} style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:2,marginBottom:8}}/>:<><div style={{fontSize:24,marginBottom:8}}>📸</div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#666"}}>Upload Inspo Photo</div><div style={{fontSize:10,color:"#444",marginTop:4,textAlign:"center"}}>I'll build this look from your wardrobe</div></>}
    </div>
    {loadingInspo&&<div style={{textAlign:"center",color:"#666",fontSize:11,letterSpacing:1,padding:"12px 0"}}>Analyzing look...</div>}
    {inspoResult&&(<div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:3,padding:16}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>{inspoResult.outfitName}</div>
      {inspoResult.pieces?.length>0&&(<div style={{display:"flex",gap:1,marginBottom:12}}>{inspoResult.pieces.map(name=>items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase())).filter(Boolean).map((item,i)=>(<div key={i} style={{flex:1,aspectRatio:"3/4",background:"#111",overflow:"hidden",borderRadius:2}}>{item.imageData?<img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}><div style={{fontSize:8,color:"#555",textAlign:"center"}}>{item.name}</div></div>}</div>))}</div>)}
      <div style={{fontSize:11,color:"#888",lineHeight:1.6,marginBottom:8}}>{inspoResult.why}</div>
      {inspoResult.tip&&<div style={{fontSize:10,color:"#b8976a",marginBottom:8}}>✦ {inspoResult.tip}</div>}
      {inspoResult.gaps?.length>0&&(<div><div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>To complete this look:</div>{inspoResult.gaps.map((g,i)=><div key={i} style={{fontSize:11,color:"#666",marginBottom:3}}>· {g}</div>)}</div>)}
    </div>)}
  </div>

  {underloved.length>0&&(<div style={{marginTop:24}}><div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#b8976a",marginBottom:12}}>Never worn</div>{underloved.map(item=>(<div key={item.id} style={{display:"flex",alignItems:"center",gap:10,background:"#1a1a1a",border:"1px solid #b8976a22",borderRadius:3,padding:"9px 12px",marginBottom:7}}>{item.imageData&&<img src={item.imageData} style={{width:32,height:42,objectFit:"cover",borderRadius:2,flexShrink:0}}/>}<div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name||"Unnamed"}</div><div style={{fontSize:9,color:"#666",letterSpacing:1,textTransform:"uppercase"}}>{item.brand||item.category}</div></div><button onClick={()=>markWorn(item.id)} style={{...chipStyle(false),flexShrink:0}}>worn</button></div>))}</div>)}
</div>)}

{/* WISHLIST */}
{view==="wishlist"&&(<div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
    <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#666"}}>Wishlist</div>
    <button onClick={()=>setAddingWish(true)} style={{...chipStyle(false),fontSize:10}}>+ Add</button>
  </div>

  {addingWish&&(<div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:3,padding:16,marginBottom:16}}>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <button onClick={()=>setWishForm(f=>({...f,type:"general"}))} style={chipStyle(wishForm.type==="general")}>General</button>
      <button onClick={()=>setWishForm(f=>({...f,type:"specific"}))} style={chipStyle(wishForm.type==="specific")}>Specific Item</button>
    </div>
    {wishForm.type==="general"?(<>
      <label style={labelStyle}>What are you looking for?</label>
      <input value={wishForm.note} onChange={e=>setWishForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Navy structured blazer, under $300" style={inputStyle}/>
    </>):(<>
      <label style={labelStyle}>Item Name</label>
      <input value={wishForm.name} onChange={e=>setWishForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Everlane The Way-High Jean" style={inputStyle}/>
      <label style={labelStyle}>Brand</label>
      <input value={wishForm.brand} onChange={e=>setWishForm(f=>({...f,brand:e.target.value}))} placeholder="Brand" style={inputStyle}/>
      <label style={labelStyle}>URL</label>
      <input value={wishForm.url} onChange={e=>setWishForm(f=>({...f,url:e.target.value}))} placeholder="https://..." style={inputStyle}/>
      <label style={labelStyle}>Current Price ($)</label>
      <input value={wishForm.note} onChange={e=>setWishForm(f=>({...f,note:e.target.value}))} placeholder="Current price" style={inputStyle}/>
      <label style={labelStyle}>Alert me when price drops to ($)</label>
      <input value={wishForm.targetPrice} onChange={e=>setWishForm(f=>({...f,targetPrice:e.target.value}))} placeholder="Target price" style={inputStyle}/>
    </>)}
    <div style={{display:"flex",gap:8,marginTop:8}}>
      <button onClick={addWishItem} style={{flex:1,background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"11px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Save</button>
      <button onClick={()=>setAddingWish(false)} style={{...chipStyle(false),padding:"11px 16px"}}>Cancel</button>
    </div>
  </div>)}

  {wishlist.length===0&&!addingWish&&(<div style={{textAlign:"center",padding:"60px 24px",color:"#444"}}><div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Nothing yet</div><div style={{fontSize:11,color:"#333"}}>Add items you want to buy</div></div>)}

  {wishlist.map(item=>(<div key={item.id} style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:14,marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:item.type==="general"?"#666":"#b8976a",marginBottom:4}}>{item.type==="general"?"General":"Specific"}</div>
        <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{item.name||item.note}</div>
        {item.brand&&<div style={{fontSize:11,color:"#777",marginBottom:4}}>{item.brand}</div>}
        {item.note&&item.type==="specific"&&<div style={{fontSize:11,color:"#666",marginBottom:4}}>Current: ${item.note}</div>}
        {item.targetPrice&&<div style={{fontSize:11,color:"#b8976a"}}>Alert at: ${item.targetPrice}</div>}
        {item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase",textDecoration:"none",display:"block",marginTop:6}}>View item →</a>}
      </div>
      <button onClick={()=>persistWishlist(wishlist.filter(w=>w.id!==item.id))} style={{...ghostBtn,color:"#555",fontSize:16,padding:"0 0 0 12px"}}>×</button>
    </div>
  </div>))}
</div>)}

{/* ADD */}
{view==="add"&&(<div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
  <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
    {navBtn("📷 Photo",addMode==="photo",()=>setAddMode("photo"))}
    {navBtn("🔗 URL",addMode==="url",()=>setAddMode("url"))}
    {navBtn("🧾 Receipt",addMode==="receipt",()=>{setAddMode("receipt");setReceiptData(null)})}
  </div>

  {addMode==="photo"&&(<>
    {scanningImage&&<div style={{textAlign:"center",padding:"16px 0",color:"#b8976a"}}><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>✦ Reading image...</div><div style={{fontSize:10,color:"#555",marginTop:4}}>Extracting brand, color, details</div></div>}
    <FormFields form={addForm} setForm={setAddForm} onImageClick={()=>openFilePicker("add")} brands={brands} onAddBrand={addBrand}/>
    <button onClick={addItem} disabled={!addForm.name||scanningImage} style={{width:"100%",background:addForm.name&&!scanningImage?"#e8e2d8":"#1a1a1a",color:addForm.name&&!scanningImage?"#111":"#444",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:addForm.name&&!scanningImage?"pointer":"not-allowed",fontWeight:600,marginTop:8}}>Add to Closet</button>
  </>)}

  {addMode==="url"&&(<>
    <label style={labelStyle}>Product URL</label>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://..." style={{...inputStyle,marginBottom:0,flex:1}}/>
      <button onClick={fetchUrl} disabled={fetchingUrl||!urlInput} style={{...chipStyle(false),padding:"4px 14px",flexShrink:0,opacity:fetchingUrl||!urlInput?0.5:1}}>{fetchingUrl?"...":"Go"}</button>
    </div>
    {fetchingUrl&&<div style={{textAlign:"center",padding:"12px 0",color:"#b8976a",fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>✦ Reading page...</div>}
    <FormFields form={addForm} setForm={setAddForm} onImageClick={()=>openFilePicker("add")} brands={brands} onAddBrand={addBrand}/>
    <button onClick={addItem} disabled={!addForm.name} style={{width:"100%",background:addForm.name?"#e8e2d8":"#1a1a1a",color:addForm.name?"#111":"#444",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:addForm.name?"pointer":"not-allowed",fontWeight:600,marginTop:8}}>Add to Closet</button>
  </>)}

  {addMode==="receipt"&&!receiptData&&!scanning&&(<div onClick={()=>receiptFileRef.current.click()} style={{background:"#1a1a1a",border:"1px dashed #333",borderRadius:3,padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}}><div style={{fontSize:36,marginBottom:12}}>🧾</div><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#666"}}>Upload Receipt</div><div style={{fontSize:11,color:"#444",marginTop:6,textAlign:"center"}}>Photo or screenshot of any receipt or order confirmation</div></div>)}
  {scanning&&<div style={{textAlign:"center",padding:"60px 24px",color:"#666"}}><div style={{fontSize:36,marginBottom:16}}>🧾</div><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>Reading receipt...</div></div>}
  {receiptData&&receiptData.length===0&&(<div style={{textAlign:"center",padding:"40px 0",color:"#666"}}><div style={{marginBottom:12}}>No items found. Try again.</div><button onClick={()=>setReceiptData(null)} style={chipStyle(false)}>Try Again</button></div>)}
  {receiptData&&receiptData.length>0&&(<><div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#b8976a",marginBottom:6}}>{receiptData.length} item{receiptData.length!==1?"s":""} found</div>{receiptDate&&<div style={{fontSize:11,color:"#888",marginBottom:14}}>Purchase date: {receiptDate}</div>}{receiptData.map(item=>(<div key={item.tempId} style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:14,marginBottom:12}}><div style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}><div onClick={()=>openFilePicker(item.tempId)} style={{width:52,height:68,background:"#111",border:"1px dashed #333",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,overflow:"hidden"}}>{receiptImages[item.tempId]?<img src={receiptImages[item.tempId]} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{fontSize:20,color:"#333"}}>+</div>}</div><div style={{flex:1,minWidth:0}}><input value={item.name} onChange={e=>updateRI(item.tempId,"name",e.target.value)} style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:6}}/><input value={item.brand||""} onChange={e=>updateRI(item.tempId,"brand",e.target.value)} placeholder="Brand" style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:6}}/><div style={{display:"flex",gap:6}}><select value={item.category} onChange={e=>updateRI(item.tempId,"category",e.target.value)} style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:0,flex:1}}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select><input value={item.price||""} onChange={e=>updateRI(item.tempId,"price",e.target.value)} placeholder="$" style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:0,width:60}}/></div></div><button onClick={()=>setReceiptData(prev=>prev.filter(i=>i.tempId!==item.tempId))} style={{...ghostBtn,fontSize:18,color:"#444",flexShrink:0}}>×</button></div><div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"#555",marginBottom:6}}>Color</div><div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{COLORS.map(c=><button key={c} onClick={()=>updateRI(item.tempId,"color",item.color===c?"":c)} style={{...chipStyle(item.color===c),padding:"3px 8px",fontSize:9}}>{c}</button>)}</div><div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"#555",marginBottom:6}}>Tags</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{Object.values(PRESET_TAGS).flat().map(t=><button key={t} onClick={()=>toggleRITag(item.tempId,t)} style={{...chipStyle((item.tags||[]).includes(t)),padding:"3px 8px",fontSize:9}}>{t}</button>)}</div></div>))}<button onClick={addReceiptItems} style={{width:"100%",background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Add {receiptData.length} Item{receiptData.length!==1?"s":""} to Closet</button><button onClick={()=>{setReceiptData(null);setReceiptDate("");setReceiptImages({})}} style={{width:"100%",background:"transparent",border:"1px solid #222",color:"#555",borderRadius:3,padding:"11px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginTop:8}}>Scan Different Receipt</button></>)}
</div>)}

{/* ITEM DETAIL */}
{selectedItem&&!editing&&(<div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:100,overflowY:"auto"}}><div style={{padding:24,maxWidth:480,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><button onClick={()=>{setSelectedItem(null);setItemEval("")}} style={ghostBtn}>← Back</button><button onClick={()=>{setEditing(true);setEditForm({...selectedItem,customColor:"",customMaterial:""})}} style={{...chipStyle(false),fontSize:10}}>Edit</button></div>{selectedItem.imageData?<img src={selectedItem.imageData} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:3,marginBottom:14}}/>:<div style={{width:"100%",aspectRatio:"3/4",background:"#1a1a1a",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,color:"#333",fontSize:12}}>No Photo</div>}<div style={{fontFamily:"Georgia, serif",fontSize:20,fontStyle:"italic",marginBottom:3}}>{selectedItem.name||"Unnamed"}</div>{selectedItem.brand&&<div style={{fontSize:11,color:"#777",marginBottom:8}}>{selectedItem.brand}</div>}<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{selectedItem.color&&<span style={chipStyle(false)}>{selectedItem.color}</span>}{selectedItem.material&&<span style={chipStyle(false)}>{selectedItem.material}</span>}{selectedItem.season&&selectedItem.season!=="All Year"&&<span style={chipStyle(false)}>{selectedItem.season}</span>}{selectedItem.sleeveLength&&selectedItem.sleeveLength!=="N/A"&&<span style={chipStyle(false)}>{selectedItem.sleeveLength}</span>}{selectedItem.length&&selectedItem.length!=="N/A"&&<span style={chipStyle(false)}>{selectedItem.length}</span>}{(selectedItem.tags||[]).map(t=><span key={t} style={chipStyle(true)}>{t}</span>)}</div>{selectedItem.comments&&<div style={{fontSize:12,color:"#777",fontStyle:"italic",lineHeight:1.6,marginBottom:12}}>{selectedItem.comments}</div>}<div style={{fontSize:10,color:"#555",lineHeight:1.8,marginBottom:14}}>{selectedItem.price&&<span>Paid ${selectedItem.price.toFixed(2)}{selectedItem.wornDates?.length>0?` · $${(selectedItem.price/selectedItem.wornDates.length).toFixed(2)}/wear`:""} · </span>}{selectedItem.datePurchased&&<span>Purchased {selectedItem.datePurchased} · </span>}Worn {selectedItem.wornDates?.length||0}×{selectedItem.wornDates?.length>0&&` · Last worn ${selectedItem.wornDates[selectedItem.wornDates.length-1]}`}</div><div style={{display:"flex",gap:8,marginBottom:16}}><button onClick={()=>markWorn(selectedItem.id)} style={{flex:1,background:"transparent",border:"1px solid #333",color:"#e8e2d8",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Mark Worn Today</button><button onClick={()=>removeItem(selectedItem.id)} style={{background:"transparent",border:"1px solid #3a2020",color:"#8a4a4a",borderRadius:3,padding:"10px 16px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Remove</button></div>{selectedItem.wornDates?.length>0&&(<div style={{marginBottom:18}}><div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:8}}>Wear History</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...selectedItem.wornDates].reverse().slice(0,12).map((d,i)=><span key={i} style={{fontSize:10,color:"#666",background:"#1a1a1a",padding:"3px 8px",borderRadius:2}}>{d}</span>)}</div></div>)}<div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:10}}>Style Verdict</div>{loadingEval?<div style={{color:"#444",fontSize:12,padding:"16px 0",fontStyle:"italic"}}>Evaluating...</div>:<div style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:16,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap"}}>{itemEval}</div>}</div></div>)}

{/* EDIT */}
{selectedItem&&editing&&editForm&&(<div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:100,overflowY:"auto"}}><div style={{padding:24,maxWidth:480,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><button onClick={()=>setEditing(false)} style={ghostBtn}>← Cancel</button><button onClick={saveEdit} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"7px 20px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Save</button></div><FormFields form={editForm} setForm={setEditForm} onImageClick={()=>openFilePicker("edit")} brands={brands} onAddBrand={addBrand}/></div></div>)}
```

  </div>);
}
