// pitch.ts — creator-facing benefit pages (/athletes, /clubs). Outcome-led,
// on-brand, ending at the creator doorway. Patreon-style "what you get".
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';
import { SHIPPED, BUILDING } from '../content/changelog.ts';
import { entryId } from './feeds.ts';
import { discordModule, discordFootLink, discordBtn, hasDiscord, DSC_CSS } from './community.ts';

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
  { t: 'Sell tickets — free or paid', d: 'Free tickets are one tap, tied to a real identity, no signup wall. Charge when you want: card payments via Stripe, money in your account, Horda keeps a flat 10%.' },
  { t: 'Know who actually showed up', d: 'Every ticket carries a QR. Scan people in at the door and verified attendance is stamped on their identity — not who clicked “interested”, who was really there.' },
  { t: 'Drag your rival onto the platform', d: 'A match has two sides. List the rival club even before they join — they join Horda to claim their side, their fans and their share of the tickets. A growth loop generic ticketing can’t have.' },
  { t: 'Fight cards that roll up', d: 'Nest bouts or races inside one event. Each fighter shares their bout; the sale rolls up to the night. Many small rivalries, all pulling fans into one big event.' },
  { t: 'A record of real presence', d: 'Checked‑in fans get an “I was there” stamp — a passport of where they actually showed up, and a shareable card that pulls the next fan in.' },
];

type AboutPage = 'about' | 'creators' | 'features' | 'pricing' | 'changelog';
const NAV: { key: AboutPage; label: string; href: string; dd: [string, string][] }[] = [
  { key: 'creators', label: 'Who it’s for', href: '/about/creators', dd: [['Event organisers', '/about/creators#organisers'], ['Athletes', '/about/creators#athletes'], ['Clubs & federations', '/about/creators#clubs'], ['Fans', '/about/creators#fans']] },
  { key: 'features', label: 'What you can do', href: '/about/features', dd: [['See who drove your tickets', '/about/features'], ['Free & paid tickets', '/about/features'], ['QR check‑in', '/about/features'], ['Two‑sided events', '/about/features'], ['Fight cards & sub‑events', '/about/features'], ['Verified presence', '/about/features']] },
  { key: 'pricing', label: 'Pricing', href: '/about/pricing', dd: [['Free events — free', '/about/pricing'], ['Paid tickets — flat 10%', '/about/pricing'], ['Attribution — always free', '/about/pricing']] },
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
  .mnav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:13px 22px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:30}
  .mnav .mark{display:flex;align-items:center;gap:9px;justify-self:center;color:var(--bone)}.mnav .mark svg{display:block}
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
  <header class="mnav">
    <nav class="links">${NAV.map(navItem).join('')}</nav>
    <a class="mark" href="/" aria-label="Horda — home">${ravenMarkCurrent(26)}<b>Horda</b></a>
    <div class="right">${guest ? `<a class="btn ghost sm" href="/login">Log in</a>` : ''}<a class="btn sm" href="${createHref}">Create an event</a></div>
  </header>
  <div class="wrap">${body}</div>
  <div class="foot"><div class="fl"><a href="/about/creators">Who it’s for</a><a href="/about/features">Features</a><a href="/about/pricing">Pricing</a><a href="/about">Overview</a><a href="/changelog">Changelog</a>${discordFootLink()}<a href="/agb">AGB</a><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></div>The events home for sports and competitive culture. joinhorda.com</div>
