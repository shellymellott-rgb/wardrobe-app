import { createElement } from "react";
import { T } from "./theme.js";

export const ghostBtn = {
  background: "transparent", border: "none", color: T.ink3, fontSize: 11,
  letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", padding: "4px 0",
  fontFamily: T.mono,
};

export function chipStyle(active) {
  return {
    background: active ? T.ink : "transparent",
    color: active ? '#fff' : T.ink2,
    border: `1px solid ${T.rule}`,
    borderRadius: 0, padding: "6px 14px", fontSize: 10, letterSpacing: ".18em",
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: T.mono,
    textTransform: "uppercase",
  };
}

export const inputStyle = {
  width: "100%", background: T.paper, border: `1px solid ${T.rule}`, color: T.ink,
  borderRadius: 0, padding: "12px 14px", fontSize: 13, outline: "none",
  boxSizing: "border-box", fontFamily: T.sans, marginBottom: 10,
};

export const labelStyle = {
  fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: T.ink3,
  display: "block", marginBottom: 6, marginTop: 14, fontFamily: T.mono,
};

export function navBtn(label, active, onClick) {
  return createElement("button", {
    onClick,
    style: {
      background: "transparent",
      color: active ? T.ink : T.ink3,
      border: 0,
      borderBottom: active ? `1px solid ${T.ink}` : "1px solid transparent",
      borderRadius: 0, padding: "6px 0", fontSize: 10, letterSpacing: ".22em",
      textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
      fontFamily: T.mono,
    },
  }, label);
}
