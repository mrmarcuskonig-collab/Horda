# 0003 — Build approach: solo, AI-built

- **Status:** accepted
- **Date:** 2026-06-17
- **Supersedes:** —

## Context
No engineering hires are planned or affordable.

## Decision
Founder-led product and engineering, executed through AI agents working directly in this repo.

## Consequences
- Durable context lives in the repo (`AGENTS.md`, `docs/`), never in a chat session.
- Sessions are scoped to a single task and discarded; no long-lived role-shaped chats acting as memory.
- Every task needs a verification signal an agent can run without a human, or it cannot be run autonomously.
