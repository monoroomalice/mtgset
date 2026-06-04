// =====================================================
// 家計簿アプリ メインロジック
// =====================================================

// --- アプリ状態 ---
const AppState = {
  currentTab:      "dashboard",
  currentYearMonth: formatYearMonth(new Date()),
  editingTxId:     null,
  charts:          {}
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
  renderAll();
});

function renderAll() {
  invalidateTxCache(); // 最新データを必ず取得
  renderDashboard();   // ダッシュボードは常に更新
  // 現在表示中のタブだけ追加で更新（全タブ再描画は重すぎる）
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
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  AppState.currentTab = tab;

  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-content").forEach(section => {
    section.classList.toggle("active", section.id === `tab-${tab}`);
  });

  // タブ切り替え時に再描画（キャッシュリセットで最新データを取得）
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
  const sel = document.getElementById("month-selector");
  const prevBtn = document.getElementById("month-prev");
  const nextBtn = document.getElementById("month-next");

  // 過去24ヶ月 + 今月のオプションを生成
  const today = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = formatYearMonth(d);
    const opt = document.createElement("option");
    opt.value = ym;
    opt.textContent = getYearMonthLabel(ym);
    if (ym === AppState.currentYearMonth) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener("change", () => {
    AppState.currentYearMonth = sel.value;
    renderAll();
  });

  prevBtn.addEventListener("click", () => {
    const [y, m] = AppState.currentYearMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    AppState.currentYearMonth = formatYearMonth(prev);
    sel.value = AppState.currentYearMonth;
    renderAll();
  });

  nextBtn.addEventListener("click", () => {
    const [y, m] = AppState.currentYearMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    const now = new Date();
    if (next > now) return;
    AppState.currentYearMonth = formatYearMonth(next);
    sel.value = AppState.currentYearMonth;
    renderAll();
  });
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

  // グループ選択肢
  groupSel.innerHTML = '<option value="">大項目を選択</option>';
  INCOME_CATEGORIES.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.group;
    opt.textContent = g.group;
    groupSel.appendChild(opt);
  });

  groupSel.addEventListener("change", () => {
    const group = INCOME_CATEGORIES.find(g => g.group === groupSel.value);
    catSel.innerHTML = '<option value="">中項目を選択</option>';
    catSel.disabled = !group;
    if (group) {
      group.items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        catSel.appendChild(opt);
      });
    }
  });

  // 口座選択肢
  populateAccountSelects(["income-account"]);

  // 日付デフォルト
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
    groupSel.value = "";
    catSel.innerHTML = '<option value="">中項目を選択</option>';
    catSel.disabled = true;
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

  // 大項目（固定費・変動費・特別積立）
  groupSel.innerHTML = '<option value="">大項目を選択</option>';
  EXPENSE_CATEGORIES.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.group;
    opt.textContent = g.group;
    groupSel.appendChild(opt);
  });

  groupSel.addEventListener("change", () => {
    const group = EXPENSE_CATEGORIES.find(g => g.group === groupSel.value);
    subgroupSel.innerHTML = '<option value="">中分類を選択</option>';
    subgroupSel.disabled = !group;
    catSel.innerHTML = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled = true;
    noteEl.textContent = "";
    if (group) {
      group.subgroups.forEach(sg => {
        const opt = document.createElement("option");
        opt.value = sg.name;
        opt.textContent = sg.name;
        subgroupSel.appendChild(opt);
      });
    }
  });

  subgroupSel.addEventListener("change", () => {
    const group    = EXPENSE_CATEGORIES.find(g => g.group === groupSel.value);
    const subgroup = group?.subgroups.find(sg => sg.name === subgroupSel.value);
    catSel.innerHTML = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled = !subgroup;
    noteEl.textContent = "";
    if (subgroup) {
      subgroup.items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        catSel.appendChild(opt);
      });
    }
  });

  catSel.addEventListener("change", () => {
    const item = getExpenseCategoryById(catSel.value)?.item;
    noteEl.textContent = item?.note ? `💡 ${item.note}` : "";
  });

  // 口座選択肢
  populateAccountSelects(["expense-account"]);

  // 日付デフォルト
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
    groupSel.value = "";
    subgroupSel.innerHTML = '<option value="">中分類を選択</option>';
    subgroupSel.disabled = true;
    catSel.innerHTML = '<option value="">詳細カテゴリを選択</option>';
    catSel.disabled = true;
    noteEl.textContent = "";
    showToast("支出を登録しました ✓", "success");
    renderAll();
  });
}

function populateAccountSelects(ids) {
  const accounts = loadAccounts();
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">口座を選択（任意）</option>';
    accounts.forEach(acc => {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = acc.name;
      sel.appendChild(opt);
    });
  });
}

