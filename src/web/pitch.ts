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
