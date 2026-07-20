// consent.ts — the registration-flow consent step (rights capture UI).
//
// DORMANT PENDING LEGAL. This renders the capture UI for the TWO LOW-RISK scopes
// only — event-media likeness and data-processing — the conservative v1 the ADR
// recommends. It is NOT yet wired to write to `rights_grant` in production; the
// grant taxonomy and copy must be a lawyer's design first
// (docs/consent-grant-model-for-legal-review.md). The higher-risk scopes
// (commercial_sponsor, ai_training_licensing) are deliberately absent until then.
//
// DESIGN RULES BAKED IN (so "freely given" survives review):
//   * Every box is OPTIONAL and UNCHECKED by default. A pre-ticked consent box is
//     invalid under GDPR (CJEU Planet49, C-673/17) — affirmative action only.
//   * The step is NON-BLOCKING. Registration completes whether or not anything is
//     ticked; the copy says so out loud. Consent that gates the service isn't
//     freely given (Art. 7(4)).
//   * Each scope is a SEPARATE toggle with its own plain-language explanation.
//   * The exact policy VERSION is emitted with the form, so a stored grant can be
//     pinned to the words the person actually saw (rights_policy.version).
//
// The scope keys match the `rights_scope` enum in 0044_rights_grants.sql.
import type { Lang } from './i18n.ts';

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Bump the version string whenever the wording below changes. A grant records
// the version it was captured under; the text itself lives in `rights_policy`.
export const CONSENT_POLICY_VERSION = 'rights-v1/2026-07-20';

type ScopeCopy = { key: string; title: string; body: string };

const COPY: Record<Lang, { heading: string; intro: string; optional: string; withdraw: string; scopes: ScopeCopy[] }> = {
  en: {
    heading: 'A couple of optional permissions',
    intro: 'These are optional and separate from signing up. You can join, register and attend without ticking anything — and change your mind anytime in Settings.',
    optional: 'Optional — leaving these unchecked changes nothing about your account.',
    withdraw: 'You can withdraw either permission at any time. Withdrawal also stops future use of anything made under it.',
    scopes: [
      { key: 'likeness_event_media',
        title: 'Let my image appear in media of events I take part in',
        body: 'Photos and clips of the events you enter may show you — the way a match report or a finish-line photo would. Just the events you were actually part of.' },
      { key: 'data_processing',
        title: 'Let Horda process my competitive record to improve my experience',
        body: 'Use of your results and entries to power your profile, matchmaking and reminders, beyond what running the service strictly requires.' },
    ],
  },
  de: {
    heading: 'Ein paar optionale Einwilligungen',
    intro: 'Diese sind optional und unabhängig von der Anmeldung. Du kannst dich registrieren, anmelden und teilnehmen, ohne etwas anzukreuzen – und deine Wahl jederzeit in den Einstellungen ändern.',
    optional: 'Optional – wenn du nichts ankreuzt, ändert sich an deinem Konto nichts.',
    withdraw: 'Du kannst jede Einwilligung jederzeit widerrufen. Der Widerruf stoppt auch die künftige Nutzung von allem, was darauf beruht.',
    scopes: [
      { key: 'likeness_event_media',
        title: 'Mein Bild darf in Medien von Events erscheinen, an denen ich teilnehme',
        body: 'Fotos und Clips der Events, zu denen du dich anmeldest, dürfen dich zeigen – wie ein Spielbericht oder ein Zielfoto. Nur die Events, an denen du wirklich teilgenommen hast.' },
      { key: 'data_processing',
        title: 'Horda darf meine Wettkampfdaten verarbeiten, um mein Erlebnis zu verbessern',
        body: 'Nutzung deiner Ergebnisse und Anmeldungen für Profil, Matchmaking und Erinnerungen – über das hinaus, was der Betrieb des Dienstes zwingend erfordert.' },
    ],
  },
};

/**
 * The consent fieldset, ready to drop into the signup/onboarding form. Returns a
 * self-contained fragment (its own scoped styles). Every input is
 * name="consent" value="<scope>", unchecked. A hidden field carries the policy
 * version so the server can pin a grant to the exact wording shown.
 *
 * NOTE: the server route that reads these is intentionally not built yet — see
 * the file header. This is the surface for legal to red-line and for Marcus to
 * preview, not a live capture path.
 */
export function consentStep(lang: Lang = 'en'): string {
  const c = COPY[lang] ?? COPY.en;
  const rows = c.scopes.map(s => `
    <label class="cx-row">
      <input type="checkbox" name="consent" value="${esc(s.key)}">
      <span class="cx-box" aria-hidden="true">✓</span>
      <span class="cx-text"><span class="cx-t">${esc(s.title)}</span><span class="cx-b">${esc(s.body)}</span></span>
    </label>`).join('');
  return `
  <style>
    .cx{border:1px solid var(--b,#3a3532);border-radius:14px;padding:15px 15px 6px;margin:18px 0}
    .cx h3{font-size:15.5px;font-weight:800;margin:0 0 4px}
    .cx .cx-intro{color:var(--mut,#a49e97);font-size:12.5px;line-height:1.5;margin:0 0 12px}
    .cx-row{display:flex;align-items:flex-start;gap:11px;padding:11px 0;border-top:1px solid var(--b,#3a3532);cursor:pointer}
    .cx-row input{position:absolute;opacity:0;width:0;height:0}
    .cx-box{flex:0 0 22px;width:22px;height:22px;margin-top:1px;border-radius:6px;border:1.5px solid var(--b,#3a3532);display:flex;align-items:center;justify-content:center;color:transparent;font-weight:800;font-size:12px}
    .cx-row:has(input:checked) .cx-box{background:var(--acc,#E15A40);border-color:var(--acc,#E15A40);color:#fff}
    .cx-text{flex:1;min-width:0}
    .cx-t{display:block;font-weight:700;font-size:14px;line-height:1.35}
    .cx-b{display:block;color:var(--mut,#a49e97);font-size:12.5px;line-height:1.5;margin-top:3px}
    .cx-foot{color:var(--mut,#a49e97);font-size:11.5px;line-height:1.5;padding:10px 0 6px;border-top:1px solid var(--b,#3a3532)}
  </style>
  <fieldset class="cx">
    <h3>${esc(c.heading)}</h3>
    <p class="cx-intro">${esc(c.intro)}</p>
    ${rows}
    <p class="cx-foot">${esc(c.optional)} ${esc(c.withdraw)}</p>
    <input type="hidden" name="consent_policy_version" value="${esc(CONSENT_POLICY_VERSION)}">
  </fieldset>`;
}
