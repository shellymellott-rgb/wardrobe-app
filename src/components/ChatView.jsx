import { useEffect } from "react";
import { inputStyle, ghostBtn } from "../styles.js";

export default function ChatView({
  chatHistory, setChatHistory,
  chatInput, setChatInput, chatLoading,
  styleNotes, removeStyleNote, clearStyleNotes,
  learnedIndicator, chatEndRef,
  correctingIdx, setCorrectingIdx, correctionInput, setCorrectionInput,
  sendChat, submitCorrection,
}) {
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatHistory]);

  return (
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",height:"calc(100vh - 160px)",display:"flex",flexDirection:"column"}}>
      {styleNotes.length>0 && (
        <div style={{flexShrink:0,padding:"10px 24px",borderBottom:"1px solid #1a1a1a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555"}}>Your style notes</div>
            <button onClick={clearStyleNotes} style={{...ghostBtn,fontSize:9,color:"#444",letterSpacing:1}}>clear all</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {styleNotes.map((n,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{fontSize:11,color:"#777",lineHeight:1.4}}>· {n}</div>
                <button onClick={()=>removeStyleNote(i)} style={{...ghostBtn,fontSize:13,color:"#3a3a3a",padding:0,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {chatHistory.length===0 && !chatLoading ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px 40px"}}>
          <div style={{fontSize:22,fontStyle:"italic",letterSpacing:-0.5,color:"#e8e2d8",marginBottom:6}}>Ask anything</div>
          <div style={{fontSize:12,color:"#444",lineHeight:2,textAlign:"center",marginBottom:32}}>What am I missing? · What shoes go with my cream jeans?<br/>Build a capsule for a weekend trip</div>
          <div style={{width:"100%",maxWidth:480,display:"flex",gap:8,alignItems:"center"}}>
            {learnedIndicator && <div style={{fontSize:9,color:"#b8976a",letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>✦ noted</div>}
            <input autoFocus value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat(chatHistory,setChatHistory);}}} placeholder="Ask about your wardrobe..." style={{...inputStyle,marginBottom:0,flex:1,fontSize:15,padding:"14px 16px"}} disabled={chatLoading}/>
            <button onClick={()=>sendChat(chatHistory,setChatHistory)} disabled={chatLoading||!chatInput.trim()} style={{background:chatInput.trim()&&!chatLoading?"#e8e2d8":"#1a1a1a",color:chatInput.trim()&&!chatLoading?"#111":"#444",border:"none",borderRadius:3,padding:"14px 20px",fontSize:13,letterSpacing:1,cursor:chatInput.trim()&&!chatLoading?"pointer":"not-allowed",flexShrink:0,fontWeight:600}}>Send</button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
            {chatHistory.map((msg,i)=>(
              <div key={i}>
                <div style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:msg.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:msg.role==="user"?"#e8e2d8":"#1a1a1a",color:msg.role==="user"?"#111":"#c8c0b0",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{msg.content}</div>
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
          <div style={{flexShrink:0,padding:"12px 16px",borderTop:"1px solid #1a1a1a",background:"#111",display:"flex",gap:8,alignItems:"center"}}>
            {learnedIndicator && <div style={{fontSize:9,color:"#b8976a",letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>✦ noted</div>}
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat(chatHistory,setChatHistory);}}} placeholder="Ask about your wardrobe..." style={{...inputStyle,marginBottom:0,flex:1}} disabled={chatLoading}/>
            <button onClick={()=>sendChat(chatHistory,setChatHistory)} disabled={chatLoading||!chatInput.trim()} style={{background:chatInput.trim()&&!chatLoading?"#e8e2d8":"#1a1a1a",color:chatInput.trim()&&!chatLoading?"#111":"#444",border:"none",borderRadius:3,padding:"0 18px",fontSize:11,letterSpacing:1,cursor:chatInput.trim()&&!chatLoading?"pointer":"not-allowed",flexShrink:0,fontWeight:600}}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
