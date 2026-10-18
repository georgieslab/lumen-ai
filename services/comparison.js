// Comparison Matrix & Decision Table service for Lumen AI Agent
// Compares 2 to 5 options side-by-side with metrics, ratings, pros, cons, and recommendations.

const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const COMPARISON_LIMITS = {
  maxTitleChars: 120,
  maxCategoryChars: 50,
  maxSummaryChars: 300,
  maxCriteriaCount: 8,
  maxCriteriaChars: 40,
  maxOptions: 5,
  maxOptionNameChars: 60,
  maxHighlightChars: 40,
  maxProsCons: 5,
  maxProConChars: 120,
  maxRecommendationChars: 400
};

export function sanitizeOption(raw, index = 0, criteriaList = []) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clip(raw.name || raw.title, COMPARISON_LIMITS.maxOptionNameChars) || `Option ${index + 1}`;
  const highlight = clip(raw.highlight || raw.badge || raw.tag, COMPARISON_LIMITS.maxHighlightChars) || undefined;
  const rating = clip(raw.rating || raw.score, 20) || undefined;

  // Values map
  const rawValues = raw.values && typeof raw.values === 'object' ? raw.values : {};
  const normalizedValues = new Map(Object.entries(rawValues).map(([key, value]) => [clip(key, COMPARISON_LIMITS.maxCriteriaChars), value]));
  const values = Object.fromEntries(criteriaList.map((criterion) => [criterion,
    normalizedValues.has(criterion) ? clip(normalizedValues.get(criterion), 150) : '—'
  ]));

  // Pros & cons
  const rawPros = Array.isArray(raw.pros) ? raw.pros : [];
  const pros = rawPros.map(p => clip(p, COMPARISON_LIMITS.maxProConChars)).filter(Boolean).slice(0, COMPARISON_LIMITS.maxProsCons);

  const rawCons = Array.isArray(raw.cons) ? raw.cons : [];
  const cons = rawCons.map(c => clip(c, COMPARISON_LIMITS.maxProConChars)).filter(Boolean).slice(0, COMPARISON_LIMITS.maxProsCons);

  return {
    id: `opt-${index + 1}`,
    name,
    highlight,
    rating,
    values,
    pros,
    cons
  };
}

export function buildComparisonWidget(input = {}) {
  const title = clip(input.title, COMPARISON_LIMITS.maxTitleChars) || 'Comparative Analysis & Decision Matrix';
  const category = clip(input.category, COMPARISON_LIMITS.maxCategoryChars) || 'Comparison';
  const summary = clip(input.summary || input.description, COMPARISON_LIMITS.maxSummaryChars);
  const recommendation = clip(input.recommendation || input.verdict, COMPARISON_LIMITS.maxRecommendationChars);

  // Criteria list
  const rawCriteria = Array.isArray(input.criteria) ? input.criteria : [];
  const criteria = [];
  const seenCriteria = new Set();
  for (const c of rawCriteria) {
    const cleaned = clip(c, COMPARISON_LIMITS.maxCriteriaChars);
    if (cleaned && !seenCriteria.has(cleaned.toLowerCase())) {
      seenCriteria.add(cleaned.toLowerCase());
      criteria.push(cleaned);
      if (criteria.length >= COMPARISON_LIMITS.maxCriteriaCount) break;
    }
  }

  // Fallback criteria if none given
  if (criteria.length === 0) {
    criteria.push('Overview', 'Key Benefit', 'Trade-off');
  }

  // Options list
  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = [];
  for (let i = 0; i < rawOptions.length; i++) {
    const opt = sanitizeOption(rawOptions[i], i, criteria);
    if (opt) options.push(opt);
    if (options.length >= COMPARISON_LIMITS.maxOptions) break;
  }

  // Ensure at least 2 options for comparison
  if (options.length < 2) {
    options.push(
      sanitizeOption({ name: 'Option A', values: { [criteria[0]]: 'Standard choice' } }, 0, criteria),
      sanitizeOption({ name: 'Option B', values: { [criteria[0]]: 'Alternative choice' } }, 1, criteria)
    );
  }

  return {
    widgetType: 'comparison',
    comparisonId: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category,
    summary: summary || undefined,
    criteria,
    options: options.slice(0, COMPARISON_LIMITS.maxOptions),
    recommendation: recommendation || undefined,
    createdAt: Date.now()
  };
}

