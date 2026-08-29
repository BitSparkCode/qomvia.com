import { ImageResponse } from "next/og";
import { robotHeadDataUri } from "@/lib/logo";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fbfaf7" }}>
        <img src={robotHeadDataUri(32)} width={32} height={32} alt="" />
      </div>
    ),
    size,
  );
}
