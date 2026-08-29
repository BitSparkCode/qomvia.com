import { robotHeadInner, type LogoColors } from "@/lib/logo";

export function Logo({
  size = 28,
  colors,
  animated = true,
}: {
  size?: number;
  colors?: LogoColors;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Qomvia"
      dangerouslySetInnerHTML={{ __html: robotHeadInner(colors, { animated }) }}
    />
  );
}
