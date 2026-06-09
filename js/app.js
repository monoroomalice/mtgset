// =====================================================
// 家計簿アプリ メインロジック
// =====================================================

const AppState = {
  currentTab:       "dashboard",
  currentYearMonth: formatYearMonth(new Date()),
  charts:           {}
};

// =====================================================
// 初期化
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  initAccounts();
  seedSampleData();
  setupNavigation();
  setupMonthSelector();
  setupForms();
  setupSettingsModal();
  generateCategoryRefLists();

  // 履歴フィルター
  document.getElementById("history-filter")
    .addEventListener("change", renderHistory);

  renderAll();
});

function renderAll() {
  invalidateTxCache();
  renderDashboard();
  const tab = AppState.currentTab;
  if (tab === "history")  renderHistory();
  if (tab === "report")   renderReport();
  if (tab === "accounts") renderAccounts();
}

// =====================================================
// ナビゲーション
// =====================================================

function setupNavigation() {
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  AppState.currentTab = tab;
  document.querySelectorAll(".nav-tab").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".tab-content").forEach(s =>
    s.classList.toggle("active", s.id === `tab-${tab}`)
  );
  invalidateTxCache();
  if (tab === "dashboard") renderDashboard();
  if (tab === "history")   renderHistory();
  if (tab === "report")    renderReport();
  if (tab === "accounts")  renderAccounts();
}

// =====================================================
// 月セレクタ
// =====================================================

function setupMonthSelector() {
  const sel     = document.getElementById("month-selector");
  const prevBtn = document.getElementById("month-prev");
  const nextBtn = document.getElementById("month-next");
  const today   = new Date();

  for (let i = 0; i < 24; i++) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym  = formatYearMonth(d);
    const opt = document.createElement("option");
    opt.value       = ym;
    opt.textContent = getYearMonthLabel(ym);
    if (ym === AppState.currentYearMonth) opt.selected = true;
    sel.appendChild(opt);
  }

  const changeMonth = (delta) => {
    const [y, m]              = AppState.currentYearMonth.split("-").map(Number);
    const next                = new Date(y, m - 1 + delta, 1);
    if (delta > 0 && next > today) return;
    AppState.currentYearMonth = formatYearMonth(next);
    sel.value                 = AppState.currentYearMonth;
    renderAll();
  };

  sel.addEventListener("change", () => {
    AppState.currentYearMonth = sel.value;
    renderAll();
  });
  prevBtn.addEventListener("click", () => changeMonth(-1));
  nextBtn.addEventListener("click", () => changeMonth(+1));
}

// =====================================================
// フォーム設定
// =====================================================

function setupForms() {
  setupIncomeForm();
  setupExpenseForm();
}

function setupIncomeForm() {
  const groupSel = document.getElementById("income-group");
  const catSel   = document.getElementById("income-category");
  const form     = document.getElementById("income-form");

  INCOME_CATEGORIES.forEach(g => {
    groupSel.appendChild(makeOption(g.group, g.group));
  });

  groupSel.addEventListener("change", () => {
    const group = INCOME_CATEGORIES.find(g => g.group === groupSel.value);
    catSel.innerHTML = '<option value="">中項目を選択</option>';
    catSel.disabled  = !group;
    group?.items.forEach(item => catSel.appendChild(makeOption(item.id, item.name)));
  });

  populateAccountSelects(["income-account"]);
  document.getElementById("income-date").valueAsDate = new Date();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const tx = {
      date:       document.getElementById("income-date").value,
      type:       "income",
      categoryId: catSel.value,
      amount:     parseInt(document.getElementById("income-amount").value) || 0,
      accountId:  document.getElementById("income-account").value,
      memo:       document.getElementById("income-memo").value.trim()
    };
    if (!tx.categoryId || tx.amount <= 0) {
      showToast("カテゴリと金額を入力してください", "error");
      return;
    }
    addTransaction(tx);
    form.reset();
    document.getElementById("income-date").valueAsDate = new Date();
    groupSel.value   = "";
    catSel.innerHTML = '<option value="">中項目を選択</option>';
    catSel.disabled  = true;
    showToast("収入を登録しました ✓", "success");
    renderAll();
  });
}

