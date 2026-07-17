// legal.ts — Impressum (§ 5 DDG) and Datenschutzerklärung (DSGVO).
//
// Deliberately its own file, in German, as plain prose. Two rules:
//
//   1. GERMAN IS AUTHORITATIVE. Do not "translate to match the app language".
//      An Impressum is a legal instrument under German law; an English-only
//      version is a risk, not a feature.
//   2. NO OS-PLATTFORM LINK. The EU Online Dispute Resolution platform was shut
//      down on 20 July 2025 (Reg. (EU) 2024/3228). The old duty to LINK it has
//      become a duty to REMOVE it. Almost every generator still emits that link.
//      Its absence here is intentional — do not "fix" it back in.
//
// The VSBG statement (whether we join consumer arbitration) survives the OS
// shutdown and is required, so it stays.
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
export const LEGAL_UPDATED = '16. Juli 2026';

function legalShell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Horda</title>${THEME_BOOT}
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
  <div class="lgtop"><a href="/">${ravenMarkCurrent(24)} Horda</a></div>
  <div class="lgwrap">${body}
    <div class="lgfoot"><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/">Zurück zu Horda</a></div>
  </div>
</body></html>`;
}

// --- /impressum -------------------------------------------------------------
export function renderImpressum(): string {
  const body = `
    <h1>Impressum</h1>
    <p class="upd">Stand: ${LEGAL_UPDATED}</p>

    <h2>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</h2>
    <div class="addr"><p><b>${esc(OPERATOR.name)}</b><br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>${esc(OPERATOR.country)}</p></div>

    <h2>Kontakt</h2>
    <p>E-Mail: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p>

    <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
    <p>${esc(OPERATOR.name)}, Anschrift wie oben.</p>

    <h2>Umsatzsteuer-Identifikationsnummer</h2>
    <p>Eine Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz ist nicht vorhanden.</p>

    <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
    <p>Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

    <h2>Haftung für Inhalte</h2>
    <p>Als Diensteanbieter bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werde ich diese Inhalte umgehend entfernen.</p>

    <h2>Haftung für Links</h2>
    <p>Mein Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werde ich derartige Links umgehend entfernen.</p>

    <h2>Nutzergenerierte Inhalte</h2>
    <p>Nutzerinnen und Nutzer können auf Horda sowie im zugehörigen Discord-Server eigene Inhalte einstellen (z. B. Profile, Veranstaltungen, Bilder und Beiträge). Diese Inhalte mache ich mir nicht zu eigen. Für sie ist die jeweils einstellende Person verantwortlich. Bei Kenntnis von Rechtsverletzungen entferne ich die betreffenden Inhalte umgehend.</p>

    <h2>Urheberrecht</h2>
    <p>Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitte ich um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werde ich derartige Inhalte umgehend entfernen.</p>

    <h2>Datenschutz</h2>
    <p>Informationen zur Verarbeitung personenbezogener Daten finden Sie in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>`;
  return legalShell('Impressum', body);
}

// --- /datenschutz -----------------------------------------------------------
export function renderDatenschutz(): string {
  const body = `
    <h1>Datenschutzerklärung</h1>
    <p class="upd">Stand: ${LEGAL_UPDATED}</p>

    <h2>1. Verantwortlicher</h2>
    <div class="addr"><p><b>${esc(OPERATOR.name)}</b><br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>${esc(OPERATOR.country)}<br>E-Mail: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p></div>

    <h2>2. Grundsatz</h2>
    <p>Ich verarbeite personenbezogene Daten nur, soweit dies für die Bereitstellung von Horda erforderlich ist oder Sie eingewilligt haben. Horda ist darauf ausgelegt, so wenig Daten wie möglich zu erheben.</p>
    <div class="note"><p><b>Aktivitäten von Fans sind privat.</b> Wem Sie folgen und welche Veranstaltungen Sie besuchen, ist für andere Nutzerinnen und Nutzer nicht einsehbar.</p></div>

    <h2>3. Welche Daten verarbeitet werden</h2>
    <h3>a) Konto</h3>
    <p>E-Mail-Adresse, Anzeigename und – sofern Sie ihn angeben – Ihr Handle. Bei Anmeldung über Google zusätzlich die von Google übermittelten Basisdaten (Name, E-Mail-Adresse, Profilbild).</p>
    <h3>b) Anmeldung ohne Passwort</h3>
    <p>Zur Anmeldung per Magic-Link bzw. Einmalcode werden ein zeitlich befristeter Token sowie Zeitpunkt und Status der Anmeldung gespeichert.</p>
    <h3>c) Nutzung</h3>
    <p>Von Ihnen erstellte Seiten und Veranstaltungen, Ihre Follows, Ihre Anmeldungen zu Veranstaltungen (Claims/Tickets) sowie – bei Einlass vor Ort – der Zeitpunkt des Check-ins.</p>
    <h3>d) Inhalte</h3>
    <p>Von Ihnen hochgeladene Bilder und eingegebene Texte.</p>
    <h3>e) Server-Logs</h3>
    <p>Beim Aufruf werden technisch notwendige Daten verarbeitet (IP-Adresse, Zeitpunkt, angeforderte Ressource, User-Agent). Aus der IP-Adresse wird zudem die grobe Region abgeleitet, um die Sprache vorauszuwählen; eine Speicherung dieses Ergebnisses erfolgt nicht.</p>
    <h3>f) Zahlungen</h3>
    <p>Beim Kauf kostenpflichtiger Tickets erfolgt die Zahlungsabwicklung über Stripe. <b>Zahlungsdaten werden nicht von mir erhoben oder gespeichert</b>; ich erhalte lediglich das Ergebnis der Zahlung.</p>

    <h2>4. Zwecke und Rechtsgrundlagen</h2>
    <ul>
      <li><b>Bereitstellung des Dienstes, Konto, Veranstaltungen, Tickets:</b> Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. vorvertragliche Maßnahmen).</li>
      <li><b>Sicherheit, Missbrauchsvermeidung, Betrieb und Verbesserung:</b> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).</li>
      <li><b>Nennung im öffentlichen Changelog, Newsletter:</b> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).</li>
      <li><b>Erfüllung gesetzlicher Pflichten</b> (z. B. Aufbewahrungsfristen): Art. 6 Abs. 1 lit. c DSGVO.</li>
    </ul>

    <h2>5. Nennung im öffentlichen Changelog</h2>
    <p>Setze ich eine von Ihnen vorgeschlagene Funktion um, nenne ich auf Wunsch Ihren Discord-Handle im betreffenden Eintrag des öffentlichen <a href="/changelog">Changelogs</a>. Dies geschieht ausschließlich mit Ihrer vorherigen ausdrücklichen Einwilligung, die ich im Einzelfall einhole. Genannt wird ausschließlich der Handle, niemals Klarname oder E-Mail-Adresse. Sie können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen; die Nennung wird dann umgehend entfernt.</p>

    <h2>6. Empfänger</h2>
    <p>Ich setze sorgfältig ausgewählte Dienstleister ein, die Daten ausschließlich weisungsgebunden verarbeiten (Auftragsverarbeitung nach Art. 28 DSGVO): Hosting und Datenbank, E-Mail-Versand sowie Bildspeicherung. Für Zahlungen ist Stripe eigenständig verantwortlich. Eine Übermittlung in Drittländer erfolgt nur auf Grundlage eines Angemessenheitsbeschlusses oder von Standardvertragsklauseln.</p>

    <h2>7. Discord</h2>
    <p>Der Horda-Discord-Server ist ein freiwilliges Zusatzangebot und keine Voraussetzung für die Nutzung von Horda. Für die Verarbeitung durch die Plattform selbst ist Discord verantwortlich (<a href="https://discord.com/privacy" target="_blank" rel="noopener">discord.com/privacy</a>). Für die Verarbeitung <i>auf dem von mir betriebenen Server</i> bin ich verantwortlich. Einzelheiten sind dort hinterlegt.</p>

    <h2>8. Speicherdauer</h2>
    <p>Kontodaten werden bis zur Löschung Ihres Kontos gespeichert. Anmelde-Token verfallen nach 15 Minuten. Daten zu Veranstaltungen und Check-ins werden gespeichert, solange dies für den Nachweis der Teilnahme erforderlich ist. Gesetzliche Aufbewahrungsfristen – insbesondere steuerrechtliche bei Ticketkäufen – bleiben unberührt.</p>

    <h2>9. Ihre Rechte</h2>
    <p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie auf Widerruf erteilter Einwilligungen (Art. 7 Abs. 3).</p>
    <p><b>Widerspruchsrecht:</b> Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten, die aufgrund von Art. 6 Abs. 1 lit. f DSGVO erfolgt, Widerspruch einzulegen (Art. 21 DSGVO).</p>
    <p>Zur Ausübung genügt eine formlose Nachricht an <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a>.</p>
    <p>Ferner haben Sie das Recht, sich bei einer Aufsichtsbehörde zu beschweren. Zuständig ist die <a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener">Berliner Beauftragte für Datenschutz und Informationsfreiheit</a>, Alt-Moabit 59-61, 10555 Berlin.</p>

    <h2>10. Minderjährige</h2>
    <p>Für Kinder und Jugendliche unter 16 Jahren ist die Nutzung nur mit Einwilligung der Erziehungsberechtigten zulässig (Art. 8 DSGVO). Für den Verkauf kostenpflichtiger Tickets und die Auszahlung von Einnahmen ist aufgrund der Vorgaben unseres Zahlungsdienstleisters ein Mindestalter von 18 Jahren erforderlich.</p>

    <h2>11. Cookies</h2>
    <p>Horda setzt ausschließlich technisch notwendige Cookies ein: ein Sitzungs-Cookie zur Anmeldung sowie ein Cookie zur Speicherung der gewählten Sprache. Es findet kein Tracking und keine Werbeanalyse statt; eine Einwilligung ist hierfür nicht erforderlich (§ 25 Abs. 2 TDDDG).</p>`;
  return legalShell('Datenschutzerklärung', body);
}
