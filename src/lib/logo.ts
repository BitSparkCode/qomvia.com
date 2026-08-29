/**
 * The Qomvia mark: a friendly agent — an outlined robot head with round eyes, a
 * smile and a signal antenna, drawn on a 32×32 grid. Defined once as markup so
 * the React header, the favicon, the embeddable badge and the Open Graph images
 * all render the identical geometry.
 */
export type LogoColors = {
  /** Head fill, kept light so the mark never reads as a solid black block. */
  plate?: string;
  /** Outline, eyes and smile. */
  ink?: string;
  /** Antenna signal, the single spot of colour. */
  accent?: string;
};

const DEFAULTS: Required<LogoColors> = {
  plate: "#ffffff",
  ink: "#17181b",
  accent: "#1d4d3e",
};

/**
 * Self-contained blink, so the same markup animates in the React header and in
 * the standalone badge SVG that merchants embed. Static for reduced motion and
 * for renderers without CSS animation (Open Graph images, favicons).
 */
const BLINK_STYLE = [
  `<style>`,
  `.qv-eyes{transform-origin:16px 15px;animation:qv-blink 5.2s ease-in-out infinite}`,
  `.qv-signal{transform-origin:16px 2.6px;animation:qv-signal 5.2s ease-in-out infinite}`,
  `@keyframes qv-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}`,
  `@keyframes qv-signal{0%,88%,100%{opacity:1;transform:scale(1)}94%{opacity:.55;transform:scale(1.25)}}`,
  `@media (prefers-reduced-motion:reduce){.qv-eyes,.qv-signal{animation:none}}`,
  `</style>`,
].join("");

export function robotHeadInner(colors: LogoColors = {}, options: { animated?: boolean } = {}): string {
  const { plate, ink, accent } = { ...DEFAULTS, ...colors };
  const eyes =
    `<circle cx="12.6" cy="15" r="1.9" fill="${ink}"/>` + `<circle cx="19.4" cy="15" r="1.9" fill="${ink}"/>`;
  return [
    options.animated ? BLINK_STYLE : "",
    `<path d="M16 3.6v3.4" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    `<circle cx="16" cy="2.6" r="2" fill="${accent}"${options.animated ? ` class="qv-signal"` : ""}/>`,
    `<path d="M3.4 14.5v3.6" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    `<path d="M28.6 14.5v3.6" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    `<rect x="6" y="7" width="20" height="18.4" rx="7.5" fill="${plate}" stroke="${ink}" stroke-width="1.8"/>`,
    options.animated ? `<g class="qv-eyes">${eyes}</g>` : eyes,
    `<path d="M12.4 19.4c1.2 1.6 2.3 2.3 3.6 2.3s2.4-.7 3.6-2.3" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
  ].join("");
}

export function robotHeadSvg(size: number, colors: LogoColors = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" role="img" aria-label="Qomvia">${robotHeadInner(colors)}</svg>`;
}

export function robotHeadDataUri(size: number, colors: LogoColors = {}): string {
  return `data:image/svg+xml;base64,${Buffer.from(robotHeadSvg(size, colors)).toString("base64")}`;
}
