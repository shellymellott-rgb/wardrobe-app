import { createElement } from "react";

export const ghostBtn = {
  background:"transparent",border:"none",color:"#666",fontSize:11,
  letterSpacing:1,textTransform:"uppercase",cursor:"pointer",padding:"4px 0",
  fontFamily:"'DM Sans', system-ui, sans-serif",
};

export function chipStyle(active) {
  return {
    background:active?"#e8e2d8":"transparent",
    color:active?"#111":"#555",
    border:`1px solid ${active?"#e8e2d8":"#2a2a2a"}`,
    borderRadius:20,padding:"5px 14px",fontSize:11,letterSpacing:0.5,cursor:"pointer",
    whiteSpace:"nowrap",fontFamily:"'DM Sans', system-ui, sans-serif",
    fontWeight:active?500:400,
  };
}

export const inputStyle = {
  width:"100%",background:"#161616",border:"1px solid #252525",color:"#e8e2d8",
  borderRadius:6,padding:"12px 14px",fontSize:13,outline:"none",boxSizing:"border-box",
  fontFamily:"'DM Sans', system-ui, sans-serif",marginBottom:10,
};

export const labelStyle = {
  fontSize:10,letterSpacing:1,textTransform:"uppercase",color:"#777",
  display:"block",marginBottom:6,marginTop:14,
  fontFamily:"'DM Sans', system-ui, sans-serif",
};

export function navBtn(label, active, onClick) {
  return createElement("button", {
    onClick,
    style:{
      background:active?"#e8e2d8":"transparent",
      color:active?"#111":"#666",
      border:`1px solid ${active?"#e8e2d8":"#2a2a2a"}`,
      borderRadius:20,padding:"7px 18px",fontSize:11,letterSpacing:1,
      textTransform:"uppercase",cursor:"pointer",fontWeight:active?600:400,
      whiteSpace:"nowrap",fontFamily:"'DM Sans', system-ui, sans-serif",
    },
  }, label);
}
