// localize.ts — the bilingual layer for SEARCH and LABELS.
//
// THE BUG THIS FIXES: an event in München tagged "München" did not show up when
// a German user searched "München", because the coverage data and half the UI
// spoke only English ("Munich"). Sports were English-only labels too, so a German
// fan scanning the chips didn't recognise their own sport.
//
// The rule from the brief: "internally it must be tagged in all languages that
// are live." Live languages are EN and DE. So every sport carries a German label
// AND search synonyms, and every city we know maps to its equivalents in both
// languages. Search matches across the whole set; labels render in the viewer's
// language.
//
// WHY SYNONYMS, NOT TRANSLATION AT WRITE-TIME: the stored value (a sport key, a
// free-text city) stays canonical and language-neutral. We expand the QUERY to
// all equivalents and match any of them. That means one event is findable in
// every live language without storing it three times — and adding a language
// later is a data change here, not a re-tagging of every existing event.
import type { Lang } from './i18n.ts';

const norm = (s: string) => String(s || '').trim().toLowerCase();

// --- SPORTS: German label + search synonyms per key ------------------------
// label = what a DE viewer sees. syn = extra strings that should resolve to this
// key when typed (either language, common short forms). The English label from
// pages.ts SPORTS is always a synonym implicitly.
interface SportL10n { de: string; syn: string[] }
const SPORT_L10N: Record<string, SportL10n> = {
  football: { de: 'Fußball', syn: ['fussball', 'fußball', 'soccer', 'fball'] },
  futsal: { de: 'Futsal', syn: [] },
  basketball: { de: 'Basketball', syn: ['korbball'] },
  volleyball: { de: 'Volleyball', syn: [] },
  beach_volleyball: { de: 'Beachvolleyball', syn: ['beach volleyball'] },
  handball: { de: 'Handball', syn: [] },
  rugby: { de: 'Rugby', syn: [] },
  american_football: { de: 'American Football', syn: ['nfl'] },
  baseball: { de: 'Baseball', syn: [] },
  cricket: { de: 'Cricket', syn: ['kricket'] },
  field_hockey: { de: 'Feldhockey', syn: ['hockey'] },
  ice_hockey: { de: 'Eishockey', syn: ['hockey', 'nhl'] },
  water_polo: { de: 'Wasserball', syn: [] },
  lacrosse: { de: 'Lacrosse', syn: [] },
  boxing: { de: 'Boxen', syn: ['box'] },
  mma: { de: 'MMA', syn: ['mixed martial arts', 'ufc', 'käfig'] },
  kickboxing: { de: 'Kickboxen', syn: [] },
  muay_thai: { de: 'Muay Thai', syn: ['thaiboxen', 'thai boxing'] },
  wrestling: { de: 'Ringen', syn: [] },
  judo: { de: 'Judo', syn: [] },
  bjj: { de: 'Brazilian Jiu-Jitsu', syn: ['jiu jitsu', 'jiu-jitsu', 'bjj', 'grappling'] },
  karate: { de: 'Karate', syn: [] },
  taekwondo: { de: 'Taekwondo', syn: [] },
  fencing: { de: 'Fechten', syn: [] },
  tennis: { de: 'Tennis', syn: [] },
  table_tennis: { de: 'Tischtennis', syn: ['ping pong', 'pingpong'] },
  badminton: { de: 'Badminton', syn: ['federball'] },
  squash: { de: 'Squash', syn: [] },
  padel: { de: 'Padel', syn: ['padel tennis'] },
  golf: { de: 'Golf', syn: [] },
  running: { de: 'Laufen', syn: ['lauf', 'jogging', 'run'] },
  trail_running: { de: 'Trailrunning', syn: ['trail'] },
  marathon: { de: 'Marathon', syn: [] },
  triathlon: { de: 'Triathlon', syn: ['tri'] },
  athletics: { de: 'Leichtathletik', syn: ['track and field', 'track'] },
  cross_country: { de: 'Crosslauf', syn: [] },
  cycling: { de: 'Radsport', syn: ['radfahren', 'rad', 'velo', 'bike', 'bicycle'] },
  road_cycling: { de: 'Straßenradsport', syn: ['rennrad'] },
  mountain_biking: { de: 'Mountainbiken', syn: ['mtb', 'mountainbike'] },
  bmx: { de: 'BMX', syn: [] },
  track_cycling: { de: 'Bahnradsport', syn: [] },
  swimming: { de: 'Schwimmen', syn: ['schwimm'] },
  open_water: { de: 'Freiwasserschwimmen', syn: ['open water'] },
  rowing: { de: 'Rudern', syn: [] },
  sailing: { de: 'Segeln', syn: [] },
  canoeing: { de: 'Kanu / Kajak', syn: ['kanu', 'kajak', 'kayak', 'canoe'] },
  surfing: { de: 'Surfen', syn: ['surf'] },
  diving: { de: 'Tauchen', syn: [] },
  weightlifting: { de: 'Gewichtheben', syn: ['olympic lifting'] },
  powerlifting: { de: 'Kraftdreikampf', syn: ['powerlifting'] },
  weight_training: { de: 'Krafttraining', syn: ['gym', 'lifting'] },
  crossfit: { de: 'CrossFit', syn: ['cross fit', 'wod'] },
  bodybuilding: { de: 'Bodybuilding', syn: [] },
  strongman: { de: 'Strongman', syn: [] },
  calisthenics: { de: 'Calisthenics', syn: ['street workout'] },
  gymnastics: { de: 'Turnen', syn: ['gymnastik'] },
  climbing: { de: 'Klettern', syn: ['kletter'] },
  bouldering: { de: 'Bouldern', syn: [] },
  skateboarding: { de: 'Skateboarding', syn: ['skaten', 'skate'] },
  parkour: { de: 'Parkour', syn: ['freerunning'] },
  skiing: { de: 'Ski', syn: ['skifahren', 'ski'] },
  snowboarding: { de: 'Snowboarden', syn: ['snowboard'] },
  cross_country_skiing: { de: 'Langlauf', syn: ['skilanglauf'] },
  figure_skating: { de: 'Eiskunstlauf', syn: [] },
  speed_skating: { de: 'Eisschnelllauf', syn: [] },
  biathlon: { de: 'Biathlon', syn: [] },
  motorsport: { de: 'Motorsport', syn: ['racing', 'formel 1', 'formula 1', 'f1'] },
  karting: { de: 'Kart', syn: ['gokart', 'go-kart', 'kartsport'] },
  motocross: { de: 'Motocross', syn: ['mx'] },
  rally: { de: 'Rallye', syn: ['rallye'] },
  equestrian: { de: 'Reitsport', syn: ['reiten', 'pferdesport', 'horse riding'] },
  archery: { de: 'Bogenschießen', syn: [] },
  shooting: { de: 'Schießsport', syn: ['schießen'] },
  darts: { de: 'Darts', syn: ['dart'] },
  bowling: { de: 'Bowling', syn: ['kegeln'] },
  pool: { de: 'Billard', syn: ['billiards', 'billard', 'snooker'] },
  esports: { de: 'E-Sport', syn: ['e-sport', 'esport', 'gaming'] },
  chess: { de: 'Schach', syn: [] },
  cheerleading: { de: 'Cheerleading', syn: ['cheer'] },
  dance: { de: 'Tanzen', syn: ['tanz', 'dancing'] },
  hyrox: { de: 'HYROX', syn: ['hyrox'] },
  hybrid: { de: 'Hybrid-Sport', syn: ['hybrid', 'hybrid racing', 'hybrid fitness'] },
  obstacle_racing: { de: 'Hindernislauf (OCR)', syn: ['ocr', 'obstacle', 'hindernislauf'] },
  spartan: { de: 'Spartan Race', syn: ['spartan'] },
  deka: { de: 'DEKA', syn: [] },
  other: { de: 'Andere / kein Sport', syn: ['other', 'andere'] },
};

