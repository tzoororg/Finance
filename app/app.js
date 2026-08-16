// תזרים — vanilla JS PWA. No framework, no build step, no router lib (hash-based tabs).
'use strict';

const BUILD = 'build 2026-08-16.1';

// Categories fixed/variable split, used for the home screen breakdown.
const FIXED_CATEGORIES = new Set(['דירה', 'מנויים ותקשורת']);
const TRANSFER_CATEGORY = 'העברה פנימית';
const INCOME_CATEGORY = 'הכנסה';

// Quick-assign chip set shown on every pending transaction (kept small on purpose —
// anything else goes through the "אחר…" prompt). ponytail: static list, add categories here.
const CATEGORY_CHIPS = [
  ['🛒', 'סופר'],
  ['🍔', 'אוכל בחוץ ומשלוחים'],
  ['⛽', 'רכב ותחבורה'],
  ['📱', 'מנויים ותקשורת'],
  ['🏠', 'דירה'],
  ['💊', 'בריאות ופארם'],
  ['🎮', 'פנאי'],
  ['🔁', TRANSFER_CATEGORY],
  ['💰', INCOME_CATEGORY],
];
const CATEGORY_EMOJI = Object.fromEntries(CATEGORY_CHIPS.map(([e, c]) => [c, e]));
const emojiFor = (cat) => CATEGORY_EMOJI[cat] || '🎁';

const COMPANY_INFO = {
  leumi: { name: 'לאומי', logo: 'לא', color: '#0a4da3' },
  hapoalim: { name: 'הפועלים', logo: 'פוע', color: '#c8102e' },
  max: { name: 'מקס', logo: 'מקס', color: '#00b0b9' },
  visaCal: { name: 'ויזה כאל', logo: 'כאל', color: '#5b2d8e' },
};

// --- localStorage-backed overrides -----------------------------------------------------
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

