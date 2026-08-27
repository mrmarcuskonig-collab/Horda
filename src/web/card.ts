// card.ts — the matchday card. The WHOLE card travels, not a naked link.
//
// WHY THIS EXISTS
// ---------------
// Sharing an event used to put a bare URL in WhatsApp. The receiver saw a string,
// not an event: no title, no date, no venue, no price, no reason to tap. The card
// is the product's face in someone else's chat — it has to carry enough that a
// stranger can decide "yes" before they ever reach Furia.
//
// TWO SURFACES, ONE PICTURE:
//   1. og:image — what WhatsApp/iMessage/X/Slack render when they unfurl the link.
//   2. Web Share Level 2 files — the PNG itself handed to the OS sheet, which is
//      the only route into an Instagram Story (see theme.ts shareMenu).
//
// SVG IS NOT ENOUGH — AND THIS WAS A LIVE BUG. /share/supporter/:kind/:id.svg was
// wired up as an og:image. No major unfurler renders SVG og:images (Facebook,
// WhatsApp and X all ignore them), so that card has never once appeared in a chat.
// Everything here rasterises to PNG (raster.ts) for exactly that reason.
//
// 1200×630 is the OG standard. WhatsApp crops toward a square, so nothing that
// matters may sit in the outer ~90px on the left/right.
import { inZone, zoneLabel } from './tz.ts';

const INK = '#232020';
const BONE = '#EDE9DF';
const ACC = '#E15A40';
const ACCINK = '#1b1310';
const MUT = '#9d9890';

const xml = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));

// Rough width metrics. There is no text layout engine here, so a title that
// overflows would silently run off the card — wrap on estimated width instead of
// character count so "WWWWW" and "iiiii" don't get the same allowance.
const CHAR_W: Record<string, number> = { i: .28, j: .28, l: .28, I: .3, t: .36, f: .36, r: .4, ' ': .27, '.': .27, ',': .27, ':': .27, ';': .27, '!': .3, "'": .2, W: .95, M: .92, m: .88, O: .8, Q: .8, G: .78, w: .78 };
const textW = (s: string, size: number) => [...s].reduce((a, c) => a + (CHAR_W[c] ?? 0.56) * size, 0);

