# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal expense tracker (RiseUp-style תזרים) for one household. Nightly scrape of Israeli
banks/cards on the PC feeds a Hebrew RTL PWA. Background: [RESEARCH.md](RESEARCH.md); phased
plan and deliberate non-goals: [PLAN.md](PLAN.md).

## Commands

```powershell
node --test test/logic.test.mjs      # logic self-checks (dedupe, categorize, merge)
node sync.mjs                        # scrape all institutions with stored creds
node sync.mjs --company visaCal --show   # one institution, visible browser (debugging)
node sync.mjs --months 12            # override lookback (default: 12 on empty store, else 2)
.\setup-creds.ps1                    # (user-run only) enter/update bank credentials
```

Serve the app via the `app` config in `.claude/launch.json` (http-server on port 8321), or
`npx http-server app -p 8321 -c-1`.

## Architecture

Two halves, connected only by a JSON file:

- **`sync.mjs`** (PC, scheduled): israeli-bank-scrapers (Puppeteer) logs into Leumi / Hapoalim /
  Max / Cal websites, normalizes transactions, merges into `data/transactions.json` (id =
  sha1 of company|account|date|amount|description|identifier — merge is idempotent and never
  overwrites an existing category), applies `rules.json` (ordered substring match → category),
  and exports `app/data.json` for the UI. Exit code 1 if any scraper failed.
- **`app/`** (phone): vanilla-JS PWA, no build step, hash-based tabs. Fetches `data.json`,
  falls back to `data.sample.json`. Budgets = 3-month average per category. User corrections
  live in localStorage (`categoryOverrides`, `budgetOverrides`, `pendingRules`); "ייצוא חוקים"
  copies pendingRules for manual merge into `rules.json`. "Now" is `data.generatedAt`, not the
  system clock.

Credentials: DPAPI-encrypted per institution in `creds/` (gitignored), written by
`setup-creds.ps1`, decrypted at runtime by spawning PowerShell. Never ask the user to provide
credentials in chat; point them at the script.

## Hard rules

- **Never edit Hebrew/UTF-8 files via PowerShell pipelines** (`Get-Content`/`Set-Content`
  round-trips mojibake them). Use the Edit/Write tools. PS5.1 also writes BOMs — strip when
  parsing anything PowerShell wrote.
- Bump `CACHE` in `app/sw.js` **and** `BUILD` in `app/app.js` on every app/ change, or the
  service worker serves the stale shell.
- `data/`, `creds/`, and `app/data.json` hold real financial data and are gitignored — never
  commit, print, or paste their contents; use `data.sample.json` for anything user-visible.
- Work on `dev`. After committing a finished change, push and release it yourself without asking:
  `git push origin dev && git push origin dev:master`, then verify the Pages deploy succeeded
  (user standing instruction, 2026-08-16).
- Scrapers break when banks change their sites — before debugging sync.mjs logic, check
  israeli-bank-scrapers issues and try `npm update israeli-bank-scrapers`.
