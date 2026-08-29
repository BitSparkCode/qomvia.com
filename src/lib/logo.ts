/**
 * The Qomvia mark: a robot head whose visor is a scanning bar, drawn on a 32×32
 * grid. Defined once as markup so the React header, the favicon, the embeddable
 * badge and the Open Graph images all render the identical geometry.
 */
export type LogoColors = {
  /** Head plate fill. */
  plate?: string;
  /** Outline, antenna and visor colour. */
  accent?: string;
  /** Eye colour, sitting on top of the visor. */
  eye?: string;
};

const DEFAULTS: Required<LogoColors> = {
  plate: "#0e1218",
  accent: "#38e08a",
  eye: "#07090c",
};

export function robotHeadInner(colors: LogoColors = {}): string {
  const { plate, accent, eye } = { ...DEFAULTS, ...colors };
  return [
    `<path d="M16 2.5v3.5" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`,
    `<circle cx="16" cy="2.5" r="2" fill="${accent}"/>`,
    `<rect x="1" y="13" width="3" height="7" rx="1.5" fill="${accent}"/>`,
    `<rect x="28" y="13" width="3" height="7" rx="1.5" fill="${accent}"/>`,
    `<rect x="5" y="6" width="22" height="21" rx="6" fill="${plate}" stroke="${accent}" stroke-width="2"/>`,
    `<rect x="9" y="12" width="14" height="7" rx="3.5" fill="${accent}"/>`,
    `<circle cx="12.8" cy="15.5" r="1.7" fill="${eye}"/>`,
    `<circle cx="19.2" cy="15.5" r="1.7" fill="${eye}"/>`,
    `<path d="M12 23h8" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`,
  ].join("");
}

export function robotHeadSvg(size: number, colors: LogoColors = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" role="img" aria-label="Qomvia">${robotHeadInner(colors)}</svg>`;
}

export function robotHeadDataUri(size: number, colors: LogoColors = {}): string {
  return `data:image/svg+xml;base64,${Buffer.from(robotHeadSvg(size, colors)).toString("base64")}`;
}
