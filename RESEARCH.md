# Research: RiseUp, competitors, and how to get Israeli bank data (2026-08-15)

Condensed from three deep-research passes (RiseUp deep-dive, competitor landscape, technical routes).
Full agent reports archived in session transcript; sources linked inline.

## 1. RiseUp (רייזאפ)

- **What it is:** monthly cashflow (תזרים) built automatically from all household bank + card
  accounts. Splits the month into fixed expenses, variable "tracked" expenses (budgeted from your
  own 3-month average per category), one-time expenses, expected income. Predicts end-of-month
  balance and flags anomalies. WhatsApp bot updates ~3x/week; human guides; native app only since
  late 2024 (was web+WhatsApp only).
- **Data access:** open banking under חוק שירות מידע פיננסי with an ISA license — read-only API,
  no passwords. (Pre-2022 it was credential scraping, which the סולידית crowd hated.)
- **Pricing:** ₪55/month (was ₪45), first month free, one subscription per household.
- **Loved:** it changes behavior — avg ₪1,100/month spending reduction claimed, ~70% improved
  cashflow in 3 months; subscription/waste detection (the Pango Simple ₪9.90 saga); proactive
  low-effort updates; everything in one place; human support + 40k-member Facebook community.
- **Hated:** price (#1 complaint, "Netflix comparison"); Hebrew-only; no cash / foreign-card
  tracking; **coarse categorization** (Finanda beats it); card removal requires support; bad fit
  for variable income; historical credential-privacy stigma.
- **Company:** ~$48M raised; 50% layoffs Apr 2024; UK product shut down Dec 2025; still top-5
  finance app in Israel. No known security incidents.

## 2. Competitors

| App | Data | Price | Wins on | Loses on |
|---|---|---|---|---|
| **Finanda** | Open banking | free / ₪16mo | accurate granular categorization, drill-down UI, manual cash entry | transfer double-counting, weak web, passive (no coaching) |
| **FamilyBiz** | Open banking | freemium | widest aggregation (pension, insurance, loans) | not a daily budgeting tool |
| **Moneytor** | Open banking | ₪49/mo | net-worth/asset dashboard, simulations | priciest, shallow budgeting |
| Bank apps (Leumi/Hapoalim insights) | own data | free | zero setup | siloed — no cross-bank+card picture |
| **Caspion / moneyman** (OSS) | israeli-bank-scrapers | free | full data ownership | setup + credential handling; no coaching |
| **YNAB** | Plaid (no IL) | $109/yr | envelope method changes behavior | learning curve, price, rigid |
| **Monarch** | Plaid+MX+Finicity | $99/yr | design, couples sharing, ~90% ML categorization | price, sync roulette |
| **Copilot** | Plaid | $95/yr | best AI categorization (learns corrections), beautiful | iOS-only, weak multi-user |
| **Actual Budget** (OSS) | SimpleFIN/CSV | free self-host | local-first privacy, polished | self-host burden, budgeting-only scope |
| Mint (dead 2024) | — | free | — | proof free ad-funded PFM dies |

**Cross-cutting lessons:**
1. Sync reliability is the #1 complaint in every market.
2. Categorization accuracy (that learns from corrections) is the #1 retention driver.
3. Coaching loops (RiseUp/YNAB) change behavior; pretty dashboards alone don't.
4. The visible Israeli gap: Finanda-grade categorization + RiseUp-style forward-looking cashflow,
   without ₪45–55/month.

## 3. Getting the data (Leumi, Hapoalim, Max, Cal)

- **Official open banking: closed to individuals.** ISA license required (company, capital,
  audits). No hobbyist tier, no public developer keys. Only indirect route: pay RiseUp and read
  the Google Sheet it exports.
- **israeli-bank-scrapers** (github.com/eshaham/israeli-bank-scrapers): actively maintained
  (v6.7.x, Node ≥22), Puppeteer logs into the bank/card websites with your credentials, returns
  normalized JSON, ~1 year history. **All four of our institutions supported.** Breaks every few
  months when banks change sites; fixed within days-weeks; current pain is Cloudflare WAF
  (anti-detect fork exists: @sergienko4/israeli-bank-scrapers).
- **moneyman** (github.com/daniel-hauser/moneyman): scheduled runner for the scrapers —
  self-hosted Docker or GitHub Actions (avoid: credentials in GitHub cloud), exports to Google
  Sheets, Telegram status. This is the standard DIY pipeline.
- **Fallbacks:** per-bank XLSX export (all four support it, ugly Hebrew formats); Gmail
  charge-alert parsing; Android notification listener (rejected — production-phone risk, no
  backfill).
- **Risk notes:** card-site logins (Max/Cal) are view-only — can't move money — so automating
  them is lower-stakes than the bank logins. Credentials must live in Windows Credential Manager
  or encrypted .env, never the plaintext Google Doc, never GitHub secrets.
