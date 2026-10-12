// Checklist and Action Plan generation service for Lumen AI Agent
// Creates structured, interactive checklist widgets that users can toggle and track.

const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const CHECKLIST_LIMITS = {
  maxTitleChars: 120,
  maxCategoryChars: 50,
  maxDescriptionChars: 300,
  maxItemTextChars: 200,
  maxItems: 30
};

export function sanitizeChecklistItem(rawItem, index = 0) {
  if (typeof rawItem === 'string') {
    const text = clip(rawItem, CHECKLIST_LIMITS.maxItemTextChars);
    if (!text) return null;
    return {
      id: `item-${index + 1}`,
      text,
      category: 'General',
      priority: 'medium',
      completed: false
    };
  }

  if (!rawItem || typeof rawItem !== 'object') return null;
  const text = clip(rawItem.text || rawItem.title || rawItem.name, CHECKLIST_LIMITS.maxItemTextChars);
  if (!text) return null;

  const validPriorities = ['low', 'medium', 'high'];
  const priority = validPriorities.includes(String(rawItem.priority).toLowerCase())
    ? String(rawItem.priority).toLowerCase()
    : 'medium';

  return {
    id: clip(rawItem.id, 40) || `item-${index + 1}`,
    text,
    category: clip(rawItem.category, CHECKLIST_LIMITS.maxCategoryChars) || 'General',
    priority,
    estimate: clip(rawItem.estimate || rawItem.time, 40) || undefined,
    completed: Boolean(rawItem.completed)
  };
}

export function buildChecklistWidget(input = {}) {
  const title = clip(input.title, CHECKLIST_LIMITS.maxTitleChars) || 'Action Plan & Checklist';
  const category = clip(input.category, CHECKLIST_LIMITS.maxCategoryChars) || 'Tasks';
  const description = clip(input.description, CHECKLIST_LIMITS.maxDescriptionChars);

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = [];
  for (let i = 0; i < rawItems.length; i++) {
    const cleaned = sanitizeChecklistItem(rawItems[i], i);
    if (cleaned) items.push(cleaned);
    if (items.length >= CHECKLIST_LIMITS.maxItems) break;
  }

  if (items.length === 0) {
    items.push({
      id: 'item-1',
      text: 'Review goals and next steps',
      category: 'General',
      priority: 'medium',
      completed: false
    });
  }

  return {
    widgetType: 'checklist',
    checklistId: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category,
    description: description || undefined,
    items,
    createdAt: Date.now()
  };
}

