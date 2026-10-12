// Budget & Expense Planner Service for Lumen AI Agent
// Creates structured financial allocations, cost breakdowns, and savings tips.

const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const BUDGET_LIMITS = {
  maxTitleChars: 120,
  maxCategoryNameChars: 60,
  maxSummaryChars: 300,
  maxCategories: 8,
  maxSubItems: 6,
  maxTips: 5,
  maxTipChars: 180
};

const DEFAULT_CATEGORY_COLORS = [
  '#38bdf8', // Sky Blue
  '#818cf8', // Indigo
  '#34d399', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#f97316', // Orange
  '#14b8a6'  // Teal
];

export function parseAmount(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  if (!val || typeof val !== 'string') return 0;
  // Clean currency symbols, commas, and whitespace
  const clean = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, num);
}

export function sanitizeBudgetCategory(raw, index = 0, total = 0) {
  if (!raw) return null;
  const obj = typeof raw === 'string' ? { name: raw, allocated: 0 } : raw;
  const name = clip(obj.name || obj.category || obj.title, BUDGET_LIMITS.maxCategoryNameChars) || `Category ${index + 1}`;
  const allocated = parseAmount(obj.allocated ?? obj.amount ?? obj.cost ?? obj.budget);
  const color = obj.color || DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length];

  const rawItems = Array.isArray(obj.items) ? obj.items : (Array.isArray(obj.subItems) ? obj.subItems : []);
  const items = rawItems
    .map(it => clip(typeof it === 'string' ? it : (it.name || it.title), 100))
    .filter(Boolean)
    .slice(0, BUDGET_LIMITS.maxSubItems);

  const tips = clip(obj.tip || obj.notes, BUDGET_LIMITS.maxTipChars) || undefined;

  return {
    id: `cat-${index + 1}`,
    name,
    allocated,
    color,
    items,
    tip: tips
  };
}

export function buildBudgetWidget(input = {}) {
  const title = clip(input.title, BUDGET_LIMITS.maxTitleChars) || 'Budget & Expense Allocation';
  const category = clip(input.category || input.type, 50) || 'Finance';
  const summary = clip(input.summary || input.description, BUDGET_LIMITS.maxSummaryChars) || undefined;
  const rawCurrency = String(input.currency || input.symbol || '$').trim();
  const currency = rawCurrency.length <= 5 ? rawCurrency : '$';

  let totalBudget = parseAmount(input.totalBudget ?? input.total ?? input.budget);

  const rawCats = Array.isArray(input.categories) ? input.categories : (Array.isArray(input.items) ? input.items : []);
  let categories = [];

  for (let i = 0; i < rawCats.length; i++) {
    const cat = sanitizeBudgetCategory(rawCats[i], i, totalBudget);
    if (cat) categories.push(cat);
    if (categories.length >= BUDGET_LIMITS.maxCategories) break;
  }

  // Fallback categories if empty
  if (categories.length === 0) {
    categories = [
      sanitizeBudgetCategory({ name: 'Essentials & Lodging', allocated: 500, items: ['Main accommodation', 'Utilities'] }, 0),
      sanitizeBudgetCategory({ name: 'Dining & Food', allocated: 250, items: ['Daily meals', 'Groceries'] }, 1),
      sanitizeBudgetCategory({ name: 'Activities & Transport', allocated: 150, items: ['Local transit', 'Sightseeing'] }, 2),
      sanitizeBudgetCategory({ name: 'Buffer & Savings', allocated: 100, items: ['Unforeseen expenses'] }, 3)
    ];
  }

  // Compute sum of categories
  const calculatedSum = categories.reduce((acc, c) => acc + c.allocated, 0);
  if (totalBudget === 0) {
    totalBudget = calculatedSum || 1000;
  }

  // Assign computed percentage to each category
  categories.forEach((cat) => {
    cat.percentage = totalBudget > 0 ? Math.round((cat.allocated / totalBudget) * 100) : 0;
  });

  const rawSavingsTips = Array.isArray(input.savingsTips) ? input.savingsTips : (Array.isArray(input.tips) ? input.tips : []);
  const savingsTips = rawSavingsTips
    .map(t => clip(t, BUDGET_LIMITS.maxTipChars))
    .filter(Boolean)
    .slice(0, BUDGET_LIMITS.maxTips);

  return {
    widgetType: 'budget',
    budgetId: `bdg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category,
    summary,
    currency,
    totalBudget,
    allocatedTotal: calculatedSum,
    categories,
    savingsTips: savingsTips.length > 0 ? savingsTips : undefined,
    createdAt: Date.now()
  };
}

// Fallback: extracts budget breakdowns from text if model outputted markdown bullet lists with costs
export function extractBudgetFromMarkdown(text) {
  if (typeof text !== 'string' || text.length < 25) {
    return { cleanText: text, budgetWidget: null };
  }

  // Look for lines like: - Lodging: $600 (35%) or * Food & Dining: $400
  const itemRegex = /^\s*[-*•]\s*(?:\*\*)?([^:$]+?)(?:\*\*)?\s*:\s*([$€£¥]?\s*[\d,]+(?:\.\d{2})?)\b(?:\s*\(?(\d{1,2})%?\)?)?/i;
  const lines = text.split('\n');
  const foundCategories = [];
  let budgetStart = -1;
  let budgetEnd = -1;
  let detectedCurrency = '$';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(itemRegex);
    if (match) {
      if (budgetStart === -1) budgetStart = i;
      budgetEnd = i;
      const catName = match[1].trim();
      const amountStr = match[2].trim();
      if (amountStr.includes('€')) detectedCurrency = '€';
      else if (amountStr.includes('£')) detectedCurrency = '£';
      else if (amountStr.includes('¥')) detectedCurrency = '¥';

      const amount = parseAmount(amountStr);
      foundCategories.push({
        name: catName,
        allocated: amount
      });
    } else if (budgetStart !== -1 && foundCategories.length >= 3 && line.trim().startsWith('#')) {
      break;
    }
  }

  if (foundCategories.length < 3) {
    return { cleanText: text, budgetWidget: null };
  }

  let title = 'Budget & Expense Allocation';
  if (budgetStart > 0) {
    for (let p = budgetStart - 1; p >= Math.max(0, budgetStart - 3); p--) {
      const prev = lines[p].trim();
      if (prev.startsWith('#') || prev.startsWith('**')) {
        title = prev.replace(/^[#*]+\s*/, '').replace(/[*#]+$/, '').trim();
        break;
      }
    }
  }

  const budgetWidget = buildBudgetWidget({
    title,
    currency: detectedCurrency,
    categories: foundCategories
  });

  const beforeLines = lines.slice(0, budgetStart);
  if (beforeLines.length > 0 && /^[#*]+\s*(?:Budget|Cost Breakdown|Expenses|Spending Plan)/i.test(beforeLines[beforeLines.length - 1].trim())) {
    beforeLines.pop();
  }
  const cleanLines = [...beforeLines, ...lines.slice(budgetEnd + 1)];
  const cleanText = cleanLines.join('\n').trim();

  return { cleanText, budgetWidget };
}

