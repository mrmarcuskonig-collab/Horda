# AGENTS.md — Furia

Every session working in this repo reads this file first, before the README. Follow it literally.

**The README is stale and will mislead you.** Its "ADR-001 — Stack" table describes Next.js 15, Drizzle ORM, Auth.js, Vercel and Neon. None of those are used. It also says the repo "currently holds the database schema — the first product slice," which was true in June and is now wrong by about 16,000 lines. Trust this file and the code; treat the README as a historical document until it is rewritten.

---

## What Furia is

Furia is the system of record for real sport: clubs, teams, athletes, leagues, fixtures and the events around them. Tenants are clubs, fighters, gyms, promoters and organisers; end users are athletes and spectators. The app is a server-rendered Node application with an embedded Postgres, deployed as a single Docker container.

Market: German cities first — Berlin, Hamburg, Cologne, Munich — with Europe as the goal. Build multi-region, multi-currency and multi-language from the start; launch one city at a time.

Business context that should shape technical judgment: solo founder, bootstrapped, no funding, no paying tenants yet. Optimise for something a real club will pay for. Prefer boring and reversible.

## Stack — what is actually true

| Layer | Reality |
|---|---|
| Runtime | Node **>= 22**, running `.ts` files **directly** via native type stripping |
| TypeScript | **No compiler, no `tsconfig.json`, no `typescript` dependency.** Types are erased at runtime and never checked. There is no typecheck step to run. |
| Database | **PGlite** (`@electric-sql/pglite`) embedded Postgres by default; `pg` for a real Postgres via `DATABASE_URL` |
| Schema | Raw SQL migrations in `db/migrations/` — 55 files, applied in filename order. The schema is the spine; there is no ORM. |
| Web | Hand-rolled SSR in `src/web/`. No framework. No client build step. |
| Images | `@resvg/resvg-js` rasterises the matchday card to PNG (`src/web/raster.ts`). Needs system fonts — see the Dockerfile comment. |
| Lint / format | **None configured.** Do not invent a lint step; match surrounding style by eye. |
| CI | **None.** `.github/` does not exist. Adding it is in progress. |
| Deploy | Docker → Render (`render.yaml`), health check `/healthz`, domain `joinfuria.com` |

Dependencies are three. Keep it that way: every dependency is a real cost against the breakeven number.

## Exact commands

```bash
npm install            # ~5s, 17 packages

npm test               # THE gate. ~3 minutes, serial. See "About the suite" below.
npm run web            # dev server — src/web/server.ts
npm run demo           # examples/persist-demo.ts
npm run db:apply       # bash db/apply.sh furia   (real Postgres only)
npm run db:verify      # psql furia -f db/verify.sql
```

There is no build, no typecheck and no lint command. Do not claim to have run one.

### About the suite

- 38 test files are wired into `npm test`, enumerated by hand in `package.json`. **50 test files exist on disk** — 12 are orphaned and never run: `banner`, `clientjs`, `count`, `customurl`, `eventedit`, `persona`, `plus`, `pricing`, `profileedit`, `promocode`, `subevents`, `vanity`. If you add a test file, you must add it to the `test` script by hand or it silently does nothing.
- The suite is **997 assertions** across those 38 files, and takes about **3 minutes** because every file boots its own server and re-applies all 55 migrations.
- Because it is a single `&&` chain, **the first failing file stops the run** and everything after it never executes. A "passing" run means every file ran; a failing run tells you nothing about the files below the failure.
- Run the single relevant file while iterating — `node tests/events.test.ts` — and the full suite before opening a PR.
- **The suite has side effects on tracked files.** `tests/web.test.ts` overwrites the ten `furia-app-*.html` snapshots at the repo root, and `npm install` can touch `package-lock.json`. Never `git add .` — stage the files your task actually changed, by name. Snapshot churn does not belong in a feature PR.

## Architecture

