import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferPeriodFromTime,
  sanitizeScheduleEvent,
  buildScheduleWidget,
  generateIcsCalendar,
  extractScheduleFromMarkdown
} from '../services/schedule.js';

test('inferPeriodFromTime accurately assigns periods', () => {
  assert.equal(inferPeriodFromTime('08:30 AM'), 'morning');
  assert.equal(inferPeriodFromTime('12:30 PM'), 'afternoon');
  assert.equal(inferPeriodFromTime('15:00'), 'afternoon');
  assert.equal(inferPeriodFromTime('06:00 PM'), 'evening');
  assert.equal(inferPeriodFromTime('19:30'), 'evening');
  assert.equal(inferPeriodFromTime('10:00 PM'), 'night');
  assert.equal(inferPeriodFromTime('22:15'), 'night');
});

test('sanitizeScheduleEvent processes raw event objects and strings', () => {
  const ev1 = sanitizeScheduleEvent('Morning run in Central Park', 0);
  assert.equal(ev1.id, 'ev-1');
  assert.equal(ev1.title, 'Morning run in Central Park');
  assert.ok(ev1.time);
  assert.equal(ev1.period, 'morning');

  const ev2 = sanitizeScheduleEvent({
    time: '02:00 PM',
    title: 'Client Strategy Presentation',
    location: 'Meeting Room 4B',
    duration: '45 mins',
    tag: 'Work'
  }, 1);

  assert.equal(ev2.id, 'ev-2');
  assert.equal(ev2.time, '02:00 PM');
  assert.equal(ev2.title, 'Client Strategy Presentation');
  assert.equal(ev2.location, 'Meeting Room 4B');
  assert.equal(ev2.duration, '45 mins');
  assert.equal(ev2.tag, 'Work');
  assert.equal(ev2.period, 'afternoon');
});

test('buildScheduleWidget creates structured widget with defaults and fallback items', () => {
  const widget = buildScheduleWidget({
    title: 'Tokyo Day 1 Itinerary',
    date: 'Day 1',
    summary: 'Explore Asakusa and Shibuya',
    events: [
      { time: '09:00 AM', title: 'Senso-ji Temple Visit', location: 'Asakusa' },
      { time: '01:00 PM', title: 'Ramen Lunch at Afuri', location: 'Harajuku' }
    ]
  });

  assert.equal(widget.widgetType, 'schedule');
  assert.equal(widget.title, 'Tokyo Day 1 Itinerary');
  assert.equal(widget.date, 'Day 1');
  assert.equal(widget.events.length, 2);
  assert.ok(widget.scheduleId.startsWith('sch-'));
});

test('buildScheduleWidget provides fallback events when list is empty', () => {
  const emptyWidget = buildScheduleWidget({});
  assert.equal(emptyWidget.widgetType, 'schedule');
  assert.ok(emptyWidget.events.length >= 3);
});

test('generateIcsCalendar outputs valid iCalendar format', () => {
  const widget = buildScheduleWidget({
    title: 'Conference Day Plan',
    events: [
      { time: '10:00 AM', title: 'Keynote Speech', location: 'Main Hall' }
    ]
  });

  const ics = generateIcsCalendar(widget);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Keynote Speech'));
  assert.ok(ics.includes('LOCATION:Main Hall'));
});

test('extractScheduleFromMarkdown catches text schedules and converts to widget', () => {
  const md = `### Daily Schedule: Productive Remote Work Day
Here is your recommended daily schedule:

- 08:30 AM: Morning Planning & High Priority Inbox
- 09:30 AM: Deep Work Block 1 (No Meetings)
- 12:30 PM: Healthy Lunch & 20min Walk (at Park)
- 02:00 PM: Team Sync & Standup
- 05:30 PM: Wrap-up & Tomorrow Prep

Let me know if you would like adjustments!`;

  const { cleanText, scheduleWidget } = extractScheduleFromMarkdown(md);
  assert.ok(scheduleWidget !== null);
  assert.equal(scheduleWidget.events.length, 5);
  assert.equal(scheduleWidget.events[0].time, '08:30 AM');
  assert.equal(scheduleWidget.events[0].title, 'Morning Planning & High Priority Inbox');
  assert.equal(scheduleWidget.events[2].location, 'Park');
  assert.equal(cleanText.includes('- 08:30 AM:'), false);
  assert.ok(cleanText.includes('adjustments'));
});

