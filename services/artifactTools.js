import { buildChecklistWidget, CHECKLIST_LIMITS } from './checklist.js';
import { buildComparisonWidget, COMPARISON_LIMITS } from './comparison.js';
import { buildScheduleWidget, SCHEDULE_LIMITS } from './schedule.js';
import { buildBudgetWidget, BUDGET_LIMITS, parseAmount } from './budget.js';
import { buildDailyBriefWidget, DAILY_BRIEF_LIMITS, BRIEF_CATEGORIES, validBriefSourceUrl } from './dailyBrief.js';
import { runQuickCompute, COMPUTATION_LIMITS } from './computation.js';

const text = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const list = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const amount = { type: 'number', minimum: 0, maximum: BUDGET_LIMITS.maxAmount };
const date = { ...text(10), pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const time = { ...text(SCHEDULE_LIMITS.maxTimeChars), description: 'A 24-hour HH:mm time or a clock time with AM/PM, e.g. 09:00 or 2:30 PM.' };

function checkDate(value, path) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (value.startsWith('0000') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${path} must be a valid calendar date`);
}

function checkZone(value, path) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); }
  catch { throw new Error(`${path} must be a valid IANA time zone`); }
}

function checkClock(value, path) {
  if (!/^(?:(?:[01]?\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s*[AP]M)$/i.test(value.trim())) {
    throw new Error(`${path} must be a valid clock time such as 09:00 or 2:30 PM`);
  }
}

function checkTimestamp(value, path) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${path} must be a valid ISO timestamp with an explicit offset or Z`);
  }
  checkDate(value.slice(0, 10), path);
}

