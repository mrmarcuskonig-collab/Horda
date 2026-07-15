// sections.ts — the catalog of athlete-page sections and the per-sport defaults.
// Athletes pick which to show and in what order; what's AVAILABLE and what's ON
// by default depends on their sport (a boxer leads with their W-L-D record; a
// footballer may not want one at all).

export interface SectionDef { key: string; label: string; short: string; desc: string }
export interface SectionPick { key: string; on: boolean }

// Post-pivot: a Crowd page is built from EVENTS, not content. No drops, media,
// merch, or sponsors — those are out of doctrine (§10). Sections are the factual
// competitive surface + the claimable events.
// Events-first doctrine: a page is its claimable events + affiliations. Result
// stats (Win/Loss/Draw) and Recent results are NOT offered as page sections.
export const SECTIONS: Record<string, SectionDef> = {
  nextup: { key: 'nextup', label: 'Next up', short: 'Next up', desc: 'Your next claimable event' },
  events: { key: 'events', label: 'Events', short: 'Events', desc: 'Upcoming events you host — all claimable' },
  connected: { key: 'connected', label: 'Connected', short: 'Connected', desc: 'Links to your clubs & teams' },
};

// Ordered availability + default-on. Every athlete leads with their next event,
// then all their events, then their connections. Same set for every sport.
export function defaultLayout(_sport: string | null): SectionPick[] {
  return [
    { key: 'nextup', on: true },
    { key: 'events', on: true },
    { key: 'connected', on: true },
  ];
}

// Merge a saved layout with the current availability for the sport: keep the
// athlete's order/visibility, drop unknown keys, append any newly-added sections.
export function resolveLayout(sport: string | null, saved: SectionPick[] | null | undefined): SectionPick[] {
  const avail = defaultLayout(sport);
  if (!saved || !saved.length) return avail;
  const availKeys = new Set(avail.map(a => a.key));
  const seen = new Set<string>();
  const out: SectionPick[] = [];
  for (const s of saved) {
    if (s && availKeys.has(s.key) && !seen.has(s.key)) { out.push({ key: s.key, on: !!s.on }); seen.add(s.key); }
  }
  for (const a of avail) if (!seen.has(a.key)) out.push(a);   // append sections added since they saved
  return out;
}
