# Furia — full app snapshot (rename + mark + redirect + rating + Fan ID + challenges + phone verify)

Complete application, everything applied and verified together:
- Furia rename (text, code, env vars, joinfuria.com, source-tag)
- ember-spark mark; canonical `.app`/`www` → `.com` redirect
- tiered rating
- canonical **phone-keyed Fan ID** (person layer) + **/verify-phone** OTP flow
  (adapter, STUB by default — real SMS/WhatsApp is one env switch away, no new dep)
- **attendance challenges** (/c/:kind/:id, owner CSV export) with an owner
  "Challenges" link on the athlete page and the club/team/association edit page
Migrations 0060–0063 run on boot.

**Verified in-container:** full suite green (46 test files, 0 failures), crawler
155/0, landing renders "Furia", zero "Horda" left. No `node_modules` in the zip.

## Deploy (branch + PR)
```bash
git checkout -b furia-snapshot
# copy this zip's contents over the repo root, replacing files, then:
git add -A && git commit -m "Furia snapshot: +Fan ID verify, challenges link"
git push -u origin furia-snapshot   # open PR, review diff, merge → Render redeploys
```

## Out-of-repo (unchanged)
Render env `HORDA_*→FURIA_*` (esp. `FURIA_URL=https://joinfuria.com`); fix the
`ANTHROPIC_API_KEY` typo; joinfuria.com/.app DNS at Render; Resend verify
joinfuria.com then flip `EMAIL_FROM`; Google OAuth redirect URIs.

## Notes
- Phone verify (`/verify-phone`) is reachable but delivery is a no-op until you wire
  a real OTP provider (`src/web/otp.ts` → branch on `OTP_PROVIDER`); in dev the code
  shows on-screen. No fan-facing changelog entry for it until a provider is live.
- Challenges link is owner-facing (athlete page + entity edit); a public fan-facing
  tab on the club/athlete page is a small follow-up.
- This snapshot supersedes the earlier delta zips — deploy THIS.