// =====================================================
// ダッシュボード
// =====================================================

function renderDashboard() {
  const ym = AppState.currentYearMonth;
  const txs = getTransactionsByMonth(ym);

  const totalIncome  = txs.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  // サマリーカード
  document.getElementById("dash-income").textContent  = formatCurrency(totalIncome);
  document.getElementById("dash-expense").textContent = formatCurrency(totalExpense);
  const balEl = document.getElementById("dash-balance");
  balEl.textContent = formatCurrency(balance);
  balEl.className = "summary-value " + (balance >= 0 ? "positive" : "negative");

  renderFixedBalanceView(ym, txs);
  renderPetMedicalChart();
  renderIncomeBreakdown(txs);
}

// ① 収入と固定費の相殺ビュー
function renderFixedBalanceView(ym, txs) {
  const settings = loadSettings();

  // 夫の本給（今月の実績、なければ設定の予算値）
  const husbandBase = txs
    .filter(t => t.type === "income" && t.categoryId === HUSBAND_BASE_ID)
    .reduce((s, t) => s + t.amount, 0);

  // 固定費の実績合計
  const fixedExpense = txs
    .filter(t => t.type === "expense" && FIXED_EXPENSE_IDS.includes(t.categoryId))
    .reduce((s, t) => s + t.amount, 0);

  const diff     = husbandBase - fixedExpense;
  const isPlus   = diff >= 0;
  const pct      = husbandBase > 0 ? Math.min(100, Math.round((fixedExpense / husbandBase) * 100)) : 0;

  document.getElementById("fixed-husband-income").textContent = formatCurrency(husbandBase);
  document.getElementById("fixed-expense-total").textContent  = formatCurrency(fixedExpense);
  const diffEl = document.getElementById("fixed-diff");
  diffEl.textContent = (isPlus ? "+" : "") + formatCurrency(diff);
  diffEl.className   = "fixed-diff " + (isPlus ? "positive" : "negative");

  const barFill = document.getElementById("fixed-bar-fill");
  barFill.style.width     = pct + "%";
  barFill.style.background = pct >= 100 ? "#DC2626" : pct >= 80 ? "#D97706" : "#059669";
  document.getElementById("fixed-bar-pct").textContent = pct + "%";

  // 固定費の内訳
  const breakdownEl = document.getElementById("fixed-breakdown");
  const fixedItems  = getAllExpenseItems().filter(i => i.isFixed);
  breakdownEl.innerHTML = fixedItems.map(item => {
    const amt = txs
      .filter(t => t.type === "expense" && t.categoryId === item.id)
      .reduce((s, t) => s + t.amount, 0);
    return `
      <div class="breakdown-row ${amt > 0 ? "" : "empty"}">
        <span>${item.name}</span>
        <span>${amt > 0 ? formatCurrency(amt) : "未入力"}</span>
      </div>`;
  }).join("");
}

// ② 犬の通院費推移グラフ
function renderPetMedicalChart() {
  try {
  const data = getMonthlySumByCategory(PET_MEDICAL_ID, 12);
  const labels  = data.map(d => getYearMonthLabel(d.yearMonth).replace("年","年\n"));
  const amounts = data.map(d => d.amount);
  const total   = amounts.reduce((s, a) => s + a, 0);

  document.getElementById("pet-annual-total").textContent = formatCurrency(total);
  document.getElementById("pet-avg-monthly").textContent  = formatCurrency(Math.round(total / 12));

  const ctx = document.getElementById("petMedicalChart").getContext("2d");
  if (AppState.charts.petMedical) AppState.charts.petMedical.destroy();
  AppState.charts.petMedical = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "動物病院（通院）",
        data: amounts,
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
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: val => `¥${val.toLocaleString()}`
          },
          grid: { color: "#F3F4F6" }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
  } catch (e) { console.warn("pet chart error:", e); }
}

// 収入内訳バー
function renderIncomeBreakdown(txs) {
  const el = document.getElementById("dash-income-breakdown");
  const totalIncome = txs.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0);
  if (totalIncome === 0) { el.innerHTML = '<p class="empty-msg">今月の収入データがありません</p>'; return; }

  const rows = [];
  for (const group of INCOME_CATEGORIES) {
    for (const item of group.items) {
      const amt = txs.filter(t => t.type === "income" && t.categoryId === item.id).reduce((s,t) => s+t.amount, 0);
      if (amt > 0) rows.push({ name: item.name, amt, pct: Math.round(amt / totalIncome * 100) });
    }
  }
  el.innerHTML = rows.map(r => `
    <div class="income-row">
      <span class="income-row-name">${r.name}</span>
      <div class="income-row-bar-wrap">
        <div class="income-row-bar" style="width:${r.pct}%"></div>
      </div>
      <span class="income-row-amt">${formatCurrency(r.amt)}</span>
    </div>`).join("");
}