/** German label for a sport key; falls back to the raw key prettified. */
export function sportDe(key: string): string {
  return SPORT_L10N[key]?.de ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Typed sport name (either language, short forms) → sport key, or null.
 *
 * The English label is passed in by the caller (pages.ts owns SPORTS), so this
 * module doesn't duplicate the canonical list — it only adds the DE + synonym
 * layer on top of whatever English labels exist.
 */
export function resolveSportKey(text: string, englishLabels: Record<string, string>): string | null {
  const q = norm(text);
  if (!q) return null;
  if (SPORT_L10N[q]) return q;                                   // typed the key itself
  for (const [key, label] of Object.entries(englishLabels)) {    // English label match
    if (norm(label) === q) return key;
  }
  for (const [key, l] of Object.entries(SPORT_L10N)) {           // German label or synonym
    if (norm(l.de) === q || l.syn.some(s => norm(s) === q)) return key;
  }
  return null;
}

// --- CITIES: equivalence classes across EN/DE ------------------------------
// Each group is a set of names for the same place. A query matching ANY member
// expands to ALL of them for the SQL ILIKE, so "München" finds events tagged
// "Munich" and vice versa. Groups also cover the common region/state a city
// sits in (Munich ↔ Bavaria/Bayern) because hosts tag inconsistently.
const CITY_GROUPS: string[][] = [
  ['munich', 'münchen', 'muenchen', 'bavaria', 'bayern'],
  ['cologne', 'köln', 'koeln'],
  ['vienna', 'wien'],
  ['zurich', 'zürich', 'zuerich'],
  ['nuremberg', 'nürnberg', 'nuernberg'],
  ['dusseldorf', 'düsseldorf', 'duesseldorf'],
  ['hanover', 'hannover'],
  ['geneva', 'genf', 'genève', 'geneve'],
  ['brunswick', 'braunschweig'],
  ['germany', 'deutschland'],
  ['austria', 'österreich', 'oesterreich'],
  ['switzerland', 'schweiz'],
];
// Reverse index: any known name → its whole group.
const CITY_INDEX = new Map<string, string[]>();
for (const g of CITY_GROUPS) for (const name of g) CITY_INDEX.set(name, g);

/**
 * Expand a city/region query to every equivalent worth matching.
 *
 * Always includes the query itself, so an unknown city (any place on earth)
 * still works exactly as before — this only ADDS cross-language hits, never
 * removes the plain substring match. Returns lower-cased needles for ILIKE.
 */
export function cityAliases(query: string | null | undefined): string[] {
  const q = norm(query);
  if (!q) return [];
  const out = new Set<string>([q]);
  // Exact known name → its group. Also catch "munich, germany" style input by
  // testing each known name as a substring of the query.
  const grp = CITY_INDEX.get(q);
  if (grp) grp.forEach(n => out.add(n));
  else for (const [name, group] of CITY_INDEX) if (q.includes(name)) group.forEach(n => out.add(n));
  return [...out];
}

/** Localized sport label for the current language. */
export function sportLabelL(key: string, englishLabel: string, lang: Lang): string {
  return lang === 'de' ? sportDe(key) : englishLabel;
}
