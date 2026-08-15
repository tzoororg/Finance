// Nightly sync: scrape Leumi/Hapoalim/Max/Cal -> data/transactions.json + app/data.json
// Usage: node sync.mjs [--company leumi] [--months 12] [--show]
import { createScraper } from 'israeli-bank-scrapers';
import { execFileSync } from 'node:child_process';
import { createHash, createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';

const ROOT = import.meta.dirname;
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const only = flag('--company');
const show = args.includes('--show');

// --- credentials (DPAPI-encrypted by setup-creds.ps1, decrypted via PowerShell) ---
function decrypt(enc) {
  const ps = `$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim());` +
    `[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`;
  return execFileSync('powershell', ['-NoProfile', '-Command', ps], { input: enc, encoding: 'utf8' }).trim();
}
function loadCreds(company) {
  const raw = JSON.parse(readFileSync(`${ROOT}/creds/${company}.json`, 'utf8').replace(/^﻿/, '')); // strip PS5.1 BOM
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, decrypt(v)]));
}

// --- store ---
mkdirSync(`${ROOT}/data`, { recursive: true });
const loadJson = (p, fallback) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback;
const store = loadJson(`${ROOT}/data/transactions.json`, {});          // id -> txn
const accounts = loadJson(`${ROOT}/data/accounts.json`, {});           // company/acct -> summary
const rules = loadJson(`${ROOT}/rules.json`, []);

export function categorize(description, ruleList = rules) {
  const d = description.toLowerCase();
  for (const r of ruleList) if (d.includes(r.match.toLowerCase())) return r.category;
  return null;
}

export function txnId(company, account, t) {
  return createHash('sha1')
    .update([company, account, t.date, t.chargedAmount, t.description, t.identifier ?? ''].join('|'))
    .digest('hex').slice(0, 16);
}

export function mergeTxns(store, company, account, txns, ruleList = rules) {
  let added = 0;
  for (const t of txns) {
    const id = txnId(company, account, t);
    if (store[id]) { store[id].status = t.status; continue; } // keep category on re-scrape
    store[id] = {
      id, company, account,
      date: t.date.slice(0, 10),
      amount: t.chargedAmount,
      currency: t.originalCurrency || 'ILS',
      description: t.description.trim(),
      memo: t.memo || '',
      status: t.status,
      category: categorize(t.description, ruleList),
    };
    added++;
  }
  return added;
}

// --- encryption (AES-256-GCM; key = sha256 of a random hex passphrase kept in data/) ---
// ponytail: no PBKDF2 — the passphrase is 128-bit random hex, not a human password.
export function encryptData(json, passphrase) {
  const key = createHash('sha256').update(passphrase).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(json, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ iv: iv.toString('base64'), data: ct.toString('base64') });
}
function loadOrCreateKey() {
  const p = `${ROOT}/data/sync-key.txt`;
  if (!existsSync(p)) writeFileSync(p, randomBytes(16).toString('hex'));
  return readFileSync(p, 'utf8').trim();
}

// Telegram alert via tg-bridge. data/tg-url.txt holds the keyed worker URL with a %s
// placeholder for the message (e.g. https://tg-bridge.../send?key=X&msg=%s). Missing file = no alerts.
async function notify(msg) {
  const p = `${ROOT}/data/tg-url.txt`;
  if (!existsSync(p)) return;
  try {
    await fetch(readFileSync(p, 'utf8').trim().replace('%s', encodeURIComponent(msg.slice(0, 140))));
  } catch { /* alerting must never break the sync */ }
}

// --- main ---
async function main() {
  const firstRun = Object.keys(store).length === 0;
  const months = Number(flag('--months') ?? (firstRun ? 12 : 2));
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const companies = args.includes('--recat-only') ? [] : only ? [only]
    : readdirSync(`${ROOT}/creds`).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  if (!companies.length && !args.includes('--recat-only')) { console.error('No credentials found. Run .\\setup-creds.ps1 first.'); process.exit(1); }

  let failed = 0;
  for (const company of companies) {
    process.stdout.write(`${company}... `);
    try {
      // persistent profile per company so completed 2FA/device-trust survives between runs
      const scraper = createScraper({
        companyId: company, startDate, showBrowser: show, timeout: 120000,
        args: [`--user-data-dir=${ROOT}/data/profiles/${company}`],
      });
      const result = await scraper.scrape(loadCreds(company));
      if (!result.success) throw new Error(`${result.errorType}: ${result.errorMessage ?? ''}`);
      let added = 0;
      for (const acct of result.accounts) {
        added += mergeTxns(store, company, acct.accountNumber, acct.txns);
        accounts[`${company}/${acct.accountNumber}`] = {
          company, account: acct.accountNumber,
          balance: acct.balance ?? null,
          lastSync: new Date().toISOString(), status: 'ok',
        };
      }
      console.log(`ok, +${added} new`);
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
      const key = Object.keys(accounts).find(k => k.startsWith(company + '/'));
      if (key) { accounts[key].status = 'error'; accounts[key].error = String(e.message).slice(0, 200); }
      else accounts[`${company}/?`] = { company, account: '?', status: 'error', error: String(e.message).slice(0, 200) };
    }
  }

  // re-apply rules to still-uncategorized txns (rules grow over time; manual categories untouched)
  for (const t of Object.values(store)) if (!t.category) t.category = categorize(t.description);

  writeFileSync(`${ROOT}/data/transactions.json`, JSON.stringify(store, null, 1));
  writeFileSync(`${ROOT}/data/accounts.json`, JSON.stringify(accounts, null, 1));
  const exportJson = JSON.stringify({
    generatedAt: new Date().toISOString(),
    accounts: Object.values(accounts),
    transactions: Object.values(store).sort((a, b) => b.date.localeCompare(a.date)),
  });
  writeFileSync(`${ROOT}/app/data.json`, exportJson);
  writeFileSync(`${ROOT}/app/data.enc`, encryptData(exportJson, loadOrCreateKey()));
  const uncat = Object.values(store).filter(t => !t.category).length;
  console.log(`\n${Object.keys(store).length} transactions total, ${uncat} uncategorized, ${failed} scraper(s) failed`);

  if (args.includes('--publish')) {
    try {
      execFileSync('git', ['add', 'app/data.enc'], { cwd: ROOT });
      execFileSync('git', ['commit', '-m', 'data sync'], { cwd: ROOT });
      execFileSync('git', ['push', 'origin', 'HEAD:master'], { cwd: ROOT });
      console.log('published data.enc');
    } catch (e) {
      // nothing to commit is fine; a real push failure counts as a sync failure
      if (!/nothing to commit/.test(String(e.stdout || e.message))) { failed++; console.log(`publish FAILED: ${e.message}`); }
    }
  }

  if (failed) await notify(`תזרים: ${failed} scraper(s) failed tonight`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) await main();
