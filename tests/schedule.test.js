import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferPeriodFromTime,
  sanitizeScheduleEvent,
  buildScheduleWidget,
  getScheduleExportStatus,
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
  assert.equal(ev1.time, undefined, 'unspecified times must not be fabricated');
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

test('buildScheduleWidget creates a structured widget and preserves supplied completion and calendar fields', () => {
  const widget = buildScheduleWidget({
    title: 'Tokyo Day 1 Itinerary',
    date: 'Day 1',
    timeZone: 'Asia/Tokyo',
    summary: 'Explore Asakusa and Shibuya',
    events: [
      { id: 'temple', date: '2026-10-18', time: '09:00 AM', endTime: '11:00', title: 'Senso-ji Temple Visit', location: 'Asakusa', completed: true },
      { time: '01:00 PM', title: 'Ramen Lunch at Afuri', location: 'Harajuku' }
    ]
  });

  assert.equal(widget.widgetType, 'schedule');
  assert.equal(widget.title, 'Tokyo Day 1 Itinerary');
  assert.equal(widget.date, 'Day 1');
  assert.equal(widget.events.length, 2);
  assert.equal(widget.timeZone, 'Asia/Tokyo');
  assert.equal(widget.events[0].id, 'temple');
  assert.equal(widget.events[0].completed, true);
  assert.equal(widget.events[0].date, '2026-10-18');
  assert.equal(widget.events[0].endTime, '11:00');
  assert.ok(widget.scheduleId.startsWith('sch-'));
});

test('buildScheduleWidget leaves an empty schedule empty rather than inventing activities', () => {
  const emptyWidget = buildScheduleWidget({});
  assert.equal(emptyWidget.widgetType, 'schedule');
  assert.equal(emptyWidget.events.length, 0);
  assert.equal(generateIcsCalendar(emptyWidget), '');
});