```
src/db/         22 files — repositories, one per aggregate. Raw SQL, no ORM.
                Canonical example: src/db/events_repo.ts
src/web/        41 files — SSR routes, pages and HTML rendering.
                Entry point: src/web/server.ts
src/engines/     8 files — domain computation (standings, results, eligibility)
src/pipeline/    5 files — ingestion: extract → map → resolve
src/read/        3 files — read models for the public surfaces
src/content/     4 files — posts, media, share cards
db/migrations/  55 .sql files, applied in filename order, never edited once shipped
tests/          50 .test.ts files, 38 wired into npm test
```

**Two files are dangerously large.** `src/web/server.ts` is 2,452 lines and `src/web/pages.ts` is 1,925 lines. Never read either in full — locate the region with grep and read a targeted range. Never rewrite either wholesale. Splitting them is a known, wanted refactor, but only as its own task with its own brief, never as a side effect.

**84 `_*.ts` scratch files sit at the repo root.** They are ad-hoc probes, not part of the app. Do not read them for context, do not import them, and do not add more — put throwaway probes in `/tmp`.

## Conventions

- **Branches:** `type/short-slug` — `feat/`, `fix/`, `chore/`, `refactor/`.
- **Commits:** Conventional Commits. The current history is 79 commits all titled "Add files via upload"; that stops now.
- **Pull requests:** one task per PR. The body must state the outcome in one sentence, the verification command with its actual output, and what could break.
- **Never merge your own PR.** Marcus is the final gate, always.

## Definition of done

An agent may open a pull request only when all of these are true:

1. `npm test` was run in full and the pass/fail counts are pasted into the PR body.
2. The passing assertion count did not go down.
3. The change matches the scope in the task brief. Anything discovered mid-task that falls outside the brief becomes a separate task, not a wider diff.
4. Any new test file was added to the `test` script in `package.json`.

Plausible-looking code with no run suite is unverified, not done.

## Anti-patterns

Add to this list every time a correction is needed twice. That is this file's main job.

- Do not trust the README's stack table. See the top of this file.
- Do not add a build step, bundler, `tsconfig.json`, ORM or framework. The app runs `.ts` directly on purpose.
- Do not add a dependency to solve what the standard library or the three existing dependencies already do.
- Do not edit a migration that has already shipped. Add a new numbered one.
- Do not widen scope silently, and do not refactor adjacent code "while you're in there."
- Do not weaken, skip or delete a test to make the suite pass. Fix the code or report the conflict.
- **Do not hardcode dates in seed or test data.** Use offsets from now. A hardcoded date is a time bomb — see the note below.
- Do not hardcode German strings, currency or date formats. Europe is the market.
- Do not touch auth, ownership or payment code as part of an unrelated task.
- Do not read or import the root `_*.ts` scratch files.

## Known broken, as of 3 Aug 2026

`npm test` **fails**. 996 assertions pass, 1 fails, exit code 1.

`tests/web.test.ts:126` — *"paid event shows a price + claim CTA"*. The seeded paid event "Season launch night" is hardcoded to `2026-08-01T19:00:00Z` in `src/web/seed.ts:103`. That date is now in the past, so the event page suppresses both the price and the claim CTA, and the assertion fails.

Nobody changed the code. The suite went red on its own on 1 August, and with no CI, nothing said so. The same hardcoded date means the **deployed demo instance shows its flagship paid event in the past** — which is what a prospective club currently sees.

Fix belongs in `src/web/seed.ts`: seed dates relative to now, not absolute. Do not fix it as a side effect of another task.

## Where the rest lives

- `docs/operating-system.md` — how the business is run: the loops, the cadence, the priorities.
- `docs/decisions/` — resolved calls. A change that contradicts one is wrong by construction; raise it instead of building it.
- `docs/evidence/` — logged conversations with real clubs. Argue product decisions from these, not from assumption.
- `docs/breakeven.md` — the number the whole plan is measured against.
- `docs/ADR-0001-data-foundations.md`, `docs/verification-policy.md`, `docs/consent-grant-model-for-legal-review.md` — pre-existing and still valid.
