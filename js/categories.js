// =====================================================
// カテゴリ定義 / Category Definitions
// =====================================================

const INCOME_CATEGORIES = [
  {
    group: "夫・給与",
    items: [
      { id: "husband_base",     name: "夫：本給（固定分）",      isFixed: true  },
      { id: "husband_variable", name: "夫：変動給（残業・シフト）", isFixed: false }
    ]
  },
  {
    group: "私・事業",
    items: [
      { id: "wife_fc",    name: "私：FC教室利益", isFixed: false },
      { id: "wife_video", name: "私：動画編集",   isFixed: false }
    ]
  },
  {
    group: "私・給与/在宅",
    items: [
      { id: "wife_remote", name: "私：在宅ワーク（時給）",           isFixed: false },
      { id: "wife_partA",  name: "私：アルバイトA（差引支給額）",    isFixed: false },
      { id: "wife_partB",  name: "私：アルバイトB（差引支給額）",    isFixed: false }
    ]
  }
];

const EXPENSE_CATEGORIES = [
  {
    group: "固定費",
    color: "#4338CA",
    subgroups: [
      {
        name: "住居費",
        items: [
          { id: "housing_loan", name: "住宅ローン", isFixed: true, note: "毎月定額" }
        ]
      },
      {
        name: "水道光熱",
        items: [
          { id: "electricity", name: "電気代（オール電化）", isFixed: true, note: "冬・夏の変動に注意" },
          { id: "water",       name: "水道代",              isFixed: true, note: "2ヶ月に1回" }
        ]
      },
      {
        name: "通信費",
        items: [
          { id: "phone", name: "スマホ代（家族分）", isFixed: true }
        ]
      },
      {
        name: "保険・ペット",
        items: [
          { id: "pet_insurance", name: "ペット保険料",       isFixed: true },
          { id: "insurance",     name: "各種保険（月払い分）", isFixed: true }
        ]
      }
    ]
  },
  {
    group: "変動費・生活費",
    color: "#059669",
    subgroups: [
      {
        name: "ペット費",
        items: [
          { id: "vet",      name: "犬：動物病院（通院）", isFixed: false, isPetMedical: true },
          { id: "pet_food", name: "犬：フード・消耗品",   isFixed: false }
        ]
      },
      {
        name: "子ども費",
        items: [
          { id: "child_edu",     name: "娘：教育・習い事",   isFixed: false },
          { id: "child_clothes", name: "娘：衣服・イベント", isFixed: false }
        ]
      },
      {
        name: "生活その他",
        items: [
          { id: "medical",     name: "医療費（人間用）",    isFixed: false },
          { id: "allowance",   name: "お小遣い / 自由費",  isFixed: false },
          { id: "contingency", name: "予備費（突発）",      isFixed: false }
        ]
      }
    ]
  },
  {
    group: "特別支出積立",
    color: "#D97706",
    subgroups: [
      {
        name: "特別支出積立",
        items: [
          { id: "tax_reserve",       name: "税金積立（固定資産/自動車/住民税）", isFixed: false },
          { id: "annual_insurance",  name: "年払い保険料積立",                  isFixed: false },
          { id: "car_maintenance",   name: "車検・メンテナンス積立",            isFixed: false }
        ]
      }
    ]
  }
];

// すべての収入中項目をフラットに取得
function getAllIncomeItems() {
  return INCOME_CATEGORIES.flatMap(g => g.items);
}

// すべての支出中項目をフラットに取得
function getAllExpenseItems() {
  return EXPENSE_CATEGORIES.flatMap(g =>
    g.subgroups.flatMap(sg => sg.items)
  );
}

// IDからカテゴリ情報を取得（収入）
function getIncomeCategoryById(id) {
  for (const group of INCOME_CATEGORIES) {
    const item = group.items.find(i => i.id === id);
    if (item) return { group: group.group, item };
  }
  return null;
}

// IDからカテゴリ情報を取得（支出）
function getExpenseCategoryById(id) {
  for (const group of EXPENSE_CATEGORIES) {
    for (const sg of group.subgroups) {
      const item = sg.items.find(i => i.id === id);
      if (item) return { group: group.group, subgroup: sg.name, item, color: group.color };
    }
  }
  return null;
}

// 固定費の支出IDリスト（ダッシュボード「相殺計算」用）
const FIXED_EXPENSE_IDS = getAllExpenseItems()
  .filter(i => i.isFixed)
  .map(i => i.id);

// 夫の固定給ID
const HUSBAND_BASE_ID = "husband_base";

// 犬の通院費ID
const PET_MEDICAL_ID = "vet";
