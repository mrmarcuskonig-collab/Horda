// legal.ts — Legal notice (Impressum, § 5 DDG) and Privacy policy (DSGVO/GDPR).
//
// Its own file, plain prose. Rules:
//
//   1. ENGLISH PROSE, GERMAN LAW. On 27 Jul 2026 Marcus decided these pages read
//      in English to match the English-only product (the audience Furia targets
//      is English-speaking). German LAW still governs, so every statutory
//      citation stays in its German form (§ 5 DDG, DSGVO articles, § 312g BGB,
//      etc.) — those are the instruments, not the prose language. This still
//      needs a lawyer's sign-off before go-live; an Impressum is a legal
//      instrument and the language question is exactly the kind of thing to
//      confirm. See the ops doc.
//   2. NO OS-PLATTFORM LINK. The EU Online Dispute Resolution platform was shut
//      down on 20 July 2025 (Reg. (EU) 2024/3228). The old duty to LINK it has
//      become a duty to REMOVE it. Almost every generator still emits that link.
//      Its absence here is intentional — do not "fix" it back in.
//
// The consumer-arbitration (VSBG) statement survives the OS shutdown and is
// required, so it stays.
//
// NOT LEGAL ADVICE. Reviewed-by-a-lawyer is still pending; see the ops doc.
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';
import { CONTACT_EMAIL } from './email.ts';

// Operator details. Single source of truth — the Impressum, the Datenschutz-
// erklärung and any future contract page all read from here.
//
// IF THIS BECOMES A COMPANY (UG/GmbH): this block must change to the company's
// name, Rechtsform, Vertretungsberechtigter, Handelsregister + HRB number and
// USt-IdNr — and the address becomes the company's, not a private home address.
export const OPERATOR = {
  name: 'Marcus König',
  street: 'Dunckerstr. 77',
  city: '10437 Berlin',
  country: 'Deutschland',
  email: CONTACT_EMAIL,
};

// Keep in sync when the text materially changes — DSGVO expects a version date.
export const LEGAL_UPDATED = '27 July 2026';