function setupExpenseForm() {
  const groupSel    = document.getElementById("expense-group");
  const subgroupSel = document.getElementById("expense-subgroup");
  const catSel      = document.getElementById("expense-category");
  const noteEl      = document.getElementById("expense-note");
  const form        = document.getElementById("expense-form");

  EXPENSE_CATEGORIES.forEach(g => {
    groupSel.appendChild(makeOption(g.group, g.group));
  });

  groupSel.addEventListener("change", () => {
    const group          = EXPENSE_CATEGORIES.find(g => g.group === groupSel.value);
    subgroupSel.innerHTML = '<option value="">中分類を選択</option>';
    subgroupSel.disabled  = !group;
    catSel.innerHTML      = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled       = true;
    noteEl.textContent    = "";
    group?.subgroups.forEach(sg => subgroupSel.appendChild(makeOption(sg.name, sg.name)));
  });

  subgroupSel.addEventListener("change", () => {
    const group    = EXPENSE_CATEGORIES.find(g => g.group === groupSel.value);
    const subgroup = group?.subgroups.find(sg => sg.name === subgroupSel.value);
    catSel.innerHTML   = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled    = !subgroup;
    noteEl.textContent = "";
    subgroup?.items.forEach(item => catSel.appendChild(makeOption(item.id, item.name)));
  });

  catSel.addEventListener("change", () => {
    const note = getExpenseCategoryById(catSel.value)?.item?.note;
    noteEl.textContent = note ? `💡 ${note}` : "";
  });

  populateAccountSelects(["expense-account"]);
  document.getElementById("expense-date").valueAsDate = new Date();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const tx = {
      date:       document.getElementById("expense-date").value,
      type:       "expense",
      categoryId: catSel.value,
      amount:     parseInt(document.getElementById("expense-amount").value) || 0,
      accountId:  document.getElementById("expense-account").value,
      memo:       document.getElementById("expense-memo").value.trim()
    };
    if (!tx.categoryId || tx.amount <= 0) {
      showToast("カテゴリと金額を入力してください", "error");
      return;
    }
    addTransaction(tx);
    form.reset();
    document.getElementById("expense-date").valueAsDate = new Date();
    groupSel.value        = "";
    subgroupSel.innerHTML = '<option value="">中分類を選択</option>';
    subgroupSel.disabled  = true;
    catSel.innerHTML      = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled       = true;
    noteEl.textContent    = "";
    showToast("支出を登録しました ✓", "success");
    renderAll();
  });
}

function makeOption(value, text) {
  const opt      = document.createElement("option");
  opt.value      = value;
  opt.textContent = text;
  return opt;
}

function populateAccountSelects(ids) {
  const accounts = loadAccounts();
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">口座を選択（任意）</option>';
    accounts.forEach(acc => sel.appendChild(makeOption(acc.id, acc.name)));
  });
}

// =====================================================
// カテゴリ早見表（JS で動的生成）
// =====================================================

function generateCategoryRefLists() {
  // 収入カテゴリ
  const incomeRef = document.getElementById("income-category-ref");
  if (incomeRef) {
    incomeRef.innerHTML = INCOME_CATEGORIES.map(g => `
      <div class="ref-group">
        <div class="ref-group-label">${g.group}</div>
        <div class="ref-items">${g.items.map(i => i.name).join("　|　")}</div>
      </div>`).join("");
  }

  // 支出カテゴリ
  const expenseRef = document.getElementById("expense-category-ref");
  if (expenseRef) {
    expenseRef.innerHTML = EXPENSE_CATEGORIES.map(g => `
      <div class="ref-group">
        <div class="ref-group-label" style="color:${g.color}">${g.group}</div>
        <div class="ref-items">${
          g.subgroups.flatMap(sg => sg.items.map(i => i.name)).join("　|　")
        }</div>
      </div>`).join("");
  }
}

// =====================================================
// ダッシュボード
// =====================================================

function renderDashboard() {
  const ym  = AppState.currentYearMonth;
  const txs = getTransactionsByMonth(ym);
  const { income, expense } = getMonthlyTotals(txs);
  const balance = income - expense;

  document.getElementById("dash-income").textContent  = formatCurrency(income);
  document.getElementById("dash-expense").textContent = formatCurrency(expense);
  const balEl = document.getElementById("dash-balance");
  balEl.textContent = formatCurrency(balance);
  balEl.className   = "summary-value " + (balance >= 0 ? "positive" : "negative");

  renderFixedBalanceView(txs);
  renderPetMedicalChart();
  renderIncomeBreakdown(txs, income);
}

// 収支合計をまとめて返すヘルパー
function getMonthlyTotals(txs) {
  return txs.reduce((acc, t) => {
    if (t.type === "income")  acc.income  += t.amount;
    else                      acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });
}

