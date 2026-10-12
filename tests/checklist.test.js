import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeChecklistItem, buildChecklistWidget } from '../services/checklist.js';

test('sanitizeChecklistItem handles string and object inputs', () => {
  const fromStr = sanitizeChecklistItem('Book flight tickets', 0);
  assert.equal(fromStr.text, 'Book flight tickets');
  assert.equal(fromStr.completed, false);
  assert.equal(fromStr.priority, 'medium');

  const fromObj = sanitizeChecklistItem({ text: 'Reserve hotel', priority: 'high', category: 'Lodging' }, 1);
  assert.equal(fromObj.text, 'Reserve hotel');
  assert.equal(fromObj.priority, 'high');
  assert.equal(fromObj.category, 'Lodging');

  assert.equal(sanitizeChecklistItem(null), null);
  assert.equal(sanitizeChecklistItem({ text: '' }), null);
});

test('buildChecklistWidget creates structured widget with defaults and caps', () => {
  const widget = buildChecklistWidget({
    title: 'Trip Checklist',
    category: 'Travel',
    description: 'Preparations before departure',
    items: ['Passport check', 'Pack luggage']
  });

  assert.equal(widget.widgetType, 'checklist');
  assert.equal(widget.title, 'Trip Checklist');
  assert.equal(widget.category, 'Travel');
  assert.equal(widget.items.length, 2);
  assert.equal(widget.items[0].text, 'Passport check');
  assert.ok(widget.checklistId.startsWith('chk-'));
});

test('buildChecklistWidget supplies fallback item when items array is empty', () => {
  const widget = buildChecklistWidget({});
  assert.equal(widget.widgetType, 'checklist');
  assert.equal(widget.items.length, 1);
  assert.equal(widget.title, 'Action Plan & Checklist');
});

