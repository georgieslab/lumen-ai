import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferCategory,
  sanitizeBriefStory,
  buildDailyBriefWidget,
  extractDailyBriefFromMarkdown
} from '../services/dailyBrief.js';

test('inferCategory detects categories from AI text correctly', () => {
  assert.equal(inferCategory('Anthropic releases Claude 3.7 reasoning model'), 'frontier-ai');
  assert.equal(inferCategory('Hugging Face announces new open weights model checkpoint'), 'open-source');
  assert.equal(inferCategory('Nvidia expands next-gen Blackwell GPU clusters and TSMC packaging'), 'chips');
  assert.equal(inferCategory('Figure AI demonstrates new humanoid robot working in logistics'), 'robotics');
  assert.equal(inferCategory('EU AI Act compliance enforcement timeline announced'), 'policy');
  assert.equal(inferCategory('AI startup raises $500M Series B at $4B valuation on Nasdaq'), 'markets');
});

test('sanitizeBriefStory clips long text, extracts categories and sanitizes URLs', () => {
  const story = sanitizeBriefStory({
    headline: 'OpenAI Introduces Deep Research Capability for Autonomous Reasoning',
    publisher: 'TechCrunch',
    publishedAt: '2 hours ago',
    category: 'frontier-ai',
    summary: 'A multi-step autonomous browsing and reasoning agent designed to synthesize deep research reports.',
    whyItMatters: 'Demonstrates real-world utility for long-horizon agent workflows.',
    url: 'https://techcrunch.com/2026/openai-deep-research'
  }, 0);

  assert.equal(story.id, 'story-1');
  assert.equal(story.headline, 'OpenAI Introduces Deep Research Capability for Autonomous Reasoning');
  assert.equal(story.publisher, 'TechCrunch');
  assert.equal(story.publishedAt, '2 hours ago');
  assert.equal(story.category, 'frontier-ai');
  assert.equal(story.categoryIcon, '🤖');
  assert.equal(story.url, 'https://techcrunch.com/2026/openai-deep-research');
  assert.ok(story.whyItMatters.includes('Demonstrates real-world utility'));
});

test('buildDailyBriefWidget supplies fallback stories when empty', () => {
  const widget = buildDailyBriefWidget();

  assert.equal(widget.widgetType, 'daily_brief');
  assert.ok(widget.title.includes('Worldwide'));
  assert.equal(widget.scope, 'Worldwide');
  assert.equal(widget.stories.length, 3);
  assert.ok(widget.briefId.startsWith('brief-'));
});

test('buildDailyBriefWidget respects custom title, scope, and weather snapshot', () => {
  const widget = buildDailyBriefWidget({
    title: 'Global AI & Innovation Brief',
    scope: 'Worldwide',
    weather: { city: 'Tokyo', condition: 'Sunny', temp: '22°C' },
    stories: [
      {
        headline: 'Breakthrough in Quantum Error Correction',
        publisher: 'Nature',
        summary: 'Researchers demonstrate fault-tolerant logical qubits.',
        url: 'https://nature.com'
      },
      {
        headline: 'Open-Weights Model Matches Closed Frontier Benchmarks',
        publisher: 'ArXiv',
        summary: 'New dense transformer architecture achieves state-of-the-art reasoning.',
        url: 'https://arxiv.org'
      }
    ]
  });

  assert.equal(widget.title, 'Global AI & Innovation Brief');
  assert.equal(widget.scope, 'Worldwide');
  assert.equal(widget.stories.length, 2);
  assert.equal(widget.weather.city, 'Tokyo');
  assert.equal(widget.weather.temp, '22°C');
});

test('extractDailyBriefFromMarkdown extracts structured news items from markdown', () => {
  const markdown = `
Here is your daily brief for today:

### 1. OpenAI Unveils Next-Gen Reasoning Model Architecture
- **Publisher**: TechCrunch
- **Summary**: Researchers demonstrated breakthrough performance in multi-step theorem proving and competitive programming.
- **Why It Matters**: Signals a leap toward automated scientific discovery and enterprise reliability.
- **Source**: [TechCrunch Article](https://techcrunch.com/article-1)

### 2. Nvidia Scales High-Bandwidth Accelerator Clusters Worldwide
- **Publisher**: Reuters
- **Summary**: Modern hyperscalers are deploying liquid-cooled rack architectures to satisfy global AI demand.
- **Why It Matters**: Essential infrastructure enabling million-token context windows and agent swarms.
- **Source**: [Reuters Story](https://reuters.com/nvidia-accelerator)

I hope this helps you stay informed today!
`;

  const { cleanText, briefWidget } = extractDailyBriefFromMarkdown(markdown);

  assert.ok(briefWidget);
  assert.equal(briefWidget.widgetType, 'daily_brief');
  assert.equal(briefWidget.stories.length, 2);
  assert.equal(briefWidget.stories[0].headline, 'OpenAI Unveils Next-Gen Reasoning Model Architecture');
  assert.equal(briefWidget.stories[0].publisher, 'TechCrunch');
  assert.equal(briefWidget.stories[0].url, 'https://techcrunch.com/article-1');
  assert.equal(briefWidget.stories[1].publisher, 'Reuters');
  assert.ok(cleanText.includes('Here is your daily brief'));
});