// --- i18n --------------------------------------------------------------------------------
// Category names stay Hebrew in both languages — they're data (rules.json), not UI chrome.
const LANG = store.get('lang', 'he');
const LOCALE = LANG === 'he' ? 'he-IL' : 'en-GB';
const I18N = {
  he: {
    projTitle: 'צפי סוף חודש', remainTitle: 'נשאר להוציא החודש',
    income: 'הכנסות', fixed: 'הוצאות קבועות', variable: 'הוצאות משתנות עד כה',
    chartTitle: 'הכנסות מול הוצאות', chartLegend: '🟩 הכנסות · 🟥 הוצאות (ללא העברות)',
    catTitle: 'קטגוריות',
    catHint: 'תקציב לכל קטגוריה נקבע אוטומטית מממוצע 3 חודשים — אפשר לדרוס ידנית (הקש על קטגוריה)',
    txTitle: 'תנועות', pendingHead: 'ממתינות לאישור', exportRules: 'ייצוא חוקים',
    accTitle: 'חשבונות', accNote: 'הסנכרון רץ על המחשב בבית — הסיסמאות לא עוזבות אותו',
    tabHome: 'תזרים', tabCategories: 'קטגוריות', tabTransactions: 'תנועות', tabAccounts: 'חשבונות',
    settingsTitle: 'הגדרות', close: 'סגירה', language: 'שפה',
    syncKey: 'מפתח סנכרון', resetKey: 'איפוס', pendingRulesLabel: 'חוקים ממתינים',
    updated: (time, days) => `עודכן ${time} · ${days} ימים נותרו`,
    paceOk: 'תקין', paceOver: 'חריג',
    pace: (state, avg) => `קצב ${state} — ‎${avg} ₪ ליום בממוצע`,
    anomalyTitle: '⚠️ חיוב חריג',
    anomalyBody: (desc, amt, n) => `״${desc}״ ${amt} ₪ — חיוב חוזר בפעם ה־${n}. מנוי שלא זיהינו?`,
    uncategorized: 'אחר / לא מסווג', outOf: 'מתוך', overrun: 'חריגה',
    noExpenses: 'אין הוצאות החודש', noPending: 'אין תנועות ממתינות',
    otherChip: 'אחר…', today: 'היום', yesterday: 'אתמול',
    totalBalance: 'סה״כ עו״ש', badgeOk: 'מעודכן', badgeErr: 'שגיאה', failed: 'נכשל',
    synced: (when) => `סונכרן ${when}`, syncFailed: (name) => `🔧 סנכרון ${name} נכשל`,
    budgetPrompt: (cat) => `תקציב חודשי עבור "${cat}" (₪)`,
    catPrompt: 'קטגוריה עבור התנועה:',
    keyPrompt: 'מפתח סנכרון (מהמחשב, data/sync-key.txt):', keyWrong: 'מפתח שגוי, נסו שוב',
    rulesCopied: (n) => `הועתקו ${n} חוקים ללוח (להדבקה בתוך rules.json)`,
    copyManually: 'העתק ידנית:',
    resetKeyConfirm: 'לאפס את מפתח הסנכרון? תתבקשו להזין אותו מחדש.',
  },
  en: {
    projTitle: 'End-of-month projection', remainTitle: 'Left to spend this month',
    income: 'Income', fixed: 'Fixed expenses', variable: 'Variable expenses so far',
    chartTitle: 'Income vs expenses', chartLegend: '🟩 income · 🟥 expenses (transfers excluded)',
    catTitle: 'Categories',
    catHint: 'Each category budget defaults to a 3-month average — tap a category to override',
    txTitle: 'Activity', pendingHead: 'Pending review', exportRules: 'Export rules',
    accTitle: 'Accounts', accNote: 'Sync runs on the home PC — passwords never leave it',
    tabHome: 'Cash flow', tabCategories: 'Categories', tabTransactions: 'Activity', tabAccounts: 'Accounts',
    settingsTitle: 'Settings', close: 'Close', language: 'Language',
    syncKey: 'Sync key', resetKey: 'Reset', pendingRulesLabel: 'Pending rules',
    updated: (time, days) => `Updated ${time} · ${days} days left`,
    paceOk: 'on track', paceOver: 'over',
    pace: (state, avg) => `Pace ${state} — ${avg} ₪/day average`,
    anomalyTitle: '⚠️ Unusual charge',
    anomalyBody: (desc, amt, n) => `"${desc}" ${amt} ₪ — recurring charge, ${n} times now. Unrecognized subscription?`,
    uncategorized: 'Other / uncategorized', outOf: 'of', overrun: 'over budget',
    noExpenses: 'No expenses this month', noPending: 'No pending transactions',
    otherChip: 'Other…', today: 'Today', yesterday: 'Yesterday',
    totalBalance: 'Total balance', badgeOk: 'Up to date', badgeErr: 'Error', failed: 'Failed',
    synced: (when) => `Synced ${when}`, syncFailed: (name) => `🔧 ${name} sync failed`,
    budgetPrompt: (cat) => `Monthly budget for "${cat}" (₪)`,
    catPrompt: 'Category for this transaction:',
    keyPrompt: 'Sync key (from the PC, data/sync-key.txt):', keyWrong: 'Wrong key, try again',
    rulesCopied: (n) => `Copied ${n} rules to clipboard (paste into rules.json)`,
    copyManually: 'Copy manually:',
    resetKeyConfirm: 'Reset the sync key? You will be asked to enter it again.',
  },
};
const t = (k, ...args) => {
  const v = I18N[LANG][k] ?? I18N.he[k] ?? k;
  return typeof v === 'function' ? v(...args) : v;
};

function applyLang() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'he' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('sel', b.dataset.lang === LANG));
}

const ILS = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const fmt = (n) => ILS.format(Math.round(n));
const fmtSigned = (n) => (n >= 0 ? '‎+' : '‎−') + fmt(Math.abs(n)) + ' ₪';
const monthKey = (d) => d.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
const daysInMonth = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();

let DATA = null; // { accounts, transactions, generatedAt }
let NOW = null;  // Date, taken from data.generatedAt so the app works on sample/offline data

