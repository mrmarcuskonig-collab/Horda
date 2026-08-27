// profilegen.ts — the shared generation plumbing: the bold monochrome Ink/Bone
// cover (SVG → data URI, always on-brand) and the optional LLM caller.
//
// This file used to also generate a whole profile from one free-text box, which
// was how a creator onboarded. That flow is gone: creating a page is now a plain
// form you finish with Save (see renderProfileCreate + /onboarding/*), so there
// is no describe-and-generate step and no mood/energy/voice direction any more.
// What remains here is used by the always-on media team (mediagen.ts), which is
// a separate, still-live feature. The filename is now a slight lie; renaming it
// is a mechanical follow-up, deliberately not bundled into this change.
import { ravenMark } from './brand.ts';

const INK = '#0B0B0C', BONE = '#EDE9DF';
const xml = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function wrap(text: string, max: number, lines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= max) cur = (cur + ' ' + w).trim();
    else { if (cur) out.push(cur); cur = w; if (out.length === lines) break; }
  }
  if (cur && out.length < lines) out.push(cur);
  return out.slice(0, lines);
}

// a bold, editorial Ink/Bone cover — typographic, with the raven mark
export function coverSvg(o: { title: string; kicker?: string; tagline?: string }): string {
  const t = (o.title || 'Furia').toUpperCase();
  const size = t.length <= 8 ? 150 : t.length <= 14 ? 112 : t.length <= 22 ? 84 : 64;
  const maxChars = Math.max(6, Math.floor(1040 / (size * 0.6)));
  const lines = wrap(t, maxChars, 2);
  const startY = 232 - (lines.length - 1) * size * 0.48;
  const titleEls = lines.map((ln, i) => `<text x="72" y="${Math.round(startY + i * size * 0.96)}" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="${size}" letter-spacing="-2" fill="${BONE}">${xml(ln)}</text>`).join('');
  const hair = Array.from({ length: 7 }, (_, i) => `<line x1="${720 + i * 74}" y1="-20" x2="${900 + i * 74}" y2="440" stroke="${BONE}" stroke-width="1.5" opacity="0.05"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420"><rect width="1200" height="420" fill="${INK}"/>${hair}` +
    (o.kicker ? `<text x="74" y="86" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="26" letter-spacing="8" fill="${BONE}" opacity="0.58">${xml(o.kicker.toUpperCase())}</text>` : '') +
    titleEls +
    `<line x1="74" y1="300" x2="430" y2="300" stroke="${BONE}" stroke-width="2" opacity="0.5"/>` +
    (o.tagline ? `<text x="74" y="348" font-family="Helvetica,Arial,sans-serif" font-weight="500" font-size="29" fill="${BONE}" opacity="0.82">${xml(o.tagline.slice(0, 60))}</text>` : '') +
    `<g transform="translate(1024,296)">${ravenMark(120, 'bone')}</g></svg>`;
  return svg;
}
export const coverDataUri = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

export type ModelCaller = (prompt: string) => Promise<string>;

// Real model when ANTHROPIC_API_KEY is set; otherwise undefined → deterministic.
export function getModel(fetcher: typeof fetch = fetch): ModelCaller | undefined {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return undefined;
  return async (prompt: string) => {
    const r = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.FURIA_AI_MODEL || 'claude-3-5-haiku-latest', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    } as any);
    const j: any = await r.json();
    return j?.content?.[0]?.text || '';
  };
}