// ① 収入と固定費の相殺ビュー
function renderFixedBalanceView(txs) {
  // 支出をカテゴリIDでまとめて集計（O(n)）
  const expenseByCategory = new Map();
  txs.filter(t => t.type === "expense").forEach(t => {
    expenseByCategory.set(t.categoryId, (expenseByCategory.get(t.categoryId) || 0) + t.amount);
  });

  const husbandBase = txs
    .filter(t => t.type === "income" && t.categoryId === HUSBAND_BASE_ID)
    .reduce((s, t) => s + t.amount, 0);

  const fixedExpense = FIXED_EXPENSE_IDS
    .reduce((s, id) => s + (expenseByCategory.get(id) || 0), 0);

  const diff  = husbandBase - fixedExpense;
  const isPlus = diff >= 0;
  const pct   = husbandBase > 0 ? Math.min(100, Math.round(fixedExpense / husbandBase * 100)) : 0;

  document.getElementById("fixed-husband-income").textContent = formatCurrency(husbandBase);
  document.getElementById("fixed-expense-total").textContent  = formatCurrency(fixedExpense);

  const diffEl = document.getElementById("fixed-diff");
  diffEl.textContent = (isPlus ? "+" : "") + formatCurrency(diff);
  diffEl.className   = "fixed-diff " + (isPlus ? "positive" : "negative");

  const barFill = document.getElementById("fixed-bar-fill");
  barFill.style.width      = pct + "%";
  barFill.style.background = pct >= 100 ? "#DC2626" : pct >= 80 ? "#D97706" : "#059669";
  document.getElementById("fixed-bar-pct").textContent = pct + "%";

  const fixedItems = getAllExpenseItems().filter(i => i.isFixed);
  document.getElementById("fixed-breakdown").innerHTML = fixedItems.map(item => {
    const amt = expenseByCategory.get(item.id) || 0;
    return `<div class="breakdown-row ${amt ? "" : "empty"}">
      <span>${item.name}</span>
      <span>${amt ? formatCurrency(amt) : "未入力"}</span>
    </div>`;
  }).join("");
}

