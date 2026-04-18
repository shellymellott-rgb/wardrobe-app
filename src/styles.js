import { createElement } from "react";

export const ghostBtn = {
  background:"transparent",border:"none",color:"#888",fontSize:11,
  letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",padding:"4px 0",
};

export function chipStyle(active) {
  return {
    background:active?"#e8e2d8":"#1a1a1a",
    color:active?"#111":"#666",
    border:`1px solid ${active?"#e8e2d8":"#2a2a2a"}`,
    borderRadius:20,padding:"4px 12px",fontSize:10,letterSpacing:1,cursor:"pointer",
    whiteSpace:"nowrap",fontFamily:"'DM Sans', system-ui, sans-serif",
  };
}

export const inputStyle = {
  width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#e8e2d8",
  borderRadius:3,padding:"11px 12px",fontSize:12,outline:"none",boxSizing:"border-box",
  fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:10,
};

export const labelStyle = {
  fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#666",
  display:"block",marginBottom:5,marginTop:10,
};

export function navBtn(label, active, onClick) {
  return createElement("button", {
    onClick,
    style:{
      background:active?"#e8e2d8":"transparent",
      color:active?"#111":"#888",
      border:`1px solid ${active?"#e8e2d8":"#333"}`,
      borderRadius:20,padding:"6px 16px",fontSize:11,letterSpacing:1.5,
      textTransform:"uppercase",cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap",
    },
  }, label);
}