// Apply the same advertised schema at execution time. Bedrock's tool schemas are
// guidance for the model; malformed calls must not silently create sample data.
export function validateArtifactInput(schema, value, path = 'input') {
  if (schema.anyOf) {
    const errors = [];
    for (const option of schema.anyOf) {
      try { validateArtifactInput(option, value, path); return; } catch (error) { errors.push(error.message); }
    }
    throw new Error(`${path} does not match an allowed shape: ${errors.join('; ')}`);
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const matches = types.some((type) => type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
      : type === 'integer' ? Number.isInteger(value)
        : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
          : typeof value === type);
  if (!matches) throw new Error(`${path} must be ${types.join(' or ')}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && !value.replace(/[\u0000-\u001f\u007f]/g, '').trim()) throw new Error(`${path} must not be empty`);
    if (value.length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity)) throw new Error(`${path} has an unsupported length`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(`${path} has an invalid format`);
  }
  if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw new Error(`${path} is outside the supported numeric range`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) throw new Error(`${path} must contain ${schema.minItems || 0} to ${schema.maxItems ?? 'unlimited'} items`);
    value.forEach((item, index) => validateArtifactInput(schema.items, item, `${path}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(value)) {
      const property = Object.hasOwn(schema.properties || {}, key) ? schema.properties[key] : null;
      if (property) validateArtifactInput(property, child, `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`${path}.${key} is not supported`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateArtifactInput(schema.additionalProperties, child, `${path}.${key}`);
    }
  }
}

function tool(name, description, inputSchema, build, check) {
  return {
    name, description, inputSchema, effect: 'local', web: false,
    execute(input) {
      validateArtifactInput(inputSchema, input);
      check?.(input);
      return build(input);
    }
  };
}

const checklistItem = object({
  text: text(CHECKLIST_LIMITS.maxItemTextChars), category: text(CHECKLIST_LIMITS.maxCategoryChars),
  priority: { type: 'string', enum: ['low', 'medium', 'high'] }, estimate: text(40), completed: { type: 'boolean' }
}, ['text']);

const comparisonOption = object({
  name: text(COMPARISON_LIMITS.maxOptionNameChars), highlight: text(COMPARISON_LIMITS.maxHighlightChars), rating: text(20),
  values: { type: 'object', additionalProperties: { anyOf: [text(150), { type: 'number' }] } },
  pros: list(text(COMPARISON_LIMITS.maxProConChars), COMPARISON_LIMITS.maxProsCons),
  cons: list(text(COMPARISON_LIMITS.maxProConChars), COMPARISON_LIMITS.maxProsCons)
}, ['name', 'values']);

const scheduleEvent = object({
  title: text(SCHEDULE_LIMITS.maxEventTitleChars), time, endTime: time, date, endDate: date,
  start: text(SCHEDULE_LIMITS.maxTimestampChars), end: text(SCHEDULE_LIMITS.maxTimestampChars), timeZone: text(SCHEDULE_LIMITS.maxTimeZoneChars),
  description: text(SCHEDULE_LIMITS.maxEventDescChars), location: text(SCHEDULE_LIMITS.maxLocationChars),
  duration: text(SCHEDULE_LIMITS.maxDurationChars), tag: text(SCHEDULE_LIMITS.maxTagChars),
  period: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'night'] }, completed: { type: 'boolean' }
}, ['title']);

const budgetCategory = object({
  name: text(BUDGET_LIMITS.maxCategoryNameChars), allocated: amount,
  items: list(text(100), BUDGET_LIMITS.maxSubItems), tip: text(BUDGET_LIMITS.maxTipChars)
}, ['name', 'allocated']);

const briefStory = object({
  headline: text(DAILY_BRIEF_LIMITS.maxHeadlineChars), summary: text(DAILY_BRIEF_LIMITS.maxSummaryChars),
  url: { ...text(2048), description: 'The real HTTP(S) source article URL obtained during research. A supplied URL is not proof of verification.' },
  publisher: text(DAILY_BRIEF_LIMITS.maxPublisherChars), publishedAt: text(DAILY_BRIEF_LIMITS.maxPublishedAtChars),
  category: { type: 'string', enum: Object.keys(BRIEF_CATEGORIES) }, whyItMatters: text(DAILY_BRIEF_LIMITS.maxWhyItMattersChars)
}, ['headline', 'summary', 'url']);

const computeSchema = object({
  operation: { type: 'string', enum: ['evaluate', 'stats', 'loan', 'compound'] },
  expression: text(COMPUTATION_LIMITS.maxExpressionChars),
  numbers: list({ type: 'number' }, COMPUTATION_LIMITS.maxNumbers, 1),
  loan: object({ principal: { type: 'number', minimum: 0 }, annualRatePercent: { type: 'number', minimum: 0 }, termYears: { type: 'number', minimum: 0 } }, ['principal', 'annualRatePercent', 'termYears']),
  compound: object({ principal: { type: 'number', minimum: 0 }, annualRatePercent: { type: 'number', minimum: 0 }, years: { type: 'number', minimum: 0 }, compoundTimesPerYear: { type: 'integer', minimum: 1 } }, ['principal', 'annualRatePercent', 'years'])
});

export const ARTIFACT_TOOL_REGISTRY = [
  tool('create_checklist',
    'Create an interactive checklist card for user planning requests, action plans, preparations, and tasks. Supply concrete items; do not invent completed work. Prefer this card to a prose checklist.',
    object({ title: text(CHECKLIST_LIMITS.maxTitleChars), category: text(CHECKLIST_LIMITS.maxCategoryChars), description: text(CHECKLIST_LIMITS.maxDescriptionChars), items: list({ anyOf: [text(CHECKLIST_LIMITS.maxItemTextChars), checklistItem] }, CHECKLIST_LIMITS.maxItems, 1) }, ['title', 'items']),
    buildChecklistWidget),
  tool('create_comparison',
    'Create an interactive comparison card when the user asks to compare options or make a planning decision. Supply at least two real named options and explicit criteria. Use research tools first for current facts; mark unknown values as Unknown.',
    object({ title: text(COMPARISON_LIMITS.maxTitleChars), category: text(COMPARISON_LIMITS.maxCategoryChars), summary: text(COMPARISON_LIMITS.maxSummaryChars), criteria: list(text(COMPARISON_LIMITS.maxCriteriaChars), COMPARISON_LIMITS.maxCriteriaCount, 1), options: list(comparisonOption, COMPARISON_LIMITS.maxOptions, 2), recommendation: text(COMPARISON_LIMITS.maxRecommendationChars) }, ['title', 'criteria', 'options']),
    buildComparisonWidget, (input) => {
      const criteria = input.criteria.map((criterion) => criterion.trim().toLowerCase());
      if (new Set(criteria).size !== criteria.length) throw new Error('input.criteria must be unique');
      const namedCriteria = input.criteria.map((criterion) => criterion.trim());
      for (const [index, option] of input.options.entries()) {
        const valueKeys = Object.keys(option.values).map((criterion) => criterion.trim());
        if (!valueKeys.some((criterion) => namedCriteria.includes(criterion))) throw new Error(`input.options[${index}].values must include at least one named criterion`);
        if (valueKeys.some((criterion) => !namedCriteria.includes(criterion))) throw new Error(`input.options[${index}].values contains an unknown criterion`);
      }
    }),
  tool('create_schedule',
    'Create an interactive schedule card for user planning requests, itineraries, agendas, and routines. Supply actual event times. For calendar export, include explicit dates, an IANA timeZone, and end times (or start/end ISO timestamps with offsets). Ask for missing dates when needed; never invent them.',
    object({ title: text(SCHEDULE_LIMITS.maxTitleChars), date, timeZone: text(SCHEDULE_LIMITS.maxTimeZoneChars), summary: text(SCHEDULE_LIMITS.maxSummaryChars), events: list(scheduleEvent, SCHEDULE_LIMITS.maxEvents, 1) }, ['title', 'events']),
    buildScheduleWidget, (input) => {
      if (input.date) checkDate(input.date, 'input.date');
      if (input.timeZone) checkZone(input.timeZone, 'input.timeZone');
      input.events.forEach((event, index) => {
        const path = `input.events[${index}]`;
        if (!event.time && !event.start) throw new Error(`${path} requires time or start`);
        for (const key of ['date', 'endDate']) if (event[key]) checkDate(event[key], `${path}.${key}`);
        for (const key of ['time', 'endTime']) if (event[key]) checkClock(event[key], `${path}.${key}`);
        for (const key of ['start', 'end']) if (event[key]) checkTimestamp(event[key], `${path}.${key}`);
        if (event.timeZone) checkZone(event.timeZone, `${path}.timeZone`);
        if (event.start && event.end && Date.parse(event.end) <= Date.parse(event.start)) throw new Error(`${path}.end must be after start`);
      });
    }),
  tool('create_budget',
    'Create an interactive budget card for user planning requests, spending allocations, and cost breakdowns. Set totalBudget to the exact user-specified total/cap; never substitute the sum of allocations or change the cap to fit costs. Ask for the cap if missing. Supply explicit currency and finite numeric allocations whose sum fits within that cap. Label estimates in the summary and use compute for math.',
    object({ title: text(BUDGET_LIMITS.maxTitleChars), category: text(50), summary: text(BUDGET_LIMITS.maxSummaryChars), currency: text(5), totalBudget: { ...amount, description: 'The exact user-specified total/cap. Do not substitute the sum of category allocations. Preserve this amount when correcting an over-budget plan; ask the user for a cap if none was supplied.' }, categories: list(budgetCategory, BUDGET_LIMITS.maxCategories, 1), savingsTips: list(text(BUDGET_LIMITS.maxTipChars), BUDGET_LIMITS.maxTips) }, ['title', 'currency', 'totalBudget', 'categories']),
    buildBudgetWidget, (input) => {
      const capCents = Math.round(parseAmount(input.totalBudget) * 100);
      const allocatedCents = input.categories.reduce((total, category) => total + Math.round(parseAmount(category.allocated) * 100), 0);
      if (allocatedCents > capCents) {
        const overage = ((allocatedCents - capCents) / 100).toFixed(2);
        throw new Error(`Category allocations exceed the exact totalBudget of ${input.currency}${(capCents / 100).toFixed(2)} by ${input.currency}${overage}. Reduce allocations to fit the user's cap; keep totalBudget unchanged.`);
      }
    }),
  tool('create_daily_brief',
    'Create a daily briefing card from researched stories with real source article URLs. Use search/read tools first for current news. Supply headline, factual summary, and HTTP(S) source link for every story; never fabricate news, publishers, dates, or verification claims.',
    object({ title: text(DAILY_BRIEF_LIMITS.maxTitleChars), date: text(50), scope: text(50), summary: text(DAILY_BRIEF_LIMITS.maxSummaryChars), stories: list(briefStory, DAILY_BRIEF_LIMITS.maxStories, 1), weather: object({ city: text(50), condition: text(40), temp: text(20) }, ['city', 'condition', 'temp']) }, ['title', 'stories']),
    buildDailyBriefWidget, (input) => {
      input.stories.forEach((story, index) => {
        if (!validBriefSourceUrl(story.url)) throw new Error(`input.stories[${index}].url must be a valid HTTP(S) source link without credentials`);
      });
    }),
  tool('compute',
    'Calculate math with the safe computation engine instead of guessing arithmetic. Supports evaluate (expression, + - * / % ^ and math functions), stats (numbers), loan (principal, annualRatePercent, termYears), and compound (principal, annualRatePercent, years, optional compoundTimesPerYear). Numeric fields must be finite numbers; rates are percentages.',
    computeSchema, (input) => {
      const result = runQuickCompute(input);
      if (result.error) throw new Error(result.error);
      return result;
    })
];

export function executeArtifactTool(name, input) {
  const entry = ARTIFACT_TOOL_REGISTRY.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`Unknown artifact tool: ${name}`);
  return entry.execute(input);
}