function wrapToWidth(s: string, size: number, maxW: number, maxLines: number): string[] {
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (textW(next, size) <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (!lines.length) return [''];
  // Ellipsise rather than clip: a truncated word reads as a bug, "…" reads as more.
  if (words.length && lines.join(' ').length < String(s).trim().length) {
    let last = lines[lines.length - 1];
    while (last && textW(last + '…', size) > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/[\s,.:;-]+$/, '') + '…';
  }
  return lines;
}

export interface CardEvent {
  title: string;
  hostName: string;
  startsAt: string | null;
  timezone: string | null;
  location: string | null;
  locationKind: string;
  /** Cheapest way in — what a stranger needs to know before tapping. */
  priceLabel: string;
  /** Doors, e.g. "In person · Stream". Absent on legacy events. */
  ways?: string[];
  /** Scarcity, only when it is real AND public. null = don't claim a number. */
  remaining?: number | null;
  full?: boolean;
  /** Absolute https URL of the event's cover, if it has one. */
  coverUrl?: string | null;
}

/**
 * The card as SVG. Deterministic and dependency-free — raster.ts turns it into
 * the PNG that actually ships. Kept separate so the SVG is inspectable in a
 * browser (/e/:id/card.svg) when a card looks wrong.
 *
 * FONTS: rasterising happens server-side, so this can only use fonts installed
 * in the container (see Dockerfile: fonts-liberation). The web font stack the app
 * uses (Anton/Inter) is NOT available to the rasteriser — asking for it would
 * silently fall back and quietly change every card's metrics.
 */
export function eventCardSvg(e: CardEvent): string {
  const W = 1200, H = 630;
  const F = 'Liberation Sans, DejaVu Sans, Helvetica, Arial, sans-serif';
  const PAD = 72;
  const COL = 1200 - PAD * 2;

  const when = e.startsAt ? inZone(e.startsAt, e.timezone) : 'Date TBA';
  const zone = e.startsAt ? zoneLabel(e.startsAt, e.timezone) : '';
  const where = e.locationKind === 'online' ? 'Online' : (e.location || '').split(',').slice(0, 2).join(',').trim();

  // Title first, and big. Everything else is support.
  const tSize = e.title.length <= 26 ? 74 : e.title.length <= 52 ? 60 : 50;
  const tLines = wrapToWidth(e.title, tSize, COL - 40, 3);
  const titleTop = 246;
  const title = tLines.map((ln, i) =>
    `<text x="${PAD}" y="${titleTop + i * (tSize * 1.14)}" font-family="${F}" font-size="${tSize}" font-weight="bold" fill="${BONE}" letter-spacing="-1">${xml(ln)}</text>`).join('');

  const metaY = titleTop + tLines.length * (tSize * 1.14) + 18;
  // Values align to a fixed column, not to the end of their label — otherwise
  // "When" and "Where" start their values two characters apart and the block
  // reads as a mistake.
  const VALX = PAD + 108;
  const metaLine = (y: number, label: string, value: string) => value
    ? `<text x="${PAD}" y="${y}" font-family="${F}" font-size="27" fill="${MUT}">${xml(label)}</text>
       <text x="${VALX}" y="${y}" font-family="${F}" font-size="27" font-weight="bold" fill="${BONE}">${xml(value)}</text>`
    : '';

  // The zone is spelled out on purpose. A card that says "20:00" to a reader in
  // London for a Berlin event is how someone shows up an hour late.
  const whenValue = zone ? `${when} ${zone}` : when;

  // Chips = the doors and the price. A stranger decides on these two facts.
  const chips: string[] = [];
  if (e.priceLabel) chips.push(e.priceLabel);
  for (const w of (e.ways ?? []).slice(0, 2)) chips.push(w);
  if (e.full) chips.push('Waitlist');
  else if (e.remaining != null && e.remaining <= 20) chips.push(`${e.remaining} left`);

  let cx = PAD;
  const chipEls = chips.map((c, i) => {
    const w = Math.round(textW(c, 24)) + 40;
    const el = `<g><rect x="${cx}" y="${H - 118}" width="${w}" height="46" rx="12" fill="${i === 0 ? ACC : 'none'}" stroke="${i === 0 ? ACC : 'rgba(237,233,223,.28)'}" stroke-width="1.5"/>
      <text x="${cx + w / 2}" y="${H - 86}" font-family="${F}" font-size="24" font-weight="bold" text-anchor="middle" fill="${i === 0 ? ACCINK : BONE}">${xml(c)}</text></g>`;
    cx += w + 12;
    return el;
  }).join('');

  // A cover photo, when there is one, sits behind a heavy scrim. The scrim is not
  // decoration: an uploaded photo is arbitrary, and white text on an arbitrary
  // photo is unreadable about a third of the time.
  const cover = e.coverUrl && /^https?:\/\//i.test(e.coverUrl)
    ? `<image href="${xml(e.coverUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="0.42"/>
       <rect width="${W}" height="${H}" fill="url(#scrim)"/>`
    : `<rect width="${W}" height="${H}" fill="url(#glow)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="72%" cy="12%" r="95%">
      <stop offset="0" stop-color="${ACC}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}" stop-opacity="0.72"/>
      <stop offset="0.55" stop-color="${INK}" stop-opacity="0.90"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0.98"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${INK}"/>
  ${cover}
  <rect x="0" y="0" width="${W}" height="6" fill="${ACC}"/>

  <text x="${PAD}" y="${titleTop - 118}" font-family="${F}" font-size="22" font-weight="bold" fill="${ACC}" letter-spacing="3">FURIA</text>
  <text x="${PAD}" y="${titleTop - 68}" font-family="${F}" font-size="29" fill="${MUT}">Hosted by <tspan font-weight="bold" fill="${BONE}">${xml(e.hostName)}</tspan></text>

  ${title}
  ${metaLine(metaY, 'When', whenValue)}
  ${metaLine(metaY + 44, 'Where', where)}
  ${chipEls}
  <text x="${W - PAD}" y="${H - 86}" font-family="${F}" font-size="22" text-anchor="end" fill="${MUT}">joinfuria.com</text>
</svg>`;
}
