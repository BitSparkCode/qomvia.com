import { ImageResponse } from "next/og";
import { robotHeadDataUri } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090c",
        }}
      >
        <img src={robotHeadDataUri(140)} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
