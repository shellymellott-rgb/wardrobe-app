import { useEffect } from "react";
import { inputStyle, ghostBtn } from "../styles.js";

export default function ItemChatModal({
  itemChatModal, setItemChatModal,
  itemChatHistory, itemChatInput, setItemChatInput, itemChatLoading,
  itemChatEndRef, learnedIndicator,
  sendItemChat,
}) {
  useEffect(() => { itemChatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [itemChatHistory]);

  if (!itemChatModal) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:150,display:"flex",flexDirection:"column",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div style={{padding:"16px 24px",borderBottom:"1px solid #222",flexShrink:0,display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setItemChatModal(null)} style={ghostBtn}>← Back</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555"}}>Styling</div>
          <div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{itemChatModal.name}</div>
        </div>
        {learnedIndicator && <div style={{fontSize:9,color:"#b8976a",letterSpacing:1.5,textTransform:"uppercase",flexShrink:0}}>✦ noted</div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
        {itemChatHistory.length===0 && (
          <div style={{textAlign:"center",padding:"40px 24px",color:"#444"}}>
            <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Chat about {itemChatModal.name}</div>
            <div style={{fontSize:11,color:"#333",lineHeight:1.8}}>How to style it · What to wear it with · Is this worth keeping?</div>
          </div>
        )}
        {itemChatHistory.map((msg,i)=>(
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:msg.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:msg.role==="user"?"#e8e2d8":"#1a1a1a",color:msg.role==="user"?"#111":"#c8c0b0",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{msg.content}</div>
          </div>
        ))}
        {itemChatLoading && (
          <div style={{display:"flex",justifyContent:"flex-start"}}>
            <div style={{padding:"10px 14px",borderRadius:"12px 12px 12px 3px",background:"#1a1a1a",color:"#555",fontSize:13,fontStyle:"italic"}}>Thinking...</div>
          </div>
        )}
        <div ref={itemChatEndRef}/>
      </div>
      <div style={{padding:"12px 16px",borderTop:"1px solid #1a1a1a",background:"#0d0d0d",display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
        <input
          value={itemChatInput} onChange={e=>setItemChatInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendItemChat();}}}
          placeholder={`Ask about ${itemChatModal.name}...`}
          style={{...inputStyle,marginBottom:0,flex:1}} disabled={itemChatLoading} autoFocus
        />
        <button onClick={sendItemChat} disabled={itemChatLoading||!itemChatInput.trim()} style={{background:itemChatInput.trim()&&!itemChatLoading?"#e8e2d8":"#1a1a1a",color:itemChatInput.trim()&&!itemChatLoading?"#111":"#444",border:"none",borderRadius:3,padding:"0 18px",fontSize:11,letterSpacing:1,cursor:itemChatInput.trim()&&!itemChatLoading?"pointer":"not-allowed",flexShrink:0,fontWeight:600}}>Send</button>
      </div>
    </div>
  );
}
