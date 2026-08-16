# תזרים — roadmap

Updated: **2026-08-16**. For agents: read CLAUDE.md first; PLAN.md has the phase history.
One glance = current state. `[ ]` open, `[x]` done. Top of the open list is next.

## ✅ Done

- [x] Scraper pipeline, all 4 institutions (`node sync.mjs`); creds DPAPI-encrypted in `creds/`
- [x] PWA live at https://tzoororg.github.io/Finance/ (Pages deploys `app/` on push to `master`)
- [x] Encrypted data delivery — `app/data.enc` (AES-256-GCM), key in `data/sync-key.txt` (gitignored)
- [x] Installed on the phone, decrypts real data (verified 2026-08-15)
- [x] Task Scheduler "Finance Sync" daily 06:30, `--publish` pushes data to master, logs `data/sync.log`
- [x] Settings sheet (language, sync-key reset, rules export) — 2026-08-16
- [x] English UI option (he/en toggle, full RTL/LTR flip) — 2026-08-16
- [x] Monthly income vs expense bar chart on home (last 6 months) — 2026-08-16
- [x] Pending transactions: category chips collapsed until tap (was: 10 chips on every item) — 2026-08-16

## 🔜 Open — next session picks from the top

- [ ] **tg-bridge alert wiring** — `notify()` in sync.mjs reads `data/tg-url.txt` (keyed worker URL,
      `%s` placeholder). Key not recoverable from transcripts; **user must create the file once**.
      Until then failures are silent (exit code + sync.log only).
- [ ] **First unattended run check** — after a scheduled 06:30 run: `data/sync.log` + Pages deploy
      succeeded. Banks may throw OTP at unattended logins; fallback per PLAN.md is cards nightly /
      banks semi-manual.
- [ ] **Projected-overshoot alert** — notify when projection < 0 by a margin; weekly, not daily.
      A few lines in sync.mjs once tg-url.txt exists.
- [ ] **Rules backlog** — ~188 of 547 transactions uncategorized. Categorize in the app inbox,
      "ייצוא חוקים" → paste into `rules.json`.
- [ ] **Verify 2026-08-16 build on the phone** — merge dev→master, check build string updates.

## 💤 Later / watch

- [ ] data.enc growth (~165KB now) — nothing to do until it's megabytes
- [ ] Scheduled task runs from `dev` tree but pushes master — fine for now, revisit if it bites

## 🚫 Deliberate non-goals (from PLAN.md)

Firestore (encrypted static file won) · open banking · on-phone scraping · cash tracking · coaching.
