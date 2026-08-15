import test from 'node:test';
import assert from 'node:assert/strict';
import { categorize, txnId, mergeTxns } from '../sync.mjs';

const rules = [{ match: 'רמי לוי', category: 'סופר' }, { match: 'wolt', category: 'אוכל בחוץ' }];
const txn = (over = {}) => ({
  date: '2026-08-01T00:00:00.000Z', chargedAmount: -100, description: 'רמי לוי שיווק',
  identifier: 555, status: 'completed', originalCurrency: 'ILS', memo: '', ...over,
});

test('categorize matches substring case-insensitively, null when no rule', () => {
  assert.equal(categorize('רמי לוי שיווק השקמה', rules), 'סופר');
  assert.equal(categorize('WOLT TLV', rules), 'אוכל בחוץ');
  assert.equal(categorize('מסעדה אקראית', rules), null);
});

test('merge is idempotent and preserves manual category on re-scrape', () => {
  const store = {};
  assert.equal(mergeTxns(store, 'max', '7719', [txn()], rules), 1);
  assert.equal(mergeTxns(store, 'max', '7719', [txn()], rules), 0); // re-scrape, no dup
  const id = txnId('max', '7719', txn());
  store[id].category = 'ידני';
  mergeTxns(store, 'max', '7719', [txn()], rules);
  assert.equal(store[id].category, 'ידני');
  assert.equal(Object.keys(store).length, 1);
});

test('same-looking txns differ by identifier/account/company', () => {
  const store = {};
  mergeTxns(store, 'max', '7719', [txn(), txn({ identifier: 556 })], rules);
  mergeTxns(store, 'visaCal', '4821', [txn()], rules);
  assert.equal(Object.keys(store).length, 3);
});

test('pending txn updates status without duplicating', () => {
  const store = {};
  mergeTxns(store, 'leumi', '111', [txn({ status: 'pending' })], rules);
  mergeTxns(store, 'leumi', '111', [txn({ status: 'completed' })], rules);
  assert.equal(Object.keys(store).length, 1);
  assert.equal(Object.values(store)[0].status, 'completed');
});
