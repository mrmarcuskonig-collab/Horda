# Horda — Founder Operating System

**Purpose:** how one person runs product, engineering and go-to-market at the standard of an AI-native team, without a team.
**Destination in repo:** `docs/operating-system.md`
**Status:** v1 draft, 3 Aug 2026. Revise it in the same PR that changes the practice.

---

## 0. The uncomfortable part, first

You asked how to work like the best AI-native product and engineering teams so you can ship tier-one results and reach EBITDA-positive in under nine months.

Your own Command Center says Product & Engineering has shipped 15 slices, has real auth, identity and ownership, Luma events, monetization, a live filterable start screen, 160/160 tests, and is "ready to deploy as a pilot." It also says Tenant Acquisition is ★ TOP PRIORITY, that there is no warm club or fighter, and that supply has to be built cold.

So: **shipping velocity is not your binding constraint. Distribution is.** A better engineering loop is a multiplier on a number that is currently zero paying tenants. Two times zero is zero.

The single most important thing the best teams do is not worktrees or spec-first prompting. It is refusing to optimise anything that is not the binding constraint. Everything below is organised around that. The engineering loop gets tightened once, in week one, so it stops costing you attention — and then your attention goes almost entirely to the commercial side, where it compounds.

If you read nothing else: **Part 1 is a two-day setup. Part 3 is where you should be spending 70% of your weeks.**

---

## Part 1 — Close the loop (Days 1–2, once)

Right now you are the transport layer: the VP Engineering session builds, hands you a package, you carry it to GitHub. Kill that.

### Step 1.1 — Give the engineering session the repo directly

The agent should clone, branch, test, and open a pull request itself. You review a diff in GitHub and merge. No zips, no copy-paste, no "which version is this."

Two ways, pick one:

- **Cloud:** the session clones from GitHub over HTTPS, works in its own sandbox, and pushes a branch. Nothing touches your Mac.
- **Local:** connect the Horda folder in the desktop app and the session works in place.

Prefer the cloud path for engineering work. It is disposable, it cannot corrupt your working tree, and it makes parallel agents trivial.

**Definition of done:** you have merged one pull request that an agent opened, without a file ever passing through your hands.

### Step 1.2 — Write `AGENTS.md` at the repo root

This is the file every future session reads before doing anything. It replaces the context you currently re-type.

Keep it imperative and under ~500 lines. "Use pnpm, not npm" beats "we prefer pnpm" — agents follow it literally, so vagueness costs you.

Sections, in this order:

1. **What Horda is** — two paragraphs, no marketing voice. What it does, who the tenant is, who the end user is.
2. **Stack and pinned versions.**
3. **Exact commands** — install, dev, test, lint, typecheck, build, deploy. Copy-pasteable. This is the highest-ROI section in the file; omitting it is the most common mistake teams make.
4. **Architecture** — the folder logic and why it is that way. Name the canonical example file for each pattern rather than describing the pattern.
5. **Conventions** — branch naming, Conventional Commits, PR description template.
6. **Definition of done** — what must be true before an agent opens a PR: tests pass, typecheck clean, no new lint errors, changelog entry.
7. **Anti-patterns** — the specific things you keep having to correct. Every time you correct an agent twice, that correction belongs here.

### Step 1.3 — Move the durable decisions into the repo

Create `docs/decisions/` and write your five resolved calls as one short file each: parent structure, no warm tenant, solo + AI-built, bootstrap, the four beachhead regions. Format: context, decision, consequences, date, status.

Then move `horda-operating-doc.md` into `docs/`. And put this file at `docs/operating-system.md`.

**Why this matters more than it sounds:** agents have no memory between sessions. Right now that memory lives in your chat history and in your head, which means you are the bus. Once it lives in the repo, any session you open — today or in November — starts with the same ground truth, and you stop paying the re-explanation tax.

### Step 1.4 — Add the automated review pass

Add a GitHub Action that runs on every PR and posts a review comment: what changed, what could break, a risk assessment, and anything that contradicts `AGENTS.md`. This is what Anthropic's product design team does with Claude on PR comments and what Cursor ships as Bugbot.

The point is not that it catches everything. The point is that it reads the diff with fresh eyes, which the agent that wrote it structurally cannot do.

**By end of Day 2 you should have:** an agent-opened PR, merged; `AGENTS.md` live; decisions in `docs/`; CI posting a review on every PR.

---

## Part 2 — Restructure how you work with sessions (Day 3)

### Step 2.1 — Retire the long-lived "VP Engineering" chat as a worker

This is the change you will resist most, so here is the reasoning.

None of the teams you are benchmarking against run persistent role-shaped agent chats. There is no standing "VP Engineering" session at Cursor or Anthropic. Sessions are scoped to a task — a feature, a bug, a refactor — and the durable context lives in the repo.

Your VP Engineering chat is doing two jobs at once: it is the worker *and* the memory. That has three costs. Its context is now months of stale decisions competing with the current task. You cannot fork it, so you can never run two pieces of work in parallel. And when it degrades, your only options are to keep going or lose everything it knows.

Split the two jobs. The **role** — its standing brief, its conventions, how it writes specs, what it must never do — becomes `AGENTS.md` plus a skill. The **work** happens in a fresh task-scoped session that reads those files and dies when the task ships.

Keep the CEO session. Strategy genuinely benefits from continuity, and it is not writing code.

### Step 2.2 — Encode the handoff as a skill

You keep writing the same kind of brief by hand. Turn it into a skill so the format is consistent and you stop improvising under time pressure.

