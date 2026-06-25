// pitch.ts — creator-facing benefit pages (/athletes, /clubs). Outcome-led,
// on-brand, ending at the creator doorway. Patreon-style "what you get".
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';

interface Benefit { t: string; d: string }
interface PitchCfg { kicker: string; headline: string; sub: string; ctaLabel: string; ctaPath: (guest: boolean) => string; benefits: Benefit[]; steps: string[]; close: string; other: { href: string; label: string } }

const CFG: Record<'athletes' | 'clubs', PitchCfg> = {
  athletes: {
    kicker: 'For athletes',
    headline: 'Turn followers into superfans — and a real income.',
    sub: 'Horda is your home base: an AI‑built page, members‑only drops, events and tickets, and recurring support from the fans who back you most. You own the audience — we handle the rest.',
    ctaLabel: 'Create your page',
    ctaPath: g => g ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete',
    benefits: [
      { t: 'Your page in a minute', d: 'Describe yourself in a sentence — AI builds a bold, on‑brand page, headline and cover. You own it instantly.' },
      { t: 'Recurring income', d: 'Supporter and Clubhouse tiers, monthly or annual. Real, predictable support from the fans closest to you.' },
      { t: 'Members‑only drops', d: 'Training, fight‑week, behind‑the‑scenes — posted free or locked to your supporters. You choose.' },
      { t: 'Events & tickets', d: 'Schedule events, sell tickets, go live on YouTube/Twitch — Luma‑style, built in.' },
      { t: 'Superfans, rewarded', d: 'Fans earn Superfan status by showing up, predicting and sharing. Loyalty you can actually see.' },
      { t: 'Verified & yours', d: 'Claim‑verified so there are no fakes — and your audience is yours, never rented from an algorithm.' },
    ],
    steps: ['Describe yourself — AI builds your page.', 'Add your tiers and your first drop.', 'Share it — fans follow, back you, show up.'],
    close: 'Your fans are already here. Give them a home.',
    other: { href: '/clubs', label: 'Run a club or federation? →' },
  },
  clubs: {
    kicker: 'For clubs & federations',
    headline: 'Your club’s home — fixtures, fans, and matchday income.',
    sub: 'The system of record — results, tables, fixtures — and the fandom layer on top: supporters, members‑only updates and ticketing. For clubs and federations at every level, from Kreisliga to the governing body.',
    ctaLabel: 'Claim your page',
    ctaPath: g => g ? '/signup?next=/onboarding/claim' : '/onboarding/claim',
    benefits: [
      { t: 'Auto‑built record', d: 'Paste results and fixtures — the league table, recent form and matchday page build themselves.' },
      { t: 'Supporter income', d: 'Recurring supporter tiers for your members. Fund the season from the people who care most.' },
      { t: 'Matchday hub', d: 'Fixtures, RSVPs, tickets and live links in one place your supporters actually check.' },
      { t: 'Members‑only updates', d: 'Team news, behind‑the‑scenes and priority tickets — kept for your supporters.' },
      { t: 'Claim & verify', d: 'Prove you represent the club. Only the real club or federation can run the page.' },
      { t: 'Every level', d: 'Grassroots to governing body — associations sanction leagues, clubs field teams, it all connects.' },
    ],
    steps: ['Find and claim your page.', 'Verify, then let AI set up your look.', 'Post, schedule matchdays, grow supporters.'],
    close: 'Bring your whole club — and its supporters — into one home.',
    other: { href: '/athletes', label: 'An individual athlete? →' },
  },
};

