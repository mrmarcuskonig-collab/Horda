import { lookupPlaces } from './src/web/geo.ts';
for (const q of ['Bonanza Coffee Berlin','Olympiastadion','Kreuzberg']) {
  const r = await lookupPlaces(q);
  console.log(q, '→', r.slice(0,3).map(p=>p.label).join('  |  ') || '(none)');
}
console.log('--- GEO_PROVIDER=off:');
process.env.GEO_PROVIDER='off';
console.log('Berlin →', (await lookupPlaces('Berl')).map(p=>p.label).join(', '));
process.exit(0);
