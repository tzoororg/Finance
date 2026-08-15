# TODO — state and next steps

Updated: 2026-08-15. For future agents: read CLAUDE.md first; PLAN.md has the phase history.

## Current state (all phases 1–4 done)

- Scraper pipeline works for all 4 institutions (`node sync.mjs`); creds DPAPI-encrypted in `creds/`.
- PWA live at **https://tzoororg.github.io/Finance/** (Pages deploys `app/` via
  `.github/workflows/pages.yml` on push to `master`; the environment allows master deploys).
- Data reaches the phone as `app/data.enc` (AES-256-GCM). Key lives in `data/sync-key.txt`
  (gitignored); the phone keeps it in localStorage after one-time entry. Never commit or print it.
- PWA installed on the physical phone (תזרים icon, standalone, decrypts real data — verified 2026-08-15).
- Task Scheduler job **"Finance Sync"** runs `node sync.mjs --publish` daily 06:30, logs to
  `data/sync.log`. `--publish` commits `app/data.enc` and pushes `HEAD:master`.
  Note: the scheduled task runs from the `dev` working tree and pushes to master — data-only
  commits land on both. Fine for now; revisit if it ever bites.

## Open items (next session picks from the top)

1. **tg-bridge alert wiring** — `notify()` in sync.mjs reads `data/tg-url.txt` (keyed worker URL
   with `%s` message placeholder). The key wasn't recoverable from transcripts; the user needs to
   create that file once. Until then failures are silent (exit code + sync.log only).
2. **First unattended run check** — after the first scheduled 06:30 run, check `data/sync.log` and
   that the Pages deploy succeeded (banks may throw OTP at an unattended login; PLAN.md's fallback
   is cards nightly / banks semi-manual).
3. **Projected-overshoot alert** (Phase 4 second half) — notify when projection < 0 by some margin;
   weekly, not daily, per house rules. A few lines in sync.mjs once tg-url.txt exists.
4. **Rules backlog** — 188 of 547 transactions uncategorized. Categorize in the app inbox on the
   phone, then "ייצוא חוקים" → paste into `rules.json`.
5. **Battery/scale check-in later** — data.enc grows with history (~165KB now); nothing to do
   until it's megabytes.

## Deliberate non-goals (unchanged from PLAN.md)

Firestore (encrypted static file won), open banking, on-phone scraping, cash tracking, coaching.
