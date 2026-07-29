// yourevents.test.ts — the "Your events" profile page: a top selector (Your events
// · Settings · Log out) and four bands in order — You're running, You're co-running,
// You're going to, My Hordas — with no discovery feed and no notifications.
// Run: node tests/yourevents.test.ts
import { renderFanHome } from '../src/web/pages.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[your-events] profile page structure + co-running band');

const html = renderFanHome({
  fanId: 'fan-1', fanName: 'Marcus König', handle: 'marcusk',
  home: { notifications: [{ kind: 'result', headline: 'Should NOT show here', href: null, createdAt: '', read: false }] } as any,
  follows: [{ type: 'athlete', id: 'a1', name: 'Rico' }],
  pages: [{ kind: 'athlete', id: 'a1', name: 'Rico', events: [{ id: 'e-run', title: 'RUN_EVENT', date: 'Sat' }] }],
  attending: [{ eventId: 'e-go', title: 'GOING_EVENT', date: 'Sun', status: 'confirmed', passToken: 't', partySize: 1, formatLabel: null }],
  coRunning: [{ eventId: 'e-co', title: 'CORUN_EVENT', date: 'Fri', hostName: 'FC Rival' }],
});

ok('profile-first header: "Your Horda" + first name + @handle → settings', html.includes('Your Horda') && html.includes('Hi, Marcus') && html.includes('@marcusk') && html.includes('class="yhhandle"'));
ok('no @handle → prompt to pick one', renderFanHome({ fanId: 'f', fanName: 'Sam', handle: null, home: { notifications: [] } as any, follows: [] }).includes('Pick a @handle'));
ok('titled "Your events" (top selector, active)', html.includes('>Your events</a>'));
ok('selector has Settings and Log out', html.includes('href="/settings"') && html.includes('href="/logout"'));
ok('band: You\'re running', html.includes("You're running"));
ok('band: You\'re co-running, with the co-organised event + its host', html.includes("You're co-running") && html.includes('CORUN_EVENT') && html.includes('FC Rival'));
ok('band: You\'re going to', html.includes("You're going to") && html.includes('GOING_EVENT'));
ok('band: My Hordas (everyone you follow)', html.includes('My Hordas') && html.includes('Rico'));
// ordering: running → co-running → going → hordas
const iRun = html.indexOf("You're running"), iCo = html.indexOf("You're co-running"), iGo = html.indexOf("You're going to"), iH = html.indexOf('My Hordas');
ok('sections are in the requested order', iRun < iCo && iCo < iGo && iGo < iH);
ok('no discovery feed ("Might be for you")', !html.includes('Might be for you'));
ok('no notifications on this page', !html.includes('Should NOT show here') && !html.includes('<h2>Notifications'));

console.log(`\n──────── your-events: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
