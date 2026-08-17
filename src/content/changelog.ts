// changelog.ts — the public ship log behind /changelog.
//
// THIS FILE IS THE PRODUCT SURFACE. Edit it like copy, not like code.
// It is deliberately plain data with no imports: anyone on the team (or a
// non-engineer) can add an entry without understanding the app.
//
// The rules that make this a trust signal instead of a marketing page:
//   1. Write for a FAN, not for an engineer. "You can now filter events by
//      city" — never "refactor discover_repo query".
//   2. If a fan asked for it, CREDIT them (`asked` = their Discord handle).
//      That's the flywheel: people ask because they see asks get built.
//   3. `building` is a public promise. Only put things there you will ship.
//      Moving something out of `building` without shipping it costs more
//      trust than never listing it.
//   4. Ship first, write second. Never list something as shipped that isn't.
//
// To add an entry: put a new object at the TOP of SHIPPED. That's it.

export type ChangeTag = 'new' | 'better' | 'fixed';

export interface ChangeEntry {
  /** ISO date (YYYY-MM-DD) the change went live. */
  date: string;
  /** Fan-readable headline. Lead with what they can now do. */
  title: string;
  /** One or two sentences. Plain language. What changed and why it matters. */
  body: string;
  tag: ChangeTag;
  /** Discord handle of whoever asked for this, without the @. Optional. */
  asked?: string;
}

export interface BuildingEntry {
  /** What we're working on, in fan language. */
  title: string;
  /** Why we're doing it — ideally the fan problem, not the tech. */
  body: string;
  /** Rough honesty about timing. Keep it vague enough to be true. */
  eta?: string;
  asked?: string;
}

// ---------------------------------------------------------------------------
// NOW BUILDING — the public promise. Keep this SHORT (3–5 items). A long
// roadmap reads as a wishlist; a short one reads as focus.
// ---------------------------------------------------------------------------
export const BUILDING: BuildingEntry[] = [
  {
    title: 'German across the whole site',
    body: 'The site already switches to German for anyone in Germany, Austria or Switzerland — but a lot of the text is still English underneath. We are translating it properly.',
    eta: 'Next',
  },
  {
    title: 'Getting paid for the reach you drove',
    body: 'Today we count exactly which fans and tickets each athlete or club drove. The next step is moving the money: appearance fees and ticket splits paid out automatically to the people who brought the crowd.',
    eta: 'After launch',
  },
  {
    title: 'Add to Apple Wallet',
    body: 'Your ticket QR lives on a web page. It should live in your Wallet, next to your boarding pass.',
    eta: 'Soon',
  },
  {
    title: 'Sport on every event',
    body: 'Filtering events by sport only works when the event or its host has a sport set. We are asking for the sport when you create the event, so the filter never misses.',
    eta: 'Soon',
  },
];

