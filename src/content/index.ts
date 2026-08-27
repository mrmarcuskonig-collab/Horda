// content/index.ts — assemble share artifacts from the DB. Each is a stat card
// (SVG) + a factual recap + outbound share text. Manufactured here, posted by
// fans elsewhere — the acquisition loop. Facts only (see report.ts bright line).
import type { Database } from '../db/index.ts';
import { shareCardSVG } from './cards.ts';
import { matchReport, fightHype, weekDrop, shareText } from './report.ts';
import { getEventForShare, getUpcomingForShare, getRecord } from '../db/content_repo.ts';
import { getFanHome } from '../db/engagement_repo.ts';

export interface ShareArtifact { kind: string; title: string; card: string; body: string; shareText: string }

export async function buildResultShare(db: Database, eventId: string): Promise<ShareArtifact | null> {
  const ev = await getEventForShare(db, eventId);
  if (!ev) return null;
  const report = matchReport({ sport: ev.sport, sides: ev.sides, date: ev.date });
  let big: string, sub: string | undefined, title: string;
  if (ev.sides.length === 2 && ev.sides.every(s => s.score != null)) {
    const home = ev.sides.find(s => s.isHome) ?? ev.sides[0];
    const away = ev.sides.find(s => s !== home) ?? ev.sides[1];
    big = `${home.name} ${home.score}–${away.score} ${away.name}`;
    sub = home.score === away.score ? 'Full time · draw' : `${(home.score! > away.score! ? home : away).name} win`;
    title = big;
  } else {
    const w = ev.sides.find(s => s.outcome === 'win'), l = ev.sides.find(s => s.outcome === 'loss');
    big = w && l ? `${w.name} def. ${l.name}` : 'Result';
    sub = w?.method ? `by ${w.method}${w.round ? ` · R${w.round}` : ''}` : 'Full time';
    title = big;
  }
  const card = shareCardSVG({ kicker: `${ev.sport} · result`, big, sub, foot: ev.date ?? '' });
  return { kind: 'result', title, card, body: report, shareText: shareText(title) };
}

export async function buildFightShare(db: Database, eventId: string): Promise<ShareArtifact | null> {
  const up = await getUpcomingForShare(db, eventId);
  if (!up) return null;
  const body = fightHype({ a: up.a, b: up.b, date: up.date, ticket: up.ticket, stream: up.stream });
  const big = `${up.a} vs ${up.b}`;
  const ways = [up.ticket ? 'Tickets' : '', up.stream ? 'Stream' : '', 'Follow'].filter(Boolean).join(' · ');
  const card = shareCardSVG({ kicker: `${up.sport} · next up`, big, sub: up.date ?? 'Coming soon', foot: ways });
  return { kind: 'fight', title: big, card, body, shareText: shareText(big + (up.date ? ` · ${up.date}` : '')) };
}

export async function buildWeekDrop(db: Database, fanId: string, fanName = 'You'): Promise<ShareArtifact> {
  const home = await getFanHome(db, fanId);
  const results = home.feed.filter(f => f.kind === 'result').map(f => ({ headline: f.headline, date: f.date }));
  const upcoming = home.feed.filter(f => f.kind === 'fixture').map(f => ({ headline: f.headline, date: f.date }));
  const body = weekDrop({ fanName, results, upcoming });
  const card = shareCardSVG({ kicker: 'your week', big: `${fanName}'s Furia`, sub: `${results.length} results · ${upcoming.length} upcoming`, foot: 'the devoted, organised' });
  return { kind: 'week', title: `${fanName}'s week in the Furia`, card, body, shareText: shareText(`${fanName}'s week in the Furia`) };
}
