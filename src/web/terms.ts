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
// Horda is a PLATFORM (Vermittler), not the event organiser. The ticket contract
// is between the FAN and the ORGANISER. Horda provides the software and collects
// the money on the organiser's behalf via Stripe. If Horda were the seller, it
// would owe every consumer duty for every event on the platform — refunds for a
// cancelled Kreisliga match would be Horda's problem, not the club's. That's a
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
// doesn't have. On 17 Jul 2026 Marcus decided Horda does not do resale at all
// (see src/db/transfer_repo.ts for the full reasoning). No secondary sale, so the
// question never arises. This is the cheapest way to answer a hard legal question:
// don't do the thing.
//
// NOT LEGAL ADVICE. Reviewed-by-a-lawyer is still outstanding.
import { esc } from './layout.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS } from './theme.ts';
import { ravenMarkCurrent } from './brand.ts';
import { OPERATOR, LEGAL_UPDATED } from './legal.ts';

/** Our cut. One constant so the AGB can never drift from what Stripe charges. */
export const TAKE_RATE_PCT = 10;

function shell(title: string, body: string): string {
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
  <div class="lgtop"><a href="/">${ravenMarkCurrent(24)} Horda</a></div>
  <div class="lgwrap">${body}
    <div class="lgfoot"><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/">Zurück zu Horda</a></div>
  </div>
</body></html>`;
}

// --- /agb -------------------------------------------------------------------
export function renderTerms(): string {
  const body = `
    <h1>Allgemeine Geschäftsbedingungen</h1>
    <p class="upd">Stand: ${LEGAL_UPDATED} · Anbieter: ${esc(OPERATOR.name)}, ${esc(OPERATOR.street)}, ${esc(OPERATOR.city)}</p>

    <h2>1. Geltungsbereich</h2>
    <p>Diese Bedingungen gelten für die Nutzung der Plattform Horda (joinhorda.com), betrieben von ${esc(OPERATOR.name)} („Horda", „wir"). Sie gelten gegenüber Verbraucherinnen und Verbrauchern (§ 13 BGB) sowie Unternehmerinnen und Unternehmern (§ 14 BGB).</p>

    <h2>2. Was Horda ist — und was nicht</h2>
    <div class="key">
      <p><b>Horda ist eine Vermittlungsplattform, nicht der Veranstalter.</b> Über Horda können Veranstalterinnen und Veranstalter (Athlet:innen, Vereine, Verbände, Privatpersonen) eigene Veranstaltungen anlegen und Plätze bzw. Tickets vergeben.</p>
      <p><b>Der Vertrag über die Teilnahme an einer Veranstaltung kommt ausschließlich zwischen Ihnen und der jeweiligen Veranstalterin bzw. dem jeweiligen Veranstalter zustande.</b> Horda wird nicht Vertragspartei dieses Vertrages. Wir stellen die Software bereit und ziehen bei kostenpflichtigen Tickets den Preis im Namen und für Rechnung der Veranstalter über unseren Zahlungsdienstleister ein.</p>
    </div>
    <p>Für die Durchführung, den Inhalt, die Absage, die Verlegung und die Sicherheit einer Veranstaltung ist allein die Veranstalterin bzw. der Veranstalter verantwortlich. Ansprüche wegen Ausfall oder Änderung einer Veranstaltung richten sich gegen diese Person, nicht gegen Horda.</p>

    <h2>3. Konto</h2>
    <p>Für die Nutzung ist ein Konto erforderlich. Die Anmeldung erfolgt passwortlos per E-Mail-Link oder Einmalcode. Sie sind dafür verantwortlich, Ihren Zugang und Ihr E-Mail-Postfach zu schützen. Angaben müssen zutreffend sein.</p>
    <p>Für Personen unter 16 Jahren ist die Nutzung nur mit Einwilligung der Erziehungsberechtigten zulässig (Art. 8 DSGVO). Für den Verkauf kostenpflichtiger Tickets und den Empfang von Auszahlungen ist ein Mindestalter von 18 Jahren erforderlich; dies folgt aus den Bedingungen unseres Zahlungsdienstleisters.</p>

    <h2>4. Plätze und Tickets</h2>
    <p>Veranstalter legen je Teilnahmeart („in Person", „Stream") fest, ob die Teilnahme kostenlos oder kostenpflichtig ist, wie viele Plätze zur Verfügung stehen und wie viele Plätze eine Person beanspruchen darf. Ein Platz gilt erst dann als vergeben, wenn er Ihnen in Horda bestätigt wurde.</p>
    <p><b>Tickets sind personengebunden und nicht übertragbar.</b> Der Zutritt erfolgt über einen QR-Code, der beim Einlass geprüft wird. Ein Weiterverkauf über Horda findet nicht statt (siehe Ziffer 9).</p>
    <p>Ist eine Teilnahmeart ausgebucht, kann eine Warteliste angeboten werden. Ein Platz auf der Warteliste begründet keinen Anspruch auf Teilnahme.</p>

    <h2>5. Preise, Zahlung und unsere Vergütung</h2>
    <p>Alle Preise verstehen sich als Endpreise in Euro und schließen die gesetzliche Umsatzsteuer ein, soweit die Veranstalterin bzw. der Veranstalter umsatzsteuerpflichtig ist. Die Zahlungsabwicklung erfolgt über <b>Stripe</b>. Zahlungsdaten werden nicht von Horda erhoben oder gespeichert.</p>
    <p>Von jedem verkauften kostenpflichtigen Ticket behält Horda eine Vergütung von <b>${TAKE_RATE_PCT}%</b> des Ticketpreises ein; der verbleibende Betrag wird an die Veranstalterin bzw. den Veranstalter ausgezahlt. Für kostenlose Veranstaltungen fällt keine Vergütung an.</p>

    <h2>6. Absage, Verlegung, Erstattung</h2>
    <p>Wird eine Veranstaltung abgesagt oder wesentlich verlegt, richtet sich Ihr Anspruch auf Erstattung gegen die Veranstalterin bzw. den Veranstalter. Horda unterstützt die Rückabwicklung technisch über den Zahlungsdienstleister, schuldet die Erstattung jedoch nicht selbst.</p>
    <p>Zu Ihrem Widerrufsrecht — und zu dessen gesetzlichem Ausschluss bei terminierten Freizeitveranstaltungen — siehe die <a href="/widerruf">Widerrufsbelehrung</a>.</p>

    <h2>7. Ihre Inhalte</h2>
    <p>Für die von Ihnen eingestellten Inhalte (Profile, Veranstaltungen, Bilder, Beiträge) bleiben Sie verantwortlich. Sie sichern zu, dass Sie über die erforderlichen Rechte verfügen und keine Rechte Dritter verletzen. Sie räumen uns das einfache, räumlich und zeitlich unbeschränkte Recht ein, diese Inhalte im Rahmen des Betriebs von Horda zu speichern, anzuzeigen und zum Zweck der Darstellung technisch zu bearbeiten (z. B. Bildgrößen). Dieses Recht endet mit der Löschung des Inhalts, soweit die Anzeige nicht bereits Dritten gegenüber erfolgt ist.</p>
    <p>Wir machen uns fremde Inhalte nicht zu eigen. Bei Kenntnis von Rechtsverletzungen entfernen wir die betreffenden Inhalte.</p>

    <h2>8. Nennung von Dritten in Veranstaltungen</h2>
    <p>Beim Anlegen einer Veranstaltung können Sie eine gegnerische Seite oder teilnehmende Athlet:innen benennen, die noch kein Horda-Konto haben. Diese Nennung begründet keine Teilnahmezusage der genannten Person. Genannte Parteien gelten als „eingeladen" und können die Nennung übernehmen oder entfernen lassen.</p>

    <h2>9. Kein Weiterverkauf</h2>
    <p>Horda bietet <b>keinen Weiterverkauf von Tickets an</b>. Es gibt auf Horda keinen Zweitmarkt, und wir vermitteln keine Tickets zwischen Fans gegen Entgelt. Das ist eine bewusste Entscheidung und keine vorübergehende Einschränkung: Ein Ticket, das gehandelt werden kann, zieht Menschen an, die das Ticket wollen — nicht die Veranstaltung.</p>
    <p>Tickets sind personengebunden. Der gewerbliche Weiterverkauf außerhalb von Horda ist untersagt und kann zur Entwertung des Tickets führen. Können Sie einen Platz nicht wahrnehmen, wenden Sie sich bitte an die Veranstalterin oder den Veranstalter; die Rückabwicklung richtet sich nach deren Bedingungen (Ziffer 6).</p>

    <h2>10. Verfügbarkeit</h2>
    <p>Horda befindet sich in aktiver Entwicklung. Wir schulden keine bestimmte Verfügbarkeit und können Funktionen ändern oder einstellen. Wesentliche Änderungen kündigen wir im öffentlichen <a href="/changelog">Changelog</a> an.</p>

    <h2>11. Haftung</h2>
    <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit haften wir nur bei der Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht) und der Höhe nach begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die Haftung ausgeschlossen.</p>
    <p>Für Schäden im Zusammenhang mit der Durchführung einer Veranstaltung haftet die Veranstalterin bzw. der Veranstalter.</p>

    <h2>12. Kündigung und Sperrung</h2>
    <p>Sie können Ihr Konto jederzeit löschen. Wir können Konten bei erheblichen oder wiederholten Verstößen gegen diese Bedingungen sperren. Bereits bestätigte Tickets bleiben davon unberührt, soweit dem keine Gründe der Sicherheit entgegenstehen.</p>

    <h2>13. Streitbeilegung</h2>
    <p>Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

    <h2>14. Schlussbestimmungen</h2>
    <p>Es gilt deutsches Recht. Gegenüber Verbrauchern gilt diese Rechtswahl nur, soweit dadurch der Schutz zwingender Vorschriften des Staates des gewöhnlichen Aufenthalts nicht entzogen wird. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>`;
  return shell('AGB', body);
}

// --- /widerruf --------------------------------------------------------------
export function renderWithdrawal(): string {
  const body = `
    <h1>Widerrufsbelehrung</h1>
    <p class="upd">Stand: ${LEGAL_UPDATED}</p>

    <div class="key">
      <p><b>Für Tickets zu Veranstaltungen mit festem Termin besteht kein Widerrufsrecht.</b></p>
      <p>Das gesetzliche Widerrufsrecht ist bei Verträgen über Dienstleistungen im Zusammenhang mit Freizeitbetätigungen ausgeschlossen, wenn der Vertrag für die Erbringung einen spezifischen Termin oder Zeitraum vorsieht (<b>§ 312g Abs. 2 Nr. 9 BGB</b>). Das trifft auf Veranstaltungstickets zu, die über Horda vergeben werden — jede Veranstaltung hat einen festen Termin.</p>
    </div>
    <p>Das bedeutet: Ein gekauftes Ticket kann nicht innerhalb von 14 Tagen ohne Grund zurückgegeben werden. Ihre Ansprüche bei <b>Absage oder wesentlicher Verlegung</b> der Veranstaltung bleiben davon unberührt und richten sich gegen die Veranstalterin bzw. den Veranstalter (siehe <a href="/agb">AGB Ziffer 6</a>).</p>

    <h2>Kostenlose Plätze</h2>
    <p>Kostenlose Plätze können Sie jederzeit selbst wieder freigeben — direkt auf der Veranstaltungsseite. Ein Widerruf ist dafür nicht erforderlich, weil kein entgeltlicher Vertrag geschlossen wurde.</p>

    <h2>Ihr Horda-Konto</h2>
    <p>Das Konto selbst ist kostenlos. Sie können es jederzeit löschen; ein Widerrufsrecht besteht mangels entgeltlicher Leistung nicht.</p>

    <h2>Wenn doch ein Widerrufsrecht besteht</h2>
    <p>Sollte im Einzelfall ausnahmsweise ein Widerrufsrecht bestehen, gilt: Sie können den Vertrag binnen 14 Tagen ohne Angabe von Gründen widerrufen. Die Frist beginnt mit Vertragsschluss. Zur Ausübung genügt eine eindeutige Erklärung in Textform an:</p>
    <div class="box"><p>${esc(OPERATOR.name)}<br>${esc(OPERATOR.street)}<br>${esc(OPERATOR.city)}<br>E-Mail: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p></div>
    <p>Zur Fristwahrung genügt die rechtzeitige Absendung. Im Falle eines wirksamen Widerrufs erstatten wir bzw. die Veranstalterin oder der Veranstalter alle erhaltenen Zahlungen unverzüglich, spätestens binnen 14 Tagen, über dasselbe Zahlungsmittel.</p>

    <h2>Muster-Widerrufsformular</h2>
    <div class="box">
      <p>An ${esc(OPERATOR.name)}, ${esc(OPERATOR.street)}, ${esc(OPERATOR.city)}, ${esc(OPERATOR.email)}:</p>
      <p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Ware / die Erbringung der folgenden Dienstleistung (*):</p>
      <p>— Bestellt am (*) / erhalten am (*):<br>— Name des/der Verbraucher(s):<br>— Anschrift des/der Verbraucher(s):<br>— Datum:<br>— Unterschrift (nur bei Mitteilung auf Papier):</p>
      <p>(*) Unzutreffendes streichen.</p>
    </div>`;
  return shell('Widerrufsbelehrung', body);
}
