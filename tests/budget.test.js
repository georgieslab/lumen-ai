import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  sanitizeBudgetCategory,
  buildBudgetWidget,
  extractBudgetFromMarkdown
} from '../services/budget.js';

test('parseAmount parses different numeric strings and currencies', () => {
  assert.equal(parseAmount(500), 500);
  assert.equal(parseAmount('$1,250.50'), 1250.50);
  assert.equal(parseAmount('€850'), 850);
  assert.equal(parseAmount('¥100000'), 100000);
  assert.equal(parseAmount('invalid'), 0);
  assert.equal(parseAmount(null), 0);
});

test('sanitizeBudgetCategory handles raw categories and items', () => {
  const cat = sanitizeBudgetCategory({
    name: 'Flights & Transit',
    allocated: '$650',
    items: ['Return flight Vienna-Tokyo', 'JR Pass 7-Day'],
    tip: 'Book 6 weeks ahead for best rate'
  }, 0);

  assert.equal(cat.id, 'cat-1');
  assert.equal(cat.name, 'Flights & Transit');
  assert.equal(cat.allocated, 650);
  assert.equal(cat.items.length, 2);
  assert.equal(cat.tip, 'Book 6 weeks ahead for best rate');
  assert.ok(cat.color);
});

test('buildBudgetWidget computes totals and category percentages correctly', () => {
  const widget = buildBudgetWidget({
    title: 'Tokyo 7-Day Travel Budget',
    totalBudget: 2000,
    currency: '$',
    category: 'Travel',
    categories: [
      { name: 'Lodging', allocated: 800 },
      { name: 'Dining', allocated: 600 },
      { name: 'Activities', allocated: 400 },
      { name: 'Buffer', allocated: 200 }
    ],
    savingsTips: ['Eat at local izakayas and ramen stalls', 'Buy subway 72h passes']
  });

  assert.equal(widget.widgetType, 'budget');
  assert.equal(widget.title, 'Tokyo 7-Day Travel Budget');
  assert.equal(widget.totalBudget, 2000);
  assert.equal(widget.allocatedTotal, 2000);
  assert.equal(widget.currency, '$');
  assert.equal(widget.categories.length, 4);
  assert.equal(widget.categories[0].percentage, 40); // 800 / 2000 = 40%
  assert.equal(widget.categories[1].percentage, 30); // 600 / 2000 = 30%
  assert.equal(widget.savingsTips.length, 2);
  assert.ok(widget.budgetId.startsWith('bdg-'));
});

test('buildBudgetWidget supplies fallback categories when empty', () => {
  const fallback = buildBudgetWidget({});
  assert.equal(fallback.widgetType, 'budget');
  assert.ok(fallback.categories.length >= 3);
  assert.ok(fallback.totalBudget > 0);
});

test('extractBudgetFromMarkdown parses bullet lists with amounts into budget widget', () => {
  const text = `### Travel Cost Breakdown: Rome Vacation
Here is the recommended budget:

- Flights & Train: $450
- Accommodation: $700
- Food & Gelato: $350
- Museum Tickets: $150
- Contingency Fund: $100

Enjoy your trip to Rome!`;

  const { cleanText, budgetWidget } = extractBudgetFromMarkdown(text);
  assert.ok(budgetWidget !== null);
  assert.equal(budgetWidget.categories.length, 5);
  assert.equal(budgetWidget.categories[0].name, 'Flights & Train');
  assert.equal(budgetWidget.categories[0].allocated, 450);
  assert.equal(budgetWidget.categories[1].name, 'Accommodation');
  assert.equal(budgetWidget.categories[1].allocated, 700);
  assert.equal(cleanText.includes('- Flights & Train:'), false);
  assert.ok(cleanText.includes('Rome'));
});

