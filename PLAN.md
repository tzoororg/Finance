# Plan: personal cashflow app ("Tzarim" working name)

Personal RiseUp replacement for one household. Not a product — no auth flows for strangers,
no billing, no coaching staff. Steal the three things that work: automatic sync, forward-looking
monthly cashflow, categorization that learns. Skip what we can't/shouldn't build: WhatsApp bot,
human guides, open-banking license.

## Architecture (lazy version)

```
[PC, nightly, Task Scheduler]                      [Phone]
israeli-bank-scrapers (Leumi, Hapoalim, Max, Cal)  PWA on GitHub Pages (dev/master, like DateAnalyze)
        │ normalized JSON                                 ▲
        ▼                                                 │ reads
sync.mjs: dedupe → categorize (rules file) ──────► Firebase Firestore (client-side encrypted blobs,
        │                                                   same E2EE pattern as DateAnalyze)
        └─ Telegram status via tg-bridge (only on failure — quiet when healthy)
```

- **No moneyman, no Docker.** moneyman's value is Sheets export + GH Actions; we want Firestore
  and local runs, so a ~150-line Node script calling israeli-bank-scrapers directly is less
  machinery. Revisit if the script grows features moneyman already has.
- **Credentials:** Windows Credential Manager (read via `keytar`/PowerShell at runtime).
  Bank logins are the sensitive ones; Max/Cal are view-only sites.
- **Data model:** transactions (id, date, amount, merchant, account, category, isRecurring),
  category rules (merchant-pattern → category, updated by in-app corrections), monthly budget
  targets (auto-seeded from 3-month average per category, RiseUp-style).
- **Categorization:** ordered regex/substring rules over merchant names, seeded from ~2 months of
  history in one sitting; every manual correction in the app appends a rule. No ML — Copilot's
  "learns from corrections" is a merchant→category map at personal scale.

## Phases

**Phase 0 — mock review (now).** HTML mocks in `mocks/` reviewed before any live code
(standing law). Sticker Book tokens to be pulled from DateAnalyze when we build the real UI.

**Phase 1 — the pipe (1–2 sessions).** Scraper script for all four institutions, run manually.
Success = a JSON file with real transactions from Leumi+Hapoalim+Max+Cal. This is the risk;
do it before any UI. Includes credential setup and one deliberate re-run to test dedupe.

**Phase 2 — categorize + store (1 session).** Rules engine, Firestore write with client-side
encryption, backfill ~12 months, hand-categorize the residue to seed rules.

**Phase 3 — PWA (2–3 sessions).** Screens per mocks: cashflow home (safe-to-spend), categories,
transaction inbox (confirm/correct new transactions — corrections feed rules), accounts/sync
status. dev→master branches, SW version bump, the usual three test layers.

**Phase 4 — schedule + alerts (½ session).** Task Scheduler nightly run; Telegram only on
scrape failure or projected month overshoot (<150 chars). Weekly, not daily.

**Later, only if wanted:** income tracking beyond salary detection, savings goals, XLSX-export
fallback parsers for when a scraper breaks, spouse access.

## What we're deliberately not building
- Open-banking integration (legally closed to individuals).
- On-phone scraping (headless Chromium on MIUI, production phone — no).
- Cash tracking, foreign cards, pension/insurance aggregation (Finanda/FamilyBiz territory; add
  manual-entry later if actually missed).
- Any coaching content. The forward-looking number IS the coaching.

## Costs
- **Build:** ~5–7 sessions total, mostly Sonnet. Rough token spend 300–600k across the project.
- **Run:** zero LLM tokens in the loop (plain Node + static PWA). Firebase free tier is plenty.
  Maintenance reality: a scraper breaks every few months → `npm update` or a small fix session
  (~10–30k tokens, a few times a year).
- **Comparison point:** RiseUp is ₪660/year; Finanda ₪0–16/month if this ever feels like too
  much maintenance.

## Open questions (for later, not blockers)
- Firestore vs. plain encrypted JSON in a private repo/Drive — decide in Phase 2 based on how
  DateAnalyze's E2EE helper reuses.
- Whether Hapoalim/Leumi logins trigger OTP on unattended runs — Phase 1 will tell us; fallback
  is running cards nightly and banks semi-manually.
