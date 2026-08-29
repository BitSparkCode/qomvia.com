import { ImageResponse } from "next/og";
import { robotHeadDataUri } from "@/lib/logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
          background: "#07090c",
          color: "#e8edf4",
          padding: 90,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={robotHeadDataUri(96)} width={96} height={96} alt="" />
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</span>
        </div>
        <div style={{ display: "flex", fontSize: 52, color: "#38e08a", lineHeight: 1.2 }}>{SITE_TAGLINE}</div>
        <div style={{ display: "flex", fontSize: 30, color: "#8d9bad" }}>
          A transparent 100-point score measured from public HTTP responses.
        </div>
      </div>
    ),
    size,
  );
}
