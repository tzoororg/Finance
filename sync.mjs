// Nightly sync: scrape Leumi/Hapoalim/Max/Cal -> data/transactions.json + app/data.json
// Usage: node sync.mjs [--company leumi] [--months 12] [--show]
import { createScraper } from 'israeli-bank-scrapers';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  writeFileSync(`${ROOT}/app/data.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    accounts: Object.values(accounts),
    transactions: Object.values(store).sort((a, b) => b.date.localeCompare(a.date)),
  }));
  const uncat = Object.values(store).filter(t => !t.category).length;
  console.log(`\n${Object.keys(store).length} transactions total, ${uncat} uncategorized, ${failed} scraper(s) failed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) await main();