// ---------------------------------------------------------------------------
// SHIPPED — newest first. Dates are the day it went live.
// ---------------------------------------------------------------------------
export const SHIPPED: ChangeEntry[] = [
  {
    date: '2026-08-05',
    title: 'See exactly who walked through the door',
    body: 'Tap the "checked in" number — on the check-in screen or on Manage — and you get the names: who came, their page, and the minute they were scanned. Check-in itself is steadier too. The screen no longer goes blank after you scan or type a code, it survives a reload and the back button, and a code typed by hand now works in any case, spaces and all. Events on a custom link (joinhorda.com/yourname) can be checked in at as well — that had been failing outright.',
    tag: 'new',
  },
  {
    date: '2026-07-30',
    title: 'Your own link: joinhorda.com/yourname',
    body: 'Clubs, teams, federations and athletes can now claim a memorable link — joinhorda.com/yourname — that shows your page with every event you run. Share that one link instead of a Horda page URL; you never have to link "to Horda" again. Set it on your page under Edit.',
    tag: 'new',
  },
  {
    date: '2026-07-30',
    title: 'Every event gets a designed banner from your picture',
    body: 'Create an event and it already looks like yours: your photo or club logo is built into a proper poster, no upload needed. A versus event splits the banner in two. No picture? It uses your initials. You can still upload your own.',
    tag: 'new',
  },
  {
    date: '2026-07-30',
    title: 'When you create an event, you can see which page it is for',
    body: 'If you run more than one page — your athlete page plus a club or two — the create form now shows, front and centre, which one is hosting the event, and lets you switch in one tap. No more publishing under the wrong page by accident.',
    tag: 'better',
  },
  {
    date: '2026-07-30',
    title: 'Your profile is now your home base',
    body: 'Tapping your profile lands you on your hub — your events, your profile, notifications and settings — with your public page one tap away. One account to edit (personal, or your athlete page), and a + to create club, federation or organiser pages from scratch.',
    tag: 'better',
  },
  {
    date: '2026-07-30',
    title: 'Setting a ticket price works again',
    body: 'A hidden glitch was stopping the price field (and a few other things) from appearing when you built an event. Fixed — choose Paid and set your ticket price, and let one person claim several spots at once.',
    tag: 'fixed',
  },
  {
    date: '2026-07-17',
    title: 'Sharing an event now sends the whole matchday card',
    body: 'Paste an event into WhatsApp and your mates see the card — who, when, where, what it costs — instead of a naked link. On a phone you can send the picture itself straight to an Instagram Story. Share it under your name and you still get the credit for who you bring.',
    tag: 'new',
  },
  {
    date: '2026-07-16',
    title: 'A public changelog, and a Discord to argue with us in',
    body: 'You can now see everything we ship, as we ship it — including what we are building next, before it exists. If you want something built, come tell us in Discord. When we build it, your name goes on the entry.',
    tag: 'new',
  },
  {
    date: '2026-07-16',
    title: 'Your home page is now your events',
    body: 'Once you are logged in, the first thing you see is the upcoming events from the athletes and clubs you follow — not a generic list. The old "create your feed" button is gone; following someone is what builds your feed.',
    tag: 'better',
  },
  {
    date: '2026-07-16',
    title: 'Following is a real page now',
    body: 'See everyone you follow in one place, search for more athletes and clubs, and unfollow anyone you have gone off. It used to just jump you to a section of the feed.',
    tag: 'new',
  },
  {
    date: '2026-07-16',
    title: 'The sport and city filters actually filter the events',
    body: 'Picking a sport or a city narrowed the athletes and clubs, but the event list underneath ignored you. It does not anymore.',
    tag: 'fixed',
  },
  {
    date: '2026-07-16',
    title: 'Fewer, better sections on your page',
    body: 'Win/Loss/Draw and Recent results are gone as page sections — they were a leftover from when Horda was about stats. Your page is about what is coming up: Next up, Events, and who you are Connected to.',
    tag: 'better',
  },
  {
    date: '2026-07-14',
    title: 'Sign in with just your email — no password',
    body: 'Enter your email, get a one-tap link (or a 6-digit code if you are on another device). No password to invent, forget, or reuse. Google still works too.',
    tag: 'new',
  },
  {
    date: '2026-07-14',
    title: 'Ticket money goes straight to organisers',
    body: 'Organisers connect a payout account and ticket money lands with them directly, minus our small platform fee. We never hold your money in between.',
    tag: 'new',
  },
  {
    date: '2026-07-12',
    title: 'Events with two sides, a roster, or a whole fight card',
    body: 'A match has two sides. A tournament has many. You can now list the opposing side even if they are not on Horda yet — they join to claim their side, their fans and their ticket share. Fight cards can nest every bout under one event.',
    tag: 'new',
  },
  {
    date: '2026-07-12',
    title: 'Every participant gets their own share link — and we count it',
    body: 'Each athlete, club and organiser on an event gets a personal link. The organiser sees exactly how many fans and ticket buyers each person drove, rolled up across the whole card. That number is the point of Horda.',
    tag: 'new',
  },
  {
    date: '2026-07-09',
    title: 'Scan tickets at the door',
    body: 'Your ticket has a real QR code. Organisers scan it with their phone camera at the gate. Being scanned in is what turns "interested" into proof you were there.',
    tag: 'new',
  },
  {
    date: '2026-07-09',
    title: 'Your Record: proof you were actually there',
    body: 'Not what you watched — where you showed up. Every event you get scanned into leaves a stamp on your Record. Nobody else can fake it.',
    tag: 'new',
  },
  {
    date: '2026-07-05',
    title: 'The site speaks German if you are in DACH',
    body: 'Land on Horda from Germany, Austria or Switzerland and you get German by default; English everywhere else. Switching the language now also keeps you on the page you were reading instead of dumping you home.',
    tag: 'better',
  },
  {
    date: '2026-07-05',
    title: 'Staying logged in actually stays logged in',
    body: 'Your session used to quietly drop. It now persists properly for 90 days.',
    tag: 'fixed',
  },
];
