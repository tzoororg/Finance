// תזרים — vanilla JS PWA. No framework, no build step, no router lib (hash-based tabs).
'use strict';

const BUILD = 'build 2026-08-15.3';

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

const ILS = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const fmt = (n) => ILS.format(Math.round(n));
const fmtSigned = (n) => (n >= 0 ? '‎+' : '‎−') + fmt(Math.abs(n)) + ' ₪';
const monthKey = (d) => d.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
const daysInMonth = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();

// --- localStorage-backed overrides -----------------------------------------------------
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

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
      if (!pass) pass = prompt('מפתח סנכרון (מהמחשב, data/sync-key.txt):');
      if (!pass) throw new Error('no key'); // user cancelled -> sample data
      try { raw = await decryptBlob(blob, pass.trim()); break; }
      catch { pass = null; alert('מפתח שגוי, נסו שוב'); }
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

  document.getElementById('home-month').textContent = NOW.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const projEl = document.getElementById('home-projection');
  projEl.textContent = fmtSigned(projection);
  projEl.className = 'big ' + (projection >= 0 ? 'pos' : 'neg');
  document.getElementById('home-updated').textContent = `עודכן ${NOW.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })} · ${daysRemaining} ימים נותרו`;

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
    `קצב ${pct > 100 ? 'חריג' : 'תקין'} — ‎${fmt(avgDailyVariable)} ₪ ליום בממוצע`;

  document.getElementById('home-income').textContent = fmt(income) + ' ₪';
  document.getElementById('home-fixed').textContent = '‎−' + fmt(fixedSpent) + ' ₪';
  document.getElementById('home-variable').textContent = '‎−' + fmt(variableSpent) + ' ₪';

  renderAnomaly();
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
    <b>⚠️ חיוב חריג</b>
    <div class="muted" style="margin-top:4px">״${esc(desc)}״ ${amt} ₪ — חיוב חוזר בפעם ה־${arr.length}. מנוי שלא זיהינו?</div>
  </div>`;
}

// --- CATEGORIES ------------------------------------------------------------------------------
function renderCategories() {
  const ym = monthKey(NOW.toISOString().slice(0, 10));
  document.getElementById('cat-month').textContent = NOW.toLocaleDateString('he-IL', { month: 'long' });
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
    const label = cat ?? 'אחר / לא מסווג';
    return `<div class="cat" data-cat="${esc(cat ?? '')}">
      <div class="emoji">${emojiFor(cat)}</div>
      <div class="mid">
        <div class="name">${esc(label)}</div>
        <div class="bar"><i style="width:${Math.min(100, pct)}%;background:${over ? 'var(--red)' : 'var(--green)'}"></i></div>
        <div class="muted">${fmt(spent)} מתוך ${fmt(budget)} ₪${over ? ' · חריגה' : ''}</div>
      </div>
      <div class="amt ${over ? 'neg' : ''}">${fmt(spent)} ₪</div>
    </div>`;
  }).join('') || '<div class="muted">אין הוצאות החודש</div>';

  document.querySelectorAll('#cat-list .cat').forEach((el) => {
    el.addEventListener('click', () => {
      const cat = el.dataset.cat || null;
      const key = cat ?? '__null__';
      const current = overrides[key] ?? '';
      const val = prompt(`תקציב חודשי עבור "${cat ?? 'אחר / לא מסווג'}" (₪)`, current || '');
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

  const t = DATA.transactions.find((x) => x.id === txnId);
  if (t) t.category = category;
  renderTransactions();
  renderHome(); // category assignment can change anomaly/spend numbers
}

function renderTransactions() {
  const pending = DATA.transactions.filter((t) => t.category == null);
  document.getElementById('tx-pending-count').textContent = pending.length;
  document.getElementById('tx-pending').innerHTML = pending.map((t) => `
    <div class="card">
      <div class="tx"><div class="mid">
        <div class="m">${esc(t.description)}</div>
        <div class="muted">${fmtDate(t.date)} · ${esc(COMPANY_INFO[t.company]?.name ?? t.company)} ${esc(accountLabel(t))}</div>
        <div class="chips">
          ${CATEGORY_CHIPS.map(([emo, cat]) => `<button class="chip" data-id="${t.id}" data-cat="${esc(cat)}">${emo} ${esc(cat)}</button>`).join('')}
          <button class="chip" data-id="${t.id}" data-cat="__other__">אחר…</button>
        </div>
      </div><div class="amt ${t.amount >= 0 ? 'pos' : 'neg'}">${fmtSigned(t.amount)}</div></div>
    </div>`).join('') || '<div class="muted" style="margin-bottom:10px">אין תנועות ממתינות</div>';

  document.querySelectorAll('#tx-pending .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const t = DATA.transactions.find((x) => x.id === id);
      let cat = btn.dataset.cat;
      if (cat === '__other__') {
        cat = prompt('קטגוריה עבור התנועה:', '');
        if (!cat || !cat.trim()) return;
      }
      assignCategory(id, t.description, cat);
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
      ${byDay.get(day).map((t) => `
        <div class="tx"><div class="mid">
          <div class="m">${esc(t.description)}</div>
          <div class="muted">${emojiFor(t.category)} ${esc(t.category)} · ${esc(COMPANY_INFO[t.company]?.name ?? t.company)} ${esc(accountLabel(t))}</div>
        </div><div class="amt ${t.amount >= 0 ? 'pos' : ''}">${fmtSigned(t.amount)}</div></div>
      `).join('')}
    </div>`).join('');
}