export function renderPitch(kind: 'athletes' | 'clubs', guest: boolean): string {
  const c = CFG[kind];
  const cta = c.ctaPath(guest);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(c.kicker)} — Horda</title>${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:90px;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  ${THM_CSS}
  .top{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:20}
  .mark{display:flex;align-items:center;color:var(--bone)}.mark svg{display:block}
  .nav{display:flex;gap:9px;align-items:center}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:600;border:1px solid var(--bone);border-radius:999px;padding:9px 18px;font-size:14px}
  .btn.ghost{background:transparent;color:var(--bone);border-color:var(--b)}
  .btn.sm{padding:7px 14px;font-size:13px}
  .wrap{max-width:900px;margin:0 auto;padding:0 20px}
  .hero{padding:54px 0 30px;border-bottom:1px solid var(--b)}
  .kick{font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:var(--mut);font-weight:600}
  .hl{font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.02em;margin:14px 0 14px;max-width:16ch}
  @media(max-width:600px){.hl{font-size:30px}}
  .lead{color:var(--mut);font-size:16px;line-height:1.6;max-width:60ch}
  .ctarow{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
  h2.sec{font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;color:var(--mut);margin:40px 0 16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
  .card{border:1px solid var(--b);border-radius:16px;padding:18px 18px;background:var(--s)}
  .card h3{font-size:16px;font-weight:600;margin:0 0 6px}
  .card p{color:var(--mut);font-size:13.5px;line-height:1.55;margin:0}
  .steps{display:grid;gap:10px;counter-reset:s}
  .step{display:flex;gap:13px;align-items:flex-start;border:1px solid var(--b);border-radius:14px;padding:14px 16px}
  .step .n{flex:0 0 28px;height:28px;border-radius:50%;border:1.5px solid var(--bone);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
  .step p{font-size:15px;font-weight:500}
  .tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
  .tier{border:1px solid var(--b);border-radius:14px;padding:16px}.tier.prem{border-color:var(--bone)}
  .tier .nm{font-weight:600;font-size:15px}.tier .pr{color:var(--mut);font-size:13px;margin-top:2px}
  .closeb{margin:40px 0 0;background:var(--bone);color:var(--ink);border-radius:20px;padding:30px 26px;text-align:center}
  .closeb h3{font-size:24px;font-weight:700;letter-spacing:-.01em;margin:0 0 14px;max-width:20ch;margin-inline:auto}
  .closeb .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .prov{max-width:900px;margin:22px auto 0;padding:0 20px;color:var(--mut);font-size:11.5px}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda">${ravenMarkCurrent(30)}</a>
    <div class="nav">${themeToggle()}<a class="btn" href="${cta}">${esc(c.ctaLabel)}</a></div></header>
  <div class="wrap">
    <section class="hero">
      <div class="kick">${esc(c.kicker)} · Horda</div>
      <h1 class="hl">${esc(c.headline)}</h1>
      <p class="lead">${esc(c.sub)}</p>
      <div class="ctarow"><a class="btn" href="${cta}">${esc(c.ctaLabel)} →</a><a class="btn ghost" href="#how">See how it works</a></div>
    </section>

    <h2 class="sec">What you get</h2>
    <div class="grid">${c.benefits.map(b => `<div class="card"><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p></div>`).join('')}</div>

    <h2 class="sec" id="how">How it works</h2>
    <div class="steps">${c.steps.map((s, i) => `<div class="step"><span class="n">${i + 1}</span><p>${esc(s)}</p></div>`).join('')}</div>

    <h2 class="sec">What fans can give</h2>
    <div class="tiers">
      <div class="tier"><div class="nm">Follow</div><div class="pr">Free — your whole audience</div></div>
      <div class="tier"><div class="nm">Supporter</div><div class="pr">Monthly or annual</div></div>
      <div class="tier prem"><div class="nm">Clubhouse</div><div class="pr">Premium · grants Superfan</div></div>
    </div>
    <p class="lead" style="font-size:13.5px;margin-top:10px">You set the prices — kept low and fair. Fans can also earn Superfan status for free by showing up and sharing.</p>

    <h2 class="sec">Fair by design</h2>
    <div class="grid">
      <div class="card"><h3>Keep more of what you earn</h3><p>A low, transparent fee — well below the big membership platforms. More of every euro reaches you.</p></div>
      <div class="card"><h3>You own your audience</h3><p>Your supporters are yours, not rented from an algorithm — export them whenever you like.</p></div>
      <div class="card"><h3>No surprise hikes</h3><p>We’ll never raise your rate on you. The deal you start with is the deal you keep.</p></div>
    </div>

    <div class="closeb"><h3>${esc(c.close)}</h3><a class="btn" href="${cta}">${esc(c.ctaLabel)} →</a></div>
    <p class="lead" style="font-size:13px;margin-top:18px"><a href="${c.other.href}" style="border-bottom:1px solid var(--b)">${esc(c.other.label)}</a></p>
  </div>
  <div class="prov">Coverage of real sport — never a fan‑to‑fan venue. joinhorda.com</div>
  ${bottomNav({ guest, fanId: null })}
</body></html>`;
}

// --- /about : a small marketing site (main + Creators + Features + Pricing) ---
// Patreon-style: a top nav whose items are their own pages (with dropdowns), an
// inspirational big-type hero, FURIA-bold but on the Ink/Bone brand. Type-led —
// no clip-art; real photography drops in later.
const FEATURES: Benefit[] = [
  { t: 'Your page in a minute', d: 'Describe yourself in a sentence — AI builds a bold, on‑brand page: headline, cover, the lot. You own it instantly.' },
  { t: 'Recurring income', d: 'Supporter and Clubhouse tiers, monthly or annual. Real, predictable support from the fans closest to you.' },
  { t: 'Members‑only drops', d: 'Training, fight‑week, team news, behind‑the‑scenes — posted free or locked to your supporters. You choose.' },
  { t: 'Events, streams & tickets', d: 'Schedule events, sell tickets, go live on YouTube / Twitch / Instagram / TikTok — Luma‑style, built in.' },
  { t: 'Superfans, rewarded', d: 'Fans earn Superfan status by showing up, predicting and sharing. Loyalty you can actually see — and reward.' },
  { t: 'Verified & yours', d: 'Claim‑verified so there are no fakes — and your audience is yours, never rented from an algorithm.' },
];

type AboutPage = 'about' | 'creators' | 'features' | 'pricing';
const NAV: { key: AboutPage; label: string; href: string; dd: [string, string][] }[] = [
  { key: 'creators', label: 'Creators', href: '/about/creators', dd: [['Athletes', '/about/creators#athletes'], ['Clubs', '/about/creators#clubs'], ['Federations', '/about/creators#federations']] },
  { key: 'features', label: 'Features', href: '/about/features', dd: [['Your page in a minute', '/about/features'], ['Recurring income', '/about/features'], ['Members‑only drops', '/about/features'], ['Events & tickets', '/about/features'], ['Superfans, rewarded', '/about/features']] },
  { key: 'pricing', label: 'Pricing', href: '/about/pricing', dd: [['Follow — free', '/about/pricing'], ['Supporter', '/about/pricing'], ['Clubhouse', '/about/pricing'], ['Earn Superfan free', '/about/pricing']] },
];

function aboutShell(active: AboutPage, guest: boolean, title: string, body: string): string {
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const navItem = (n: typeof NAV[number]) => `<div class="navitem${active === n.key ? ' on' : ''}"><a class="topl" href="${n.href}">${esc(n.label)}</a><div class="dd">${n.dd.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('')}</div></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Horda</title>${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--bone);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:90px;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  ${THM_CSS}
  .mnav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:13px 22px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:30}
  .mnav .mark{display:flex;align-items:center;justify-self:center;color:var(--bone)}.mnav .mark svg{display:block}
  .links{display:flex;gap:8px;justify-self:start}
  .navitem{position:relative;padding:8px 6px}
  .navitem .topl{font-size:14.5px;font-weight:600;color:var(--mut)}.navitem:hover .topl,.navitem.on .topl{color:var(--bone)}
  .navitem::after{content:"";position:absolute;top:100%;left:-10px;right:-10px;height:12px}
  .dd{position:absolute;top:calc(100% + 8px);left:0;min-width:240px;background:var(--ink);border:1px solid var(--b);border-radius:14px;padding:8px;display:none;box-shadow:0 18px 44px rgba(0,0,0,.55);z-index:40}
  .navitem:hover .dd{display:block}
  .dd a{display:block;padding:9px 12px;border-radius:9px;font-size:13.5px;color:var(--mut)}.dd a:hover{background:var(--s);color:var(--bone)}
  .right{display:flex;align-items:center;gap:10px;justify-self:end}
  @media(max-width:760px){.links{display:none}.mnav .mark{justify-self:start}.mnav{grid-template-columns:auto 1fr}}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:700;border:1.5px solid var(--bone);border-radius:999px;padding:9px 18px;font-size:14px;white-space:nowrap}
  .btn:hover{opacity:.9}
  .btn.ghost{background:transparent;color:var(--bone);border-color:var(--b)}.btn.sm{padding:7px 14px;font-size:13px}
  .wrap{max-width:1000px;margin:0 auto;padding:0 22px}
  .kick{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--mut);font-weight:700}
  /* big inspirational hero */
  .bighero{padding:96px 0 70px}
  .bighero .hl{font-size:88px;line-height:.98;font-weight:900;letter-spacing:-.035em;margin:18px 0 22px;max-width:14ch}
  .bighero .lead{color:var(--mut);font-size:20px;line-height:1.55;max-width:54ch}
  @media(max-width:760px){.bighero{padding:54px 0 36px}.bighero .hl{font-size:48px}.bighero .lead{font-size:17px}}
  .ctarow{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}
  /* page hero (sub-pages) */
  .phero{padding:64px 0 30px;border-bottom:1px solid var(--b)}
  .phero .hl{font-size:54px;line-height:1.02;font-weight:900;letter-spacing:-.03em;margin:14px 0 14px;max-width:18ch}
  .phero .lead{color:var(--mut);font-size:18px;line-height:1.6;max-width:58ch}
  @media(max-width:760px){.phero .hl{font-size:36px}}
  h2.sec{font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--mut);margin:52px 0 18px}
  .secsub{color:var(--mut);font-size:15px;max-width:60ch;margin:-8px 0 22px}
  /* pillar blocks on the main page */
  .pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}@media(max-width:760px){.pillars{grid-template-columns:1fr}}
  .pillar{display:block;border:1px solid var(--b);border-radius:20px;padding:26px 24px;background:var(--s);transition:border-color .15s}
  .pillar:hover{border-color:var(--bone)}
  .pillar .pn{font-size:24px;font-weight:900;letter-spacing:-.02em}.pillar p{color:var(--mut);font-size:14px;margin:8px 0 14px;line-height:1.55}.pillar .go{font-weight:700;font-size:13.5px}
  .manifesto{border-top:1px solid var(--b);margin-top:64px;padding-top:40px}
  .manifesto .ln{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.15;max-width:24ch;margin:0 0 14px}
  .manifesto .ln b{color:var(--bone)}.manifesto .ln{color:var(--mut)}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.two{grid-template-columns:1fr}}
  .pcard{border:1px solid var(--b);border-radius:20px;padding:26px;background:var(--s)}.pcard h3{font-size:24px;font-weight:800;letter-spacing:-.01em;margin-bottom:8px}.pcard p{color:var(--mut);font-size:14.5px;line-height:1.6;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
  .card{border:1px solid var(--b);border-radius:16px;padding:22px;background:var(--s)}.card h3{font-size:18px;font-weight:700;margin:0 0 7px}.card p{color:var(--mut);font-size:14px;line-height:1.55;margin:0}
  .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}@media(max-width:760px){.tiers{grid-template-columns:1fr}}
  .tier{border:1px solid var(--b);border-radius:18px;padding:24px;background:var(--s)}.tier.prem{border-color:var(--bone)}
  .tier .nm{font-weight:800;font-size:20px}.tier .pr{color:var(--mut);font-size:13.5px;margin:4px 0 14px}
  .tier ul{list-style:none;margin:0 0 16px}.tier li{font-size:13.5px;color:var(--bone);padding:7px 0;border-top:1px solid var(--b)}.tier li:first-child{border-top:none}
  .trust{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}@media(max-width:760px){.trust{grid-template-columns:1fr}}
  .steps{display:grid;gap:11px;max-width:720px}
  .step{display:flex;gap:14px;align-items:flex-start;border:1px solid var(--b);border-radius:14px;padding:15px 18px}
  .step .n{flex:0 0 30px;height:30px;border-radius:50%;border:1.5px solid var(--bone);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
  .step p{font-size:15.5px;font-weight:500;padding-top:3px}
  .closeb{margin:60px auto 0;background:var(--bone);color:var(--ink);border-radius:24px;padding:48px 28px;text-align:center;max-width:820px}
  .closeb h3{font-size:36px;font-weight:900;letter-spacing:-.02em;margin:0 auto 18px;max-width:18ch}
  .closeb .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .foot{max-width:1000px;margin:34px auto 0;padding:0 22px;color:var(--mut);font-size:12px}
  .foot a{color:var(--mut);border-bottom:1px solid var(--b)}.foot .fl{display:flex;gap:18px;margin-bottom:10px;flex-wrap:wrap}
</style></head><body>
  <header class="mnav">
    <nav class="links">${NAV.map(navItem).join('')}</nav>
    <a class="mark" href="/" aria-label="Horda — home">${ravenMarkCurrent(30)}</a>
    <div class="right">${themeToggle()}${guest ? `<a class="btn ghost sm" href="/login">Log in</a>` : ''}<a class="btn sm" href="${athleteHref}">Create your page</a></div>
  </header>
  <div class="wrap">${body}</div>
  <div class="foot"><div class="fl"><a href="/about/creators">Creators</a><a href="/about/features">Features</a><a href="/about/pricing">Pricing</a><a href="/about">Overview</a></div>Coverage of real sport — never a fan‑to‑fan venue. joinhorda.com</div>
  ${bottomNav({ guest, fanId: null })}
</body></html>`;
}

// MAIN /about — inspirational: what Horda can be, with routes into each page.
export function renderAbout(guest: boolean): string {
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const body = `
    <section class="bighero">
      <div class="kick">The home for sports superfans</div>
      <h1 class="hl">Build the home your fans never had.</h1>
      <p class="lead">From a regional keeper to a running influencer — Horda turns a following into a Horda: superfans who follow, back you and show up. Drops, events, tickets and recurring income, in one place you own.</p>
      <div class="ctarow"><a class="btn" href="${athleteHref}">Create your page →</a><a class="btn ghost" href="/about/features">See what you can do</a></div>
    </section>

    <h2 class="sec">Start here</h2>
    <div class="pillars">
      <a class="pillar" href="/about/creators"><div class="pn">Creators</div><p>Athletes, clubs and federations — every side of sport, one home.</p><span class="go">Who it’s for →</span></a>
      <a class="pillar" href="/about/features"><div class="pn">Features</div><p>AI page, members‑only drops, events &amp; tickets, superfans.</p><span class="go">What you can do →</span></a>
      <a class="pillar" href="/about/pricing"><div class="pn">Pricing</div><p>Free to start. Fair, transparent tiers. You set the price.</p><span class="go">What it costs →</span></a>
    </div>

    <div class="manifesto">
      <p class="ln"><b>The long tail of sport</b> — every league, every fighter — finally has a home.</p>
      <p class="ln">Not rented from an algorithm. <b>An audience you own.</b></p>
      <p class="ln">Where showing up, predicting and sharing turns fans into <b>superfans.</b></p>
    </div>

    <div class="closeb"><h3>Your fans are already here. Give them a home.</h3><a class="btn" href="${athleteHref}">Create your page →</a></div>`;
  return aboutShell('about', guest, 'Horda for creators', body);
}

// /about/creators — who it's for (athletes, clubs, federations)
export function renderAboutCreators(guest: boolean): string {
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const claimHref = guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  const body = `
    <section class="phero">
      <div class="kick">Creators</div>
      <h1 class="hl">Built for every side of sport.</h1>
      <p class="lead">Whether you compete, run a club, or govern a league — Horda gives you one home for your fandom and the tools to make it pay.</p>
    </section>

    <h2 class="sec" id="athletes">Athletes</h2>
    <div class="pcard"><h3>Your page in a sentence.</h3><p>Describe yourself and AI builds a bold, on‑brand page — headline, cover, the lot. Post drops, set your tiers, schedule fight‑week events and meet‑ups. You own it instantly, and your fans can earn Superfan status by showing up.</p><a class="btn" href="${athleteHref}">Create my athlete page →</a></div>

    <h2 class="sec" id="clubs">Clubs</h2>
    <div class="pcard"><h3>Turn matchdays into a home.</h3><p>From a grassroots side to a national cup run: claim your page, verify you represent it, and bring fixtures, RSVPs, tickets and members‑only team news into one place your supporters actually check — and fund.</p><a class="btn" href="${claimHref}">Claim our club page →</a></div>

    <h2 class="sec" id="federations">Federations</h2>
    <div class="pcard"><h3>Govern the whole pyramid.</h3><p>Associations sanction leagues, clubs field teams, athletes compete — and on Horda it all connects. Verify clubs, surface competitions, and give your grassroots a home from the governing body down.</p><a class="btn" href="${claimHref}">Claim our federation page →</a></div>

    <div class="closeb"><h3>Your fans are already here. Give them a home.</h3><a class="btn" href="${athleteHref}">Create your page →</a></div>`;
  return aboutShell('creators', guest, 'Creators', body);
}

// /about/features — what you can do
export function renderAboutFeatures(guest: boolean): string {
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const body = `
    <section class="phero">
      <div class="kick">Features</div>
      <h1 class="hl">Everything you need to grow &amp; earn.</h1>
      <p class="lead">One home for your fandom: an AI‑built page, members‑only drops, events and tickets, recurring income, and superfans you can actually see.</p>
    </section>

    <h2 class="sec">What you can do</h2>
    <div class="grid">${FEATURES.map(f => `<div class="card"><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></div>`).join('')}</div>

    <h2 class="sec">How it works</h2>
    <div class="steps">
      <div class="step"><span class="n">1</span><p>Describe yourself, or find &amp; claim your club — AI builds your page.</p></div>
      <div class="step"><span class="n">2</span><p>Add your tiers and post your first drop or schedule an event.</p></div>
      <div class="step"><span class="n">3</span><p>Share it — fans follow, back you, show up, and climb to Superfan.</p></div>
    </div>

    <div class="closeb"><h3>Give your fans something to belong to.</h3><a class="btn" href="${athleteHref}">Create your page →</a></div>`;
  return aboutShell('features', guest, 'Features', body);
}

// /about/pricing — what it costs
export function renderAboutPricing(guest: boolean): string {
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const body = `
    <section class="phero">
      <div class="kick">Pricing</div>
      <h1 class="hl">Free to start. Fair to grow.</h1>
      <p class="lead">You set the prices — kept low and fair. Three ways for fans to back you, plus a free path to Superfan status. We only do well when you do.</p>
    </section>

    <h2 class="sec">Ways fans back you</h2>
    <div class="tiers">
      <div class="tier"><div class="nm">Follow</div><div class="pr">Free — your whole audience</div><ul><li>Public drops, events &amp; matchdays</li><li>Counts toward Superfan status</li></ul><a class="btn ghost sm" href="${athleteHref}">Start free</a></div>
      <div class="tier"><div class="nm">Supporter</div><div class="pr">Monthly or annual — you set it</div><ul><li>Members‑only drops</li><li>Early &amp; priority tickets</li><li>The supporter badge</li></ul><a class="btn sm" href="${athleteHref}">Add a tier</a></div>
      <div class="tier prem"><div class="nm">Clubhouse</div><div class="pr">Premium · grants Superfan</div><ul><li>Everything in Supporter</li><li>The inside circle &amp; perks</li><li>Instant Superfan status</li></ul><a class="btn sm" href="${athleteHref}">Add a tier</a></div>
    </div>

    <h2 class="sec">Fair by design</h2>
    <div class="trust">
      <div class="card"><h3>Keep more of what you earn</h3><p>A low, transparent fee — well below the big membership platforms.</p></div>
      <div class="card"><h3>You own your audience</h3><p>Your supporters are yours, not rented from an algorithm — export them anytime.</p></div>
      <div class="card"><h3>No surprise hikes</h3><p>We’ll never raise your rate on you. The deal you start with is the deal you keep.</p></div>
    </div>
    <p class="secsub" style="margin-top:18px">Fans can also <b style="color:var(--bone)">earn Superfan status for free</b> — by showing up, predicting and sharing. Loyalty, not just money.</p>

    <div class="closeb"><h3>Start free. Earn from day one.</h3><a class="btn" href="${athleteHref}">Create your page →</a></div>`;
  return aboutShell('pricing', guest, 'Pricing', body);
}