// ② 犬の通院費推移グラフ
function renderPetMedicalChart() {
  try {
    const data    = getMonthlySumByCategory(PET_MEDICAL_ID, 12);
    const amounts = data.map(d => d.amount);
    const total   = amounts.reduce((s, a) => s + a, 0);

    document.getElementById("pet-annual-total").textContent = formatCurrency(total);
    document.getElementById("pet-avg-monthly").textContent  = formatCurrency(Math.round(total / 12));

    const ctx = document.getElementById("petMedicalChart").getContext("2d");
    if (AppState.charts.petMedical) AppState.charts.petMedical.destroy();
    AppState.charts.petMedical = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => getYearMonthLabel(d.yearMonth).replace("年", "年\n")),
        datasets: [{
          label: "動物病院（通院）",
          data:  amounts,
          backgroundColor: amounts.map(a => a > 15000 ? "#FCA5A5" : a > 8000 ? "#FCD34D" : "#86EFAC"),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${formatCurrency(c.parsed.y)}` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => `¥${v.toLocaleString()}` }, grid: { color: "#F3F4F6" } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  } catch (e) { console.warn("pet chart:", e); }
}

// 今月の収入内訳バー
function renderIncomeBreakdown(txs, totalIncome) {
  const el = document.getElementById("dash-income-breakdown");
  if (!totalIncome) {
    el.innerHTML = '<p class="empty-msg">今月の収入データがありません</p>';
    return;
  }
  const rows = [];
  for (const group of INCOME_CATEGORIES) {
    for (const item of group.items) {
      const amt = txs.filter(t => t.type === "income" && t.categoryId === item.id)
                     .reduce((s, t) => s + t.amount, 0);
      if (amt) rows.push({ name: item.name, amt, pct: Math.round(amt / totalIncome * 100) });
    }
  }
  el.innerHTML = rows.map(r => `
    <div class="income-row">
      <span class="income-row-name">${r.name}</span>
      <div class="income-row-bar-wrap"><div class="income-row-bar" style="width:${r.pct}%"></div></div>
      <span class="income-row-amt">${formatCurrency(r.amt)}</span>
    </div>`).join("");
}

// =====================================================
// 取引履歴
// =====================================================

function renderHistory() {
  const txs    = getTransactionsByMonth(AppState.currentYearMonth);
  const filter = document.getElementById("history-filter")?.value || "all";
  const filtered = txs
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const accounts = loadAccounts();
  const tbody    = document.getElementById("history-body");

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">取引データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const catInfo = tx.type === "income"
      ? getIncomeCategoryById(tx.categoryId)
      : getExpenseCategoryById(tx.categoryId);
    const catName = catInfo?.item?.name || tx.categoryId;
    const acc     = accounts.find(a => a.id === tx.accountId);
    const accIcon = acc?.type === "cash" ? "💴" : acc?.type === "savings" ? "🏦" : "💳";
    const accTag  = acc ? `<span class="acc-tag">${accIcon} ${acc.name}</span>` : "";

    return `<tr>
      <td>${formatDate(tx.date)}</td>
      <td><span class="badge ${tx.type}">${tx.type === "income" ? "収入" : "支出"}</span></td>
      <td class="cat-cell">${catName}${accTag}</td>
      <td class="amount-cell ${tx.type}">${tx.type === "income" ? "+" : "−"}${formatCurrency(tx.amount)}</td>
      <td class="memo-cell">${tx.memo || ""}</td>
      <td class="action-cell">
        <button class="btn-icon" onclick="deleteTransactionUI('${tx.id}')">🗑</button>
      </td>
    </tr>`;
  }).join("");
}

function deleteTransactionUI(id) {
  if (!confirm("この取引を削除しますか？")) return;
  deleteTransaction(id);
  renderAll();
  showToast("取引を削除しました", "info");
}

// =====================================================
// 月次レポート
// =====================================================

function renderReport() {
  const txs             = getTransactionsByMonth(AppState.currentYearMonth);
  const { income, expense } = getMonthlyTotals(txs);

  document.getElementById("report-income").textContent  = formatCurrency(income);
  document.getElementById("report-expense").textContent = formatCurrency(expense);
  const balEl = document.getElementById("report-balance");
  balEl.textContent = formatCurrency(income - expense);
  balEl.className   = income >= expense ? "positive" : "negative";

  renderExpensePieChart(txs);
  renderMonthlyTrendChart();
  renderDetailTable(txs);
}

function renderExpensePieChart(txs) {
  try {
    const groupTotals = {}, groupColors = {};
    for (const g of EXPENSE_CATEGORIES) {
      const ids   = g.subgroups.flatMap(sg => sg.items.map(i => i.id));
      const total = txs.filter(t => t.type === "expense" && ids.includes(t.categoryId))
                       .reduce((s, t) => s + t.amount, 0);
      if (total) { groupTotals[g.group] = total; groupColors[g.group] = g.color; }
    }
    const labels  = Object.keys(groupTotals);
    if (!labels.length) return;

    const ctx = document.getElementById("expensePieChart").getContext("2d");
    if (AppState.charts.expensePie) AppState.charts.expensePie.destroy();
    AppState.charts.expensePie = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data:            Object.values(groupTotals),
          backgroundColor: labels.map(l => groupColors[l]),
          borderWidth: 3, borderColor: "#fff"
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${formatCurrency(c.parsed)}` } }
        }
      }
    });
  } catch (e) { console.warn("pie chart:", e); }
}

function renderMonthlyTrendChart() {
  try {
    const allTxs      = loadTransactions();
    const today       = new Date();
    const incomeData  = [], expenseData = [], labels = [];

    for (let i = 5; i >= 0; i--) {
      const d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym  = formatYearMonth(d);
      // 月フィルターは1回だけ
      const txs = allTxs.filter(t => t.date.startsWith(ym));
      labels.push(getYearMonthLabel(ym).replace("年", "年\n"));
      let inc = 0, exp = 0;
      txs.forEach(t => { if (t.type === "income") inc += t.amount; else exp += t.amount; });
      incomeData.push(inc);
      expenseData.push(exp);
    }

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (AppState.charts.trend) AppState.charts.trend.destroy();
    AppState.charts.trend = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "収入", data: incomeData,  backgroundColor: "#86EFAC", borderRadius: 4, order: 2 },
          { label: "支出", data: expenseData, backgroundColor: "#FCA5A5", borderRadius: 4, order: 2 },
          {
            label: "収支", type: "line",
            data: incomeData.map((v, i) => v - expenseData[i]),
            borderColor: "#4338CA", backgroundColor: "transparent",
            pointBackgroundColor: "#4338CA", borderWidth: 2, order: 1
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } }
        },
        scales: {
          y: { ticks: { callback: v => `¥${(v / 10000).toFixed(0)}万` }, grid: { color: "#F3F4F6" } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  } catch (e) { console.warn("trend chart:", e); }
}

