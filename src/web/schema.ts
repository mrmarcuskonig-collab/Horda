// schema.ts — schema.org JSON-LD structured data.
//
// WHY: when someone asks their AI "what's happening in Berlin this weekend?",
// the answer engine (Google's event search, Bing, and the LLMs sitting on top of
// them) reads schema.org/Event JSON-LD — NOT prose. Structured data turns an
// event page from "some text a model has to parse and might get wrong" into a
// machine FACT: {a football match, in Berlin, Sat 20:00 Europe/Berlin, €15,
// tickets at this URL, organised by FC Beispiel}. This is the single highest-
// leverage thing for making individual Furia events findable by AI search.
//
// It also unlocks Google's Event rich results (the little event cards in search)
// for free — same markup.
//
// PRINCIPLES:
//  - Only PUBLIC, UPCOMING, LISTED events. Unlisted stays unlisted; a private
//    event must never become a search result, structured data least of all.
//  - Never lie to a crawler. If we don't know the price or the venue, omit the
//    field — a wrong `offers` block is worse than none (it produces wrong answers
//    AND can get the site flagged for structured-data spam).
//  - The instant is UTC (startsAt), and the timezone is stated, so an answer
//    engine computes the local time correctly — the same discipline as tz.ts.
import { inZone } from './tz.ts';

const xml = (s: string) => String(s ?? '');

export interface EventLd {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;        // ISO instant (UTC)
  endsAt?: string | null;
  timezone: string | null;        // IANA
  location: string | null;
  locationKind: string;           // in_person | online | hybrid
  admission: string;              // open | register | apply | paid
  priceCents: number | null;
  currency: string;
  coverUrl: string | null;        // absolute https, or null
  hostName: string;
  hostUrl: string | null;         // absolute host page
  eventUrl: string;               // absolute /e/:id
  capacity?: number | null;
  going?: number;                 // tickets/claims sold, for `remainingAttendeeCapacity`
}

/**
 * schema.org/Event as a <script type="application/ld+json"> block, or '' when the
 * event shouldn't be exposed (no start time — an event with no date is not an
 * event a search engine should surface).
 */
export function eventJsonLd(e: EventLd): string {
  if (!e.startsAt) return '';

  // eventAttendanceMode is a real schema.org enum answer engines filter on
  // ("show me online events"). Map our location kind onto it.
  const mode = e.locationKind === 'online'
    ? 'https://schema.org/OnlineEventAttendanceMode'
    : e.locationKind === 'hybrid'
      ? 'https://schema.org/MixedEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode';

  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.startsAt,                       // ISO 8601 UTC; engines localise via the location
    eventAttendanceMode: mode,
    eventStatus: 'https://schema.org/EventScheduled',
    url: e.eventUrl,
    organizer: { '@type': 'Organization', name: e.hostName, ...(e.hostUrl ? { url: e.hostUrl } : {}) },
  };
  if (e.endsAt) obj.endDate = e.endsAt;
  if (e.description) obj.description = e.description.slice(0, 500);
  // Image must be absolute; a data:/relative image is ignored by every consumer.
  if (e.coverUrl && /^https?:\/\//i.test(e.coverUrl)) obj.image = [e.coverUrl];

  // location: a Place for in-person (with the venue as the address), a
  // VirtualLocation for online. Hybrid gets both, which schema.org allows as an
  // array — engines that only take one read the first.
  const place = e.location && e.locationKind !== 'online'
    ? { '@type': 'Place', name: e.location, address: e.location }
    : null;
  const virtual = { '@type': 'VirtualLocation', url: e.eventUrl };
  if (e.locationKind === 'online') obj.location = virtual;
  else if (e.locationKind === 'hybrid' && place) obj.location = [place, virtual];
  else if (place) obj.location = place;
  // No usable location at all → omit rather than invent one.

  // offers: the ticket. A free event is a real Offer at price 0 (engines show
  // "Free"); a paid event states the price + currency. availability flips to
  // SoldOut when the room is full, so an answer engine doesn't send someone to a
  // sold-out event. Omit entirely if we can't state a truthful price.
  if (e.admission === 'paid' && e.priceCents != null) {
    obj.offers = {
      '@type': 'Offer', price: (e.priceCents / 100).toFixed(2), priceCurrency: e.currency || 'EUR',
      url: e.eventUrl, availability: soldOut(e) ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      validFrom: undefined,
    };
  } else if (e.admission === 'open' || e.admission === 'register') {
    obj.offers = {
      '@type': 'Offer', price: '0', priceCurrency: e.currency || 'EUR',
      url: e.eventUrl, availability: soldOut(e) ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    };
  }
  // 'apply' events aren't openly ticketed — no Offer (the price/availability is
  // conditional on approval, which schema.org can't express honestly).

  if (e.capacity != null) obj.maximumAttendeeCapacity = e.capacity;

  // JSON.stringify with a replacer that drops undefined keeps the block clean.
  const json = JSON.stringify(obj, (_k, v) => v === undefined ? undefined : v);
  // </script> can't appear literally inside a script block; escape the slash.
  return `<script type="application/ld+json">${json.replace(/<\/script/gi, '<\\/script')}</script>`;
}

function soldOut(e: EventLd): boolean {
  return e.capacity != null && (e.going ?? 0) >= e.capacity;
}

/**
 * An ItemList of events — for a city/date landing page, this is the "list of
 * events" an answer engine ingests wholesale. Kept minimal (name + url + date):
 * the full detail lives on each event's own page via eventJsonLd.
 */
export function eventListJsonLd(o: { name: string; url: string; events: { title: string; url: string; startsAt: string | null }[] }): string {
  if (!o.events.length) return '';
  const items = o.events.filter(e => e.startsAt).map((e, i) => ({
    '@type': 'ListItem', position: i + 1,
    item: { '@type': 'Event', name: e.title, startDate: e.startsAt, url: e.url },
  }));
  const obj = { '@context': 'https://schema.org', '@type': 'ItemList', name: o.name, url: o.url, itemListElement: items };
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/script/gi, '<\\/script')}</script>`;
}

// kept for callers that want the venue-local start string in a human meta tag
export function localStart(startsAt: string | null, tz: string | null): string {
  return startsAt ? inZone(startsAt, tz) : '';
}