function legalShell(title: string, body: string): string {
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
  .lgwrap p b, .lgwrap b{color:var(--bone);font-weight:600}
  .lgwrap a{color:var(--bone);border-bottom:1px solid var(--b)}
  .lgwrap ul{margin:0 0 12px 20px}
  .lgwrap li{color:var(--mut);font-size:14.5px;line-height:1.72;margin-bottom:5px}
  .addr{border:1px solid var(--b);border-radius:14px;padding:18px 20px;background:var(--s);margin-bottom:12px}
  .addr p{margin:0;color:var(--bone);line-height:1.7}
  .note{border-left:2px solid var(--acc);padding:2px 0 2px 16px;margin:16px 0}
  .lgfoot{border-top:1px solid var(--b);margin-top:44px;padding-top:20px;font-size:12.5px}
  .lgfoot a{margin-right:16px;color:var(--mut)}
</style></head><body>
  <div class="lgtop"><a href="/">${ravenMarkCurrent(24)} Furia</a></div>
  <div class="lgwrap">${body}
    <div class="lgfoot"><a href="/agb">Terms</a><a href="/widerruf">Withdrawal</a><a href="/impressum">Legal notice</a><a href="/datenschutz">Privacy</a><a href="/">Back to Furia</a></div>
  </div>
</body></html>`;
}

// --- /impressum -------------------------------------------------------------
export function renderImpressum(): string {
  const body = `
    <h1>Legal notice (Impressum)</h1>
    <p class="upd">Last updated: ${LEGAL_UPDATED}</p>

    <h2>Information pursuant to § 5 Digitale-Dienste-Gesetz (DDG)</h2>
    <div class="addr"><p><b>${esc(OPERATOR.name)}</b><br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>${esc(OPERATOR.country)}</p></div>

    <h2>Contact</h2>
    <p>Email: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p>

    <h2>Responsible for content under § 18 Abs. 2 MStV</h2>
    <p>${esc(OPERATOR.name)}, address as above.</p>

    <h2>VAT identification number</h2>
    <p>No VAT identification number pursuant to § 27a Umsatzsteuergesetz (UStG) has been issued.</p>

    <h2>Consumer dispute resolution / universal arbitration board</h2>
    <p>I am neither willing nor obliged to take part in dispute-resolution proceedings before a consumer arbitration board (Verbraucherschlichtungsstelle).</p>

    <h2>Liability for content</h2>
    <p>As a service provider I am responsible under § 7 Abs. 1 DDG for my own content on these pages in accordance with general law. Under §§ 8 bis 10 DDG, however, I am not obliged as a service provider to monitor transmitted or stored third-party information, or to investigate circumstances that indicate unlawful activity. Obligations to remove or block the use of information under general law remain unaffected. Liability in this respect is only possible from the point in time at which a concrete infringement of the law becomes known. Upon becoming aware of such infringements, I will remove this content without delay.</p>

    <h2>Liability for links</h2>
    <p>My offering contains links to external third-party websites over whose content I have no influence. I therefore cannot accept any liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content. The linked pages were checked for possible legal infringements at the time of linking; no unlawful content was identifiable at that time. Permanent monitoring of the content of the linked pages is not reasonable without concrete evidence of an infringement. Upon becoming aware of infringements, I will remove such links without delay.</p>

    <h2>User-generated content</h2>
    <p>Users may post their own content on Furia and in the associated Discord server (for example profiles, events, images and posts). I do not adopt this content as my own; the person who posted it is responsible for it. Upon becoming aware of infringements, I remove the content concerned without delay.</p>

    <h2>Copyright</h2>
    <p>The content and works created by the operator on these pages are subject to German copyright law (Urheberrecht). Reproduction, adaptation, distribution and any kind of exploitation beyond the limits of copyright require the written consent of the respective author or creator. Downloads and copies of this page are permitted only for private, non-commercial use. Insofar as the content on this page was not created by the operator, the copyrights of third parties are respected; in particular, third-party content is identified as such. Should you nevertheless become aware of a copyright infringement, please notify me accordingly. Upon becoming aware of infringements, I will remove such content without delay.</p>

    <h2>Data protection</h2>
    <p>For information on the processing of personal data, see the <a href="/datenschutz">privacy policy</a>.</p>`;
  return legalShell('Legal notice', body);
}

// --- /datenschutz -----------------------------------------------------------
export function renderDatenschutz(): string {
  const body = `
    <h1>Privacy policy</h1>
    <p class="upd">Last updated: ${LEGAL_UPDATED}</p>

    <h2>1. Controller (Verantwortlicher)</h2>
    <div class="addr"><p><b>${esc(OPERATOR.name)}</b><br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>${esc(OPERATOR.country)}<br>Email: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p></div>

    <h2>2. Principle</h2>
    <p>I process personal data only where this is necessary to provide Furia, or where you have consented. Furia is designed to collect as little data as possible.</p>
    <div class="note"><p><b>Fan activity is private.</b> Who you follow and which events you attend cannot be seen by other users.</p></div>

    <h2>3. What data is processed</h2>
    <h3>a) Account</h3>
    <p>Email address, display name and — if you provide one — your handle. When you sign in with Google, additionally the basic data supplied by Google (name, email address, profile picture).</p>
    <h3>b) Passwordless sign-in</h3>
    <p>For sign-in by magic link or one-time code, a time-limited token together with the time and status of the sign-in are stored.</p>
    <h3>c) Use</h3>
    <p>Pages and events you create, your follows, your registrations for events (claims/tickets) and — on in-person entry — the time of check-in.</p>
    <h3>d) Content</h3>
    <p>Images you upload and text you enter.</p>
    <h3>e) Server logs</h3>
    <p>When the site is accessed, technically necessary data is processed (IP address, time, requested resource, user agent). The approximate region is also derived from the IP address in order to pre-select the language; this result is not stored.</p>
    <h3>f) Payments</h3>
    <p>For purchases of paid tickets, payment is processed via Stripe. <b>Payment data is not collected or stored by me</b>; I receive only the result of the payment.</p>

    <h2>4. Purposes and legal bases</h2>
    <ul>
      <li><b>Provision of the service, account, events, tickets:</b> Art. 6 Abs. 1 lit. b DSGVO (contract or pre-contractual measures).</li>
      <li><b>Security, abuse prevention, operation and improvement:</b> Art. 6 Abs. 1 lit. f DSGVO (legitimate interest).</li>
      <li><b>Credit in the public changelog, newsletter:</b> Art. 6 Abs. 1 lit. a DSGVO (consent).</li>
      <li><b>Compliance with legal obligations</b> (e.g. retention periods): Art. 6 Abs. 1 lit. c DSGVO.</li>
    </ul>

    <h2>5. Credit in the public changelog</h2>
    <p>If I implement a feature you suggested, I will — on request — credit your Discord handle in the relevant entry of the public <a href="/changelog">changelog</a>. This happens only with your prior explicit consent, which I obtain in each individual case. Only the handle is named, never your real name or email address. You can withdraw consent at any time with effect for the future; the credit is then removed without delay.</p>

    <h2>6. Recipients</h2>
    <p>I use carefully selected service providers that process data exclusively on my instructions (processing on behalf of the controller under Art. 28 DSGVO): hosting and database, email delivery and image storage. For payments, Stripe is independently responsible. Any transfer to third countries takes place only on the basis of an adequacy decision or standard contractual clauses (Standardvertragsklauseln).</p>

    <h2>7. Discord</h2>
    <p>The Furia Discord server is a voluntary additional offering and not a prerequisite for using Furia. Discord is responsible for the processing carried out by the platform itself (<a href="https://discord.com/privacy" target="_blank" rel="noopener">discord.com/privacy</a>). For the processing <i>on the server I operate</i>, I am responsible. Details are provided there.</p>

    <h2>8. Retention period</h2>
    <p>Account data is stored until you delete your account. Sign-in tokens expire after 15 minutes. Data on events and check-ins is stored for as long as this is necessary to evidence attendance. Statutory retention periods — in particular tax-law periods for ticket purchases — remain unaffected.</p>

    <h2>9. Your rights</h2>
    <p>You have the right to access (Art. 15 DSGVO), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to withdraw consent you have given (Art. 7 Abs. 3).</p>
    <p><b>Right to object (Widerspruchsrecht):</b> you have the right, on grounds relating to your particular situation, to object at any time to the processing of personal data concerning you that is carried out on the basis of Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO).</p>
    <p>To exercise these rights, an informal message to <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a> is sufficient.</p>
    <p>You also have the right to lodge a complaint with a supervisory authority. The competent authority is the <a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener">Berliner Beauftragte für Datenschutz und Informationsfreiheit</a> (Berlin Commissioner for Data Protection and Freedom of Information), Alt-Moabit 59-61, 10555 Berlin.</p>

    <h2>10. Minors</h2>
    <p>For children and young people under 16 years of age, use is permitted only with the consent of a parent or guardian (Art. 8 DSGVO). For selling paid tickets and receiving payouts, a minimum age of 18 years is required due to the requirements of our payment service provider.</p>

    <h2>11. Cookies</h2>
    <p>Furia uses strictly necessary cookies only: a session cookie for sign-in and a cookie storing the selected language. There is no tracking and no advertising analytics; no consent is required for this (§ 25 Abs. 2 TDDDG).</p>`;
  return legalShell('Privacy policy', body);
}
