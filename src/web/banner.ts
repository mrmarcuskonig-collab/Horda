// banner.ts — the DYNAMIC event banner (the "background picture" behind an event).
//
// The default banner isn't a blank gradient: it's a designed treatment of the
// HOST's own picture — the athlete's photo or the club's logo — so an event looks
// like itself the moment it's created, with nothing uploaded.
//
//   * single / multi-party host → one host, centred, on a blurred duotone wash of
//     their own picture.
//   * versus (two sides)        → the banner splits down a diagonal seam: the host
//     on the left, the opponent on the right (a "VS" badge between them). If side B
//     hasn't been claimed yet, the right half is a clean placeholder.
//
// Served as SVG at /e/:id/banner.svg and used as the cover FALLBACK wherever an
// event has no uploaded cover. Embedded images may be data: URLs (uploads) or
// https URLs; browsers render both inside an <img src=".svg">.
export interface BannerParty { name: string; avatarUrl: string | null }
export type BannerStyle = 'ember' | 'mono' | 'cool' | 'bold';
export const BANNER_STYLES: BannerStyle[] = ['ember', 'mono', 'cool', 'bold'];
export const BANNER_STYLE_LABEL: Record<BannerStyle, string> = { ember: 'Ember', mono: 'Mono', cool: 'Cool', bold: 'Bold' };
export function normalizeBannerStyle(s: string | null | undefined): BannerStyle {
  return (BANNER_STYLES as string[]).includes(s ?? '') ? (s as BannerStyle) : 'ember';
}

const STYLE: Record<BannerStyle, { glow: string; base: string; ring: string; seam: string }> = {
  ember: { glow: '#E15A40', base: '#160f0d', ring: '#E15A40', seam: '#E15A40' },
  mono:  { glow: '#8a8a8a', base: '#121212', ring: '#EDE9DF', seam: '#EDE9DF' },
  cool:  { glow: '#3b7fc4', base: '#0c141f', ring: '#7fb0e0', seam: '#7fb0e0' },
  bold:  { glow: '#E15A40', base: '#211d1d', ring: '#EDE9DF', seam: '#E15A40' },
};

const xmlB = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

const W = 1200, H = 480;

// One half of the banner (or the whole thing for a single host): a blurred, greyed
// wash of the picture, a radial glow in the style colour, and the picture again as
// a crisp disc with a coloured ring. No picture → a monogram placeholder.
function panel(x: number, w: number, p: BannerParty, s: BannerStyle, idx: number): string {
  const st = STYLE[s];
  const cx = x + w / 2, cy = H * 0.44, r = Math.round(Math.min(w, H) * 0.235);
  const clip = `bclip${idx}`;
  const wash = p.avatarUrl
    ? `<image href="${xmlB(p.avatarUrl)}" x="${x - 40}" y="-40" width="${w + 80}" height="${H + 80}" preserveAspectRatio="xMidYMid slice" filter="url(#bblur)" opacity="0.5"/>`
    : '';
  const disc = p.avatarUrl
    ? `<image href="${xmlB(p.avatarUrl)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(237,233,223,.07)"/>
       <text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-family="Liberation Sans,DejaVu Sans,Arial,sans-serif" font-size="${Math.round(r * 0.9)}" font-weight="bold" fill="rgba(237,233,223,.5)">${xmlB(initials(p.name))}</text>`;
  return `
    <clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <g clip-path="url(#half${idx})">
      <rect x="${x}" y="0" width="${w}" height="${H}" fill="${st.base}"/>
      ${wash}
      <rect x="${x}" y="0" width="${w}" height="${H}" fill="url(#glow${idx})"/>
      <rect x="${x}" y="0" width="${w}" height="${H}" fill="url(#vign)"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${st.ring}" stroke-width="4" opacity="0.9"/>
      ${disc}
    </g>`;
}

/**
 * Render the banner SVG. `versus` splits it in two; otherwise it's a single host
 * treatment (also used for multi-party events, which read as one host).
 */
export function eventBannerSvg(d: { style?: string | null; host: BannerParty; opponent?: BannerParty | null; versus?: boolean }): string {
  const s = normalizeBannerStyle(d.style);
  const st = STYLE[s];
  const versus = !!d.versus;
  const glow = (id: string, cxPct: number) => `<radialGradient id="${id}" cx="${cxPct}%" cy="16%" r="90%">
      <stop offset="0" stop-color="${st.glow}" stop-opacity="0.34"/><stop offset="1" stop-color="${st.base}" stop-opacity="0"/></radialGradient>`;
  const defs = `<defs>
    <filter id="bblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/><feColorMatrix type="saturate" values="0.35"/></filter>
    <linearGradient id="vign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>
    ${glow('glow0', versus ? 26 : 50)}${versus ? glow('glow1', 74) : ''}
    <clipPath id="half0"><rect x="0" y="0" width="${versus ? W / 2 : W}" height="${H}"/></clipPath>
    ${versus ? `<clipPath id="half1"><rect x="${W / 2}" y="0" width="${W / 2}" height="${H}"/></clipPath>` : ''}
  </defs>`;

  if (!versus) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${panel(0, W, d.host, s, 0)}</svg>`;
  }
  const opp: BannerParty = d.opponent ?? { name: '', avatarUrl: null };
  // The diagonal seam + a VS badge — the fight-poster split.
  const seam = `<polygon points="${W / 2 - 26},0 ${W / 2 + 26},0 ${W / 2 + 6},${H} ${W / 2 - 46},${H}" fill="${st.base}"/>
    <line x1="${W / 2 - 10}" y1="0" x2="${W / 2 - 30}" y2="${H}" stroke="${st.seam}" stroke-width="3" opacity="0.85"/>
    <g><circle cx="${W / 2 - 10}" cy="${H / 2}" r="46" fill="${st.base}" stroke="${st.seam}" stroke-width="3"/>
       <text x="${W / 2 - 10}" y="${H / 2 + 16}" text-anchor="middle" font-family="Liberation Sans,DejaVu Sans,Arial,sans-serif" font-size="40" font-weight="bold" fill="#EDE9DF">VS</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
    ${panel(0, W / 2, d.host, s, 0)}
    ${panel(W / 2, W / 2, opp, s, 1)}
    ${seam}</svg>`;
}
