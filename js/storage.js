// =====================================================
// データ管理 / Storage & Data Management
// =====================================================

const STORAGE_KEYS = {
  TRANSACTIONS: "household_transactions",
  ACCOUNTS:     "household_accounts",
  SETTINGS:     "household_settings"
};

const DEFAULT_ACCOUNTS = [
  { id: "acc_joint",        name: "家族口座（共同）",        type: "checking", initialBalance: 0 },
  { id: "acc_husband",      name: "夫の口座",                type: "checking", initialBalance: 0 },
  { id: "acc_wife_kumon",   name: "私：公文用口座",          type: "checking", initialBalance: 0 },
  { id: "acc_wife_biz",     name: "私：事業用口座",          type: "checking", initialBalance: 0 },
  { id: "acc_wife_salary",  name: "私：給与受取口座",        type: "checking", initialBalance: 0 },
  { id: "acc_savings",      name: "特別積立口座",            type: "savings",  initialBalance: 0 },
  { id: "acc_cash",         name: "現金",                    type: "cash",     initialBalance: 0 }
];

// =====================================================
// トランザクション
// =====================================================

// 描画サイクル内キャッシュ — saveTransactions で即時更新、invalidateTxCache でリセット
let _txCache = null;

function loadTransactions() {
  if (_txCache !== null) return _txCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    _txCache = raw ? JSON.parse(raw) : [];
    return _txCache;
  } catch { return (_txCache = []); }
}

function saveTransactions(list) {
  _txCache = list;
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
}

function invalidateTxCache() { _txCache = null; }

function addTransaction(tx) {
  const list = loadTransactions();
  const newTx = { id: generateId(), createdAt: new Date().toISOString(), ...tx };
  list.push(newTx);
  saveTransactions(list);
  return newTx;
}

function updateTransaction(id, updates) {
  const list = loadTransactions();
  const idx  = list.findIndex(t => t.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  saveTransactions(list);
  return true;
}

function deleteTransaction(id) {
  saveTransactions(loadTransactions().filter(t => t.id !== id));
}

// yearMonth: "YYYY-MM"
function getTransactionsByMonth(yearMonth) {
  return loadTransactions().filter(t => t.date.startsWith(yearMonth));
}

// 過去 months ヶ月分のカテゴリ別月次合計（loadTransactions は1回だけ）
function getMonthlySumByCategory(categoryId, months = 12) {
  const allTxs = loadTransactions();
  const today  = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d  = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    const ym = formatYearMonth(d);
    const amount = allTxs
      .filter(t => t.date.startsWith(ym) && t.categoryId === categoryId)
      .reduce((s, t) => s + t.amount, 0);
    return { yearMonth: ym, amount };
  });
}

// =====================================================
// 口座管理
// =====================================================

function loadAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : [...DEFAULT_ACCOUNTS];
  } catch { return [...DEFAULT_ACCOUNTS]; }
}

function saveAccounts(accounts) {
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
}

function initAccounts() {
  const existing    = loadAccounts();
  const existingIds = existing.map(a => a.id);
  const toAdd       = DEFAULT_ACCOUNTS.filter(a => !existingIds.includes(a.id));
  if (toAdd.length > 0) saveAccounts([...existing, ...toAdd]);
}

// =====================================================
// 設定
// =====================================================

function loadSettings()         { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {}; } catch { return {}; } }
function saveSettings(settings) { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }

// =====================================================
// ユーティリティ
// =====================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function getYearMonthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

// =====================================================
// サンプルデータ（初回起動時のみ）
// =====================================================

function seedSampleData() {
  if (loadTransactions().length > 0) return;

  const today  = new Date();
  const thisYM = formatYearMonth(today);

  const samples = [
    { date: `${thisYM}-25`, type: "income",  categoryId: "husband_base",     amount: 280000, accountId: "acc_husband",     memo: "本給" },
    { date: `${thisYM}-25`, type: "income",  categoryId: "husband_variable", amount: 35000,  accountId: "acc_husband",     memo: "残業代" },
    { date: `${thisYM}-20`, type: "income",  categoryId: "wife_fc",          amount: 85000,  accountId: "acc_wife_biz",    memo: "FC教室分" },
    { date: `${thisYM}-28`, type: "income",  categoryId: "wife_partA",       amount: 42000,  accountId: "acc_wife_salary", memo: "バイトA給与" },
    { date: `${thisYM}-27`, type: "expense", categoryId: "housing_loan",     amount: 85000,  accountId: "acc_joint",       memo: "住宅ローン" },
    { date: `${thisYM}-05`, type: "expense", categoryId: "electricity",      amount: 18000,  accountId: "acc_joint",       memo: "電気代" },
    { date: `${thisYM}-10`, type: "expense", categoryId: "phone",            amount: 8500,   accountId: "acc_joint",       memo: "スマホ3台分" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "pet_insurance",    amount: 4200,   accountId: "acc_joint",       memo: "ペット保険" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "insurance",        amount: 12000,  accountId: "acc_joint",       memo: "生命保険・医療保険" },
    { date: `${thisYM}-12`, type: "expense", categoryId: "vet",              amount: 8500,   accountId: "acc_joint",       memo: "通院・薬代（保険適用後）" },
    { date: `${thisYM}-15`, type: "expense", categoryId: "child_edu",        amount: 15000,  accountId: "acc_joint",       memo: "習い事月謝" },
    { date: `${thisYM}-20`, type: "expense", categoryId: "medical",          amount: 2100,   accountId: "acc_joint",       memo: "内科受診" },
    { date: `${thisYM}-18`, type: "expense", categoryId: "allowance",        amount: 20000,  accountId: "acc_joint",       memo: "夫婦お小遣い" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "tax_reserve",      amount: 10000,  accountId: "acc_savings",     memo: "税金積立" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "car_maintenance",  amount: 5000,   accountId: "acc_savings",     memo: "車検積立" },
  ];

  // 過去11ヶ月の犬の通院費（グラフ用サンプル）
  [6200, 12500, 3800, 9100, 0, 15800, 4200, 7600, 11000, 2500, 18900].forEach((amt, i) => {
    if (amt === 0) return;
    const d  = new Date(today.getFullYear(), today.getMonth() - (11 - i), 15);
    samples.push({ date: `${formatYearMonth(d)}-15`, type: "expense", categoryId: "vet", amount: amt, accountId: "acc_joint", memo: "通院（サンプル）" });
  });

  samples.forEach(s => addTransaction(s));
}
