// Simulate the back-button onclick in a fake browser and PROVE the branches.
import { backButton } from './src/web/theme.ts';

// Extract the onclick body the same way a browser wraps an inline handler.
const html = backButton('/athlete/OWNER-ID');           // href fallback = the host/own profile
const onclick = html.match(/onclick="([^"]+)"/)![1];
const hrefFallback = html.match(/href="([^"]+)"/)![1];

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

// Run the handler in a scenario. Returns what happened: 'back' | 'navigate(href)'.
function runClick(scenario: { historyLength: number; referrer: string }) {
  let wentBack = false, defaultPrevented = false;
  const history = { length: scenario.historyLength, back() { wentBack = true; } };
  const event = { preventDefault() { defaultPrevented = true; } };
  const document = { referrer: scenario.referrer };
  const location = { origin: 'https://joinhorda.com' };
  // eslint-disable-next-line no-new-func
  new Function('history', 'event', 'document', 'location', onclick)(history, event, document, location);
  // The <a> navigates to href UNLESS default was prevented.
  return wentBack ? 'back' : (defaultPrevented ? 'nothing?!' : `navigate(${hrefFallback})`);
}

console.log('\n[backsim] executing the real onclick in a fake browser\n');

// THE REPORTED BUG: discover/main → event → back, with an EMPTY referrer
// (the case that broke). Must go BACK, never to the profile href.
ok('empty referrer + history → goes BACK (was: navigate to own profile)',
  runClick({ historyLength: 3, referrer: '' }) === 'back');
ok('same-origin referrer + history → goes BACK',
  runClick({ historyLength: 3, referrer: 'https://joinhorda.com/' }) === 'back');
ok('cross-origin referrer + history → still goes BACK (came from Twitter = back to Twitter, like the browser)',
  runClick({ historyLength: 2, referrer: 'https://twitter.com/x' }) === 'back');
// Cold deep-link: opened as the very first page in a fresh tab → no history →
// use the semantic href so back still does SOMETHING sensible.
ok('no history (cold deep-link) → falls to the href fallback',
  runClick({ historyLength: 1, referrer: '' }) === `navigate(${hrefFallback})`);
// The critical negative: it must NEVER navigate to the profile href when there
// IS history, regardless of referrer.
ok('NEVER navigates to the profile href when history exists (empty referrer)',
  runClick({ historyLength: 5, referrer: '' }) !== `navigate(/athlete/OWNER-ID)`);
ok('does not depend on document.referrer at all', !onclick.includes('referrer'));
ok('uses preventDefault, not the unreliable return-false', onclick.includes('preventDefault') && !onclick.includes('return false'));

console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