// =====================================================
// 取引履歴
// =====================================================

function renderHistory() {
  const ym   = AppState.currentYearMonth;
  const txs  = getTransactionsByMonth(ym);
  const filter = document.getElementById("history-filter")?.value || "all";

  const filtered = txs
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById("history-body");
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">取引データがありません</td></tr>';
    return;
  }

  const accounts = loadAccounts();
  tbody.innerHTML = filtered.map(tx => {
    const catInfo = tx.type === "income"
      ? getIncomeCategoryById(tx.categoryId)
      : getExpenseCategoryById(tx.categoryId);
    const catName  = catInfo?.item?.name || tx.categoryId;
    const acc      = accounts.find(a => a.id === tx.accountId);
    const accName  = acc?.name || "";
    const accIcon  = acc?.type === "cash" ? "💴" : acc?.type === "savings" ? "🏦" : "💳";
    const accTag   = accName
      ? `<span class="acc-tag">${accIcon} ${accName}</span>`
      : "";

    return `
      <tr>
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

// 履歴フィルター
document.addEventListener("DOMContentLoaded", () => {
  const filterSel = document.getElementById("history-filter");
  if (filterSel) filterSel.addEventListener("change", renderHistory);
});

// =====================================================
// 月次レポート
// =====================================================

function renderReport() {
  const ym  = AppState.currentYearMonth;
  const txs = getTransactionsByMonth(ym);

  const totalIncome  = txs.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0);
  const totalExpense = txs.filter(t => t.type === "expense").reduce((s,t) => s+t.amount, 0);

  document.getElementById("report-income").textContent  = formatCurrency(totalIncome);
  document.getElementById("report-expense").textContent = formatCurrency(totalExpense);
  const balEl = document.getElementById("report-balance");
  balEl.textContent = formatCurrency(totalIncome - totalExpense);
  balEl.className = totalIncome >= totalExpense ? "positive" : "negative";

  renderExpensePieChart(txs);
  renderMonthlyTrendChart();
  renderDetailTable(txs);
}

function renderExpensePieChart(txs) {
  try {
  const expenses = txs.filter(t => t.type === "expense");
  if (expenses.length === 0) return;

  // 支出を「大項目グループ」で集計
  const groupTotals = {};
  const groupColors = {};
  for (const group of EXPENSE_CATEGORIES) {
    const ids = group.subgroups.flatMap(sg => sg.items.map(i => i.id));
    const total = expenses.filter(t => ids.includes(t.categoryId)).reduce((s,t) => s+t.amount, 0);
    if (total > 0) {
      groupTotals[group.group] = total;
      groupColors[group.group] = group.color;
    }
  }

  const labels  = Object.keys(groupTotals);
  const amounts = Object.values(groupTotals);
  const colors  = labels.map(l => groupColors[l]);

  const ctx = document.getElementById("expensePieChart").getContext("2d");
  if (AppState.charts.expensePie) AppState.charts.expensePie.destroy();
  AppState.charts.expensePie = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: amounts, backgroundColor: colors, borderWidth: 3, borderColor: "#fff" }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`
          }
        }
      }
    }
  });
  } catch (e) { console.warn("pie chart error:", e); }
}

function renderMonthlyTrendChart() {
  try {
  const allTxs = loadTransactions(); // キャッシュ経由で1回だけロード
  const today  = new Date();
  const months = 6;
  const incomeData  = [];
  const expenseData = [];
  const labels      = [];

  for (let i = months - 1; i >= 0; i--) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym  = formatYearMonth(d);
    const txs = allTxs.filter(t => t.date.startsWith(ym));
    labels.push(getYearMonthLabel(ym).replace("年","年\n"));
    incomeData.push(txs.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0));
    expenseData.push(txs.filter(t => t.type === "expense").reduce((s,t) => s+t.amount, 0));
  }

  const ctx = document.getElementById("trendChart").getContext("2d");
  if (AppState.charts.trend) AppState.charts.trend.destroy();
  AppState.charts.trend = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "収入",
          data: incomeData,
          backgroundColor: "#86EFAC",
          borderRadius: 4,
          order: 2
        },
        {
          label: "支出",
          data: expenseData,
          backgroundColor: "#FCA5A5",
          borderRadius: 4,
          order: 2
        },
        {
          label: "収支",
          data: incomeData.map((inc, i) => inc - expenseData[i]),
          type: "line",
          borderColor: "#4338CA",
          backgroundColor: "transparent",
          pointBackgroundColor: "#4338CA",
          borderWidth: 2,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: val => `¥${(val/10000).toFixed(0)}万` },
          grid: { color: "#F3F4F6" }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
  } catch (e) { console.warn("trend chart error:", e); }
}