function accountLabel(t) { return t.account?.startsWith('····') ? t.account : ''; }
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const todayKey = NOW.toISOString().slice(0, 10);
  const yestKey = new Date(NOW.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayKey) return 'היום';
  if (iso === yestKey) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

document.getElementById('tx-export-rules').addEventListener('click', async () => {
  const rules = store.get('pendingRules', []);
  const text = JSON.stringify(rules, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert(`הועתקו ${rules.length} חוקים ללוח (להדבקה בתוך rules.json)`);
  } catch {
    prompt('העתק ידנית:', text);
  }
});

// --- ACCOUNTS --------------------------------------------------------------------------------
function renderAccounts() {
  document.getElementById('acc-list').innerHTML = DATA.accounts.map((a) => {
    const info = COMPANY_INFO[a.company] || { name: a.company, logo: a.company.slice(0, 3), color: '#666' };
    const badge = a.status === 'ok' ? '<span class="badge ok">מעודכן</span>' : '<span class="badge warn">שגיאה</span>';
    const sub = a.status === 'ok'
      ? `סונכרן ${new Date(a.lastSync).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
      : (a.error || 'נכשל');
    return `<div class="acc">
      <div class="logo" style="background:${info.color}">${esc(info.logo)}</div>
      <div class="mid"><div class="n">${esc(info.name)} · ${esc(a.account)}</div><div class="muted">${esc(sub)}</div></div>
      ${badge}
    </div>`;
  }).join('');

  const total = DATA.accounts.filter((a) => a.balance != null).reduce((s, a) => s + a.balance, 0);
  document.getElementById('acc-totals').innerHTML = `<div class="kv"><span>סה״כ עו״ש</span><span class="v">${fmt(total)} ₪</span></div>`;

  const errors = DATA.accounts.filter((a) => a.status === 'error');
  document.getElementById('acc-errors').innerHTML = errors.map((a) => `
    <div class="card alert"><b>🔧 סנכרון ${esc(COMPANY_INFO[a.company]?.name ?? a.company)} נכשל</b>
      <div class="muted" style="margin-top:4px">${esc(a.error || '')}</div></div>`).join('');

  document.getElementById('build-string').textContent = BUILD;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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

loadData().then(() => {
  showTab(location.hash.slice(1) || 'home');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});
