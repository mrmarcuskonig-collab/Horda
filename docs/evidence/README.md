# Evidence

One file per conversation with a real club, fighter, gym, promoter or organiser. Filename: `YYYY-MM-DD-<slug>.md`.

This directory is the sales pipeline and the product research, in one place, in the repo — so that agents can read it and product arguments get settled with what people actually said.

## Rules

- **Log the failures.** A rejection with a stated reason is worth more than a polite "sounds interesting." A log containing only good conversations is worthless for finding patterns.
- **Never smooth a quote.** If the exact wording is gone, drop the verbatim section rather than paraphrasing inside quotation marks.
- **Keep `outcome` honest.** "Interested" is not "trialling."
- **Log out-of-beachhead conversations too**, marked as such. Europe is the goal; sequencing is the only thing the beachhead constrains.
- Anything appearing in fewer than three conversations is an anecdote and must be labelled as one.

## Targets

Five conversations a week. 100 logged by month three.

## Front matter schema

```yaml
date: 2026-08-04
org: SV Beispiel Berlin
type: club            # club | fighter | gym | promoter | organiser | federation
city: berlin
country: DE
contact: first name + role
channel: cold-dm      # cold-dm | cold-email | intro | event | inbound
events_per_year: 6
current_tool: WhatsApp + Excel
current_spend_eur_month: 0
outcome: interested   # no-answer | rejected | interested | trialling | paying
next_step: demo on 12 Aug
```

Sections: What they run · What hurts · What they said about Horda · Objection · Verbatim · What this changes.

The `evidence-log` skill writes these for you and reads them back for patterns.
