// =====================================================
// データ管理 / Storage & Data Management
// =====================================================

const STORAGE_KEYS = {
  TRANSACTIONS: "household_transactions",
  ACCOUNTS:     "household_accounts",
  SETTINGS:     "household_settings"
};

// デフォルト口座
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
// トランザクション（取引）
// =====================================================

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

function addTransaction(tx) {
  const transactions = loadTransactions();
  const newTx = {
    id:         generateId(),
    createdAt:  new Date().toISOString(),
    ...tx
  };
  transactions.push(newTx);
  saveTransactions(transactions);
  return newTx;
}

function updateTransaction(id, updates) {
  const transactions = loadTransactions();
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return false;
  transactions[idx] = { ...transactions[idx], ...updates };
  saveTransactions(transactions);
  return true;
}

function deleteTransaction(id) {
  const transactions = loadTransactions();
  const filtered = transactions.filter(t => t.id !== id);
  saveTransactions(filtered);
}

// 月別取引取得 (yearMonth: "YYYY-MM")
function getTransactionsByMonth(yearMonth) {
  return loadTransactions().filter(t => t.date.startsWith(yearMonth));
}

// 特定カテゴリ・期間の取引集計
function sumByCategory(categoryId, yearMonth) {
  return getTransactionsByMonth(yearMonth)
    .filter(t => t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
}

// 過去N ヶ月分の月別カテゴリ合計
function getMonthlySumByCategory(categoryId, months = 12) {
  const result = [];
  const today = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = formatYearMonth(d);
    result.push({ yearMonth: ym, amount: sumByCategory(categoryId, ym) });
  }
  return result;
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
  const existing = loadAccounts();
  if (existing.length === 0) {
    saveAccounts(DEFAULT_ACCOUNTS);
    return;
  }
  // 新しいデフォルト口座を既存データに追加（既存取引を壊さない）
  const existingIds = existing.map(a => a.id);
  const toAdd = DEFAULT_ACCOUNTS.filter(a => !existingIds.includes(a.id));
  if (toAdd.length > 0) {
    saveAccounts([...existing, ...toAdd]);
  }
}

function updateAccountBalance(accountId, delta) {
  const accounts = loadAccounts();
  const acc = accounts.find(a => a.id === accountId);
  if (acc) {
    acc.balance = (acc.balance || acc.initialBalance || 0) + delta;
    saveAccounts(accounts);
  }
}

// =====================================================
// 設定
// =====================================================

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : getDefaultSettings();
  } catch { return getDefaultSettings(); }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

function getDefaultSettings() {
  return {
    // 固定費の毎月予算
    budgets: {
      husband_base:     0,   // 夫：本給
      housing_loan:     0,   // 住宅ローン
      electricity:      0,   // 電気代
      phone:            0,   // スマホ代
      pet_insurance:    0,   // ペット保険
      insurance:        0    // 各種保険
    }
  };
}

// =====================================================
// ユーティリティ
// =====================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatYearMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

// サンプルデータ投入（初回起動時）
function seedSampleData() {
  if (loadTransactions().length > 0) return; // 既にデータあり

  const today = new Date();
  const thisYM = formatYearMonth(today);
  const lastYM = formatYearMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  const samples = [
    // 今月の収入
    { date: `${thisYM}-25`, type: "income",  categoryId: "husband_base",     amount: 280000, accountId: "acc_husband", memo: "本給" },
    { date: `${thisYM}-25`, type: "income",  categoryId: "husband_variable", amount: 35000,  accountId: "acc_husband", memo: "残業代" },
    { date: `${thisYM}-20`, type: "income",  categoryId: "wife_fc",          amount: 85000,  accountId: "acc_wife_biz",    memo: "FC教室3月分" },
    { date: `${thisYM}-28`, type: "income",  categoryId: "wife_partA",       amount: 42000,  accountId: "acc_wife_salary", memo: "バイトA給与" },

    // 今月の支出（固定費）
    { date: `${thisYM}-27`, type: "expense", categoryId: "housing_loan",     amount: 85000,  accountId: "acc_joint",   memo: "住宅ローン" },
    { date: `${thisYM}-05`, type: "expense", categoryId: "electricity",      amount: 18000,  accountId: "acc_joint",   memo: "電気代" },
    { date: `${thisYM}-10`, type: "expense", categoryId: "phone",            amount: 8500,   accountId: "acc_joint",   memo: "スマホ3台分" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "pet_insurance",    amount: 4200,   accountId: "acc_joint",   memo: "ペット保険" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "insurance",        amount: 12000,  accountId: "acc_joint",   memo: "生命保険・医療保険" },

    // 今月の支出（変動費）
    { date: `${thisYM}-12`, type: "expense", categoryId: "vet",              amount: 8500,   accountId: "acc_joint",   memo: "通院・薬代（保険適用後）" },
    { date: `${thisYM}-15`, type: "expense", categoryId: "child_edu",        amount: 15000,  accountId: "acc_joint",   memo: "習い事月謝" },
    { date: `${thisYM}-20`, type: "expense", categoryId: "medical",          amount: 2100,   accountId: "acc_joint",   memo: "内科受診" },
    { date: `${thisYM}-18`, type: "expense", categoryId: "allowance",        amount: 20000,  accountId: "acc_joint",   memo: "夫婦お小遣い" },

    // 今月の積立
    { date: `${thisYM}-01`, type: "expense", categoryId: "tax_reserve",      amount: 10000,  accountId: "acc_savings", memo: "税金積立" },
    { date: `${thisYM}-01`, type: "expense", categoryId: "car_maintenance",  amount: 5000,   accountId: "acc_savings", memo: "車検積立" },
  ];

  // 過去11ヶ月の犬の通院費データ（グラフ用）
  const petAmounts = [6200, 12500, 3800, 9100, 0, 15800, 4200, 7600, 11000, 2500, 18900, 8500];
  for (let i = 11; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 15);
    const ym = formatYearMonth(d);
    if (petAmounts[11 - i] > 0) {
      samples.push({
        date:       `${ym}-15`,
        type:       "expense",
        categoryId: "vet",
        amount:     petAmounts[11 - i],
        accountId:  "acc_joint",
        memo:       "通院（サンプル）"
      });
    }
  }

  samples.forEach(s => addTransaction(s));
}