// Auto-parses markdown comparison tables into an interactive ComparisonCard widget
export function extractComparisonFromMarkdown(text) {
  if (typeof text !== 'string' || !text.includes('|')) {
    return { cleanText: text, comparisonWidget: null };
  }

  const lines = text.split('\n');
  let tableStart = -1;
  let tableEnd = -1;
  const tableLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|') && line.split('|').length >= 4) {
      if (tableStart === -1) tableStart = i;
      tableEnd = i;
      tableLines.push(line);
    } else if (tableStart !== -1 && tableLines.length >= 3) {
      break;
    } else if (tableStart !== -1) {
      tableStart = -1;
      tableLines.length = 0;
    }
  }

  if (tableLines.length < 3) {
    return { cleanText: text, comparisonWidget: null };
  }

  const headerCells = tableLines[0].split('|').map(s => s.trim()).filter(Boolean);
  const sepLine = tableLines[1];
  if (!/^\|?\s*[-:]+\s*\|/.test(sepLine) || headerCells.length < 3) {
    return { cleanText: text, comparisonWidget: null };
  }

  const optionNames = headerCells.slice(1).map(n => n.replace(/\*+/g, '').trim());
  const optionsMap = optionNames.map(name => ({ name, values: {}, pros: [], cons: [] }));
  const criteria = [];

  for (let r = 2; r < tableLines.length; r++) {
    const rowCells = tableLines[r].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (rowCells.length < 2) continue;
    const critName = rowCells[0].replace(/\*+/g, '').trim();
    if (!critName) continue;
    criteria.push(critName);

    for (let o = 0; o < optionsMap.length; o++) {
      if (rowCells[o + 1] !== undefined) {
        optionsMap[o].values[critName] = rowCells[o + 1].trim();
      }
    }
  }

  if (optionsMap.length < 2 || criteria.length < 2) {
    return { cleanText: text, comparisonWidget: null };
  }

  let title = 'Comparative Analysis & Decision Matrix';
  if (tableStart > 0) {
    for (let p = tableStart - 1; p >= Math.max(0, tableStart - 3); p--) {
      const prevLine = lines[p].trim();
      if (prevLine.startsWith('#') || prevLine.startsWith('**')) {
        title = prevLine.replace(/^[#*]+\s*/, '').replace(/[*#]+$/, '').trim();
        break;
      }
    }
  }

  let recommendation = '';
  const remainingAfterTable = lines.slice(tableEnd + 1).join('\n');
  const topPickMatch = remainingAfterTable.match(/(?:###?\s*(?:Top Pick|Recommendation|Verdict)[\s\S]*?\n\s*\*\*([^\n*]+)\*\*[\s\S]*?(?:Reasoning|Summary)?[:\s-]*([^\n#]+))/i) ||
    remainingAfterTable.match(/(?:###?\s*(?:Top Pick|Recommendation)[\s\S]*?\n\s*([^\n#]+))/i);

  if (topPickMatch) {
    const pickName = (topPickMatch[1] || '').trim();
    const reason = (topPickMatch[2] || '').trim();
    recommendation = reason ? `${pickName}: ${reason}` : pickName;

    const matchedOption = optionsMap.find(o => o.name.toLowerCase().includes(pickName.toLowerCase()) || pickName.toLowerCase().includes(o.name.toLowerCase()));
    if (matchedOption) {
      matchedOption.highlight = 'Top Pick';
    }
  }

  const comparisonWidget = buildComparisonWidget({
    title,
    criteria,
    options: optionsMap,
    recommendation
  });

  const beforeLines = lines.slice(0, tableStart);
  if (beforeLines.length > 0 && /^[#*]+\s*(?:Decision Matrix|Comparison)/i.test(beforeLines[beforeLines.length - 1].trim())) {
    beforeLines.pop();
  }
  const cleanLines = [...beforeLines, ...lines.slice(tableEnd + 1)];
  const cleanText = cleanLines.join('\n').trim();

  return { cleanText, comparisonWidget };
}

