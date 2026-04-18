export default function LoginScreen({ onSignIn }) {
  return (
    <div style={{ minHeight:"100vh", background:"#111", color:"#e8e2d8", fontFamily:"Georgia,'Times New Roman',serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:10, letterSpacing:5, color:"#555", textTransform:"uppercase", marginBottom:8 }}>Personal Closet</div>
      <div style={{ fontSize:36, fontStyle:"italic", letterSpacing:-0.5, marginBottom:48 }}>Wardrobe</div>
      <button
        onClick={onSignIn}
        style={{ background:"#e8e2d8", color:"#111", border:"none", borderRadius:3, padding:"16px 32px", fontSize:12, letterSpacing:3, textTransform:"uppercase", cursor:"pointer", fontWeight:600, fontFamily:"'DM Sans',system-ui,sans-serif" }}
      >
        Sign in with Google
      </button>
      <div style={{ fontSize:10, color:"#444", marginTop:16, letterSpacing:1, fontFamily:"'DM Sans',system-ui,sans-serif" }}>Your wardrobe syncs automatically across all devices</div>
    </div>
  );
}
