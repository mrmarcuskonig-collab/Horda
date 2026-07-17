import { zonedToUtc, inZone, zoneLabel, isValidZone, viewerDiffers } from './src/web/tz.ts';
const cases: [string,string,string][] = [
  ['2030-09-12T20:00','Europe/Berlin','2030-09-12T18:00:00.000Z'],  // CEST = UTC+2
  ['2030-01-15T20:00','Europe/Berlin','2030-01-15T19:00:00.000Z'],  // CET  = UTC+1
  ['2030-06-01T19:30','Europe/London','2030-06-01T18:30:00.000Z'],  // BST  = UTC+1
  ['2030-06-01T19:30','America/New_York','2030-06-01T23:30:00.000Z'],// EDT = UTC-4
  ['2030-06-01T19:30','Asia/Tokyo','2030-06-01T10:30:00.000Z'],     // JST  = UTC+9
  ['2030-10-27T02:30','Europe/Berlin','2030-10-27T01:30:00.000Z'],  // DST fall-back day
  ['2030-03-31T03:30','Europe/Berlin','2030-03-31T01:30:00.000Z'],  // DST spring-forward day
];
let bad=0;
for (const [local,tz,want] of cases) {
  const got = zonedToUtc(local,tz).toISOString();
  const ok = got===want; if(!ok) bad++;
  console.log(`${ok?'ok  ':'FAIL'} ${local} ${tz.padEnd(17)} → ${got}${ok?'':'  want '+want}`);
}
console.log('\nrender in the EVENT zone:', inZone('2030-09-12T18:00:00Z','Europe/Berlin'), zoneLabel('2030-09-12T18:00:00Z','Europe/Berlin'));
console.log('same instant, viewer in Tokyo still sees the VENUE time:', inZone('2030-09-12T18:00:00Z','Europe/Berlin'));
console.log('viewer in London differs from Berlin event?', viewerDiffers('Europe/Berlin','Europe/London','2030-09-12T18:00:00Z'));
console.log('viewer in Berlin differs from Berlin event?', viewerDiffers('Europe/Berlin','Europe/Berlin','2030-09-12T18:00:00Z'));
console.log('junk zone rejected:', !isValidZone('Not/AZone'), '| valid:', isValidZone('Europe/Berlin'));
process.exit(bad?1:0);