</body></html>`;
}

// MAIN /about — a conversion page built around the four audiences. Each audience
// card leads with the OUTCOME Horda drives for them, then the CTA into their path.
export function renderAbout(guest: boolean): string {
  const createHref = '/create';
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const claimHref = guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  const body = `
    <section class="bighero">
      <div class="kick">The events home for competitive sport</div>
      <h1 class="hl">The event sells the tickets. Horda shows who drove them.</h1>
      <p class="lead">Run your match, fight night, race or run club — free or paid tickets, QR check‑in, verified presence — and see exactly which club, athlete and fan brought the crowd. Generic ticketing can’t tell you who brought whom. That’s the whole point of Horda.</p>
      <div class="ctarow"><a class="btn acc" href="${createHref}">Create an event →</a><a class="btn ghost" href="#audiences">Find your outcome</a></div>
    </section>

    <h2 class="sec" id="audiences">What Horda does for you</h2>
    <p class="secsub">Pick who you are. Every one of them walks away with something they couldn’t get before.</p>
    <div class="aud">
      <div class="audcard">
        <div class="who">Event organisers</div>
        <div class="out">Sell out the night — and see who filled every seat.</div>
        <p>Create an event in a minute, issue free or paid tickets, invite co‑organisers, and scan people in at the door. Afterwards the share panel breaks down exactly which club, athlete and link drove the sales.</p>
        <div class="metric"><span>Tickets sold</span><span>Who drove them</span><span>Who showed up</span></div>
        <div class="cta"><a class="btn acc" href="${createHref}">Create an event →</a></div>
      </div>
      <div class="audcard">
        <div class="who">Athletes</div>
        <div class="out">Turn your following into countable, paid reach.</div>
        <p>Your roster link makes your draw a number, not a guess — “Rico drove 312 fans and 140 ticket buyers to this fight.” That’s hard proof of your pull when you negotiate an appearance fee, and the reason to promote here, not just on Instagram.</p>
        <div class="metric"><span>Fans driven</span><span>Ticket buyers</span><span>Proof of draw</span></div>
        <div class="cta"><a class="btn acc" href="${athleteHref}">Create your page →</a></div>
      </div>
      <div class="audcard">
        <div class="who">Clubs &amp; federations</div>
        <div class="out">Fill the stands, and pull your rivals in with you.</div>
        <p>List the away side before they’re even on Horda — they join to claim their side, their fans and their ticket share. Run a whole season of fixtures; attribution rolls up the pyramid from federation to club to athlete.</p>
        <div class="metric"><span>Both fanbases</span><span>Season‑wide</span><span>Rivals onboarded</span></div>
        <div class="cta"><a class="btn acc" href="${claimHref}">Claim your club →</a></div>
      </div>
      <div class="audcard">
        <div class="who">Fans</div>
        <div class="out">Prove you were actually there.</div>
        <p>Claim a spot with just your email — no password wall. Get a QR ticket, show it at the door, and your presence is stamped onto your Record: a passport of where you really showed up, not what you streamed.</p>
        <div class="metric"><span>QR ticket</span><span>Verified presence</span><span>Your Record</span></div>
        <div class="cta"><a class="btn" href="/">Find an event →</a></div>
      </div>
    </div>

    <h2 class="sec">How it works, in one match</h2>
    <div class="pcard">
      <h3>FC Kreuzberg vs. FC Rival — Regionalliga‑Pokal.</h3>
      <p>Kreuzberg creates the match and lists FC Rival as the away side — <b style="color:var(--bone)">even though Rival isn’t on Horda yet</b>. The event goes live; both fanbases can claim tickets. To claim their side, their fans and their share of the tickets, <b style="color:var(--bone)">Rival joins Horda</b> — the event drags the rival club, and its fanbase, onto the platform. On the day you scan tickets at the gate. Afterwards you see it in numbers: <b style="color:var(--bone)">Rival’s captain drove 210 fans and 88 ticket buyers</b>; Kreuzberg drove 341 and 150. Reach, measured — and, later, paid.</p>
      <a class="btn acc" href="${createHref}">Create an event →</a>
    </div>

    <div class="manifesto">
      <p class="ln">Every match has <b>two sides</b>. A tournament has <b>many</b>. Both bring their own fans.</p>
      <p class="ln">Today an athlete’s share is <b>unmeasured, unpaid</b>. Here it’s <b>counted</b> — and later, paid.</p>
      <p class="ln">Not who clicked “interested”. <b>Who actually showed up.</b></p>
    </div>

    <div class="closeb"><h3>Run your next event where the reach is measured.</h3><a class="btn" href="${createHref}">Create an event →</a></div>`;
  return aboutShell('about', guest, 'The events home for competitive sport', body);
}

// /about/creators — who it's for, each with an outcome + a concrete example.
export function renderAboutCreators(guest: boolean): string {
  const createHref = '/create';
  const claimHref = guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  const athleteHref = guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const body = `
    <section class="phero">
      <div class="kick">Who it’s for</div>
      <h1 class="hl">Everyone who makes the event happen.</h1>
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
  return aboutShell('creators', guest, 'Who it’s for', body);
}

// /about/features — what you can do, outcome-led, with a worked walkthrough.
export function renderAboutFeatures(guest: boolean): string {
  const createHref = '/create';
  const body = `
    <section class="phero">
      <div class="kick">What you can do</div>
      <h1 class="hl">Sell tickets. Scan them in. See who drove them.</h1>
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
  return aboutShell('features', guest, 'What you can do', body);
}

// /about/pricing — ticketing-led. Free events free; paid tickets a flat 10%.
export function renderAboutPricing(guest: boolean): string {
  const createHref = '/create';
  const body = `
    <section class="phero">
      <div class="kick">Pricing</div>
      <h1 class="hl">Free events are free. Paid tickets: a flat 10%.</h1>
      <p class="lead">No monthly fee, no lock‑in. We only make money when you sell a paid ticket — and the attribution that shows who drove your reach is always free.</p>
    </section>

    <h2 class="sec">What it costs</h2>
    <div class="tiers">
      <div class="tier"><div class="nm">Free events</div><div class="pr">€0 — always</div><ul><li>Unlimited free tickets</li><li>QR check‑in &amp; verified presence</li><li>Every participant’s promo link</li></ul><a class="btn ghost sm" href="${createHref}">Create an event</a></div>
      <div class="tier prem"><div class="nm">Paid tickets</div><div class="pr">Flat 10% per ticket sold</div><ul><li>Card payments via Stripe</li><li>Payouts to your own account</li><li>You keep 90% of every ticket</li></ul><a class="btn sm" href="${createHref}">Sell tickets</a></div>
      <div class="tier"><div class="nm">Attribution</div><div class="pr">Free — for everyone</div><ul><li>Per‑participant reach counts</li><li>Fans + ticket buyers driven</li><li>Roll‑ups across sub‑events</li></ul><a class="btn ghost sm" href="/about/features">How it works</a></div>
    </div>

    <h2 class="sec">Fair by design</h2>
    <div class="trust">
      <div class="card"><h3>Gate money, not creation</h3><p>Free actions stay frictionless. Verification only kicks in where cash actually moves.</p></div>
      <div class="card"><h3>Web‑first payouts</h3><p>Connect a Stripe account, money lands in your bank. We never route through app‑store fees.</p></div>
      <div class="card"><h3>You own your crowd</h3><p>The fans and reach you build are yours — measured, exportable, never rented from an algorithm.</p></div>
    </div>
    <p class="secsub" style="margin-top:18px">Appearance fees and ticket splits — paying an athlete for the reach they drove — are <b style="color:var(--bone)">coming next</b>. At launch, the reach is measured; the payments follow.</p>

    <div class="closeb"><h3>Start free. Sell tickets when you’re ready.</h3><a class="btn" href="${createHref}">Create an event →</a></div>`;
  return aboutShell('pricing', guest, 'Pricing', body);
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