test('generateIcsCalendar exports real DTSTART and DTEND in UTC for an explicitly zoned schedule', () => {
  const widget = buildScheduleWidget({
    title: 'Conference Day Plan',
    date: '2026-10-17',
    timeZone: 'Europe/Vienna',
    events: [
      { time: '10:00 AM', endTime: '11:30', title: 'Keynote Speech', location: 'Main Hall' }
    ]
  });

  const ics = generateIcsCalendar(widget);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Keynote Speech'));
  assert.ok(ics.includes('LOCATION:Main Hall'));
  assert.ok(ics.includes('DTSTART:20261017T080000Z\r\n'));
  assert.ok(ics.includes('DTEND:20261017T093000Z\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.deepEqual(getScheduleExportStatus(widget), { canExport: true, reason: '' });
});

test('calendar conversion respects seasonal offsets and event dates across midnight', () => {
  const ics = generateIcsCalendar({
    timeZone: 'Europe/Vienna',
    events: [
      { date: '2026-01-17', time: '10:00', endTime: '11:00', title: 'Winter' },
      { date: '2026-07-17', time: '23:30', endDate: '2026-07-18', endTime: '01:00', title: 'Summer overnight' }
    ]
  });
  assert.ok(ics.includes('DTSTART:20260117T090000Z'));
  assert.ok(ics.includes('DTEND:20260117T100000Z'));
  assert.ok(ics.includes('DTSTART:20260717T213000Z'));
  assert.ok(ics.includes('DTEND:20260717T230000Z'));
});

test('ISO timestamps with explicit offsets work without a schedule date or time zone', () => {
  const widget = buildScheduleWidget({ events: [{
    title: 'Flight', start: '2026-10-17T23:30:00+02:00', end: '2026-10-18T01:00:00+01:00'
  }] });
  const ics = generateIcsCalendar(widget);
  assert.equal(widget.events[0].start, '2026-10-17T23:30:00+02:00');
  assert.equal(widget.events[0].time, '23:30');
  assert.equal(widget.events[0].endTime, '01:00');
  assert.ok(ics.includes('DTSTART:20261017T213000Z'));
  assert.ok(ics.includes('DTEND:20261018T000000Z'));
  assert.ok(generateIcsCalendar({ events: [{ start: '2026-10-17T09:00Z', end: '2026-10-17T10:00Z' }] }).includes('DTSTART:20261017T090000Z'));
});

test('event-specific zones and offsetless ISO timestamps resolve with the supplied zone', () => {
  const ics = generateIcsCalendar({ timeZone: 'Europe/Vienna', events: [{
    title: 'New York call', timeZone: 'America/New_York',
    start: '2026-10-17T09:00:00', end: '2026-10-17T10:00:00'
  }] });
  assert.ok(ics.includes('DTSTART:20261017T130000Z'));
  assert.ok(ics.includes('DTEND:20261017T140000Z'));
});

test('calendar export never invents missing dates, end times, or time zones', () => {
  const incomplete = [
    { events: [{ title: 'Routine', time: '09:00', endTime: '10:00' }] },
    { date: 'Tomorrow', timeZone: 'Europe/Vienna', events: [{ time: '09:00', endTime: '10:00' }] },
    { date: '2026-10-17', timeZone: 'Europe/Vienna', events: [{ time: '09:00', duration: '1 hour' }] },
    { date: '2026-10-17', events: [{ time: '09:00', endTime: '10:00' }] },
    { events: [{ start: '2026-10-17T09:00', end: '2026-10-17T10:00' }] }
  ];
  for (const schedule of incomplete) {
    const status = getScheduleExportStatus(schedule);
    assert.equal(status.canExport, false);
    assert.ok(status.reason.length > 0);
    assert.equal(generateIcsCalendar(schedule), '');
  }
});

test('calendar export rejects impossible dates, times, UTC offsets, and reversed intervals', () => {
  const invalid = [
    { date: '2026-02-29', timeZone: 'UTC', events: [{ time: '09:00', endTime: '10:00' }] },
    { date: '2026-04-31', timeZone: 'UTC', events: [{ time: '09:00', endTime: '10:00' }] },
    { date: '2026-10-17', timeZone: 'UTC', events: [{ time: '24:00', endTime: '25:00' }] },
    { date: '2026-10-17', timeZone: 'Mars/Olympus', events: [{ time: '09:00', endTime: '10:00' }] },
    { date: '2026-10-17', timeZone: 'UTC', events: [{ time: '23:00', endTime: '01:00' }] },
    { events: [{ start: '2026-02-30T09:00:00Z', end: '2026-03-01T10:00:00Z' }] },
    { events: [{ start: '2026-10-17T09:00:00+25:00', end: '2026-10-17T10:00:00Z' }] },
    { events: [{ start: '2026-10-17T09:00:00Z', end: '2026-10-17T09:00:00Z' }] },
    { events: [{ start: '2026-10-17T09:00:00.100Z', end: '2026-10-17T09:00:00.200Z' }] },
    { events: [{ start: '9999-12-31T22:00:00-02:00', end: '9999-12-31T23:00:00-02:00' }] }
  ];
  for (const schedule of invalid) {
    assert.equal(getScheduleExportStatus(schedule).canExport, false, JSON.stringify(schedule));
    assert.equal(generateIcsCalendar(schedule), '');
  }
  assert.equal(getScheduleExportStatus({ date: '2028-02-29', timeZone: 'UTC', events: [{ time: '09:00', endTime: '10:00' }] }).canExport, true);
});

test('DST gaps and repeated local hours require explicit valid times or offsets', () => {
  const gap = { date: '2026-03-29', timeZone: 'Europe/Vienna', events: [{ time: '02:30', endTime: '03:30' }] };
  const overlap = { date: '2026-10-25', timeZone: 'Europe/Vienna', events: [{ time: '02:30', endTime: '03:30' }] };
  assert.match(getScheduleExportStatus(gap).reason, /does not exist/);
  assert.match(getScheduleExportStatus(overlap).reason, /occurs twice/);
  assert.equal(generateIcsCalendar(gap), '');
  assert.equal(generateIcsCalendar(overlap), '');
  const resolved = generateIcsCalendar({ events: [{ start: '2026-10-25T02:30:00+02:00', end: '2026-10-25T02:30:00+01:00' }] });
  assert.ok(resolved.includes('DTSTART:20261025T003000Z'));
  assert.ok(resolved.includes('DTEND:20261025T013000Z'));
  const crossing = generateIcsCalendar({ date: '2026-03-29', timeZone: 'Europe/Vienna', events: [{ time: '01:30', endTime: '03:30' }] });
  assert.ok(crossing.includes('DTSTART:20260329T003000Z'));
  assert.ok(crossing.includes('DTEND:20260329T013000Z'));
});

test('ICS text escapes separators, newlines, and backslashes and folds Unicode at 75 octets', () => {
  const title = 'Planning, review; decisions \\ notes';
  const description = `Line one\nLine two; comma, slash\\\r\n${'🌍'.repeat(50)}`;
  const ics = generateIcsCalendar({ title, scheduleId: 'safe\r\nINJECTED:true', events: [{
    title, description, location: 'Vienna, Austria; HQ',
    start: '2026-10-17T09:00:00Z', end: '2026-10-17T10:00:00Z'
  }] });
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Planning\\, review\\; decisions \\\\ notes'));
  assert.ok(unfolded.includes(`DESCRIPTION:Line one\\nLine two\\; comma\\, slash\\\\\\n${'🌍'.repeat(50)}`));
  assert.ok(unfolded.includes('LOCATION:Vienna\\, Austria\\; HQ'));
  assert.equal(ics.includes('\r\nINJECTED:'), false);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
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

