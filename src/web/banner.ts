// banner.ts — the DYNAMIC event banner (the "background picture" behind an event).
//
// One clean treatment, no picker: the HOST's own picture — an athlete's photo or
// a club/organiser logo — embedded into a dark, ember-lit field. The picture is
// full-bleed and FEATHERED into the artwork (never a photo-in-a-ring badge), with
// a soft ember glow behind it and a vignette for depth. No picture (especially an
// unclaimed side) falls back to the name's INITIALS (e.g. "RV"), set large.
//
// versus (two sides) → the two pictures meet at a slim ember seam with a minimal
// VS; an unclaimed side is that side's initials. Served at /e/:id/banner.svg and
// used as the cover FALLBACK wherever an event has no uploaded cover.
export interface BannerParty { name: string; avatarUrl: string | null }

// Kept for compatibility with callers that still pass/normalise a style; the
// generator no longer branches on it (there is a single design).
export type BannerStyle = string;
export function normalizeBannerStyle(s: string | null | undefined): string { return s ?? ''; }

const INK1 = '#171412', INK2 = '#0C0A09', EMBER = '#E1553B', BONE = '#F1ECE3';
const xmlB = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
const W = 1200, H = 480;

const DEFS =
  `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INK1}"/><stop offset="1" stop-color="${INK2}"/></linearGradient>` +
  `<linearGradient id="vin" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>` +
  `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.22 0"/></filter>`;

// A soft ember halo behind the subject (a rim of light, not a ring outline).
const glow = (cxPct: number) => `<radialGradient id="glow${cxPct}" cx="${cxPct}%" cy="42%" r="58%"><stop offset="0" stop-color="${EMBER}" stop-opacity="0.30"/><stop offset="1" stop-color="${EMBER}" stop-opacity="0"/></radialGradient>`;

// Feather mask: opaque toward `bx`, dissolving to nothing toward `ax`, so the
// picture melts into the field instead of ending in a hard edge or a disc.
const fade = (id: string, ax: number, bx: number) =>
  `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${ax}" y1="0" x2="${bx}" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="${id}"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}g)"/></mask>`;

const pic = (href: string, x: number, w: number, maskRef: string) =>
  `<image href="${xmlB(href)}" x="${x}" y="-24" width="${w}" height="${H + 48}" preserveAspectRatio="xMidYMid slice" mask="${maskRef}"/>`;

const mono = (name: string, cx: number, cy: number, size: number) =>
  `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Liberation Sans,Helvetica Neue,Arial,sans-serif" font-size="${size}" font-weight="bold" letter-spacing="-4" fill="${BONE}" opacity="0.94">${xmlB(initials(name))}</text>` +
  `<rect x="${cx - size * 0.42}" y="${cy + 26}" width="${size * 0.84}" height="6" rx="3" fill="${EMBER}"/>`;

const svg = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${body}</svg>`;

/**
 * Render the banner SVG. `versus` splits it into two integrated pictures; a
 * single host (also multi-party) gets one embedded picture. `style` is ignored
 * (single design) but accepted for backward compatibility.
 */
export function eventBannerSvg(d: { style?: string | null; host: BannerParty; opponent?: BannerParty | null; versus?: boolean }): string {
  const host = d.host ?? { name: '', avatarUrl: null };

  if (d.versus) {
    const opp = d.opponent ?? { name: '', avatarUrl: null };
    const defs = `<defs>${DEFS}${glow(50)}${fade('fl', 662, 476)}${fade('fr', 538, 724)}</defs>`;
    const left = host.avatarUrl ? pic(host.avatarUrl, -16, 720, 'url(#fl)') : mono(host.name, 296, 288, 150);
    const right = opp.avatarUrl ? pic(opp.avatarUrl, 496, 720, 'url(#fr)') : mono(opp.name || '?', 904, 288, 150);
    const seam = `<rect x="598" y="0" width="4" height="480" fill="${EMBER}"/>` +
      `<text x="600" y="256" text-anchor="middle" font-family="Liberation Sans,Helvetica Neue,Arial,sans-serif" font-size="60" font-weight="bold" letter-spacing="-1" fill="${EMBER}" stroke="${INK2}" stroke-width="7" paint-order="stroke">VS</text>`;
    return svg(defs,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow50)"/>
       ${left}${right}
       <rect width="${W}" height="${H}" fill="url(#vin)"/><rect width="${W}" height="${H}" fill="url(#grain)" opacity="0.3"/>
       ${seam}`);
  }

  const defs = `<defs>${DEFS}${glow(72)}${fade('fs', 500, 720)}</defs>`;
  const subject = host.avatarUrl ? pic(host.avatarUrl, 470, 764, 'url(#fs)') : mono(host.name, 850, 288, 210);
  return svg(defs,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow72)"/>
     ${subject}
     <rect width="${W}" height="${H}" fill="url(#vin)"/><rect width="${W}" height="${H}" fill="url(#grain)" opacity="0.28"/>
     <rect x="64" y="402" width="176" height="3" rx="1.5" fill="${EMBER}"/>`);
}
