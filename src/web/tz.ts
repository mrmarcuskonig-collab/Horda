// tz.ts — event time, done properly.
//
// THE BUG THIS FIXES (real, shipped, and exactly the "arrives an hour late"
// failure): the create form posts a naive wall-clock string from
// <input type="datetime-local"> — "2030-09-12T20:00", no zone. That got handed
// straight to `$3::timestamptz`, so POSTGRES resolved it using whatever timezone
// the SERVER happened to be in. The stored instant therefore depended on the
// deploy environment, not on the organiser. The event page then rendered the
// naive value back and looked correct, so the error was invisible — right up
// until the fan hit "add to calendar" and their ICS landed an hour out.
//
// THE MODEL: an event happens at a PLACE at a WALL-CLOCK time. "20:00 at
// Kreuzberg Boxing Club" is 20:00 in Berlin whether you're reading it from
// Berlin, London or Tokyo. So we store two things:
//
//   starts_at  timestamptz  — the true absolute instant (for ICS, "starts in
//                             2h", the LIVE badge, ordering)
//   timezone   text (IANA)  — the venue's zone, e.g. 'Europe/Berlin'
//
// and we always DISPLAY in the event's own timezone, labelled. We never render
// an event in the viewer's local time: a fan in London reading "20:00" for a
// Berlin fight would show up an hour late — which is the whole problem.
//
// (The one exception worth making later: an ONLINE event has no venue, so the
// viewer's local time is the useful one. Noted, not built.)

/** The zone offset (ms) in `tz` at a given instant. Intl only, no dependency. */
function offsetAt(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  // What the wall clock in `tz` reads at this instant, re-read as if it were UTC.
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** A real IANA zone? Guards against junk from a client-supplied field. */
export function isValidZone(tz: string): boolean {
  if (!tz || !/^[A-Za-z_+\-0-9/]{3,64}$/.test(tz)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * Wall-clock time in a zone → the true UTC instant.
 *   zonedToUtc('2030-09-12T20:00', 'Europe/Berlin') → 2030-09-12T18:00:00Z
 *
 * Two passes because the offset itself depends on the instant: we guess by
 * treating the input as UTC, look up the offset there, correct, then re-check.
 * That second pass is what makes the DST boundaries land right — near a
 * transition the first guess can sit on the wrong side of the jump.
 */
export function zonedToUtc(local: string, tz: string): Date {
  const clean = String(local || '').trim().replace(' ', 'T');
  const guess = new Date(clean.endsWith('Z') ? clean : clean + 'Z');
  if (isNaN(guess.getTime())) return new Date();
  if (!isValidZone(tz)) return guess;                    // unknown zone → treat as UTC
  let utc = new Date(guess.getTime() - offsetAt(guess, tz));
  const off2 = offsetAt(utc, tz);
  const utc2 = new Date(guess.getTime() - off2);
  if (utc2.getTime() !== utc.getTime()) utc = utc2;
  return utc;
}

/** Format an instant in the EVENT's zone. Always what a fan should act on. */
export function inZone(instant: string | Date | null, tz: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!instant) return '';
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return '';
  const zone = tz && isValidZone(tz) ? tz : 'UTC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: zone, ...opts,
  }).format(d);
}

/**
 * The short zone label to print next to a time ("CEST", "GMT+2").
 * Worth showing ALWAYS on an event page: it's the difference between a fan
 * assuming their own clock and knowing the venue's.
 */
export function zoneLabel(instant: string | Date | null, tz: string | null): string {
  if (!instant || !tz || !isValidZone(tz)) return '';
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d);
  return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
}

/** Is the viewer somewhere that would read this time differently? */
export function viewerDiffers(tz: string | null, viewerTz: string | null, instant: string | Date | null): boolean {
  if (!tz || !viewerTz || !instant || !isValidZone(tz) || !isValidZone(viewerTz)) return false;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return false;
  return offsetAt(d, tz) !== offsetAt(d, viewerTz);
}

/** ICS wants UTC basic-format: 20300912T180000Z. */
export function icsUtc(instant: string | Date): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
