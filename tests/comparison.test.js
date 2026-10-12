import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOption, buildComparisonWidget, extractComparisonFromMarkdown } from '../services/comparison.js';

test('sanitizeOption creates structured option with criteria values and pros/cons', () => {
  const criteria = ['Price', 'Battery'];
  const opt = sanitizeOption({
    name: 'Model X',
    highlight: 'Best Value',
    rating: '4.8/5',
    values: { Price: '$299', Battery: '24 hours' },
    pros: ['Long battery', 'Great screen'],
    cons: ['Heavy']
  }, 0, criteria);

  assert.equal(opt.id, 'opt-1');
  assert.equal(opt.name, 'Model X');
  assert.equal(opt.highlight, 'Best Value');
  assert.equal(opt.values.Price, '$299');
  assert.equal(opt.values.Battery, '24 hours');
  assert.equal(opt.pros.length, 2);
  assert.equal(opt.cons.length, 1);
});

test('buildComparisonWidget creates multi-option decision matrix with fallback handling', () => {
  const widget = buildComparisonWidget({
    title: 'Camera Comparison',
    category: 'Photography',
    criteria: ['Sensor', 'Price', 'Weight'],
    options: [
      { name: 'Sony A6400', highlight: 'Best Autofocus', values: { Sensor: 'APS-C', Price: '$850' } },
      { name: 'Fujifilm X-T30 II', highlight: 'Best Colors', values: { Sensor: 'APS-C', Price: '$900' } }
    ],
    recommendation: 'Choose Sony for fast action video, Fujifilm for film simulation photos.'
  });

  assert.equal(widget.widgetType, 'comparison');
  assert.equal(widget.title, 'Camera Comparison');
  assert.equal(widget.criteria.length, 3);
  assert.equal(widget.options.length, 2);
  assert.ok(widget.comparisonId.startsWith('cmp-'));
  assert.equal(widget.recommendation.includes('Choose Sony'), true);
});

test('buildComparisonWidget guarantees at least 2 options and fallback criteria', () => {
  const widget = buildComparisonWidget({});
  assert.equal(widget.widgetType, 'comparison');
  assert.ok(widget.options.length >= 2);
  assert.ok(widget.criteria.length >= 3);
});

test('extractComparisonFromMarkdown parses markdown decision table into widget', () => {
  const md = `### Decision Matrix: iPad Air M2 vs iPad Pro M4 vs Galaxy Tab S9

| Feature | iPad Air M2 | iPad Pro M4 | Galaxy Tab S9 |
|---|---|---|---|
| Price | $599 | $949 | $799 |
| Screen Quality | Liquid Retina | XDR OLED | AMOLED 2X |
| Battery Life | 18 hours | 20 hours | 16 hours |

### Top Pick
**Galaxy Tab S9**
- Reasoning: Best value for stylus and drawing.`;

  const { cleanText, comparisonWidget } = extractComparisonFromMarkdown(md);
  assert.ok(comparisonWidget !== null);
  assert.equal(comparisonWidget.title, 'Decision Matrix: iPad Air M2 vs iPad Pro M4 vs Galaxy Tab S9');
  assert.equal(comparisonWidget.options.length, 3);
  assert.equal(comparisonWidget.options[0].name, 'iPad Air M2');
  assert.equal(comparisonWidget.options[2].name, 'Galaxy Tab S9');
  assert.equal(comparisonWidget.options[2].highlight, 'Top Pick');
  assert.equal(comparisonWidget.criteria.includes('Price'), true);
  assert.equal(cleanText.includes('| Feature |'), false);
});

