// clientjs.test.ts — every inline <script> we ship must actually PARSE.
//
// Why this exists: a single broken apostrophe (`venue\'s` inside a template
// literal collapses to a bare quote, terminating a JS string) 500'd nothing on
// the server and passed every HTML-assertion suite and the crawler — because
// none of them execute or parse JavaScript. But in a real browser it threw a
// SyntaxError that killed the ENTIRE create-form IIFE: the Free→Paid price
// toggle never revealed the price field, the timezone hint, address
// autocomplete, the banner preview and the party-size stepper all went dead.
// This suite parses every inline script on every important page with the same
// engine the browser uses, so that class of bug can never ship silently again.
// Run: node tests/clientjs.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession } from '../src/db/auth_repo.ts';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const ath = app.ids.athletes[0].id;
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [ath])).rows[0].account_id;
const cookie = `hz_session=${await createSession(app.db, acct)}`;

// A paid, multi-per-person event exercises the price + stepper scripts.
const r0 = await fetch(base + '/events', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie } as any, body: new URLSearchParams({ host_kind: 'athlete', host_id: ath, title: 'JS Scan', starts_at: '2027-10-05T19:00', location_kind: 'in_person', location: 'Berlin', archetype: 'single', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '15', fmt_inperson_cap: '100', fmt_inperson_maxpp: '4' }).toString() });
const ev = (r0.headers.get('location') || '').match(/\/e\/([^/?]+)/)?.[1] || '';

console.log('\n[clientjs] every inline script parses in a JS engine');

const parses = async (url: string, ck?: string): Promise<{ n: number; bad: string[] }> => {
  const html = await (await fetch(base + url, { headers: ck ? { cookie: ck } as any : undefined })).text();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const bad: string[] = [];
  scripts.forEach((s, i) => { try { new vm.Script(s); } catch (e: any) { bad.push(`#${i}: ${e.message}`); } });
  return { n: scripts.length, bad };
};

const pages: [string, string, string?][] = [
  ['home', '/?guest=1'],
  ['event page (guest)', `/e/${ev}?guest=1`],
  ['event page (owner)', `/e/${ev}`, cookie],
  ['create event form', `/host/athlete/${ath}/new`, cookie],
  ['edit event form', `/e/${ev}/edit`, cookie],
  ['manage', `/manage/${ev}`, cookie],
  ['checkout', `/e/${ev}/checkout`, cookie],
  ['athlete page', `/athlete/${ath}?guest=1`],
  ['signup', '/signup'],
  ['login', '/login'],
];

for (const [name, url, ck] of pages) {
  const { n, bad } = await parses(url, ck);
  if (bad.length) bad.forEach(b => console.log('      ' + b));
  ok(`${name}: ${n} inline script(s) all parse`, bad.length === 0 && n > 0);
}

// And specifically: the create form's price toggle + stepper depend on that
// main IIFE, so assert it carries the control names the JS drives.
const cform = await (await fetch(base + `/host/athlete/${ath}/new`, { headers: { cookie } as any })).text();
ok('create form ships the price field + max-per-person control', cform.includes('name="fmt_inperson_price"') && cform.includes('name="fmt_inperson_maxpp"'));

await app.close();
console.log(`\n──────── clientjs: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