function renderDetailTable(txs) {
  const el = document.getElementById("report-detail");
  const allItems = [
    ...getAllIncomeItems().map(i => ({
      ...i, type: "income",
      group: INCOME_CATEGORIES.find(g => g.items.some(it => it.id === i.id))?.group
    })),
    ...getAllExpenseItems().map(i => ({
      ...i, type: "expense",
      group: getExpenseCategoryById(i.id)?.group
    }))
  ];

  const rows = allItems.map(item => {
    const amt = txs.filter(t => t.categoryId === item.id).reduce((s,t) => s+t.amount, 0);
    return { ...item, amt };
  }).filter(r => r.amt > 0);

  if (rows.length === 0) { el.innerHTML = '<p class="empty-msg">データがありません</p>'; return; }

  el.innerHTML = `
    <table class="detail-table">
      <thead><tr><th>大項目</th><th>中項目</th><th>種別</th><th>金額</th></tr></thead>
      <tbody>
        ${rows.map(r => `
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
  const txs      = loadTransactions();
  const el       = document.getElementById("accounts-list");

  el.innerHTML = accounts.map(acc => {
    const inflow  = txs.filter(t => t.type === "income" && t.accountId === acc.id).reduce((s,t) => s+t.amount, 0);
    const outflow = txs.filter(t => t.type === "expense" && t.accountId === acc.id).reduce((s,t) => s+t.amount, 0);
    const balance = (acc.initialBalance || 0) + inflow - outflow;
    const icon  = acc.type === "savings" ? "🏦" : acc.type === "cash" ? "💴" : "💳";
    const label = acc.type === "savings" ? "積立口座" : acc.type === "cash" ? "現金" : "普通口座";
    return `
      <div class="account-card">
        <div class="account-header">
          <span class="account-icon">${icon}</span>
          <div class="account-info">
            <div class="account-name">${acc.name}</div>
            <div class="account-type">${label}</div>
          </div>
          <div class="account-balance ${balance >= 0 ? "positive" : "negative"}">
            ${formatCurrency(balance)}
          </div>
        </div>
        <div class="account-flow">
          <span class="flow-in">入金 ${formatCurrency(inflow)}</span>
          <span class="flow-out">出金 ${formatCurrency(outflow)}</span>
        </div>
        <div class="account-initial">
          初期残高:
          <input type="number" class="initial-balance-input"
                 value="${acc.initialBalance || 0}"
                 onchange="updateInitialBalance('${acc.id}', this.value)"
                 min="0">
          円
        </div>
      </div>`;
  }).join("");
}

function updateInitialBalance(accountId, value) {
  const accounts = loadAccounts();
  const acc = accounts.find(a => a.id === accountId);
  if (acc) {
    acc.initialBalance = parseInt(value) || 0;
    saveAccounts(accounts);
    renderAccounts();
    showToast("初期残高を更新しました", "info");
  }
}

// =====================================================
// 設定モーダル
// =====================================================

function setupSettingsModal() {
  document.getElementById("settings-btn").addEventListener("click", openSettings);
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  document.getElementById("settings-form").addEventListener("submit", saveSettingsForm);
  document.getElementById("export-csv-btn").addEventListener("click", exportCSV);
  document.getElementById("clear-data-btn").addEventListener("click", clearAllData);
}

function openSettings() {
  const settings = loadSettings();
  document.getElementById("settings-modal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settings-modal").style.display = "none";
}

function saveSettingsForm(e) {
  e.preventDefault();
  showToast("設定を保存しました ✓", "success");
  closeSettings();
}

// =====================================================
// CSV エクスポート
// =====================================================

function exportCSV() {
  const txs = loadTransactions().sort((a,b) => a.date.localeCompare(b.date));
  const accounts = loadAccounts();
  const header = ["日付", "種別", "大項目", "中項目", "金額", "口座", "メモ"];
  const rows = txs.map(tx => {
    const catInfo = tx.type === "income"
      ? getIncomeCategoryById(tx.categoryId)
      : getExpenseCategoryById(tx.categoryId);
    return [
      tx.date,
      tx.type === "income" ? "収入" : "支出",
      catInfo?.group || "",
      catInfo?.item?.name || tx.categoryId,
      tx.amount,
      accounts.find(a => a.id === tx.accountId)?.name || "",
      tx.memo || ""
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csv = "﻿" + [header.join(","), ...rows].join("\n"); // BOM付きUTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `家計簿_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSVをエクスポートしました", "success");
}

function clearAllData() {
  if (!confirm("全データを削除します。この操作は元に戻せません。よろしいですか？")) return;
  localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
  localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  location.reload();
}

// =====================================================
// トースト通知
// =====================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add("show"); }, 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
