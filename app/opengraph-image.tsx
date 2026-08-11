import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TrueCite — Evidence before confidence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#f8fafc", background: "linear-gradient(135deg,#07111f,#0f2740 62%,#0d9488)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34 }}><span style={{ display: "flex", width: 54, height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", background: "#5eead4", color: "#07111f", fontWeight: 800 }}>T</span>TrueCite</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}><div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 700, maxWidth: 920 }}>Evidence before confidence.</div><div style={{ fontSize: 30, color: "#cbd5e1" }}>Deterministic readiness · fail-closed grounded prose · reviewable evidence packs</div></div>
      <div style={{ display: "flex", fontSize: 22, color: "#99f6e4" }}>AI governance portfolio demonstration</div>
    </div>, size
  );
}
