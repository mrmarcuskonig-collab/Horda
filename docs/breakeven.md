# Breakeven

The number the whole plan is measured against. Every weekly steering session opens with progress against it.

**Goal:** EBITDA-positive before **May 2027** (nine months from August 2026).

## The arithmetic

```
C  = monthly cost base       (founder draw + infra + tools + legal + accounting)
P  = price per tenant/month
M  = gross margin            (0.85–0.95 typical for SaaS)

Tenants needed at breakeven  =  C / (P × M)
Weeks remaining              =  <fill>
Required new tenants/week    =  tenants needed / weeks remaining
```

## Current values

| Input | Value | Last reviewed |
|---|---|---|
| Monthly cost base (C) | `<FILL>` | |
| Price per tenant (P) | `<FILL>` | |
| Gross margin (M) | `<FILL>` | |
| **Tenants at breakeven** | `<FILL>` | |
| **Required run-rate** | `<FILL>` /week | |

## Actuals

| Metric | Value | As of |
|---|---|---|
| Paying tenants | 0 | 2026-08-03 |
| Trials running | 0 | 2026-08-03 |
| Conversations logged | 0 | 2026-08-03 |
| Conversation → paying conversion | n/a | |

## The funnel implication

Once the conversion rate from logged conversation to paying tenant is known, the required weekly conversation count falls out of it directly:

```
Conversations needed/week = required new tenants per week / conversion rate
```

If the implied number is not achievable by one person, that is not a scheduling problem — it means the price, the wedge or the city is wrong, and the plan needs changing rather than the calendar. Expect to know this within roughly six weeks of starting the evidence loop.

## Review rules

- Update actuals every Monday in steering.
- Update inputs whenever a real cost or a real price changes — not from estimates.
- If the required run-rate has been missed four weeks running, that is a signal to change the plan, not to work harder. Raise it explicitly.
