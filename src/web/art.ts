// art.ts — bold, on-brand generative poster art (Ink/Bone). Halftone dot fields
// + geometric energy = FURIA-style graphic punch with no external image deps:
// works offline, never 404s, and is theme-aware (uses the --ink/--bone vars).

function halftone(w: number, h: number, gap: number, fromX: number, fromY: number, max: number, reach: number, opacity = 0.5): string {
  let s = '';
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) {
      const dx = x - fromX, dy = y - fromY;
      const r = max * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / reach);
      if (r > 0.25) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`;
    }
  }
  return `<g fill="var(--bone)" opacity="${opacity}">${s}</g>`;
}

// Wide hero backdrop: a spotlight of halftone with diagonal speed lines and a
// bold cut. Sits behind the headline (faint, so text stays legible).
export function heroArt(): string {
  return `<svg class="art" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="hg" cx="80%" cy="16%" r="72%"><stop offset="0" stop-color="var(--bone)" stop-opacity=".12"/><stop offset="1" stop-color="var(--bone)" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="560" fill="var(--ink)"/>
    <rect width="1200" height="560" fill="url(#hg)"/>
    ${halftone(1200, 560, 17, 950, 110, 5.4, 700, 0.55)}
    <g stroke="var(--bone)" stroke-width="2" opacity=".13" fill="none"><path d="M-60 480 L520 50"/><path d="M120 610 L780 120"/><path d="M380 650 L1060 150"/></g>
    <polygon points="860,560 1200,280 1200,560" fill="var(--bone)" opacity=".05"/>
  </svg>`;
}

// Tile art for cards / culture strip. `seed` shifts the spotlight + motif so each
// reads distinct. `motif`: ring (combat), crest (club), bolt (energy/culture).
export function tileArt(seed: number, motif: 'ring' | 'crest' | 'bolt' = 'ring'): string {
  const fx = 60 + (seed * 53) % 220;
  const fy = 40 + (seed * 31) % 140;
  const motifSvg = motif === 'ring'
    ? `<circle cx="200" cy="120" r="58" fill="none" stroke="var(--bone)" stroke-width="10" opacity=".5"/><circle cx="200" cy="120" r="30" fill="none" stroke="var(--bone)" stroke-width="6" opacity=".35"/>`
    : motif === 'crest'
      ? `<path d="M168 70 H232 V120 Q232 158 200 174 Q168 158 168 120 Z" fill="none" stroke="var(--bone)" stroke-width="9" opacity=".5"/>`
      : `<path d="M214 56 L176 128 H204 L188 196 L240 110 H210 Z" fill="var(--bone)" opacity=".5"/>`;
  return `<svg class="tart" viewBox="0 0 280 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="280" height="220" fill="var(--ink)"/>
    ${halftone(280, 220, 11, fx, fy, 4, 240, 0.5)}
    <g stroke="var(--bone)" stroke-width="1.5" opacity=".12" fill="none"><path d="M-20 200 L160 20"/><path d="M40 240 L240 40"/></g>
    ${motifSvg}
  </svg>`;
}