// data.enc = {iv, data} base64, AES-256-GCM, key = SHA-256 of the sync key shown on the PC
// (data/sync-key.txt). Asked for once, kept in localStorage.
async function decryptBlob(blob, passphrase) {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const keyBits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
  const key = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function loadData() {
  let raw;
  try {
    const r = await fetch('data.enc', { cache: 'no-store' });
    if (!r.ok) throw new Error('no data.enc');
    const blob = await r.json();
    let pass = store.get('syncKey', null);
    for (;;) {
      if (!pass) pass = prompt(t('keyPrompt'));
      if (!pass) throw new Error('no key'); // user cancelled -> sample data
      try { raw = await decryptBlob(blob, pass.trim()); break; }
      catch { pass = null; alert(t('keyWrong')); }
    }
    store.set('syncKey', pass.trim());
  } catch {
    try {
      const r = await fetch('data.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('no data.json');
      raw = await r.json();
    } catch {
      raw = await (await fetch('data.sample.json', { cache: 'no-store' })).json();
    }
  }
  const overrides = store.get('categoryOverrides', {});
  raw.transactions.forEach((t) => { if (overrides[t.id] != null) t.category = overrides[t.id]; });
  DATA = raw;
  NOW = new Date(raw.generatedAt);
}

// --- derived helpers ---------------------------------------------------------------------
const isTransfer = (t) => t.category === TRANSFER_CATEGORY;
function txIsIncome(t) { return t.amount > 0 && !isTransfer(t); }
function txIsExpense(t) { return t.amount < 0 && !isTransfer(t); }

function txnsForMonth(ym) { return DATA.transactions.filter((t) => monthKey(t.date) === ym); }

function prevMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function sumExpenses(txns, filterFn) {
  return txns.filter(txIsExpense).filter(filterFn ?? (() => true)).reduce((s, t) => s + Math.abs(t.amount), 0);
}

// --- HOME ----------------------------------------------------------------------------------
function renderHome() {
  const ym = monthKey(NOW.toISOString().slice(0, 10));
  const monthTxns = txnsForMonth(ym);
  const dim = daysInMonth(ym);
  const dayOfMonth = NOW.getDate();
  const daysRemaining = Math.max(0, dim - dayOfMonth);

  const income = monthTxns.filter(txIsIncome).reduce((s, t) => s + t.amount, 0);
  const fixedSpent = sumExpenses(monthTxns, (t) => FIXED_CATEGORIES.has(t.category));
  const variableSpent = sumExpenses(monthTxns, (t) => !FIXED_CATEGORIES.has(t.category));

  // 3-month lookback for variable-spend pace (previous FULL months only).
  const prev3 = prevMonths(ym, 3);
  const prev3Txns = prev3.flatMap(txnsForMonth);
  const prev3VariableTotal = sumExpenses(prev3Txns, (t) => !FIXED_CATEGORIES.has(t.category));
  const prev3Days = prev3.reduce((s, m) => s + daysInMonth(m), 0) || 1;
  const avgDailyVariable = prev3VariableTotal / prev3Days;

  // Projected end-of-month = income so far - expenses so far - (avg daily variable spend * days left).
  // No "expected remaining fixed charges" modeling in v1 (per spec) — fixed costs already booked
  // this month are counted once, in expenses-so-far.
  const projection = income - fixedSpent - variableSpent - avgDailyVariable * daysRemaining;

  document.getElementById('home-month').textContent = NOW.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const projEl = document.getElementById('home-projection');
  projEl.textContent = fmtSigned(projection);
  projEl.className = 'big ' + (projection >= 0 ? 'pos' : 'neg');
  document.getElementById('home-updated').textContent =
    t('updated', NOW.toLocaleString(LOCALE, { hour: '2-digit', minute: '2-digit' }), daysRemaining);

  // "Remaining to spend" = a monthly variable-spend budget (avg of last 3 months) minus what's spent so far.
  const variableBudget = prev3VariableTotal / (prev3.length || 1) || variableSpent || 1;
  const remaining = variableBudget - variableSpent;
  const pct = Math.min(100, Math.max(0, (variableSpent / variableBudget) * 100));
  document.getElementById('home-remaining').textContent = fmt(remaining) + ' ₪';
  document.getElementById('home-remaining').className = 'v ' + (remaining >= 0 ? 'pos' : 'neg');
  const bar = document.getElementById('home-bar');
  bar.style.width = pct + '%';
  bar.style.background = pct > 100 ? 'var(--red)' : 'var(--green)';
  document.getElementById('home-pace').textContent =
    t('pace', pct > 100 ? t('paceOver') : t('paceOk'), fmt(avgDailyVariable));

  document.getElementById('home-income').textContent = fmt(income) + ' ₪';
  document.getElementById('home-fixed').textContent = '‎−' + fmt(fixedSpent) + ' ₪';
  document.getElementById('home-variable').textContent = '‎−' + fmt(variableSpent) + ' ₪';

  renderMonthChart(ym);
  renderAnomaly();
}

// Monthly income vs expense bars, last 6 months (oldest -> newest). Pure CSS, no chart lib.
function renderMonthChart(ym) {
  const months = [...prevMonths(ym, 5).reverse(), ym];
  const rows = months.map((m) => {
    const txns = txnsForMonth(m);
    return {
      m,
      income: txns.filter(txIsIncome).reduce((s, t) => s + t.amount, 0),
      expense: sumExpenses(txns),
    };
  });
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const h = (v) => Math.max(v > 0 ? 3 : 0, Math.round((v / max) * 100));
  document.getElementById('home-chart').innerHTML = rows.map((r) => `
    <div class="mo" title="‎+${fmt(r.income)} / ‎−${fmt(r.expense)} ₪">
      <div class="bars">
        <i class="b inc" style="height:${h(r.income)}%"></i>
        <i class="b exp" style="height:${h(r.expense)}%"></i>
      </div>
      <div class="mlabel">${new Date(r.m + '-01T00:00:00').toLocaleDateString(LOCALE, { month: 'short' })}</div>
    </div>`).join('');
  document.getElementById('home-chart-legend').textContent = t('chartLegend');
}

// Anomaly heuristic: a description seen 3+ times, categorized as null or "מנויים ותקשורת",
// and small (<=50 ILS) — likely an unrecognized subscription. First match wins, v1 keeps it simple.
function renderAnomaly() {
  const counts = new Map();
  DATA.transactions.filter(txIsExpense).forEach((t) => {
    if ((t.category == null || t.category === 'מנויים ותקשורת') && Math.abs(t.amount) <= 50) {
      const key = t.description;
      const arr = counts.get(key) || [];
      arr.push(t);
      counts.set(key, arr);
    }
  });
  const hit = [...counts.entries()].find(([, arr]) => arr.length >= 3);
  const el = document.getElementById('home-anomaly');
  if (!hit) { el.innerHTML = ''; return; }
  const [desc, arr] = hit;
  const amt = Math.abs(arr[0].amount).toFixed(2);
  el.innerHTML = `<div class="card alert">
    <b>${t('anomalyTitle')}</b>
    <div class="muted" style="margin-top:4px">${esc(t('anomalyBody', desc, amt, arr.length))}</div>
  </div>`;
}

// --- CATEGORIES ------------------------------------------------------------------------------
function renderCategories() {
  const ym = monthKey(NOW.toISOString().slice(0, 10));
  document.getElementById('cat-month').textContent = NOW.toLocaleDateString(LOCALE, { month: 'long' });
  const monthTxns = txnsForMonth(ym).filter(txIsExpense);
  const prev3 = prevMonths(ym, 3);
  const overrides = store.get('budgetOverrides', {});

  const cats = new Set(monthTxns.map((t) => t.category ?? null));
  const rows = [...cats].sort((a, b) => (a ?? '').localeCompare(b ?? '')).map((cat) => {
    const spent = sumExpenses(monthTxns, (t) => (t.category ?? null) === cat);
    const avg3mo = sumExpenses(prev3.flatMap(txnsForMonth), (t) => (t.category ?? null) === cat) / (prev3.length || 1);
    const budget = overrides[cat ?? '__null__'] ?? (avg3mo || spent || 1);
    return { cat, spent, budget };
  }).sort((a, b) => b.spent - a.spent);

  document.getElementById('cat-list').innerHTML = rows.map(({ cat, spent, budget }) => {
    const pct = Math.min(140, (spent / budget) * 100);
    const over = spent > budget + 0.5; // tolerance so rounded-equal amounts don't flag as overrun
    const label = cat ?? t('uncategorized');
    return `<div class="cat" data-cat="${esc(cat ?? '')}">
      <div class="emoji">${emojiFor(cat)}</div>
      <div class="mid">
        <div class="name">${esc(label)}</div>
        <div class="bar"><i style="width:${Math.min(100, pct)}%;background:${over ? 'var(--red)' : 'var(--green)'}"></i></div>
        <div class="muted">${fmt(spent)} ${t('outOf')} ${fmt(budget)} ₪${over ? ' · ' + t('overrun') : ''}</div>
      </div>
      <div class="amt ${over ? 'neg' : ''}">${fmt(spent)} ₪</div>
    </div>`;
  }).join('') || `<div class="muted">${t('noExpenses')}</div>`;

  document.querySelectorAll('#cat-list .cat').forEach((el) => {
    el.addEventListener('click', () => {
      const cat = el.dataset.cat || null;
      const key = cat ?? '__null__';
      const current = overrides[key] ?? '';
      const val = prompt(t('budgetPrompt', cat ?? t('uncategorized')), current || '');
      if (val == null || val.trim() === '' || isNaN(+val)) return;
      overrides[key] = +val;
      store.set('budgetOverrides', overrides);
      renderCategories();
    });
  });
}

// --- TRANSACTIONS ----------------------------------------------------------------------------
function assignCategory(txnId, description, category) {
  const overrides = store.get('categoryOverrides', {});
  overrides[txnId] = category;
  store.set('categoryOverrides', overrides);

  const rules = store.get('pendingRules', []);
  rules.push({ match: description, category });
  store.set('pendingRules', rules);

  const txn = DATA.transactions.find((x) => x.id === txnId);
  if (txn) txn.category = category;
  renderTransactions();
  renderHome(); // category assignment can change anomaly/spend numbers
}

let expandedTx = null; // which pending transaction currently shows its category chips

function renderTransactions() {
  const pending = DATA.transactions.filter((t) => t.category == null);
  document.getElementById('tx-pending-count').textContent = pending.length;
  document.getElementById('tx-pending').innerHTML = pending.map((tx) => `
    <div class="card txcard ${expandedTx === tx.id ? 'open' : ''}" data-id="${tx.id}">
      <div class="tx"><div class="mid">
        <div class="m">${esc(tx.description)}</div>
        <div class="muted">${fmtDate(tx.date)} · ${esc(COMPANY_INFO[tx.company]?.name ?? tx.company)} ${esc(accountLabel(tx))}</div>
      </div><div class="amt ${tx.amount >= 0 ? 'pos' : 'neg'}">${fmtSigned(tx.amount)}</div></div>
      <div class="chips" ${expandedTx === tx.id ? '' : 'hidden'}>
        ${CATEGORY_CHIPS.map(([emo, cat]) => `<button class="chip" data-id="${tx.id}" data-cat="${esc(cat)}">${emo} ${esc(cat)}</button>`).join('')}
        <button class="chip" data-id="${tx.id}" data-cat="__other__">${t('otherChip')}</button>
      </div>
    </div>`).join('') || `<div class="muted" style="margin-bottom:10px">${t('noPending')}</div>`;

  // Tap a pending item to reveal its category chips (one open at a time).
  document.querySelectorAll('#tx-pending .txcard').forEach((card) => {
    card.addEventListener('click', () => {
      expandedTx = expandedTx === card.dataset.id ? null : card.dataset.id;
      renderTransactions();
    });
  });

  document.querySelectorAll('#tx-pending .chip').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const txn = DATA.transactions.find((x) => x.id === id);
      let cat = btn.dataset.cat;
      if (cat === '__other__') {
        cat = prompt(t('catPrompt'), '');
        if (!cat || !cat.trim()) return;
      }
      expandedTx = null;
      assignCategory(id, txn.description, cat);
    });
  });

  // Grouped by day, newest first — everything already categorized (resolved transactions).
  const resolved = DATA.transactions.filter((t) => t.category != null);
  const byDay = new Map();
  resolved.forEach((t) => { const arr = byDay.get(t.date) || []; arr.push(t); byDay.set(t.date, arr); });
  const days = [...byDay.keys()].sort().reverse();
  document.getElementById('tx-grouped').innerHTML = days.map((day) => `
    <div class="daylabel">${fmtDate(day)}</div>
    <div class="card">
      ${byDay.get(day).map((tx) => `
        <div class="tx"><div class="mid">
          <div class="m">${esc(tx.description)}</div>
          <div class="muted">${emojiFor(tx.category)} ${esc(tx.category)} · ${esc(COMPANY_INFO[tx.company]?.name ?? tx.company)} ${esc(accountLabel(tx))}</div>
        </div><div class="amt ${tx.amount >= 0 ? 'pos' : ''}">${fmtSigned(tx.amount)}</div></div>
      `).join('')}
    </div>`).join('');
}

