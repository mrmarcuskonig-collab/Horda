// terms.ts — AGB (Nutzungsbedingungen) + Widerrufsbelehrung.
//
// WHY THIS EXISTS NOW: you're selling tickets and taking a 10% cut, so this
// stops being optional. Three separate obligations land at once:
//   1. AGB — the contract for a UGC platform + a ticket marketplace.
//   2. Widerrufsbelehrung — consumer withdrawal information (§ 312d, Art. 246a
//      EGBGB). You MUST inform even where the right doesn't apply.
//   3. A clear statement of WHO the contract is with. This is the big one below.
//
// THE STRUCTURAL DECISION, spelled out because everything else follows from it:
// Furia is a PLATFORM (Vermittler), not the event organiser. The ticket contract
// is between the FAN and the ORGANISER. Furia provides the software and collects
// the money on the organiser's behalf via Stripe. If Furia were the seller, it
// would owe every consumer duty for every event on the platform — refunds for a
// cancelled Kreisliga match would be Furia's problem, not the club's. That's a
// different, much heavier company.
//
// THE ONE THAT SAVES THE MODEL: § 312g Abs. 2 Nr. 9 BGB exempts leisure services
// tied to a SPECIFIC DATE from the 14-day right of withdrawal, and the BGH
// confirmed this for online event tickets (BGH 13.07.2022, VIII ZR 317/21).
// Without it every ticket could be cancelled within 14 days and dated-event
// ticketing wouldn't work. The BGH also held that failing to inform about a
// non-existent withdrawal right does not create one — but we inform anyway,
// because the alternative is arguing about it.
//
// ONE OPEN QUESTION FOR THE LAWYER (do not paper over it):
//   The BGH case concerned a Vorverkaufsstelle. Whether the exemption extends to
//   a PLATFORM is on referral to the EuGH. If it doesn't, paid events need a real
//   withdrawal flow.
//
// THE SECOND QUESTION IS NOW CLOSED — by a product decision, not a legal answer.
// Secondary-market tickets are argued NOT to be covered by the § 312g exemption,
// which would have given a resale buyer a withdrawal right the primary buyer
// doesn't have. On 17 Jul 2026 Marcus decided Furia does not do resale at all
// (see src/db/transfer_repo.ts for the full reasoning). No secondary sale, so the
// question never arises. This is the cheapest way to answer a hard legal question:
// don't do the thing.
//
// NOT LEGAL ADVICE. Reviewed-by-a-lawyer is still outstanding.
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';
import { OPERATOR, LEGAL_UPDATED } from './legal.ts';

import { PLATFORM_FEE_PCT } from './pricing.ts';

/** Our cut on the Free plan — re-exported from the single pricing source
 *  (pricing.ts) so the AGB clause can never drift from what's actually charged.
 *  Change the number in pricing.ts (or the FURIA_PLATFORM_FEE_PCT env var), and
 *  the AGB, the pricing page and the live Stripe fee all move together. */
