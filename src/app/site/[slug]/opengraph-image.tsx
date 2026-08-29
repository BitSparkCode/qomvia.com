import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { robotHeadDataUri } from "@/lib/logo";
import { gradeColor, SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  const scan = brand
    ? await prisma.scan.findFirst({
        where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const score = scan?.score ?? 0;
  const color = gradeColor(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf7",
          color: "#17181b",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#6a675f" }}>
          <img src={robotHeadDataUri(44)} width={44} height={44} alt="" />
          {SITE_NAME} · agent-readiness score
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
            {brand?.domain ?? "not scored yet"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
            <span style={{ fontSize: 180, fontWeight: 800, color, lineHeight: 1 }}>{scan ? score : "—"}</span>
            <span style={{ fontSize: 48, color: "#6a675f", paddingBottom: 24 }}>/100</span>
            {scan?.grade ? (
              <span style={{ fontSize: 48, color, paddingBottom: 24 }}>grade {scan.grade}</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#6a675f" }}>
          Can AI agents read your catalogue and reach checkout?
        </div>
      </div>
    ),
    size,
  );
}
