# Furia — full app, ready to deploy

This is the **complete application** (formerly Horda), with everything applied and
verified together:

- Full Horda → Furia rename (text, code identifiers, env-var names, package name,
  `joinfuria.com`, and the ADR-0002 `source` data-tag).
- The provenance-tiered rating (anyone can rate a hosted event after it ends;
  public score stays verified-only).
- The **ember spark** mark (widest variant) in nav, favicon, read-model header,
  and both share-card generators.
- The pre-existing provenance bug-fix in `createClaim`.
- New migration `db/migrations/0060_rebrand_source.sql` (runs automatically on boot).

**Verified in-container:** full suite green (42 test files, 0 failures), crawler
155 pages / 0 problems, landing renders "Furia" with zero "Horda" left.
`node_modules` is NOT included — Render (or `npm install`) restores it.

## Deploy (branch + PR — the safe way)

This tree is my reconciled copy of your app. If you've pushed anything to `main`
since our last sync, use the PR flow so GitHub shows you the diff before merging —
do **not** force-overwrite `main` blind.

```bash
# from a fresh clone of your repo (or your working copy):
git checkout -b furia-launch
# copy the contents of this zip over the repo root, replacing files, then:
git add -A
git commit -m "Launch: rebrand to Furia + tiered rating + ember-spark mark"
git push -u origin furia-launch
# open the PR, review the diff, merge → Render redeploys from main
```

## Out-of-repo checklist (these live outside the code)

1. **Render env vars** — rename each `HORDA_*` to `FURIA_*` (same values). The
   important ones: `FURIA_URL` = `https://joinfuria.com`, plus the fee/Plus knobs
   (`FURIA_PLATFORM_FEE_PCT`, `FURIA_PLUS_*`). `DATABASE_URL` is unchanged. If you'd
   rather not do this in lockstep, tell me and I'll make the code read `FURIA_*`
   first and fall back to `HORDA_*`.
2. **Domain** — point `joinfuria.com` DNS at Render, add it as a custom domain,
   and keep `joinhorda.com` redirecting to it so old links survive.
3. **Email** — verify `joinfuria.com` in Resend, or magic-link emails won't send.

Migrations (incl. `0060`, which flips the `source` default to `furia` and backfills
existing rows) run automatically on boot via `applySchema`. No manual DB step.
