// pitch.ts — creator-facing benefit pages (/athletes, /clubs). Outcome-led,
// on-brand, ending at the creator doorway. Patreon-style "what you get".
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';
import { SHIPPED, BUILDING } from '../content/changelog.ts';
import { entryId } from './feeds.ts';
import { discordModule, discordFootLink, discordBtn, hasDiscord, DSC_CSS } from './community.ts';
import { TAKE_RATE_PCT } from './terms.ts';
import { PLANS, ENTITLEMENT_LABEL, annualSavingPct, getPlan, type Plan } from './pricing.ts';

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
  <div class="prov">The events home for sports and competitive culture. joinhorda.com</div>
  ${bottomNav({ guest, fanId: null })}
</body></html>`;
}

// --- /about : a small marketing site (main + Creators + Features + Pricing) ---
// Patreon-style: a top nav whose items are their own pages (with dropdowns), an
// inspirational big-type hero, FURIA-bold but on the Ink/Bone brand. Type-led —
// no clip-art; real photography drops in later.
// Outcome-led — every card names the result, then how. New positioning: the
// events layer for competitive sport, with attributed reach.
const FEATURES: Benefit[] = [
  { t: 'See who drove every ticket', d: 'Every participant gets a ready‑to‑share link. When a fan claims or buys through it, it’s credited to them — “Rico drove 312 fans and 140 ticket buyers to this fight.” Reach you can finally count.' },
  { t: 'Sell tickets — free or paid', d: `Free tickets are one tap, tied to a real identity, no signup wall. Charge when you want: card payments via Stripe, money in your account, Horda keeps a flat ${TAKE_RATE_PCT}% (0% on Horda Plus).` },
  { t: 'Know who actually showed up', d: 'Every ticket carries a QR. Scan people in at the door and verified attendance is stamped on their identity — not who clicked “interested”, who was really there.' },
  { t: 'Drag your rival onto the platform', d: 'A match has two sides. List the rival club even before they join — they join Horda to claim their side, their fans and their share of the tickets. A growth loop generic ticketing can’t have.' },
  { t: 'Fight cards that roll up', d: 'Nest bouts or races inside one event. Each fighter shares their bout; the sale rolls up to the night. Many small rivalries, all pulling fans into one big event.' },
  { t: 'A record of real presence', d: 'Checked‑in fans get an “I was there” stamp — a passport of where they actually showed up, and a shareable card that pulls the next fan in.' },
];

type AboutPage = 'about' | 'creators' | 'features' | 'pricing' | 'changelog' | 'embed';
const NAV: { key: AboutPage; label: string; href: string; dd: [string, string][] }[] = [
  { key: 'creators', label: 'Who it’s for', href: '/about/creators', dd: [['Event organisers', '/about/creators#organisers'], ['Athletes', '/about/creators#athletes'], ['Clubs & federations', '/about/creators#clubs'], ['Fans', '/about/creators#fans']] },
  { key: 'features', label: 'What you can do', href: '/about/features', dd: [['See who drove your tickets', '/about/features'], ['Free & paid tickets', '/about/features'], ['QR check‑in', '/about/features'], ['Two‑sided events', '/about/features'], ['Fight cards & sub‑events', '/about/features'], ['Verified presence', '/about/features']] },
  { key: 'pricing', label: 'Pricing', href: '/about/pricing', dd: [['Horda Free — free forever', '/about/pricing'], [`Paid tickets — flat ${TAKE_RATE_PCT}%`, '/about/pricing'], ['Horda Plus — 0% fee', '/about/pricing']] },
  // Built in the open: the changelog is a top-level marketing surface, not a
  // buried footer link. Shipping velocity IS the pitch.
  { key: 'changelog', label: 'Changelog', href: '/changelog', dd: [['What we just shipped', '/changelog'], ['What we’re building now', '/changelog#building'], ['Ask for a feature', '/changelog#ask']] },
];

// `head` lets a page add <link rel="alternate"> etc. The changelog uses it to
// advertise its RSS/JSON twins — a feed nobody can discover is a feed nobody
// reads, and autodiscovery is how readers and agents find one without being told.
function aboutShell(active: AboutPage, guest: boolean, title: string, body: string, head = ''): string {
  const createHref = '/create';   // events-first: primary CTA everywhere is "Create an event"
  const navItem = (n: typeof NAV[number]) => `<div class="navitem${active === n.key ? ' on' : ''}"><a class="topl" href="${n.href}">${esc(n.label)}</a><div class="dd">${n.dd.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('')}</div></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Horda</title>${head}${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--bone);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:40px;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  /* Standalone marketing site — NO app chrome (no left rail, no bottom tab bar,
     no peek sheet). The about pages carry the brand, not the product UI. */
  .mnav{display:flex;align-items:center;padding:13px 22px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:30}
  .mnav .mark{display:flex;align-items:center;gap:9px;color:var(--bone)}.mnav .mark svg{display:block}
  .mnav .mark b{font-size:19px;font-weight:800;letter-spacing:-.02em}
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
  /* Audience cards — the conversion spine: one card per audience, each naming the
     OUTCOME Horda drives and a direct CTA into that audience's path. */
  .aud{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}@media(max-width:760px){.aud{grid-template-columns:1fr}}
  .audcard{display:flex;flex-direction:column;border:1px solid var(--b);border-radius:20px;padding:28px 26px;background:var(--s);transition:border-color .15s,transform .15s}
  .audcard:hover{border-color:var(--acc);transform:translateY(-2px)}
  .audcard .who{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--acc)}
  .audcard .out{font-size:26px;font-weight:900;letter-spacing:-.02em;line-height:1.1;margin:12px 0 10px}
  @media(max-width:760px){.audcard .out{font-size:22px}}
  .audcard p{color:var(--mut);font-size:14.5px;line-height:1.6;margin:0 0 18px}
  .audcard .metric{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap}
  .audcard .metric span{font-size:12.5px;color:var(--bone);background:var(--ink);border:1px solid var(--b);border-radius:999px;padding:4px 11px}
  .audcard .cta{margin-top:auto}
  .btn.acc{background:var(--acc);color:var(--accink,#fff);border-color:var(--acc)}.btn.acc:hover{opacity:.92}
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
  ${DSC_CSS}
  /* changelog */
  .cl{max-width:760px}
  .clhead .kick{color:var(--acc);font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
  .bld{display:grid;gap:11px;margin-bottom:8px}
  .bldi{border:1px dashed var(--b);border-radius:14px;padding:17px 19px;background:transparent}
  .bldi h4{font-size:16.5px;font-weight:700;margin:0 0 5px;display:flex;gap:9px;align-items:center;flex-wrap:wrap}
  .bldi p{color:var(--mut);font-size:14px;line-height:1.55;margin:0}
  .eta{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:2px 8px}
  .cle{display:flex;gap:16px;padding:22px 0;border-top:1px solid var(--b)}
  .cle .when{flex:0 0 92px;color:var(--mut);font-size:12.5px;font-variant-numeric:tabular-nums;padding-top:3px}
  .cle h4{font-size:17px;font-weight:700;margin:0 0 6px;letter-spacing:-.01em}
  .cle p{color:var(--mut);font-size:14.5px;line-height:1.6;margin:0}
  .tg{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;border-radius:999px;padding:2px 8px;margin-bottom:8px}
  .tg.new{background:var(--acc);color:var(--accink)}
  .tg.better{border:1px solid var(--b);color:var(--mut)}
  .tg.fixed{border:1px solid var(--b);color:var(--mut)}
  .cred{margin-top:9px;font-size:13px;color:var(--mut)}.cred b{color:var(--bone);font-weight:600}
  @media(max-width:600px){.cle{flex-direction:column;gap:5px}.cle .when{flex:none}}
</style></head><body>
  ${/* About pages carry the brand, not the product nav. Just the Horda logo, in
        the same top-left spot as the app's landing header, clicking back into the
        application — no marketing nav bar. */''}
  <header class="mnav">
    <a class="mark" href="/" aria-label="Horda — back to the app">${ravenMarkCurrent(26)}<b>Horda</b></a>
  </header>
  <div class="wrap">${body}</div>
  <div class="foot"><div class="fl"><a href="/about/creators">Who it’s for</a><a href="/about/features">Features</a><a href="/about/pricing">Pricing</a><a href="/about">Overview</a><a href="/changelog">Changelog</a>${discordFootLink()}<a href="/agb">Terms</a><a href="/impressum">Legal notice</a><a href="/datenschutz">Privacy</a></div>The events home for sports and competitive culture. joinhorda.com</div>
</body></html>`;
}

// MAIN /about — reworked from scratch (28 Jul 2026) in the Partiful storytelling
// mould: one big promise, a scrolling WALL of real-styled event posters as proof,
// then four short, visual audience beats (each with an on-brand mini-mockup, not
// paragraphs), a "before / during / after" feature grid, and a memorable sign-off.
// All visuals are built from Horda's own dark event/poster styling — no stock
// photography, no fabricated platform stats (per-event example figures only).
type Poster = { sport: string; title: string; when: string; city: string };
const POSTERS: Poster[] = [
  { sport: 'Football', title: 'FC Kreuzberg vs. Wedding United', when: 'Sat · 20:00', city: 'Berlin' },
  { sport: 'Boxing', title: 'Rico Vasquez — Fight Night', when: 'Fri · 21:00', city: 'Hamburg' },
  { sport: 'Hyrox', title: 'HYROX Berlin — Winter Heat', when: 'Sun · 09:00', city: 'Berlin' },
  { sport: 'Run club', title: 'Ostkreuz Saturday Run', when: 'Sat · 08:00', city: 'Berlin' },
  { sport: 'Grappling', title: 'Open Mat — Prenzlauer Berg', when: 'Wed · 19:00', city: 'Berlin' },
  { sport: 'Basketball', title: 'Mitte Ballers — Playoff', when: 'Sat · 18:00', city: 'Berlin' },
  { sport: 'Cycling', title: 'Grunewald Crit', when: 'Sun · 10:00', city: 'Berlin' },
  { sport: 'Strongman', title: 'Spandau Strongman Open', when: 'Sat · 12:00', city: 'Berlin' },
  { sport: 'BJJ', title: 'Gi & No-Gi Throwdown', when: 'Sun · 14:00', city: 'Leipzig' },
  { sport: 'Futsal', title: 'Neukölln Futsal Cup', when: 'Fri · 19:00', city: 'Berlin' },
];
const posterCard = (p: Poster, i: number) => `
  <div class="poster t${i % 4}">
    <div class="p-top"><span class="p-sport">${esc(p.sport)}</span><span class="p-live">Spots open</span></div>
    <div class="p-title">${esc(p.title)}</div>
    <div class="p-foot"><span>${esc(p.when)}</span><span>${esc(p.city)}</span></div>
  </div>`;

export function renderAbout(guest: boolean): string {
  const createHref = '/create';
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const claimHref = guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  const wallRow = (arr: Poster[], cls: string) => `<div class="wrow ${cls}">${(arr.concat(arr)).map((p, i) => posterCard(p, i)).join('')}</div>`;
  const half = Math.ceil(POSTERS.length / 2);
  const body = `
    <section class="ahero">
      <div class="kick">The events home for competitive sport</div>
      <h1 class="big">Every match. Every fight.<br>Every race. <em>One place.</em></h1>
      <p class="lead">Create the event, sell it out, scan them in at the door, and see exactly who brought the crowd. The events platform built for competitive sport — not another generic ticket link.</p>
      <div class="ctarow"><a class="btn acc lg" href="${createHref}">Create an event →</a><a class="btn ghost lg" href="/">Find an event</a></div>
    </section>

    <div class="wallcap">Built for the ones who actually show up</div>
    <section class="wall" aria-label="Events on Horda">
      ${wallRow(POSTERS.slice(0, half), 'a')}
      ${wallRow(POSTERS.slice(half), 'b')}
    </section>

    <h2 class="sec" id="audiences">One platform, four ways in</h2>

    <div class="beat">
      <div class="beat-txt">
        <div class="who">Organisers</div>
        <h3>Fill the room — and know who filled it.</h3>
        <p>Build a beautiful event page in a minute. Free or paid spots, co-organisers, and a QR scan at the door. Afterwards you see which club, athlete and link drove every claim.</p>
        <a class="btn acc" href="${createHref}">Create an event →</a>
      </div>
      <div class="beat-vis">
        <div class="mk mk-manage">
          <div class="mk-h">Kreuzberg vs. Wedding United</div>
          <div class="mk-row"><span>142 going</span><span>3 doors</span></div>
          <div class="mk-bar"><i style="width:78%"></i></div>
          <div class="mk-scan">◲ Scan tickets at the gate</div>
        </div>
      </div>
    </div>

    <div class="beat rev">
      <div class="beat-txt">
        <div class="who">Athletes</div>
        <h3>Turn a following into a draw you can prove.</h3>
        <p>Your link makes your pull a fact, not a guess — the fans and spots you personally brought to the night. Hard proof when you negotiate, and a reason to promote here, not just on the feed.</p>
        <a class="btn acc" href="${athleteHref}">Create your page →</a>
      </div>
      <div class="beat-vis">
        <div class="mk mk-athlete">
          <div class="mk-av"></div>
          <div class="mk-name">Rico Vasquez</div>
          <div class="mk-handle">@rico · Boxing</div>
          <div class="mk-chip">brought 312 to the door</div>
        </div>
      </div>
    </div>

    <div class="beat">
      <div class="beat-txt">
        <div class="who">Clubs &amp; federations</div>
        <h3>Bring both fanbases — and pull your rivals in.</h3>
        <p>List the away side before they’re even on Horda. They join to claim their side, their fans and their ticket share. Run a whole season — it rolls up the pyramid from federation to club to athlete.</p>
        <a class="btn acc" href="${claimHref}">Claim your club →</a>
      </div>
      <div class="beat-vis">
        <div class="mk mk-versus">
          <div class="mk-side"><div class="mk-crest">FCK</div><span>Kreuzberg</span></div>
          <div class="mk-vs">VS</div>
          <div class="mk-side"><div class="mk-crest b">WU</div><span>Wedding Utd</span></div>
        </div>
      </div>
    </div>

    <div class="beat rev">
      <div class="beat-txt">
        <div class="who">Fans</div>
        <h3>Claim your spot. Show up. Keep the proof.</h3>
        <p>Grab a spot with just your email — no password wall. Get a QR pass, show it at the door, and it lands on your Record: the real log of where you showed up, not what you streamed.</p>
        <a class="btn" href="/">Find an event →</a>
      </div>
      <div class="beat-vis">
        <div class="mk mk-pass">
          <div class="mk-qr"></div>
          <div class="mk-passt">Your spot is ready</div>
          <div class="mk-stamp">I WAS THERE</div>
        </div>
      </div>
    </div>

    <h2 class="sec">Everything you need — before, during & after</h2>
    <div class="ftiles">
      <div class="ftile"><div class="fi">✦</div><h4>Beautiful event pages</h4><p>Bold, on-brand pages built for sharing and selling out.</p></div>
      <div class="ftile"><div class="fi">◎</div><h4>Free or paid spots</h4><p>Set a price or keep it free. A flat, fair fee on paid — nothing on free.</p></div>
      <div class="ftile"><div class="fi">◲</div><h4>Scan at the door</h4><p>QR check-in from your phone. Skip the clipboard, know who came.</p></div>
      <div class="ftile"><div class="fi">⚔</div><h4>Two sides, one event</h4><p>Versus events, co-organisers and rivals — both crowds in one place.</p></div>
      <div class="ftile"><div class="fi">↗</div><h4>Share &amp; attribution</h4><p>Per-person links show exactly who drove which claims.</p></div>
      <div class="ftile"><div class="fi">⤶</div><h4>Edit, cancel, notify</h4><p>Change plans and everyone holding a spot hears about it instantly.</p></div>
    </div>

    <div class="signoff">
      <h2>See you at the gate.</h2>
      <a class="btn lg" href="${createHref}">Create an event →</a>
    </div>`;
  return aboutShell('about', guest, 'The events home for competitive sport', body, `
    <link href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800;900&display=swap" rel="stylesheet"><style>
    .ahero{padding:74px 0 44px;text-align:center}
    .ahero .kick{color:var(--acc)}
    .ahero .big{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:96px;line-height:.86;letter-spacing:-.01em;text-transform:uppercase;margin:16px auto 20px;max-width:16ch}
    .ahero .big em{font-style:normal;color:var(--acc)}
    .ahero .lead{margin:0 auto;font-size:19px;max-width:52ch}
    .ahero .ctarow{justify-content:center}
    .btn.lg{padding:13px 26px;font-size:15.5px}
    @media(max-width:760px){.ahero{padding:44px 0 30px}.ahero .big{font-size:46px}.ahero .lead{font-size:16px}}
    /* poster wall */
    .wallcap{text-align:center;color:var(--mut);font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;margin:26px 0 14px}
    .wall{margin:0 -22px 8px;overflow:hidden;display:grid;gap:16px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
    .wrow{display:flex;gap:16px;width:max-content;animation:scrollx 46s linear infinite}
    .wrow.b{animation-duration:60s;animation-direction:reverse}
    .wall:hover .wrow{animation-play-state:paused}
    @keyframes scrollx{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media(prefers-reduced-motion:reduce){.wrow{animation:none}}
    .poster{flex:0 0 auto;width:230px;height:150px;border-radius:16px;border:1px solid var(--b);background:linear-gradient(150deg,var(--s),var(--ink));padding:15px 16px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
    .poster::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 100% 0%,rgba(225,90,64,.22),transparent 60%);pointer-events:none}
    .poster.t1::before{background:radial-gradient(120% 90% at 0% 100%,rgba(225,90,64,.16),transparent 60%)}
    .poster.t2::before{background:radial-gradient(120% 90% at 100% 100%,rgba(237,233,223,.08),transparent 60%)}
    .poster.t3::before{background:radial-gradient(120% 90% at 0% 0%,rgba(225,90,64,.14),transparent 60%)}
    .p-top{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
    .p-sport{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}
    .p-live{font-size:10px;font-weight:700;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:2px 8px}
    .p-title{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:22px;line-height:1.02;letter-spacing:.01em;color:var(--bone);position:relative;z-index:1}
    .p-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);position:relative;z-index:1}
    /* audience beats */
    .beat{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;padding:40px 0;border-top:1px solid var(--b)}
    .beat.rev .beat-txt{order:2}
    .beat .who{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--acc);margin-bottom:8px}
    .beat h3{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:38px;line-height:1.02;letter-spacing:.01em;margin:0 0 12px;text-transform:uppercase}
    .beat p{color:var(--mut);font-size:15.5px;line-height:1.6;max-width:46ch;margin:0 0 18px}
    @media(max-width:760px){.beat{grid-template-columns:1fr;gap:20px;padding:30px 0}.beat.rev .beat-txt{order:0}.beat h3{font-size:30px}}
    .beat-vis{display:flex;justify-content:center}
    .mk{width:100%;max-width:340px;border:1px solid var(--b);border-radius:20px;background:linear-gradient(160deg,var(--s),var(--ink));padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
    .mk-manage .mk-h{font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:22px;color:var(--bone);margin-bottom:12px}
    .mk-manage .mk-row{display:flex;justify-content:space-between;color:var(--mut);font-size:13px;margin-bottom:10px}
    .mk-bar{height:8px;border-radius:999px;background:var(--ink);border:1px solid var(--b);overflow:hidden;margin-bottom:16px}
    .mk-bar i{display:block;height:100%;background:var(--acc)}
    .mk-scan{text-align:center;background:var(--acc);color:var(--accink,#fff);font-weight:700;font-size:13.5px;border-radius:12px;padding:11px}
    .mk-athlete{text-align:center}
    .mk-av{width:76px;height:76px;border-radius:50%;margin:4px auto 12px;background:conic-gradient(from 210deg,var(--acc),#f0a58f,var(--acc));box-shadow:0 0 0 3px var(--ink),0 0 0 5px var(--acc)}
    .mk-name{font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:24px;color:var(--bone)}
    .mk-handle{color:var(--mut);font-size:13px;margin:2px 0 14px}
    .mk-chip{display:inline-block;background:rgba(225,90,64,.14);color:var(--acc);border:1px solid rgba(225,90,64,.4);font-weight:700;font-size:13px;border-radius:999px;padding:7px 14px}
    .mk-versus{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .mk-side{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;color:var(--bone);font-size:13px;font-weight:600}
    .mk-crest{width:58px;height:58px;border-radius:14px;background:var(--acc);color:var(--accink,#fff);display:flex;align-items:center;justify-content:center;font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:18px}
    .mk-crest.b{background:var(--bone);color:var(--ink)}
    .mk-vs{font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:22px;color:var(--mut)}
    .mk-pass{text-align:center}
    .mk-qr{width:110px;height:110px;margin:0 auto 14px;border-radius:12px;background:repeating-conic-gradient(var(--bone) 0 25%,var(--ink) 0 50%) 0 0/22px 22px,var(--bone);border:6px solid var(--bone)}
    .mk-passt{color:var(--bone);font-weight:700;font-size:14px;margin-bottom:10px}
    .mk-stamp{display:inline-block;color:var(--acc);border:2px solid var(--acc);border-radius:8px;font-weight:900;letter-spacing:.16em;font-size:13px;padding:5px 12px;transform:rotate(-5deg)}
    /* feature grid */
    .ftiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:6px}
    @media(max-width:760px){.ftiles{grid-template-columns:1fr}}
    .ftile{border:1px solid var(--b);border-radius:18px;background:var(--s);padding:22px 20px;transition:border-color .15s}
    .ftile:hover{border-color:var(--acc)}
    .ftile .fi{width:40px;height:40px;border-radius:11px;background:rgba(225,90,64,.14);color:var(--acc);display:flex;align-items:center;justify-content:center;font-size:19px;margin-bottom:12px}
    .ftile h4{font-size:16.5px;font-weight:800;margin:0 0 6px}
    .ftile p{color:var(--mut);font-size:14px;line-height:1.5;margin:0}
    /* sign-off */
    .signoff{text-align:center;margin:64px 0 20px;padding:56px 24px;border-radius:26px;background:linear-gradient(160deg,var(--acc),#c0442e)}
    .signoff h2{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:56px;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:var(--accink,#fff);margin:0 0 22px}
    .signoff .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
    @media(max-width:760px){.signoff h2{font-size:38px}}
    </style>`);
}

// Shared display treatment for the About sub-pages — the same heavy condensed
// (Saira) uppercase headlines + ember accent as the reworked main /about, so the
// whole marketing site reads as one thing.
const SUBPAGE_HEAD = `<link href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800;900&display=swap" rel="stylesheet"><style>
  .phero{padding:64px 0 26px}
  .phero .hl{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:62px;line-height:.9;letter-spacing:-.01em;text-transform:uppercase;max-width:20ch}
  .phero .hl em{font-style:normal;color:var(--acc)}
  h2.sec{font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:22px;letter-spacing:.02em;color:var(--bone);text-transform:uppercase}
  .pcard h3{font-family:'Saira Condensed',Inter,sans-serif;font-weight:800;font-size:27px;letter-spacing:.01em;text-transform:uppercase;line-height:1.02}
  .closeb h3{font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.01em}
  @media(max-width:760px){.phero .hl{font-size:40px}}
</style>`;

// /about/creators — who it's for, each with an outcome + a concrete example.
export function renderAboutCreators(guest: boolean): string {
  const createHref = '/create';
  const claimHref = guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const body = `
    <section class="phero">
      <div class="kick">Who it’s for</div>
      <h1 class="hl">Everyone who makes<br>the <em>event happen.</em></h1>
      <p class="lead">Organisers sell the tickets, athletes bring the fans, federations connect the pyramid — and fans get proof they were there. Each side gets the reach it drove.</p>
    </section>

    <h2 class="sec" id="organisers">Event organisers</h2>
    <div class="pcard"><h3>Sell out the night — and see who filled the seats.</h3><p>Create a match, a fight night or a run club in a minute. Issue free or paid tickets, scan people in at the door, and invite co‑organisers and the rival side. Afterwards you see the breakdown: which club, which athlete, which link drove the tickets. <b style="color:var(--bone)">The outcome:</b> a full house you can explain — you know who brought them, not just how many turned up.</p><a class="btn acc" href="${createHref}">Create an event →</a> <a class="btn ghost" href="${claimHref}">Claim an organiser page</a></div>

    <h2 class="sec" id="athletes">Athletes</h2>
    <div class="pcard"><h3>Turn your Instagram share into a measured, paid channel.</h3><p>Athletes, coaches, sports influencers — anyone with a following. Today you promote an event by posting to socials, unmeasured and unpaid. On Horda your roster link makes your draw countable: <b style="color:var(--bone)">“Rico drove 312 fans and 140 ticket buyers to this fight.”</b> <b style="color:var(--bone)">The outcome:</b> hard proof of your draw when you negotiate an appearance fee — and a reason to promote here, not just on Instagram.</p><a class="btn acc" href="${athleteHref}">Create your page →</a></div>

    <h2 class="sec" id="clubs">Clubs &amp; federations</h2>
    <div class="pcard"><h3>Fill the stands, pull your rivals in, run a whole season.</h3><p>List the away side even before they’re on Horda — they join to claim their side, their fans and their ticket share (a growth loop generic ticketing can’t have). Federations sanction leagues, clubs field teams, athletes compete, and it all connects: promotion cascades and attribution rolls up the whole pyramid. <b style="color:var(--bone)">The outcome:</b> both fanbases in the building and your rivals onboarded — season after season.</p><a class="btn acc" href="${claimHref}">Claim your club or federation →</a></div>

    <h2 class="sec" id="fans">Fans</h2>
    <div class="pcard"><h3>Prove you were actually there.</h3><p>Claim a spot with just your email — no password wall. Get a QR ticket, show it at the door, and your presence is stamped onto your <b style="color:var(--bone)">Record</b> — a passport of where you really showed up, not what you streamed. <b style="color:var(--bone)">The outcome:</b> proof you were in the room, and an “I was there” card that pulls your friends into the next one.</p><a class="btn" href="/">Find an event →</a></div>

    <div class="closeb"><h3>Run your next event where the reach is measured.</h3><a class="btn" href="${createHref}">Create an event →</a></div>`;
  return aboutShell('creators', guest, 'Who it’s for', body, SUBPAGE_HEAD);
}

// /about/features — what you can do, outcome-led, with a worked walkthrough.
export function renderAboutFeatures(guest: boolean): string {
  const createHref = '/create';
  const body = `
    <section class="phero">
      <div class="kick">What you can do</div>
      <h1 class="hl">Sell tickets. Scan<br>them in. <em>See who drove them.</em></h1>
      <p class="lead">The full loop for competitive sport — free or paid tickets, QR check‑in, verified presence — plus the thing generic ticketing can’t do: per‑participant attribution, so you know exactly who brought whom.</p>
    </section>

    <h2 class="sec">What you can do</h2>
    <div class="grid">${FEATURES.map(f => `<div class="card"><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></div>`).join('')}</div>

    <h2 class="sec">A fight night, end to end</h2>
    <p class="secsub">One concrete run‑through — the same model handles a Kreisliga cup or a run club.</p>
    <div class="steps">
      <div class="step"><span class="n">1</span><p><b>Create the night</b> and add the card — ten bouts, each its own two sides. Every fighter gets a ready‑to‑share promo link automatically.</p></div>
      <div class="step"><span class="n">2</span><p><b>List the rivals</b> who aren’t on Horda yet. They join to claim their side, their fans and their ticket share — the event pulls them in.</p></div>
      <div class="step"><span class="n">3</span><p><b>Sell one ticket to the night</b> — free or paid. A fighter shares his bout; the sale rolls up to the parent event and is credited to him.</p></div>
      <div class="step"><span class="n">4</span><p><b>Scan tickets at the door.</b> Verified presence is stamped on each fan’s identity — you know exactly who showed up.</p></div>
      <div class="step"><span class="n">5</span><p><b>Read the reach.</b> Your share panel shows every participant’s draw — fans and ticket buyers — rolled up across all ten bouts.</p></div>
    </div>

    <div class="closeb"><h3>See who drove your next sell‑out.</h3><a class="btn" href="${createHref}">Create an event →</a></div>`;
  return aboutShell('features', guest, 'What you can do', body, SUBPAGE_HEAD);
}

// /about/pricing — ticketing-led. Free events free; paid tickets a flat 10%.
export function renderAboutPricing(guest: boolean): string {
  const createHref = '/create';
  const free = getPlan('free');
  const plus = getPlan('plus');
  const cur = (n: number) => `€${n}`;
  const feeLabel = (p: Plan) => p.entitlements.includes('zero_fee')
    ? '0% platform fee' : `${p.feePct}% platform fee on paid tickets`;
  // Everything on the pricing page is rendered from pricing.ts — change a price,
  // a fee or an entitlement there (or via env) and this page follows.
  const planCard = (p: Plan): string => {
    const isFree = p.priceMonthly === 0;
    const priceBlock = isFree
      ? `<div class="pr"><span class="amt">€0</span><span class="per">free, forever</span></div>`
      : `<div class="pr">
           <span class="amt mo">${cur(p.priceMonthly)}<span class="per">/mo</span></span>
           <span class="amt yr">${cur(p.priceAnnual)}<span class="per">/mo · billed annually</span></span>
         </div>`;
    // Plus leads with what's NEW vs Free (Luma-style "Everything in Free, plus:").
    const shown = isFree ? p.entitlements : p.entitlements.filter(e => !free.entitlements.includes(e));
    const lead = isFree ? '' : `<li class="lead">Everything in ${free.name}, plus:</li>`;
    const feats = shown.map(e => `<li>${ENTITLEMENT_LABEL[e]}</li>`).join('');
    let cta: string;
    if (!p.live) {
      cta = `<div class="soon">Coming soon</div><a class="btn ghost sm" href="/about/features">See what's included</a>`;
    } else if (isFree) {
      cta = `<a class="btn sm" href="${createHref}">Get started</a>`;
    } else {
      // Live Plus: subscribe with the interval the toggle is showing (mo/yr swap via CSS).
      cta = `<form method="post" action="/plus/subscribe" style="margin:0">
        <button class="btn acc sm mo" name="interval" value="monthly">Get ${esc(p.name)}</button>
        <button class="btn acc sm yr" name="interval" value="annual">Get ${esc(p.name)}</button>
      </form>`;
    }
    const save = !isFree && annualSavingPct(p) > 0 ? `<span class="save yr">Save ${annualSavingPct(p)}%</span>` : '';
    return `<div class="plan${p.featured ? ' feat' : ''}">
      <div class="phead"><div class="pnm">${esc(p.name)}${p.featured ? '<span class="tagp">Most for serious organisers</span>' : ''}</div>${save}</div>
      ${priceBlock}
      <div class="fee">${feeLabel(p)}</div>
      <p class="pblurb">${esc(p.blurb)}</p>
      ${cta}
      <ul class="pfeat">${lead}${feats}</ul>
    </div>`;
  };
  const body = `
    <section class="phero">
      <div class="kick">Pricing</div>
      <h1 class="hl">Free forever. Pay only when it pays off.</h1>
      <p class="lead">Run unlimited events and sell tickets on the Free plan — a flat ${free.feePct}% on paid tickets, nothing on free ones. Go Plus to drop the fee to 0% and unlock scale tools.</p>
    </section>

    <input type="checkbox" id="billtoggle" class="billtoggle">
    <div class="billrow">
      <label for="billtoggle" class="billlab"><span class="bm">Monthly</span><span class="bt" aria-hidden="true"></span><span class="by">Annual</span></label>
    </div>

    <div class="plans">
      ${PLANS.map(planCard).join('')}
    </div>
    <p class="finenote">Stripe's card fee (typically 2.9% + €0.25) applies on paid tickets and is separate from Horda's platform fee. No fee on free events.</p>

    <h2 class="sec">Fair by design</h2>
    <div class="trust">
      <div class="card"><h3>Gate money, not creation</h3><p>Running and filling an event is always free. A fee only ever applies where cash actually moves.</p></div>
      <div class="card"><h3>Web-first payouts</h3><p>Connect a Stripe account, money lands in your bank. We never route through app-store fees.</p></div>
      <div class="card"><h3>You own your crowd</h3><p>The fans and reach you build are yours — measured, exportable, never rented from an algorithm.</p></div>
    </div>

    <div class="entcard">
      <div><h3>Running a federation or a whole season?</h3><p>Custom email domain, SSO, multiple calendars and season-wide tooling for clubs and governing bodies.</p></div>
      <a class="btn ghost" href="mailto:hello@joinhorda.com?subject=Horda%20for%20clubs%20%26%20federations">Talk to us</a>
    </div>

    <div class="closeb"><h3>Start free. Upgrade when the tickets are flowing.</h3><a class="btn" href="${createHref}">Create an event →</a></div>`;
  return aboutShell('pricing', guest, 'Pricing', body, `<style>
    .billrow{display:flex;justify-content:center;margin:8px 0 22px}
    .billtoggle{position:absolute;opacity:0;pointer-events:none}
    .billlab{display:inline-flex;align-items:center;gap:12px;cursor:pointer;font-weight:700;font-size:14px;color:var(--mut);user-select:none}
    .billlab .bt{width:44px;height:26px;border-radius:999px;background:var(--s);border:1px solid var(--b);position:relative;transition:background .15s}
    .billlab .bt::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--bone);transition:transform .18s}
    .billtoggle:checked ~ .billrow .bt{background:var(--acc)}
    .billtoggle:checked ~ .billrow .bt::after{transform:translateX(18px)}
    .billtoggle:checked ~ .billrow .by{color:var(--bone)}
    .billlab .bm{color:var(--bone)}
    .billtoggle:checked ~ .billrow .bm{color:var(--mut)}
    /* toggle which price/label shows: monthly by default, annual when checked */
    .amt.yr,.save.yr,.btn.yr{display:none}
    .billtoggle:checked ~ .plans .amt.mo{display:none}
    .billtoggle:checked ~ .plans .amt.yr{display:inline-flex}
    .billtoggle:checked ~ .plans .save.yr{display:inline-block}
    .billtoggle:checked ~ .plans .btn.mo{display:none}
    .billtoggle:checked ~ .plans .btn.yr{display:inline-block}
    .plans{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:820px;margin:0 auto}
    @media(max-width:720px){.plans{grid-template-columns:1fr}}
    .plan{border:1px solid var(--b);border-radius:20px;background:var(--s);padding:26px 24px;display:flex;flex-direction:column}
    .plan.feat{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
    .phead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .pnm{font-weight:900;font-size:20px;letter-spacing:-.01em}
    .tagp{display:block;font-size:11px;font-weight:700;color:var(--acc);letter-spacing:.02em;margin-top:3px}
    .save{background:var(--acc);color:var(--accink,#fff);font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap}
    .pr{margin:14px 0 4px;min-height:44px}
    .pr .amt{display:inline-flex;font-family:'Saira Condensed',Inter,sans-serif;font-weight:900;font-size:44px;line-height:1;color:var(--bone);align-items:baseline;gap:2px}
    .pr .per{font-family:Inter,sans-serif;font-weight:500;font-size:13px;color:var(--mut);margin-left:6px}
    .fee{font-size:13.5px;font-weight:700;color:var(--acc);margin-bottom:8px}
    .pblurb{color:var(--mut);font-size:13.5px;line-height:1.5;margin:0 0 16px}
    .plan .soon{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:6px 12px;margin-bottom:10px}
    .plan .btn{align-self:flex-start}
    .pfeat{list-style:none;margin:18px 0 0;padding:16px 0 0;border-top:1px solid var(--b);display:grid;gap:9px}
    .pfeat li{position:relative;padding-left:24px;font-size:13.5px;color:var(--bone);line-height:1.4}
    .pfeat li::before{content:"✓";position:absolute;left:0;color:var(--acc);font-weight:800}
    .pfeat li.lead{padding-left:0;color:var(--mut);font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.04em}
    .pfeat li.lead::before{content:""}
    .finenote{text-align:center;color:var(--mut);font-size:12.5px;max-width:60ch;margin:16px auto 0}
    .entcard{display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid var(--b);border-radius:20px;background:var(--s);padding:24px 26px;margin-top:16px}
    .entcard h3{font-size:19px;font-weight:800;margin:0 0 4px}.entcard p{color:var(--mut);font-size:14px;line-height:1.5;margin:0;max-width:54ch}
    @media(max-width:640px){.entcard{flex-direction:column;align-items:flex-start}}
  </style>`);
}

// /about/embed — the how-to Q&A for putting your events widget on your own site.
export function renderAboutEmbed(guest: boolean): string {
  const qa: [string, string][] = [
    ['What is the events widget?', 'A small box you can put on your own website that shows your upcoming Horda events with live “Tickets →” links. Visitors click through to Horda to claim or buy. It always shows your latest events — you never have to update it by hand.'],
    ['Where do I get my embed code?', 'Open Horda, go to <b>Your events</b>, and next to the page you manage tap <b>Embed on your website</b>. You’ll get a one‑line <code>&lt;iframe&gt;</code> snippet, a live preview, and a Copy button.'],
    ['How do I add it to my website?', 'Paste the snippet into any HTML block on your site. In most website builders that’s an element called “Embed”, “HTML”, or “Custom code”. WordPress: add a <b>Custom HTML</b> block. Wix: <b>Embed &rarr; Embed HTML</b>. Squarespace: a <b>Code</b> block. Webflow: an <b>Embed</b> element. Then publish.'],
    ['Will it stay up to date?', 'Yes. The widget reads your events live from Horda, so when you add, edit, cancel or sell out an event, your website reflects it automatically — no re‑pasting.'],
    ['Can I change the size?', 'Yes — edit the <code>width</code> and <code>height</code> in the snippet. It’s responsive and caps at a tidy width, so it fits a sidebar or a full column.'],
    ['Is anything private exposed?', 'No. The widget is public and read‑only. It shows only what’s already public — your events and their ticket links. Nothing about your account, your attendees, or your revenue is in it.'],
    ['Can athletes and federations embed too?', 'Yes. Any page you manage — an athlete page, a club, a team or a federation — has its own embed code with that page’s events.'],
  ];
  const body = `
    <section class="phero">
      <div class="kick">Embed on your website</div>
      <h1 class="hl">Put your events on your own site.</h1>
      <p class="lead">Show every event and ticket you’re selling right on your website — one paste, always up to date. Here’s how.</p>
    </section>
    <h2 class="sec">Questions &amp; answers</h2>
    <div class="grid" style="grid-template-columns:1fr">${qa.map(([q, a]) => `<div class="card"><h3>${q}</h3><p>${a}</p></div>`).join('')}</div>
    <div class="closeb"><h3>Get your embed code from “Your events”.</h3><a class="btn" href="/create">Create an event →</a></div>`;
  return aboutShell('embed', guest, 'Embed on your website', body);
}

// /changelog — built in the open. Shipping velocity is the pitch: a founder-led
// product that visibly ships weekly, credits the people who asked, and states
// what's next BEFORE it exists. Reads from src/content/changelog.ts so the log
// is edited as copy, not as code.
const TAG_LABEL: Record<string, string> = { new: 'New', better: 'Better', fixed: 'Fixed' };

// "2026-07-16" → "16 Jul". Hand-rolled: no locale dependency, no surprises.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const mi = Number(m) - 1;
  if (!y || !d || mi < 0 || mi > 11) return iso;   // malformed entry → show it raw rather than lie
  return `${Number(d)} ${MONTHS[mi]}`;
}
// Group shipped entries by date so a day of shipping reads as one push.
function groupByDate(entries: typeof SHIPPED): [string, typeof SHIPPED][] {
  const out: [string, typeof SHIPPED][] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last[0] === e.date) last[1].push(e);
    else out.push([e.date, [e]]);
  }
  return out;
}

export function renderChangelog(guest: boolean): string {
  const credit = (asked?: string) =>
    asked ? `<div class="cred">Asked for by <b>@${esc(asked)}</b> in Discord.</div>` : '';

  // data-status marks these as promises, not shipped work. Without it, a parser
  // seeing a page of headlines has no way to tell "we built this" from "we said
  // we would" — and publishing the second as the first is the exact trust
  // failure this page exists to avoid.
  const building = BUILDING.map(b => `
    <article class="bldi" data-status="building">
      <h4>${esc(b.title)}${b.eta ? `<span class="eta">${esc(b.eta)}</span>` : ''}</h4>
      <p>${esc(b.body)}</p>
      ${credit(b.asked)}
    </article>`).join('');

  // EVERY entry carries its own machine-readable date, even when the human sees
  // it once per day.
  //
  // This used to be `i === 0 ? shortDate(date) : ''` — the date printed on the
  // first entry of a day and left EMPTY on the rest, because to a reader it's
  // obviously the same day. To anything parsing the page it wasn't obvious at
  // all: most entries had no date, and the ones that did said "17 Jul" with no
  // year. <time datetime="2026-07-17"> gives the machine the full ISO date on
  // every entry while the human still sees the grouped "17 Jul" — same layout,
  // no lost data. `visibility:hidden` rather than omission: it holds its space
  // so the grid doesn't shift, and it stays in the DOM to be read.
  const shipped = groupByDate(SHIPPED).map(([date, entries]) => entries.map((e, i) => `
    <article class="cle" id="${esc(entryId(e))}">
      <div class="when"><time datetime="${esc(date)}"${i === 0 ? '' : ' style="visibility:hidden"'}>${esc(shortDate(date))}</time></div>
      <div>
        <span class="tg ${e.tag}" data-tag="${esc(e.tag)}">${TAG_LABEL[e.tag] ?? esc(e.tag)}</span>
        <h4>${esc(e.title)}</h4>
        <p>${esc(e.body)}</p>
        ${credit(e.asked)}
      </div>
    </article>`).join('')).join('');

  // The "ask" block degrades gracefully: with Discord configured it points there;
  // without it, it still lets people ask via the existing feature-request form.
  const ask = hasDiscord()
    ? `<div id="ask">${discordModule()}</div>`
    : `<div id="ask" class="pcard"><h3>Tell us what to build.</h3><p>Horda is built in the open. If something is missing, say so — the things on this page mostly exist because someone asked.</p><a class="btn" href="/about">About Horda →</a></div>`;

  const body = `
    <section class="phero clhead">
      <div class="kick">Built in the open</div>
      <h1 class="hl">What we shipped. What we’re building.</h1>
      <p class="lead">We build Horda in public, one week at a time. Everything below is live right now — and everything under “now building” is a promise we made before we kept it. If you want something on this page, ${hasDiscord() ? 'ask in our Discord' : 'tell us'}; when we build it, your name goes on the entry.</p>
      <div class="ctarow">${discordBtn('Ask for a feature', 'btn')}<a class="btn ghost" href="#shipped">See what shipped</a></div>
    </section>

    <h2 class="sec" id="building">Now building</h2>
    <p class="secsub">Not live yet. Listed here so you can hold us to it.</p>
    <div class="bld">${building}</div>

    <h2 class="sec" id="shipped">Shipped</h2>
    <p class="secsub">Newest first. All of it is live on joinhorda.com today.</p>
    <div class="cl">${shipped}</div>

    ${ask}`;
  // Autodiscovery: the standard way a feed reader, a Slack unfurler or an agent
  // finds the machine version of a page it was pointed at.
  const head = `
<link rel="alternate" type="application/rss+xml" title="Horda — changelog" href="/feed.xml">
<link rel="alternate" type="application/feed+json" title="Horda — changelog" href="/changelog.json">
<link rel="alternate" type="text/markdown" title="Horda — changelog (markdown)" href="/changelog.md">`;
  return aboutShell('changelog', guest, 'Changelog', body, head);
}
