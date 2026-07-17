// i18n.ts — minimal EN/DE dictionary for the shell the user sees first: the
// TikTok-style left rail, the discover headings, and the settings toggles.
// Language is a per-device cookie (hz_lang). Full-app translation is incremental;
// this deliberately covers the primary navigation surface, not every string yet.
export type Lang = 'en' | 'de';
export function normLang(v: string | undefined | null): Lang { return v === 'de' ? 'de' : 'en'; }

const DICT: Record<string, { en: string; de: string }> = {
  explore:      { en: 'Explore',          de: 'Erkunden' },
  // The logged-in home is the feed, so the nav says so. Guests see the same
  // slot; the content behind it just isn't personalised yet.
  your_horda:   { en: 'Your Horda',       de: 'Deine Horda' },
  // Guests have no profile to visit — they have a handle worth taking.
  claim_handle_nav: { en: 'Claim your @handle', de: '@Handle sichern' },
  following:    { en: 'Following',         de: 'Gefolgt' },
  create_event: { en: 'Create event',     de: 'Event erstellen' },
  profile:      { en: 'Profile',          de: 'Profil' },
  settings:     { en: 'Settings',         de: 'Einstellungen' },
  language:     { en: 'Language',         de: 'Sprache' },
  dark_mode:    { en: 'Dark mode',        de: 'Dunkler Modus' },
  // Just "Search": you can also search clubs, athletes and events — naming only
  // city and sport made the box look narrower than it is.
  search_ph:    { en: 'Search',            de: 'Suchen' },
  login:        { en: 'Log in',           de: 'Anmelden' },
  join_free:    { en: 'Join free',        de: 'Kostenlos beitreten' },
  your_feed:    { en: 'Your feed',        de: 'Dein Feed' },
  events_head:  { en: 'Public events · live & upcoming', de: 'Öffentliche Events · live & bevorstehend' },
  clubs_head:   { en: 'Clubs & federations', de: 'Vereine & Verbände' },
  going:        { en: 'going',            de: 'dabei' },
  shares:       { en: 'shares',           de: 'geteilt' },
  followers:    { en: 'followers',        de: 'Follower' },
  notifications:{ en: 'Notifications',    de: 'Mitteilungen' },
  live_now:     { en: 'LIVE NOW',         de: 'JETZT LIVE' },
};
export function t(lang: Lang, key: string): string {
  const e = DICT[key];
  return e ? e[lang] : key;
}
