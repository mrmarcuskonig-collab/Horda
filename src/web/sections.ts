// sections.ts — the catalog of athlete-page sections and the per-sport defaults.
// Athletes pick which to show and in what order; what's AVAILABLE and what's ON
// by default depends on their sport (a boxer leads with their W-L-D record; a
// footballer may not want one at all).

export interface SectionDef { key: string; label: string; short: string; desc: string }
export interface SectionPick { key: string; on: boolean }

export const SECTIONS: Record<string, SectionDef> = {
  record: { key: 'record', label: 'Win / Loss / Draw', short: 'Record', desc: 'Your fight or match record' },
  nextup: { key: 'nextup', label: 'Next up', short: 'Next up', desc: 'Your next fight or event' },
  drops: { key: 'drops', label: 'Drops', short: 'Drops', desc: 'Your posts & members-only updates' },
  events: { key: 'events', label: 'Events', short: 'Events', desc: 'Upcoming events you host' },
  media: { key: 'media', label: 'Media', short: 'Media', desc: 'Photo & video grid' },
  results: { key: 'results', label: 'Recent results', short: 'Results', desc: 'Your latest results, with share cards' },
  merch: { key: 'merch', label: 'Merch', short: 'Shop', desc: 'Your shop items' },
  connected: { key: 'connected', label: 'Connected', short: 'Connected', desc: 'Links to your clubs & teams' },
};

const COMBAT = ['boxing', 'mma', 'kickboxing', 'muay_thai', 'wrestling', 'judo', 'bjj', 'karate', 'taekwondo'];
const RACE = ['running', 'triathlon', 'cycling', 'swimming', 'athletics', 'rowing'];

// Ordered availability + default-on for a sport. Record leads for combat sports;
// race/endurance sports lead with next race + results; default is content-first.
export function defaultLayout(sport: string | null): SectionPick[] {
  const s = (sport || '').toLowerCase();
  const combat = COMBAT.includes(s);
  const race = RACE.includes(s);
  return [
    { key: 'record', on: combat },                 // W-L-D: on for combat sports by default
    { key: 'nextup', on: true },
    { key: 'results', on: combat || race },         // recent results lead for combat + race
    { key: 'drops', on: true },
    { key: 'events', on: true },
    { key: 'media', on: true },
    { key: 'merch', on: true },
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