A Horda engineering task brief should force you to state: the outcome in one sentence, the files and interfaces involved, **what is explicitly out of scope**, and the end-to-end verification step. The out-of-scope line is the one that saves you — it is what stops a 200-line task becoming a 2,000-line diff.

### Step 2.3 — Learn the parallel move

Two or three task-scoped sessions on separate branches, working on genuinely independent slices. Conflicts resolve at merge like any branch merge. Both Cursor and Anthropic call this out as the main unlock once the single-agent loop is smooth.

Do not do this in week one. Get one loop clean first; parallelism multiplies whatever quality your loop already has, including the bad parts.

---

## Part 3 — The three loops (ongoing, this is the actual job)

### Loop A — The build loop (daily, but shrinking)

1. **Spec.** The session explores read-only and proposes an approach. You correct it *here* — correction at the plan stage is cheap, correction after a large diff is expensive. This is the single highest-leverage minute of your day.
2. **Build.** It writes across files and runs commands, against a verifiable goal: your 160 tests, the typechecker, the linter.
3. **Verify.** It runs the suite and iterates until green. Because you have a check the agent can run, you can walk away — this is exactly what Anthropic's design team means by autonomous loops.
4. **Review.** CI posts its adversarial pass. You read the diff for *architecture*, not style. Google's explicit shift: stop nitpicking style on agent-written code, review the blueprint.
5. **Merge.** You are the final gate. Always.

**Time-box this to two hours a day.** If the build loop is eating your week, you are building things nobody has asked to pay for.

### Loop B — The evidence loop (daily, non-negotiable)

Every working day, one conversation with a club, a fighter, or an organiser in one of the starting German cities — Berlin, Hamburg, Cologne, Munich. Cold. Not research, not a survey — a real conversation about what their event admin actually costs them today.

Log every one in `docs/evidence/YYYY-MM-DD-<who>.md`: who, what they run, what they use now, what they pay for it, what they said no to and why, and one verbatim quote.

Two reasons this lives in the repo. It becomes ground truth your agents can read, so product decisions get argued from evidence instead of vibes. And when you have thirty of these, the pattern in them *is* your positioning, your pricing and your pitch — you will not have to invent any of it.

**Target: 100 logged conversations by month three.** That is roughly five a week. It is the hardest habit in this document and the one that determines whether you hit the goal.

### Loop C — The steering loop (weekly, automated)

A scheduled task every Monday that reads the repo, checks CI and open PRs, counts new evidence files and paying tenants, and refreshes the Command Center artifact. Your board last updated 19 June — that is the failure mode this fixes.

Then thirty minutes with the CEO session, on three questions only:

- What did we learn from the evidence loop that contradicts what we believed last week?
- What is the binding constraint *now*?
- What am I doing that is not that?

---

## Part 4 — The arithmetic you need to do today

"EBITDA-positive in under nine months" is a number, not a mood. Until it is written down you cannot tell whether any given week helped.

Fill this in — the figures below are **illustrative placeholders**, not estimates of your business:

```
Monthly cost base (founder draw + infra + legal + tools)   = C
Price per tenant per month                                  = P
Gross margin per tenant                                     = M   (~85–95% for SaaS)
Tenants needed at breakeven                                 = C / (P × M)
```

If C is €5,000 and P is €149 at 90% margin, you need about **37 paying tenants**. Nine months to 37 tenants is roughly one new paying tenant a week from month three. That is the number that should be on your wall — not slices shipped, not tests passing.

Now work backwards. If one in five serious conversations converts, one paying tenant a week means five real conversations a week, which means the evidence loop *is* the sales pipeline, not a research exercise. If your conversion is one in fifteen, either the price is wrong, the wedge is wrong, or the region is wrong — and you will know within six weeks, which is the point.

**Do this arithmetic before you write another line of code.** Everything in Parts 1–3 is in service of it.

---

## Part 5 — What actually separates tier-one output

Speed is table stakes now; everyone has the same models. Three things still differentiate.

**Taste.** Agents produce plausible work by default, and plausible is the enemy of excellent. Your job is to be the person who says "this is fine and I don't want it." Your dark-theme call and the wordmark cut into the raven's angles are taste decisions — they do not come from the loop, they come from you, and they are most of what people will actually feel about Horda.

**Verification.** Plausible-looking code with no passing check is unverified, not done. You already have 160 tests; the discipline is never letting that erode when you are in a hurry. It is the only reason you get to walk away from an autonomous run.

**Focus.** The best teams are defined less by what they build than by what they refuse to build. Europe is the destination, but with one founder, the refusal muscle is your scarcest asset. Drive one region to density before touching the second — your own D5 already says this. Hold yourself to it.

---

## The first week, concretely

- **Day 1** — Repo access for the engineering session. Merge one agent-opened PR. Write `AGENTS.md`.
- **Day 2** — Decisions and operating docs into `docs/`. CI review action live.
- **Day 3** — Retire the standing VP Engineering chat. Write the task-brief skill. Open your first task-scoped session against `AGENTS.md`.
- **Day 4** — Do the Part 4 arithmetic. Write the breakeven number into `docs/`. Set up the Monday steering task.
- **Day 5** — Start the evidence loop. Five conversations. Log all five, including the ones that go badly — especially those.

From week two, the ratio is roughly 70% commercial, 20% build loop, 10% steering. If it inverts, that is the signal that you have retreated into the part of the job that feels safest, which for a technical founder is always the code.
