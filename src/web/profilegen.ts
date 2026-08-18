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
  const t = (o.title || 'Horda').toUpperCase();
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
      body: JSON.stringify({ model: process.env.HORDA_AI_MODEL || 'claude-3-5-haiku-latest', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    } as any);
    const j: any = await r.json();
    return j?.content?.[0]?.text || '';
  };
}

// --- RESTORED: generateProfile + its helpers ---------------------------------
// server.ts still imports { generateProfile } from here. The create-with-Save
// rework (feat/profile-creation-save) removes both together, but only the new
// profilegen.ts reached main via a partial web upload, so the export vanished
// while server.ts still called it -> boot crash. Re-adding the export makes main
// boot again on the current (AI-onboarding) behaviour. Ship the full rework by
// pushing that branch atomically; this is the reconciliation, not a redesign.
const SPORTS = ['boxing', 'football', 'soccer', 'basketball', 'running', 'mma', 'tennis', 'cycling', 'triathlon', 'handball', 'volleyball', 'rugby', 'swimming', 'athletics', 'hockey', 'climbing', 'rowing'];
const SPORT_ALIAS: Record<string, string> = { boxer: 'boxing', footballer: 'football', runner: 'running', sprinter: 'running', cyclist: 'cycling', swimmer: 'swimming', climber: 'climbing', rower: 'rowing', triathlete: 'triathlon' };
const detectSport = (t: string) => { const l = t.toLowerCase(); return SPORTS.find(s => l.includes(s)) || Object.keys(SPORT_ALIAS).map(k => l.includes(k) ? SPORT_ALIAS[k] : '').find(Boolean) || ''; };
const slug = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'horda';
export interface ProfileInput { kind: 'athlete' | 'club'; description: string; name?: string; sport?: string }
export interface GeneratedProfile { displayName: string; handle: string; headline: string; tagline: string; bio: string; cover: string; links: Record<string, string> }
// pull links out of the description into the profile, and return the text minus URLs
function extractLinks(desc: string): { links: Record<string, string>; cleaned: string } {
  const links: Record<string, string> = {};
  for (const u of desc.match(/https?:\/\/[^\s)]+/gi) || []) {
    const host = u.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
    if (host.includes('instagram.')) links.instagram ||= u;
    else if (host.includes('tiktok.')) links.tiktok ||= u;
    else if (host.includes('youtube.') || host.includes('youtu.be')) links.youtube ||= u;
    else if (host.includes('x.com') || host.includes('twitter.')) links.x ||= u;
    else links.website ||= u;
  }
  const cleaned = desc.replace(/https?:\/\/[^\s)]+/gi, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
  return { links, cleaned };
}
// vibe/design directives describe how the page should LOOK — never the bio copy
const STYLE_RE = /\b(i\s*want|i'?d\s*like|make it|should\s+(be|look|feel)|vibe|aesthetic|design|theme|colou?r|background|look\s*&?\s*feel|fresh|moody|minimal|clean look)\b|\bpage\b|\bprofile\b/i;

function deterministic(input: ProfileInput): GeneratedProfile {
  const { links, cleaned } = extractLinks((input.description || '').trim());
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const facts = sentences.filter(s => !STYLE_RE.test(s) && !/\b(site|website|socials?|profiles?|links?|follow me)\b/i.test(s) && s.replace(/[^a-z]/gi, '').length >= 8);
  const factText = (facts.length ? facts : sentences).join(' ');
  const first = facts[0] || sentences[0] || '';
  const sport = input.sport || detectSport(cleaned);
  const name = input.name || cleaned.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/)?.[1] || (input.kind === 'club' ? 'New club' : 'New athlete');
  // nickname only when the quote opens at a word boundary (so "I'm" contractions don't match)
  const nick = cleaned.match(/(?:^|\s)["“‘']([^"”’']{2,24})["”’']/)?.[1] || name.split(' ')[0];
  const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const tagline = first ? (first.length <= 90 ? first : first.slice(0, 87) + '…') : `${cap(sport) || input.kind} on Horda`;
  const headline = `${nick}${sport ? ` · ${cap(sport)}` : ''}`;
  const bio = factText.slice(0, 300);
  return { displayName: name, handle: slug(name), headline, tagline, bio, cover: coverSvg({ title: nick || name, kicker: sport || input.kind, tagline }), links };
}

export async function generateProfile(input: ProfileInput, model?: ModelCaller): Promise<GeneratedProfile> {
  if (model) {
    try {
      const prompt = `You write sports ${input.kind} profiles for "Horda" (monochrome, bold, fresh). Use ONLY facts in the description — never invent records, achievements, stats or quotes. IMPORTANT: styling/vibe instructions (e.g. "I want a dark intense page", "make it fresh") describe the DESIGN only — never put them in the bio or tagline. Do not put raw URLs in the copy. Return STRICT JSON only, keys: displayName, handle (lowercase a-z0-9), headline (<=6 words, punchy), tagline (<=90 chars, factual), bio (<=300 chars, confident, no clichés, no design talk), sport (one lowercase word or ""). Description: """${input.description}"""`;
      const raw = await model(prompt);
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      const sport = (j.sport || input.sport || '').toString();
      const nick = (j.displayName || '').split(' ')[0];
      return {
        displayName: j.displayName || ('New ' + input.kind), handle: slug(j.handle || j.displayName || ''),
        headline: j.headline || '', tagline: j.tagline || '', bio: j.bio || '',
        cover: coverSvg({ title: nick || j.displayName || 'Horda', kicker: sport || input.kind, tagline: j.tagline }),
        links: extractLinks(input.description).links,
      };
    } catch { /* fall back to deterministic */ }
  }
  return deterministic(input);
}
