// cards.ts — monochrome, vertical share cards (1080×1350, IG/TikTok-native).
// Pure SVG, strictly Ink/Bone, raven motif. Every value is real spine data.
const INK = '#0B0B0C', BONE = '#EDE9DF';
const escTxt = (s: string) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

// angular raven head (profile) — the brand motif, drawn small
const RAVEN = (x: number, y: number, s: number, fill = BONE) =>
  `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}">
     <path d="M2 34 L78 8 L150 2 L196 22 L214 56 L196 92 L150 104 L150 150 L120 150 L120 100 L78 96 L40 70 Z"/>
     <rect x="150" y="40" width="22" height="9" fill="${INK}"/>
   </g>`;

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
  <g transform="translate(72,48) scale(0.30)">
    <path fill="${BONE}" d="M110,40 L350,40 L350,172 L312,366 L282,408 L132,408 L60,172 L60,96 Z"/>
    <path fill="${INK}" d="M122,56 L336,56 L336,176 L302,360 L274,392 L142,392 L74,176 L74,108 Z"/>
    <path fill="none" stroke="${BONE}" stroke-width="2.5" d="M134,68 L324,68 L324,182 L290,350 L264,378 L154,378 L86,182 L86,120 Z"/>
    <g transform="translate(74,30) scale(1.5)"><path fill="${BONE}" d="M12,100 L68,80 L84,60 L120,55 L140,58 L156,74 L158,104 L150,132 L140,160 L128,176 L106,180 L84,152 L62,120 Z"/><polygon fill="${INK}" points="98,82 110,76 113,80 101,86"/></g>
  </g>
  <text x="72" y="300" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="800" letter-spacing="6" fill="${BONE}" opacity="0.65">${escTxt(o.kicker.toUpperCase())}</text>
  <g font-family="Helvetica,Arial,sans-serif">${bigText}</g>
  ${o.sub ? `<text x="72" y="910" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="600" fill="${BONE}" opacity="0.8">${escTxt(o.sub)}</text>` : ''}
  ${o.foot ? `<text x="72" y="1180" font-family="Helvetica,Arial,sans-serif" font-size="40" font-weight="800" letter-spacing="1" fill="${BONE}">${escTxt(o.foot)}</text>` : ''}
  <line x1="72" y1="1240" x2="1008" y2="1240" stroke="${BONE}" stroke-width="2" opacity="0.3"/>
  <text x="72" y="1300" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="2" fill="${BONE}" opacity="0.7">joinhorda.com · this is the Horda</text>
  </svg>`;
}

export const cardDataUri = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
