// mediagen.ts — the AI "always-on media team". Reframes AI from one-time page
// generation to the ongoing, event/result-triggered content engine. Given a
// fixture or a result it drafts on-brand assets the creator reviews and posts.
// Deterministic by default (no key needed); LLM-pluggable for the copy.
import { coverSvg } from './profilegen.ts';
import type { ModelCaller } from './profilegen.ts';

export interface EventBrief {
  athleteName: string; nickname?: string; sport?: string | null;
  label: string;                 // "Fight Night" | "Matchday" | "Race Day"
  title: string; opponent?: string | null; date?: string | null; location?: string | null;
  result?: string | null;
}
export interface MediaAssets {
  graphic: string;        // matchday/fight-night graphic (SVG)
  hypePost: string;       // pre-event hype copy
  recap: string | null;   // post-result recap copy (null until a result exists)
  supporterCard: string;  // free shareable supporter card (SVG)
}

const firstName = (n: string) => (n.split(' ')[0] || n).replace(/[^A-Za-z]/g, '') || n;

// On-brand event graphic — reuses the page cover system so it looks like the
// creator's brand, not a generic template.
export function eventGraphic(b: EventBrief): string {
  const vs = b.opponent ? `${firstName(b.athleteName)} vs ${b.opponent}` : b.athleteName;
  return coverSvg({ title: vs, kicker: b.label, tagline: [b.date, b.location].filter(Boolean).join(' · ').slice(0, 60) });
}
export function recapGraphic(b: EventBrief): string {
  return coverSvg({ title: b.result ? b.result : b.athleteName, kicker: `${b.label} · Result`, tagline: b.title.slice(0, 60) });
}
// Free shareable supporter card — the viral surface. "I'm backing X".
export function supporterCard(b: EventBrief, opt: { superfanNo?: number; backing?: boolean } = {}): string {
  const kicker = opt.superfanNo ? `Superfan #${opt.superfanNo}` : 'In the Furia';
  const tagline = opt.backing !== false ? `Backing ${firstName(b.athleteName)} for ${b.label.toLowerCase()}` : `${b.label}`;
  return coverSvg({ title: b.athleteName, kicker, tagline });
}

// --- copy (deterministic fallback; model-enhanced when wired) --------------
function detHype(b: EventBrief): string {
  const who = b.nickname ? `${firstName(b.athleteName)} "${b.nickname}"` : firstName(b.athleteName);
  const vs = b.opponent ? ` against ${b.opponent}` : '';
  const when = b.date ? ` — ${b.date}` : '';
  return `${b.label} is coming${when}. ${who} steps up${vs}. The room opens on the day — superfans get the pre-event access, the walkout thoughts, and the live reactions. Be there.`;
}
function detRecap(b: EventBrief): string {
  if (!b.result) return '';
  return `${b.result}. Thank you to everyone who was in the room — your noise carried. ${firstName(b.athleteName)} reads every message. Recap, reactions and what's next, inside.`;
}

export async function generateEventAssets(b: EventBrief, model?: ModelCaller): Promise<MediaAssets> {
  let hype = detHype(b);
  let recap = b.result ? detRecap(b) : null;
  if (model) {
    try {
      const prompt = `You are the social media manager for a sports athlete page on "Furia". Write SHORT, punchy, factual copy. Never invent results, stats, or quotes. Brand voice: bold, warm, no clichés, no hashtags-spam (one hashtag max). Event: ${JSON.stringify({ label: b.label, athlete: b.athleteName, opponent: b.opponent, date: b.date, location: b.location, result: b.result })}. Return STRICT JSON: {"hype": "<=280 chars pre-event hype>", "recap": "${b.result ? '<=280 chars post-result recap>' : ''}"}.`;
      const raw = await model(prompt);
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      if (typeof j.hype === 'string' && j.hype.trim()) hype = j.hype.trim().slice(0, 300);
      if (b.result && typeof j.recap === 'string' && j.recap.trim()) recap = j.recap.trim().slice(0, 300);
    } catch { /* deterministic copy already set */ }
  }
  return {
    graphic: b.result ? recapGraphic(b) : eventGraphic(b),
    hypePost: hype,
    recap,
    supporterCard: supporterCard(b),
  };
}
