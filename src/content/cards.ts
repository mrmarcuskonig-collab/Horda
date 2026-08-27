// cards.ts — vertical share cards (1080×1350, IG/TikTok-native). Pure SVG,
// Ink/Bone with the ember spark mark. Every value is real spine data.
const INK = '#0B0B0C', BONE = '#EDE9DF', EMBER = '#E15A40';
// The Furia mark — a four-point ember spark (normalized 0..100, centred 50,50).
const SPARK = 'M50 22C58 42 63 45 99 50 63 55 58 58 50 78 42 58 37 45 1 50 37 45 42 42 50 22Z';
const escTxt = (s: string) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

// the ember spark mark, drawn small (normalized 0..100 → scale s)
const RAVEN = (x: number, y: number, s: number, fill = EMBER) =>
  `<g transform="translate(${x},${y}) scale(${s / 100})" fill="${fill}"><path d="${SPARK}"/></g>`;

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines.slice(0, 3);
}

export interface CardOpts { kicker: string; big: string; sub?: string; foot?: string }
export function shareCardSVG(o: CardOpts): string {
  const lines = wrap(o.big.toUpperCase(), 15);
  const startY = 760 - (lines.length - 1) * 60;
  const bigText = lines.map((l, i) => `<text x="72" y="${startY + i * 120}" font-size="104" font-weight="800" letter-spacing="-1" fill="${BONE}">${escTxt(l)}</text>`).join('');
  const facets = Array.from({ length: 7 }, (_, i) => `<line x1="${-200 + i * 230}" y1="0" x2="${100 + i * 230}" y2="1350" stroke="${BONE}" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <rect width="1080" height="1350" fill="${INK}"/>
  <g opacity="0.05">${facets}</g>
  <g transform="translate(72,60) scale(1.2)"><path fill="${EMBER}" d="${SPARK}"/></g>
  <text x="72" y="300" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="800" letter-spacing="6" fill="${BONE}" opacity="0.65">${escTxt(o.kicker.toUpperCase())}</text>
  <g font-family="Helvetica,Arial,sans-serif">${bigText}</g>
  ${o.sub ? `<text x="72" y="910" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="600" fill="${BONE}" opacity="0.8">${escTxt(o.sub)}</text>` : ''}
  ${o.foot ? `<text x="72" y="1180" font-family="Helvetica,Arial,sans-serif" font-size="40" font-weight="800" letter-spacing="1" fill="${BONE}">${escTxt(o.foot)}</text>` : ''}
  <line x1="72" y1="1240" x2="1008" y2="1240" stroke="${BONE}" stroke-width="2" opacity="0.3"/>
  <text x="72" y="1300" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="2" fill="${BONE}" opacity="0.7">joinfuria.com · this is the Furia</text>
  </svg>`;
}

export const cardDataUri = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
