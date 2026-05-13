import { useEffect, useRef, useState } from "react";
import { inputStyle, ghostBtn } from "../styles.js";

export default function ChatView({
  weather,
  chatHistory, setChatHistory,
  chatInput, setChatInput, chatLoading,
  styleNotes, removeStyleNote, clearStyleNotes,
  learnedIndicator, chatEndRef,
  correctingIdx, setCorrectingIdx, correctionInput, setCorrectionInput,
  sendChat, submitCorrection,
  attachedImage, onImageAttach, onImageClear,
  planCards, setPlanCards, onApprovePlanDay, items,
}) {
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatHistory]);
  const imageInputRef = useRef();
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",height:"calc(100vh - 160px)",display:"flex",flexDirection:"column"}}>
      <input type="file" accept="image/*" ref={imageInputRef} style={{display:"none"}}
        onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f && onImageAttach) onImageAttach(f); }} />
      {styleNotes.length>0 && (
        <div style={{flexShrink:0,borderBottom:"1px solid #1a1a1a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 24px",cursor:"pointer"}} onClick={()=>setShowNotes(s=>!s)}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555"}}>· STYLE NOTES ({styleNotes.length}) {showNotes?"▾":"▸"}</div>
            {showNotes && <button onClick={e=>{e.stopPropagation();clearStyleNotes();}} style={{...ghostBtn,fontSize:9,color:"#444",letterSpacing:1}}>clear all</button>}
          </div>
          {showNotes && (
            <div style={{display:"flex",flexDirection:"column",gap:3,padding:"0 24px 10px"}}>
              {styleNotes.map((n,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{fontSize:11,color:"#777",lineHeight:1.4}}>· {n}</div>
                  <button onClick={()=>removeStyleNote(i)} style={{...ghostBtn,fontSize:13,color:"#3a3a3a",padding:0,flexShrink:0}}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {chatHistory.length===0 && !chatLoading ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px 40px"}}>
          <div style={{fontSize:22,fontStyle:"italic",letterSpacing:-0.5,color:"#e8e2d8",marginBottom:6}}>Ask anything</div>
          <div style={{fontSize:12,color:"#444",lineHeight:2,textAlign:"center",marginBottom:32}}>What am I missing? · What shoes go with my cream jeans?<br/>Build a capsule for a weekend trip</div>
          <div style={{width:"100%",maxWidth:480}}>
            {weather && (
              <div style={{fontSize:11,color:"#555",marginBottom:8,textAlign:"center"}}>🌤 {weather.tempHigh}°F · {weather.condition}</div>
            )}
            {attachedImage && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <img src={attachedImage} style={{height:48,width:36,objectFit:"cover",borderRadius:3,border:"1px solid #333"}}/>
                <button onClick={onImageClear} style={{...ghostBtn,fontSize:18,padding:"0 4px",color:"#666"}}>×</button>
              </div>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {learnedIndicator && <div style={{fontSize:9,color:"#b8976a",letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>✦ noted</div>}
              <input autoFocus value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat(chatHistory,setChatHistory);}}} placeholder="Ask about your wardrobe..." style={{...inputStyle,marginBottom:0,flex:1,fontSize:15,padding:"14px 16px"}} disabled={chatLoading}/>
              <button onClick={()=>imageInputRef.current?.click()} style={{background:"none",border:"none",color:"#666",fontSize:18,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}} title="Attach image">📎</button>
              <button onClick={()=>sendChat(chatHistory,setChatHistory)} disabled={chatLoading||!chatInput.trim()} style={{background:chatInput.trim()&&!chatLoading?"#e8e2d8":"#1a1a1a",color:chatInput.trim()&&!chatLoading?"#111":"#444",border:"none",borderRadius:3,padding:"14px 20px",fontSize:13,letterSpacing:1,cursor:chatInput.trim()&&!chatLoading?"pointer":"not-allowed",flexShrink:0,fontWeight:600}}>Send</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
            {chatHistory.map((msg,i)=>(
              <div key={i}>
                <div style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:msg.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:msg.role==="user"?"#e8e2d8":"#1a1a1a",color:msg.role==="user"?"#111":"#c8c0b0",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{Array.isArray(msg.content)?msg.content.map((block,bi)=>block.type==="image"?<img key={bi} src={`data:${block.source.media_type};base64,${block.source.data}`} style={{maxWidth:"100%",maxHeight:200,borderRadius:8,display:"block",marginBottom:4}}/>:<span key={bi}>{block.text}</span>):msg.content}</div>
                </div>
                {msg.role==="assistant" && !chatLoading && (
                  correctingIdx===i ? (
                    <div style={{display:"flex",gap:6,marginTop:4,paddingLeft:4}}>
                      <input autoFocus value={correctionInput} onChange={e=>setCorrectionInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submitCorrection(chatHistory,setChatHistory,i);if(e.key==="Escape")setCorrectingIdx(null);}} placeholder="What was wrong?" style={{...inputStyle,marginBottom:0,flex:1,fontSize:11}}/>
                      <button type="button" onClick={()=>submitCorrection(chatHistory,setChatHistory,i)} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"0 12px",fontSize:11,cursor:"pointer",fontWeight:600,flexShrink:0}}>Save</button>
                      <button type="button" onClick={()=>setCorrectingIdx(null)} style={{...ghostBtn,fontSize:16,padding:"0 6px",flexShrink:0}}>✕</button>
                    </div>
                  ) : (
                    <div style={{paddingLeft:4,marginTop:2}}>
                      <button type="button" onClick={()=>{setCorrectingIdx(i);setCorrectionInput("");}} style={{background:"none",border:"none",color:"#3a3a3a",fontSize:10,cursor:"pointer",padding:"2px 4px",letterSpacing:1}}>✗ correct this</button>
                    </div>
                  )
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{padding:"10px 14px",borderRadius:"12px 12px 12px 3px",background:"#1a1a1a",color:"#555",fontSize:13,fontStyle:"italic"}}>Thinking...</div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
          {planCards?.length > 0 && (
            <div style={{flexShrink:0,borderTop:"1px solid #2a2a2a",background:"#161616",maxHeight:220,overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px 6px"}}>
                <div style={{fontSize:9,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Save to journal</div>
                <button onClick={()=>setPlanCards([])} style={{background:"none",border:"none",color:"#555",fontSize:16,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
              </div>
              {planCards.map((card,ci)=>(
                <div key={ci} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderTop:"1px solid #1a1a1a"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:"#e8e2d8",marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.date}{card.label?` · ${card.label}`:""}</div>
                    <div style={{display:"flex",gap:4}}>
                      {card.itemIds.slice(0,5).map(id=>{
                        const item=items?.find(i=>String(i.id)===id);
                        return item?(
                          <div key={id} style={{width:56,height:75,background:"#1a1a1a",borderRadius:2,overflow:"hidden",flexShrink:0}}>
                            {(item.imageThumb||item.imageData)&&<img src={item.imageThumb??item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                          </div>
                        ):null;
                      })}
                    </div>
                  </div>
                  <button onClick={()=>{onApprovePlanDay(card);setPlanCards(p=>p.filter((_,i)=>i!==ci));}} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"6px 12px",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",flexShrink:0,fontWeight:600}}>Add</button>
                  <button onClick={()=>setPlanCards(p=>p.filter((_,i)=>i!==ci))} style={{background:"none",border:"1px solid #333",color:"#666",borderRadius:3,padding:"6px 10px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",flexShrink:0}}>Skip</button>
                </div>
              ))}
            </div>
          )}
          <div style={{flexShrink:0,borderTop:"1px solid #1a1a1a",background:"#111"}}>
            {attachedImage && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px 0"}}>
                <img src={attachedImage} style={{height:48,width:36,objectFit:"cover",borderRadius:3,border:"1px solid #333"}}/>
                <button onClick={onImageClear} style={{...ghostBtn,fontSize:18,padding:"0 4px",color:"#666"}}>×</button>
              </div>
            )}
            <div style={{padding:"12px 16px",display:"flex",gap:8,alignItems:"center"}}>
              {learnedIndicator && <div style={{fontSize:9,color:"#b8976a",letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>✦ noted</div>}
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat(chatHistory,setChatHistory);}}} placeholder="Ask about your wardrobe..." style={{...inputStyle,marginBottom:0,flex:1}} disabled={chatLoading}/>
              <button onClick={()=>imageInputRef.current?.click()} style={{background:"none",border:"none",color:"#666",fontSize:18,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}} title="Attach image">📎</button>
              <button onClick={()=>sendChat(chatHistory,setChatHistory)} disabled={chatLoading||!chatInput.trim()} style={{background:chatInput.trim()&&!chatLoading?"#e8e2d8":"#1a1a1a",color:chatInput.trim()&&!chatLoading?"#111":"#444",border:"none",borderRadius:3,padding:"0 18px",fontSize:11,letterSpacing:1,cursor:chatInput.trim()&&!chatLoading?"pointer":"not-allowed",flexShrink:0,fontWeight:600}}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