export const TAKE_RATE_PCT = PLATFORM_FEE_PCT;

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Furia</title>${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  ${THM_CSS}
  .lgtop{padding:18px 22px;border-bottom:1px solid var(--b)}
  .lgtop a{display:inline-flex;align-items:center;gap:9px;color:var(--bone);font-weight:800;letter-spacing:-.02em}
  .lgwrap{max-width:760px;margin:0 auto;padding:44px 22px 90px}
  .lgwrap h1{font-size:34px;font-weight:900;letter-spacing:-.02em;margin-bottom:8px}
  .lgwrap .upd{color:var(--mut);font-size:13px;margin-bottom:34px}
  .lgwrap h2{font-size:19px;font-weight:800;letter-spacing:-.01em;margin:34px 0 10px}
  .lgwrap h3{font-size:15.5px;font-weight:700;margin:18px 0 6px}
  .lgwrap p{color:var(--mut);font-size:14.5px;line-height:1.72;margin-bottom:12px}
  .lgwrap b{color:var(--bone);font-weight:600}
  .lgwrap a{color:var(--bone);border-bottom:1px solid var(--b)}
  .lgwrap ul{margin:0 0 12px 20px}
  .lgwrap li{color:var(--mut);font-size:14.5px;line-height:1.72;margin-bottom:5px}
  .box{border:1px solid var(--b);border-radius:14px;padding:18px 20px;background:var(--s);margin-bottom:12px}
  .box p:last-child{margin-bottom:0}
  .key{border-left:2px solid var(--acc);padding:2px 0 2px 16px;margin:16px 0}
  .lgfoot{border-top:1px solid var(--b);margin-top:44px;padding-top:20px;font-size:12.5px}
  .lgfoot a{margin-right:16px;color:var(--mut)}
</style></head><body>
  <div class="lgtop"><a href="/">${ravenMarkCurrent(24)} Furia</a></div>
  <div class="lgwrap">${body}
    <div class="lgfoot"><a href="/agb">Terms</a><a href="/widerruf">Withdrawal</a><a href="/impressum">Legal notice</a><a href="/datenschutz">Privacy</a><a href="/">Back to Furia</a></div>
  </div>
</body></html>`;
}

// --- /agb -------------------------------------------------------------------
export function renderTerms(): string {
  const body = `
    <h1>Terms of Service</h1>
    <p class="upd">Last updated: ${LEGAL_UPDATED} · Provider: ${esc(OPERATOR.name)}, ${esc(OPERATOR.street)}, ${esc(OPERATOR.city)}</p>

    <h2>1. Scope</h2>
    <p>These terms govern the use of the Furia platform (joinfuria.com), operated by ${esc(OPERATOR.name)} ("Furia", "we"). They apply both to consumers (§ 13 BGB) and to businesses (§ 14 BGB).</p>

    <h2>2. What Furia is — and is not</h2>
    <div class="key">
      <p><b>Furia is an intermediary platform, not the event organiser.</b> Through Furia, organisers (athletes, clubs, associations, private individuals) can create their own events and issue spots or tickets.</p>
      <p><b>The contract for taking part in an event is concluded exclusively between you and the respective organiser.</b> Furia is not a party to that contract. We provide the software and, for paid tickets, collect the price in the name of and on behalf of the organiser via our payment service provider.</p>
    </div>
    <p>The organiser alone is responsible for staging, content, cancellation, postponement and safety of an event. Claims arising from the cancellation or change of an event are directed against that person, not against Furia.</p>

    <h2>3. Account</h2>
    <p>An account is required in order to use the service. Sign-in is passwordless, by email link or one-time code. You are responsible for protecting your access and your email inbox. The information you provide must be accurate.</p>
    <p>For persons under 16 years of age, use is permitted only with the consent of a parent or guardian (Art. 8 DSGVO). For selling paid tickets and receiving payouts, a minimum age of 18 years is required; this follows from the terms of our payment service provider.</p>

    <h2>4. Spots and tickets</h2>
    <p>For each attendance type ("in person", "stream"), organisers set whether attendance is free or paid, how many spots are available and how many spots one person may claim. A spot is only deemed allocated once it has been confirmed to you in Furia.</p>
    <p><b>Tickets are identity-bound and non-transferable.</b> Entry is by a QR code that is checked on admission. There is no resale via Furia (see section 9).</p>
    <p>If an attendance type is fully booked, a waitlist may be offered. A place on the waitlist does not give rise to a right to attend.</p>

    <h2>5. Prices, payment and our fee</h2>
    <p>All prices are final prices in euros and include statutory VAT insofar as the organiser is liable for VAT. Payment is processed via <b>Stripe</b>. Payment data is not collected or stored by Furia.</p>
    <p>From every paid ticket sold, Furia retains a fee of <b>${TAKE_RATE_PCT}%</b> of the ticket price; the remaining amount is paid out to the organiser. No fee is charged for free events.</p>

    <h2>6. Cancellation, postponement, refunds</h2>
    <p>If an event is cancelled or substantially postponed, your claim to a refund is directed against the organiser. Furia supports the reversal technically via the payment service provider but does not itself owe the refund.</p>
    <p>Regarding your right of withdrawal — and its statutory exclusion for scheduled leisure events — see the <a href="/widerruf">withdrawal information</a>.</p>

    <h2>7. Your content</h2>
    <p>You remain responsible for the content you post (profiles, events, images, posts). You warrant that you hold the necessary rights and do not infringe the rights of third parties. You grant us the simple, geographically and temporally unlimited right to store, display and technically process this content for the purpose of presentation (e.g. image sizes) in the course of operating Furia. This right ends when the content is deleted, insofar as it has not already been displayed to third parties.</p>
    <p>We do not adopt third-party content as our own. Where we become aware of infringements, we remove the content concerned.</p>

    <h2>8. Naming third parties in events</h2>
    <p>When creating an event, you may name an opposing side or participating athletes who do not yet have a Furia account. Such naming does not constitute a commitment to attend by the named person. Named parties are treated as "invited" and can take over or have the naming removed.</p>

    <h2>9. No resale</h2>
    <p>Furia offers <b>no resale of tickets</b>. There is no secondary market on Furia, and we do not broker tickets between fans for payment. This is a deliberate decision, not a temporary limitation: a ticket that can be traded attracts people who want the ticket — not the event.</p>
    <p>Tickets are identity-bound. Commercial resale outside Furia is prohibited and may lead to invalidation of the ticket. If you cannot take up a spot, please contact the organiser; the reversal is governed by their terms (section 6).</p>

    <h2>10. Availability</h2>
    <p>Furia is under active development. We do not owe any particular availability and may change or discontinue features. We announce material changes in the public <a href="/changelog">changelog</a>.</p>

    <h2>11. Liability</h2>
    <p>We are liable without limitation for intent and gross negligence, for injury to life, body or health, and under the Produkthaftungsgesetz (Product Liability Act). For simple negligence we are liable only for breach of a material contractual obligation (Kardinalpflicht) and limited in amount to the foreseeable damage typical for the contract. Otherwise, liability is excluded.</p>
    <p>For damage in connection with the staging of an event, the organiser is liable.</p>

    <h2>12. Termination and suspension</h2>
    <p>You can delete your account at any time. We may suspend accounts for serious or repeated breaches of these terms. Tickets already confirmed remain unaffected, unless reasons of safety prevent this.</p>

    <h2>13. Dispute resolution</h2>
    <p>I am neither willing nor obliged to take part in dispute-resolution proceedings before a consumer arbitration board (Verbraucherschlichtungsstelle).</p>

    <h2>14. Final provisions</h2>
    <p>German law applies. In relation to consumers, this choice of law applies only insofar as it does not deprive the consumer of the protection of mandatory provisions of the state of their habitual residence. Should any provision be invalid, the validity of the remaining provisions remains unaffected.</p>`;
  return shell('Terms of Service', body);
}

// --- /widerruf --------------------------------------------------------------
export function renderWithdrawal(): string {
  const body = `
    <h1>Withdrawal information</h1>
    <p class="upd">Last updated: ${LEGAL_UPDATED}</p>

    <div class="key">
      <p><b>There is no right of withdrawal for tickets to events with a fixed date.</b></p>
      <p>The statutory right of withdrawal is excluded for contracts for services connected with leisure activities where the contract provides a specific date or period for performance (<b>§ 312g Abs. 2 Nr. 9 BGB</b>). This applies to event tickets issued via Furia — every event has a fixed date.</p>
    </div>
    <p>This means: a purchased ticket cannot be returned within 14 days without reason. Your claims in the event of <b>cancellation or substantial postponement</b> of the event remain unaffected and are directed against the organiser (see <a href="/agb">Terms, section 6</a>).</p>

    <h2>Free spots</h2>
    <p>You can release free spots yourself at any time — directly on the event page. No withdrawal is required for this, because no paid contract was concluded.</p>

    <h2>Your Furia account</h2>
    <p>The account itself is free. You can delete it at any time; there is no right of withdrawal, as there is no paid service.</p>

    <h2>If a right of withdrawal does apply</h2>
    <p>Should a right of withdrawal exceptionally apply in an individual case: you may withdraw from the contract within 14 days without giving reasons. The period begins on conclusion of the contract. To exercise it, an unambiguous statement in text form to the following address is sufficient:</p>
    <div class="box"><p>${esc(OPERATOR.name)}<br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>Email: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p></div>
    <p>To meet the deadline, it is sufficient that you send your notice before the period expires. In the event of an effective withdrawal, we or the organiser will refund all payments received without delay, and at the latest within 14 days, using the same means of payment.</p>

    <h2>Model withdrawal form</h2>
    <div class="box">
      <p>To ${esc(OPERATOR.name)}, ${esc(OPERATOR.street)}, ${esc(OPERATOR.city)}, ${esc(OPERATOR.email)}:</p>
      <p>I/we (*) hereby withdraw from the contract concluded by me/us (*) for the purchase of the following goods / the provision of the following service (*):</p>
      <p>— Ordered on (*) / received on (*):<br>— Name of consumer(s):<br>— Address of consumer(s):<br>— Date:<br>— Signature (only if this form is notified on paper):</p>
      <p>(*) Delete as appropriate.</p>
    </div>`;
  return shell('Withdrawal information', body);
}
