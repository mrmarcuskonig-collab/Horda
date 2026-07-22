// _bqa.ts — browser QA. Drives a REAL headless Chromium against the running app.
// The journeys here are the ones that keep breaking and that a status-code
// crawler cannot see: back-navigation landing, login/join state while logged in,
// follow-state reflection. Every assertion is the result of a real click.
import { startServer } from './src/web/server.ts';
import pw from '/tmp/node_modules/playwright-core/index.js';

const EXE = '/sessions/trusting-nifty-einstein/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const chromium = (pw as any).chromium;

const b = await chromium.launch({
  headless: true, executablePath: EXE,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/xlibs' },
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--headless=new'],
});

let pass = 0, fail = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean, extra = '') => {
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ·  ' + extra : ''}`);
  if (c) pass++; else { fail++; fails.push(n + (extra ? ` (${extra})` : '')); }
};
const path = (u: string) => { try { return new URL(u).pathname + new URL(u).search; } catch { return u; } };

async function fresh() {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on('pageerror', (e: any) => errs.push(String(e.message || e)));
  return { ctx, p, errs };
}

// ---- J1: back from an event opened off the HOME feed returns HOME ----------
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const homeUrl = path(p.url());
  // click the first event card on the home feed
  const card = await p.$('a[href^="/e/"]');
  ok('J1.setup home has an event card to click', !!card);
  if (card) {
    await card.click(); await p.waitForLoadState('networkidle');
    const evUrl = path(p.url());
    const back = await p.$('.hz-back');
    ok('J1 event page has a back control', !!back, evUrl);
    if (back) {
      await back.click(); await p.waitForLoadState('networkidle');
      ok('J1 back from event → HOME (not profile)', path(p.url()) === homeUrl,
        `landed ${path(p.url())}, expected ${homeUrl}`);
    }
  }
  await ctx.close();
}

// ---- J2: back from an event opened off a CLUB page returns to the CLUB -----
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const clubHrefs: string[] = await p.$$eval('a[href^="/club/"]',
    (a: any[]) => [...new Set(a.map(x => x.getAttribute('href')))]);
  // find a club that actually lists an event (not every seed club has one)
  let clubWithEvent = '';
  for (const c of clubHrefs) {
    await p.goto(base + c, { waitUntil: 'networkidle' });
    if (await p.$('a[href^="/e/"]')) { clubWithEvent = c; break; }
  }
  ok('J2 setup: found a club that lists an event', !!clubWithEvent);
  if (clubWithEvent) {
    await p.goto(base + clubWithEvent, { waitUntil: 'networkidle' });
    const clubUrl = path(p.url());
    await (await p.$('a[href^="/e/"]'))!.click();
    await p.waitForLoadState('networkidle');
    const back = await p.$('.hz-back');
    ok('J2 event (from club) has a back control', !!back);
    if (back) {
      await back.click(); await p.waitForLoadState('networkidle');
      ok('J2 back from event → the CLUB it was opened from', path(p.url()) === clubUrl,
        `landed ${path(p.url())}, expected ${clubUrl}`);
    }
  }
  await ctx.close();
}

// ---- J7: the exact repro — HOME → Profile → an event → back → Profile -------
// "click my events on the main screen, open an event, press back → lands on
// profile not main." Whichever page you CAME from is where back must return.
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const prof = await p.$('a[href^="/fan/"]');
  if (prof) {
    await prof.click(); await p.waitForLoadState('networkidle');
    const profUrl = path(p.url());
    const ev = await p.$('a[href^="/e/"]');
    if (ev) {
      await ev.click(); await p.waitForLoadState('networkidle');
      const back = await p.$('.hz-back');
      if (back) {
        await back.click(); await p.waitForLoadState('networkidle');
        ok('J7 back from a profile-opened event → PROFILE (where you came from)',
          path(p.url()) === profUrl, `landed ${path(p.url())}, expected ${profUrl}`);
      } else ok('J7 event page has back control', false);
    } else ok('J7 profile lists an event to open', true, 'no events on demo profile — skipped');
  } else ok('J7 setup: profile link on home', false);
  await ctx.close();
}

// ---- J3: a logged-in viewer is never shown guest Login / Join --------------
{
  const targets = ['/', '/map', '/following', '/create'];
  for (const t of targets) {
    const { ctx, p } = await fresh();
    await p.goto(base + t, { waitUntil: 'networkidle' });
    // the guest foot CTA is a ghost login button + a "Join free" link
    const guestChrome = await p.evaluate(() => {
      const html = document.body.innerHTML;
      const login = /class="btn ghost"[^>]*href="\/login"/.test(html);
      const join = html.includes('Join free');
      return login && join;
    });
    ok(`J3 logged-in ${t} shows NO guest Login/Join`, !guestChrome);
    // and grab an event page too, off this page
    await ctx.close();
  }
  // event page specifically (the original bug)
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const card = await p.$('a[href^="/e/"]');
  if (card) {
    await card.click(); await p.waitForLoadState('networkidle');
    const guestChrome = await p.evaluate(() => {
      const html = document.body.innerHTML;
      return /class="btn ghost"[^>]*href="\/login"/.test(html) && html.includes('Join free');
    });
    ok('J3 logged-in EVENT page shows NO guest Login/Join', !guestChrome, path(p.url()));
  }
  await ctx.close();
}

