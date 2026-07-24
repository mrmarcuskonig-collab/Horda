// embed.test.ts — the embeddable events widget, its owner snippet page, and the
// how-to Q&A. Run: node tests/embed.test.ts
import { startServer } from '../src/web/server.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string) => fetch(base + p);
const club = app.ids.clubs[0].id;
console.log('\n[embed] widget + owner code page + Q&A');

// The widget is public + frameable (no X-Frame-Options / restrictive CSP).
const w = await get(`/embed/club/${club}`);
const wt = await w.text();
ok('widget renders (200) with the entity + upcoming events', w.status === 200 && wt.includes('Upcoming events'));
ok('widget links visitors to the event to get tickets', wt.includes(`/e/`) && wt.includes('Tickets'));
ok('widget is frameable — no X-Frame-Options / frame-ancestors block', !w.headers.get('x-frame-options') && !(w.headers.get('content-security-policy') || '').includes('frame-ancestors'));
ok('widget carries no app chrome (standalone)', !wt.includes('class="bnav"') && !wt.includes('class="drail"'));

// The owner snippet page (demo viewer owns the seed club).
const c = await get(`/embed/club/${club}/code`);
const ct = await c.text();
ok('owner code page gives a copy-paste <iframe> snippet', c.status === 200 && ct.includes('&lt;iframe src=') );
ok('owner code page shows a live preview + links to the Q&A', ct.includes(`/embed/club/${club}`) && ct.includes('/about/embed'));

// A non-owner can't reach the code page (redirected away).
const other = await fetch(base + `/embed/athlete/${'00000000-0000-0000-0000-000000000000'}/code`, { redirect: 'manual' });
ok('code page for a non-existent/again-not-owned entity does not 200', other.status !== 200);

// The Q&A page exists on the marketing site, no app rail.
const qa = await get('/about/embed');
const qt = await qa.text();
ok('/about/embed Q&A page renders', qa.status === 200 && (qt.includes('Questions &amp; answers') || qt.includes('Questions & answers')));
ok('/about/embed explains where to get the code + how to paste it', qt.includes('Your events') && (qt.includes('WordPress') || qt.includes('Custom HTML')));
ok('/about/embed is standalone (no app rail)', !qt.includes('class="bnav"') && !qt.includes('class="drail"'));

console.log(`\n──────── embed: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
