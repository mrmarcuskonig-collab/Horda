// brand.ts — the REAL Horda marks (from the supplied asset pack). No wordmark.
// raven = everyday/small surfaces (header, favicon, avatar); crest = ceremonial
// (matchday, share cards, merch). Strictly Ink/Bone. These paths are the
// delivered SVGs verbatim — do not redraw them.
const RAVEN_D = 'M12,100 L68,80 L84,60 L120,55 L140,58 L156,74 L158,104 L150,132 L140,160 L128,176 L106,180 L84,152 L62,120 Z M98,82 L110,76 L113,80 L101,86 Z';

// Bare raven head, sized; tone picks ink or bone fill (eye knocks out via evenodd).
export function ravenMark(size = 26, tone: 'bone' | 'ink' = 'bone'): string {
  const fill = tone === 'bone' ? '#EDE9DF' : '#0B0B0C';
  return `<svg width="${size}" height="${size}" viewBox="2 47 166 141" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horda"><path fill="${fill}" fill-rule="evenodd" d="${RAVEN_D}"/></svg>`;
}

// Theme-aware raven: inherits the surrounding text color (currentColor), so it
// flips automatically between dark and light themes.
export function ravenMarkCurrent(size = 30): string {
  return `<svg width="${size}" height="${size}" viewBox="2 47 166 141" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horda"><path fill="currentColor" fill-rule="evenodd" d="${RAVEN_D}"/></svg>`;
}

// Full crest. `dark`=true uses the inverted (bone shield) for dark backgrounds.
export function crestMark(height = 120, dark = true): string {
  const w = Math.round((height * 400) / 460);
  const shieldOuter = dark ? '#EDE9DF' : '#0B0B0C';
  const shieldInner = dark ? '#0B0B0C' : '#EDE9DF';
  const ravenFill = dark ? '#EDE9DF' : '#0B0B0C';
  const eyeFill = dark ? '#0B0B0C' : '#EDE9DF';
  return `<svg width="${w}" height="${height}" viewBox="0 0 400 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horda crest">
    <path fill="${shieldOuter}" d="M110,40 L350,40 L350,172 L312,366 L282,408 L132,408 L60,172 L60,96 Z"/>
    <path fill="${shieldInner}" d="M122,56 L336,56 L336,176 L302,360 L274,392 L142,392 L74,176 L74,108 Z"/>
    <path fill="none" stroke="${shieldOuter}" stroke-width="2.5" d="M134,68 L324,68 L324,182 L290,350 L264,378 L154,378 L86,182 L86,120 Z"/>
    <g transform="translate(74,30) scale(1.5)"><path fill="${ravenFill}" d="M12,100 L68,80 L84,60 L120,55 L140,58 L156,74 L158,104 L150,132 L140,160 L128,176 L106,180 L84,152 L62,120 Z"/><polygon fill="${eyeFill}" points="98,82 110,76 113,80 101,86"/></g>
  </svg>`;
}

// favicon.svg delivered asset (raven on ink), served at /favicon.svg
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0B0B0C"/><g transform="translate(8.15,-0.82) scale(0.2805)"><path fill="#EDE9DF" fill-rule="evenodd" d="${RAVEN_D}"/></g></svg>`;
