// i18n.ts — minimal EN/DE dictionary for the shell the user sees first: the
// TikTok-style left rail, the discover headings, and the settings toggles.
// Language is a per-device cookie (hz_lang). Full-app translation is incremental;
// this deliberately covers the primary navigation surface, not every string yet.
export type Lang = 'en' | 'de';
export function normLang(v: string | undefined | null): Lang { return v === 'de' ? 'de' : 'en'; }

const DICT: Record<string, { en: string; de: string }> = {
  explore:      { en: 'Explore',          de: 'Erkunden' },
  following:    { en: 'Following',         de: 'Gefolgt' },
  create_event: { en: 'Create event',     de: 'Event erstellen' },
  profile:      { en: 'Profile',          de: 'Profil' },
  settings:     { en: 'Settings',         de: 'Einstellungen' },
  language:     { en: 'Language',         de: 'Sprache' },
  dark_mode:    { en: 'Dark mode',        de: 'Dunkler Modus' },
  search_ph:    { en: 'Search city or sport', de: 'Stadt oder Sportart' },
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