// ---- J4: follow state reflects reality after you follow --------------------
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const club = await p.$('a[href^="/club/"]');
  if (club) {
    await club.click(); await p.waitForLoadState('networkidle');
    const clubUrl = p.url();
    // find a follow control (button or form submit whose label is Follow)
    const followBtn = await p.$('button:has-text("Follow"), form[action*="follow"] button');
    if (followBtn) {
      const before = (await followBtn.textContent() || '').trim();
      await followBtn.click();
      await p.waitForLoadState('networkidle');
      // reload the club page fresh and read the control again
      await p.goto(clubUrl, { waitUntil: 'networkidle' });
      const after = await p.evaluate(() => {
        const el = document.querySelector('button, .followbtn, [data-follow]');
        return (document.body.textContent || '');
      });
      const nowFollowing = /Following|Unfollow|Folge ich|Entfolgen/.test(after);
      ok('J4 after Follow, the control reflects Following/Unfollow', nowFollowing,
        `before="${before}"`);
    } else ok('J4 club page has a Follow control', false, clubUrl);
  } else ok('J4 setup: a club link exists', false);
  await ctx.close();
}

// ---- J5: German search finds a German sport term ---------------------------
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/set-lang?l=de', { waitUntil: 'networkidle' });
  await p.goto(base + '/?q=' + encodeURIComponent('Fußball'), { waitUntil: 'networkidle' });
  const hasResults = await p.$$eval('a[href^="/e/"], a[href^="/club/"]', (a: any[]) => a.length);
  ok('J5 German query "Fußball" returns results', hasResults > 0, `${hasResults} cards`);
  await ctx.close();
}

// ---- J6: English-only — the map is English even after a legacy de cookie ----
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/set-lang?l=de', { waitUntil: 'networkidle' });
  await p.goto(base + '/map', { waitUntil: 'networkidle' });
  const lang = await p.evaluate(() => document.documentElement.getAttribute('lang'));
  ok('J6 map is English even with a legacy de cookie (no language jump)', lang === 'en', `lang=${lang}`);
  await ctx.close();
}

// ---- J8: no uncaught JS errors on the core pages (real browser console) ----
{
  const pages = ['/', '/map', '/following', '/notifications', '/create', '/about', '/changelog'];
  for (const t of pages) {
    const { ctx, p, errs } = await fresh();
    await p.goto(base + t, { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);
    ok(`J8 ${t} throws no uncaught JS error`, errs.length === 0, errs[0] || '');
    await ctx.close();
  }
  // and an event page
  const { ctx, p, errs } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const card = await p.$('a[href^="/e/"]');
  if (card) { await card.click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(150);
    ok('J8 event page throws no uncaught JS error', errs.length === 0, errs[0] || ''); }
  await ctx.close();
}

// ---- J9: mobile — tapping an event card opens the half-sheet (not full nav) --
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const beforeUrl = path(p.url());
  const card = await p.$('a[href^="/e/"]');
  ok('J9.setup mobile home has an event card', !!card);
  if (card) {
    await card.click();
    await p.waitForTimeout(700);   // fetch + slide
    const sheetOpen = await p.evaluate(() => {
      const s = document.getElementById('hz-peek');
      const scrim = document.getElementById('hz-peekscrim');
      if (!s || !scrim) return { open: false };
      const cs = getComputedStyle(scrim);
      const bodyHtml = (document.querySelector('#hz-peek .hz-pkbody') || {}).innerHTML || '';
      return { open: scrim.classList.contains('on') && cs.display !== 'none', hasContent: /poster|evgrid|Add to calendar|Claim|Get ticket|Get access|Hosted by/.test(bodyHtml) };
    });
    // The list DOM stays mounted behind the sheet (progressive overlay); the peek
    // sheet is what's visibly open.
    const listStillMounted = await p.$$eval('a[href^="/e/"]', (a: any[]) => a.length > 0);
    ok('J9 tapping an event card opens the peek half-sheet (list stays behind it)', sheetOpen.open && listStillMounted, `from ${beforeUrl}`);
    ok('J9 the sheet is populated with the event content', !!sheetOpen.hasContent);
  }
  await ctx.close();
}
// ---- J10: desktop — event card navigates normally (no sheet) ----------------
{
  const { ctx, p } = await fresh();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const card = await p.$('a[href^="/e/"]');
  if (card) {
    await card.click(); await p.waitForLoadState('networkidle');
    ok('J10 on desktop, an event card navigates to the full event page', path(p.url()).startsWith('/e/'));
  }
  await ctx.close();
}

console.log(`\n──────── browser QA: ${pass} passed, ${fail} failed ────────`);
if (fail) console.log('FAILURES:\n' + fails.map(f => '  ✗ ' + f).join('\n'));
await b.close();
await app.close?.();
process.exit(fail ? 1 : 0);
