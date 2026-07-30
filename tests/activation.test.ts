// activation.test.ts — role-aware activation checklists with auto-checking.
// Run: node tests/activation.test.ts
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { createFan, followEntity } from '../src/db/engagement_repo.ts';
import { fanChecklist, athleteChecklist, entityChecklist, renderChecklist } from '../src/web/activation.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;
const club = ids.clubs[0].id;

console.log('\n[activation · fan]');
const fan = await createFan(db, 'newbie', 'Newbie');
let fc = await fanChecklist(db, fan);
ok('fresh fan: 3 steps, none done, incomplete', fc.steps.length === 3 && fc.steps.every(s => !s.done) && !fc.complete);
ok('checklist renders a card with progress + dismiss', renderChecklist(fc).includes('Finish setting up') && renderChecklist(fc).includes('id="actck"') && renderChecklist(fc).includes('Dismiss'));
// one follow isn't enough — the step needs 3
await followEntity(db, fan, 'athlete', rico);
fc = await fanChecklist(db, fan);
ok('one follow does not yet complete the "follow 3" step', fc.steps.find(s => s.label.startsWith('Follow'))!.done === false);
// three follows auto-checks it
await followEntity(db, fan, 'athlete', ids.athletes[1].id);
await followEntity(db, fan, 'club', club);
fc = await fanChecklist(db, fan);
ok('three follows auto-checks the "follow 3" step', fc.steps.find(s => s.label.startsWith('Follow'))!.done === true);

console.log('\n[activation · athlete owner]');
const ac = await athleteChecklist(db, rico);
ok('athlete: "page is live" is done', ac.steps[0].done === true);
ok('athlete: doctrine steps — no clubs/leagues connect, no tiers/drops/social prompt', !ac.steps.some(s => /connect|club|league|tier|drop|social/i.test(s.label)));
ok('athlete: has 3 steps (page live, photo/banner, first event)', ac.steps.length === 3);

console.log('\n[activation · club owner]');
const ec = await entityChecklist(db, 'club', club);
ok('club: "claimed & verified" is done', ec.steps[0].done === true);
ok('club: has 3 steps (no connect-to-league step)', ec.steps.length === 3);

console.log('\n[activation · render rules]');
ok('a complete checklist renders nothing (no nag)', renderChecklist({ title: 'x', steps: [{ label: 'a', done: true, href: '/' }], complete: true, storageKey: 'k' }) === '');
ok('storage keys are namespaced per role/entity', (await athleteChecklist(db, rico)).storageKey.startsWith('hz_act_ath_') && (await fanChecklist(db, fan)).storageKey === 'hz_act_fan');

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
