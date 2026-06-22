// icons.ts — monochrome social/affiliation glyphs (currentColor), so links show
// the platform logo rather than the word. 24x24 viewBox.
const SOCIAL: Record<string, string> = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.4-.43-5a3 3 0 0 0-2.1-2.1C18.7 4.5 12 4.5 12 4.5s-6.7 0-8.47.4A3 3 0 0 0 1.43 7C1 8.6 1 12 1 12s0 3.4.43 5a3 3 0 0 0 2.1 2.1c1.77.4 8.47.4 8.47.4s6.7 0 8.47-.4a3 3 0 0 0 2.1-2.1c.43-1.6.43-5 .43-5Z"/><path d="M10 8.7v6.6l5.5-3.3L10 8.7Z" fill="#0B0B0C"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.6 7.6L22 22h-6.8l-4.6-6-5.3 6H1.8l7.1-8.1L2 2h6.9l4.2 5.5L18.2 2Zm-1.2 18h1.5L7.1 3.9H5.5L17 20Z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.35 2.3 1.83 4 4.5 4.3v3.1c-1.6 0-3.1-.5-4.5-1.4v6.1A6.3 6.3 0 1 1 9.8 8.9v3.2A3.1 3.1 0 1 0 13.4 15V3h3.1Z"/></svg>`,
  twitch: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.3 2 3 5.3V19h4.5v3h2.7l3-3H17l4-4V2H4.3Zm14.7 11-2.7 2.7h-4.5L9 18.4V15.7H6.2V4.5h12.8V13Z"/><path d="M15.3 7.5h1.8v4.2h-1.8zM10.7 7.5h1.8v4.2h-1.8z"/></svg>`,
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3.3 12h17.4M12 3c2.8 2.7 2.8 15.3 0 18M12 3c-2.8 2.7-2.8 15.3 0 18"/></svg>`,
};

const KIND: Record<string, string> = {
  club: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/></svg>`, // crest/shield
  team: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15.5 19c0-2 1.3-3.6 3.2-3.9"/></svg>`,
  league: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v3a5 5 0 0 1-10 0V4ZM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 14h6M10 19h4M12 12v2"/></svg>`, // trophy
  gym: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 7.5 17.5 16.5M4 9l2-2 3 3M20 15l-2 2-3-3M3 10l1-1M21 14l-1 1"/></svg>`, // dumbbell-ish
  promotion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l16-6v14L3 13v-2Z"/><path d="M7 12v5"/></svg>`, // megaphone
  event: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`, // calendar
  athlete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>`, // person
  custom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
};

export const socialIcon = (key: string): string => SOCIAL[key] ?? KIND.custom;
export const kindIcon = (key: string): string => KIND[key] ?? KIND.custom;
export const hasSocialIcon = (key: string): boolean => key in SOCIAL;