function renderDetailTable(txs) {
  const el = document.getElementById("report-detail");
  const allItems = [
    ...getAllIncomeItems().map(i => ({
      ...i, type: "income",
      group: INCOME_CATEGORIES.find(g => g.items.some(it => it.id === i.id))?.group
    })),
    ...getAllExpenseItems().map(i => ({
      ...i, type: "expense", group: getExpenseCategoryById(i.id)?.group
    }))
  ];
  const rows = allItems
    .map(item => ({ ...item, amt: txs.filter(t => t.categoryId === item.id).reduce((s, t) => s + t.amount, 0) }))
    .filter(r => r.amt > 0);

  if (!rows.length) { el.innerHTML = '<p class="empty-msg">データがありません</p>'; return; }
  el.innerHTML = `
    <table class="detail-table">
      <thead><tr><th>大項目</th><th>中項目</th><th>種別</th><th>金額</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr>
          <td>${r.group}</td>
          <td>${r.name}</td>
          <td><span class="badge ${r.type}">${r.type === "income" ? "収入" : "支出"}</span></td>
          <td class="amount-cell ${r.type}">${formatCurrency(r.amt)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

// =====================================================
// 口座管理
// =====================================================

function renderAccounts() {
  const accounts = loadAccounts();
  const allTxs   = loadTransactions();
  document.getElementById("accounts-list").innerHTML = accounts.map(acc => {
    const inflow  = allTxs.filter(t => t.type === "income"  && t.accountId === acc.id).reduce((s, t) => s + t.amount, 0);
    const outflow = allTxs.filter(t => t.type === "expense" && t.accountId === acc.id).reduce((s, t) => s + t.amount, 0);
    const balance = (acc.initialBalance || 0) + inflow - outflow;
    const icon    = acc.type === "savings" ? "🏦" : acc.type === "cash" ? "💴" : "💳";
    const label   = acc.type === "savings" ? "積立口座" : acc.type === "cash" ? "現金" : "普通口座";
    return `
      <div class="account-card">
        <div class="account-header">
          <span class="account-icon">${icon}</span>
          <div class="account-info">
            <div class="account-name">${acc.name}</div>
            <div class="account-type">${label}</div>
          </div>
          <div class="account-balance ${balance >= 0 ? "positive" : "negative"}">${formatCurrency(balance)}</div>
        </div>
        <div class="account-flow">
          <span class="flow-in">入金 ${formatCurrency(inflow)}</span>
          <span class="flow-out">出金 ${formatCurrency(outflow)}</span>
        </div>
        <div class="account-initial">
          初期残高: <input type="number" class="initial-balance-input"
            value="${acc.initialBalance || 0}" min="0"
            onchange="updateInitialBalance('${acc.id}', this.value)"> 円
        </div>
      </div>`;
  }).join("");
}

function updateInitialBalance(accountId, value) {
  const accounts = loadAccounts();
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return;
  acc.initialBalance = parseInt(value) || 0;
  saveAccounts(accounts);
  renderAccounts();
  showToast("初期残高を更新しました", "info");
}

// =====================================================
// 設定モーダル
// =====================================================

function setupSettingsModal() {
  document.getElementById("settings-btn").addEventListener("click",  openSettings);
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  document.getElementById("export-csv-btn").addEventListener("click", exportCSV);
  document.getElementById("clear-data-btn").addEventListener("click", clearAllData);
}

function openSettings()  { document.getElementById("settings-modal").style.display = "flex"; }
function closeSettings() { document.getElementById("settings-modal").style.display = "none"; }

// =====================================================
// CSV エクスポート
// =====================================================

function exportCSV() {
  const accounts = loadAccounts();
  const accMap   = new Map(accounts.map(a => [a.id, a.name]));
  const header   = ["日付", "種別", "大項目", "中項目", "金額", "口座", "メモ"];
  const rows     = loadTransactions()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(tx => {
      const catInfo = tx.type === "income"
        ? getIncomeCategoryById(tx.categoryId)
        : getExpenseCategoryById(tx.categoryId);
      return [
        tx.date,
        tx.type === "income" ? "収入" : "支出",
        catInfo?.group || "",
        catInfo?.item?.name || tx.categoryId,
        tx.amount,
        accMap.get(tx.accountId) || "",
        tx.memo || ""
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

  const csv  = "﻿" + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `家計簿_${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSVをエクスポートしました", "success");
}

function clearAllData() {
  if (!confirm("全データを削除します。元に戻せません。よろしいですか？")) return;
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  location.reload();
}

// =====================================================
// トースト通知
// =====================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast     = Object.assign(document.createElement("div"), { className: `toast toast-${type}`, textContent: message });
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
