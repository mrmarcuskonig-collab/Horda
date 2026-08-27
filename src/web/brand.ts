// brand.ts — the Furia mark: an ember spark. One shape, four surfaces —
// nav (ember), mono (on a coloured surface), favicon (ember on ink), and the
// ceremonial crest (matchday, share cards, merch). Strictly Ink / Bone / Ember.
// Export names are kept from the previous mark so every call site is untouched.
const EMBER = '#E15A40';   // --acc
const EMBER2 = '#cd4c33';  // --acc2, the companion spark
const INK = '#0B0B0C';
const BONE = '#EDE9DF';

// A four-point ember spark, normalized to a 0..100 box, centred at 50,50. The
// concave edges give it the struck-spark bite. Do not redraw — scale via viewBox.
const SPARK_D = 'M50 22C58 42 63 45 99 50 63 55 58 58 50 78 42 58 37 45 1 50 37 45 42 42 50 22Z';

// Mono spark for coloured backgrounds (bone on dark, ink on light) — e.g. sitting
// on an ember button or an avatar fallback where ember-on-ember would vanish.
export function ravenMark(size = 26, tone: 'bone' | 'ink' = 'bone'): string {
  const fill = tone === 'bone' ? BONE : INK;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Furia"><path fill="${fill}" d="${SPARK_D}"/></svg>`;
}

// The primary mark: always ember, so it reads the same on any surface. Used in
// the nav lockup beside the wordmark.
export function ravenMarkCurrent(size = 30): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Furia"><path fill="${EMBER}" d="${SPARK_D}"/></svg>`;
}

// Ceremonial: the spark at scale with a small companion spark thrown off it —
// matchday cards, share images, merch. `dark` kept for API compatibility (the
// ember spark reads on both, so it no longer needs to invert).
export function crestMark(height = 120, dark = true): string {
  const w = Math.round((height * 400) / 460);
  return `<svg width="${w}" height="${height}" viewBox="0 0 400 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Furia crest">
    <g transform="translate(70,95) scale(2.6)"><path fill="${EMBER}" d="${SPARK_D}"/></g>
    <g transform="translate(298,60) scale(0.9)"><path fill="${EMBER2}" d="${SPARK_D}"/></g>
  </svg>`;
}

// favicon.svg — ember spark on ink, served at /favicon.svg
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${INK}"/><g transform="translate(8,8) scale(0.48)"><path fill="${EMBER}" d="${SPARK_D}"/></g></svg>`;