function accountLabel(t) { return t.account?.startsWith('····') ? t.account : ''; }
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const todayKey = NOW.toISOString().slice(0, 10);
  const yestKey = new Date(NOW.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayKey) return t('today');
  if (iso === yestKey) return t('yesterday');
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

async function exportRules() {
  const rules = store.get('pendingRules', []);
  const text = JSON.stringify(rules, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert(t('rulesCopied', rules.length));
  } catch {
    prompt(t('copyManually'), text);
  }
}
document.getElementById('tx-export-rules').addEventListener('click', exportRules);

// --- ACCOUNTS --------------------------------------------------------------------------------
function renderAccounts() {
  document.getElementById('acc-list').innerHTML = DATA.accounts.map((a) => {
    const info = COMPANY_INFO[a.company] || { name: a.company, logo: a.company.slice(0, 3), color: '#666' };
    const badge = a.status === 'ok' ? `<span class="badge ok">${t('badgeOk')}</span>` : `<span class="badge warn">${t('badgeErr')}</span>`;
    const sub = a.status === 'ok'
      ? t('synced', new Date(a.lastSync).toLocaleString(LOCALE, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }))
      : (a.error || t('failed'));
    return `<div class="acc">
      <div class="logo" style="background:${info.color}">${esc(info.logo)}</div>
      <div class="mid"><div class="n">${esc(info.name)} · ${esc(a.account)}</div><div class="muted">${esc(sub)}</div></div>
      ${badge}
    </div>`;
  }).join('');

  const total = DATA.accounts.filter((a) => a.balance != null).reduce((s, a) => s + a.balance, 0);
  document.getElementById('acc-totals').innerHTML = `<div class="kv"><span>${t('totalBalance')}</span><span class="v">${fmt(total)} ₪</span></div>`;

  const errors = DATA.accounts.filter((a) => a.status === 'error');
  document.getElementById('acc-errors').innerHTML = errors.map((a) => `
    <div class="card alert"><b>${esc(t('syncFailed', COMPANY_INFO[a.company]?.name ?? a.company))}</b>
      <div class="muted" style="margin-top:4px">${esc(a.error || '')}</div></div>`).join('');

  document.getElementById('build-string').textContent = BUILD;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- settings ---------------------------------------------------------------------------------
const settingsDialog = document.getElementById('settings');
document.querySelectorAll('.gear').forEach((b) => b.addEventListener('click', () => {
  document.getElementById('settings-build').textContent = BUILD;
  settingsDialog.showModal();
}));
document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', (e) => { if (e.target === settingsDialog) settingsDialog.close(); });
document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.lang === LANG) return;
  store.set('lang', b.dataset.lang);
  location.reload(); // simplest correct way to re-render everything in the new language
}));
document.getElementById('settings-reset-key').addEventListener('click', () => {
  if (!confirm(t('resetKeyConfirm'))) return;
  localStorage.removeItem('syncKey');
  location.reload();
});
document.getElementById('settings-export-rules').addEventListener('click', exportRules);

// --- tabs / routing (hash-based, no router lib) -----------------------------------------------
const TABS = ['home', 'categories', 'transactions', 'accounts'];
const RENDER = { home: renderHome, categories: renderCategories, transactions: renderTransactions, accounts: renderAccounts };

function showTab(tab) {
  if (!TABS.includes(tab)) tab = 'home';
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById('screen-' + tab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  RENDER[tab]();
}

document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.tab; }));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

applyLang();
loadData().then(() => {
  showTab(location.hash.slice(1) || 'home');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});
