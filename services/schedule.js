// Schedule & Timeline service for Lumen AI Agent
// Creates time-blocked day plans, travel itineraries, agendas, and daily routines with .ics calendar export.

const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const SCHEDULE_LIMITS = {
  maxTitleChars: 120,
  maxDateChars: 60,
  maxSummaryChars: 300,
  maxEvents: 16,
  maxEventTitleChars: 80,
  maxEventDescChars: 250,
  maxLocationChars: 80,
  maxTagChars: 30,
  maxDurationChars: 30,
  maxTimeChars: 30,
  maxTimeZoneChars: 80,
  maxTimestampChars: 50
};

export function inferPeriodFromTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 'morning';
  const clean = timeStr.toLowerCase();

  // Explicit strings
  if (clean.includes('pm') || clean.includes('afternoon') || clean.includes('evening') || clean.includes('night')) {
    const hourMatch = clean.match(/(\d{1,2})/);
    const hour = hourMatch ? parseInt(hourMatch[1], 10) : 14;
    if (clean.includes('night') || (clean.includes('pm') && (hour >= 9 && hour !== 12))) return 'night';
    if (clean.includes('evening') || (clean.includes('pm') && (hour >= 5 && hour !== 12))) return 'evening';
    return 'afternoon';
  }

  // 24-hour match e.g. 14:00, 18:30
  const match24 = clean.match(/^(\d{1,2}):/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    if (h >= 21) return 'night';
    if (h >= 17) return 'evening';
    if (h >= 12) return 'afternoon';
    return 'morning';
  }

  return 'morning';
}

export function sanitizeScheduleEvent(raw, index = 0) {
  if (!raw) return null;
  const obj = typeof raw === 'string' ? { title: raw } : raw;
  const title = clip(obj.title || obj.activity || obj.name, SCHEDULE_LIMITS.maxEventTitleChars) || `Event ${index + 1}`;
  const rawTime = clip(obj.time || obj.timeSlot || obj.hour, SCHEDULE_LIMITS.maxTimeChars);
  const start = clip(obj.start, SCHEDULE_LIMITS.maxTimestampChars) || undefined;
  const end = clip(obj.end, SCHEDULE_LIMITS.maxTimestampChars) || undefined;
  const time = rawTime || start?.match(/T(\d{2}:\d{2})/)?.[1] || undefined;
  const description = clip(obj.description || obj.notes || obj.details, SCHEDULE_LIMITS.maxEventDescChars) || undefined;
  const location = clip(obj.location || obj.place || obj.venue, SCHEDULE_LIMITS.maxLocationChars) || undefined;
  const duration = clip(obj.duration || obj.length, SCHEDULE_LIMITS.maxDurationChars) || undefined;
  const tag = clip(obj.tag || obj.category || obj.type, SCHEDULE_LIMITS.maxTagChars) || undefined;
  const rawPeriod = String(obj.period || '').toLowerCase();
  const validPeriods = ['morning', 'afternoon', 'evening', 'night'];
  const period = validPeriods.includes(rawPeriod) ? rawPeriod : inferPeriodFromTime(time);

  return {
    id: clip(obj.id, 80) || `ev-${index + 1}`,
    time,
    endTime: clip(obj.endTime, SCHEDULE_LIMITS.maxTimeChars) || end?.match(/T(\d{2}:\d{2})/)?.[1] || undefined,
    date: clip(obj.date, SCHEDULE_LIMITS.maxDateChars) || undefined,
    endDate: clip(obj.endDate, SCHEDULE_LIMITS.maxDateChars) || undefined,
    timeZone: clip(obj.timeZone, SCHEDULE_LIMITS.maxTimeZoneChars) || undefined,
    start,
    end,
    title,
    description,
    location,
    duration,
    tag,
    period,
    completed: obj.completed === true
  };
}

export function buildScheduleWidget(input = {}) {
  const title = clip(input.title, SCHEDULE_LIMITS.maxTitleChars) || 'Daily Timeline & Schedule';
  const date = clip(input.date || input.day, SCHEDULE_LIMITS.maxDateChars) || undefined;
  const summary = clip(input.summary || input.overview, SCHEDULE_LIMITS.maxSummaryChars) || undefined;

  const rawEvents = Array.isArray(input.events) ? input.events : (Array.isArray(input.items) ? input.items : []);
  const events = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = sanitizeScheduleEvent(rawEvents[i], i);
    if (ev) events.push(ev);
    if (events.length >= SCHEDULE_LIMITS.maxEvents) break;
  }

  return {
    widgetType: 'schedule',
    scheduleId: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    date,
    timeZone: clip(input.timeZone, SCHEDULE_LIMITS.maxTimeZoneChars) || undefined,
    summary,
    events,
    createdAt: Date.now()
  };
}

// Resolve explicit dates to UTC before export. This keeps ICS timezone handling
// self-contained and avoids relying on a calendar client's TZID database.
function parseLocalDateTime(date, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time || '');
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch.map(Number);
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] || 0);
  if (timeMatch[4]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (timeMatch[4].toUpperCase() === 'PM' ? 12 : 0);
  }
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(hour, minute, second, 0);
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return { year, month, day, hour, minute, second, naiveUtc: value.getTime() };
}

function resolveZonedDateTime(local, timeZone) {
  if (!timeZone) return { error: 'Add an IANA time zone, such as Europe/Vienna, or use ISO start/end timestamps with explicit offsets.' };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
  } catch {
    return { error: `The time zone "${timeZone}" is invalid. Use an IANA time zone such as Europe/Vienna.` };
  }
  const partsAt = (timestamp) => Object.fromEntries(formatter.formatToParts(timestamp)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const offsets = new Set();
  // Sample both sides of DST changes, then verify each candidate against the
  // actual wall-clock date. A gap yields none; a repeated hour yields two.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = local.naiveUtc + hours * 3600000;
    const p = partsAt(sample);
    const represented = new Date(0);
    represented.setUTCFullYear(p.year, p.month - 1, p.day);
    represented.setUTCHours(p.hour, p.minute, p.second, 0);
    offsets.add(represented.getTime() - sample);
  }
  const candidates = [...offsets].map((offset) => local.naiveUtc - offset).filter((candidate) => {
    const p = partsAt(candidate);
    return ['year', 'month', 'day', 'hour', 'minute', 'second'].every((key) => p[key] === local[key]);
  });
  if (candidates.length === 0) return { error: 'This local time does not exist because of a clock change. Choose a valid time or supply an ISO timestamp with an explicit offset.' };
  if (candidates.length > 1) return { error: 'This local time occurs twice because of a clock change. Supply ISO start/end timestamps with explicit offsets.' };
  return { timestamp: candidates[0] };
}

export function resolveEventTime(event, schedule, end = false) {
  const iso = end ? event.end : event.start;
  const timeZone = event.timeZone || schedule.timeZone;
  if (iso) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?$/.exec(iso);
    const local = match && parseLocalDateTime(match[1], match[2]);
    if (!local) return { error: 'Use valid ISO start/end timestamps or explicit dates (YYYY-MM-DD) and times (HH:mm).' };
    if (match[4]) {
      const offset = match[4] === 'Z' ? null : /^([+-])(\d{2}):(\d{2})$/.exec(match[4]);
      if (offset && (Number(offset[2]) > 23 || Number(offset[3]) > 59)) return { error: 'The ISO timestamp has an invalid UTC offset.' };
      const milliseconds = Number((match[3] || '').padEnd(3, '0'));
      const offsetMinutes = offset ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1) : 0;
      return { timestamp: local.naiveUtc + milliseconds - offsetMinutes * 60000 };
    }
    if (match[3]) return { error: 'Use an explicit UTC offset for timestamps with fractional seconds.' };
    return resolveZonedDateTime(local, timeZone);
  }
  const date = end ? (event.endDate || event.date || schedule.date) : (event.date || schedule.date);
  const time = end ? event.endTime : event.time;
  const local = parseLocalDateTime(date, time);
  if (!local) return { error: 'Add a valid date (YYYY-MM-DD) and both start and end times (HH:mm) to every event. Use an explicit end date for overnight events.' };
  return resolveZonedDateTime(local, timeZone);
}

export function resolveCalendarEvents(schedule) {
  if (!schedule || !Array.isArray(schedule.events) || schedule.events.length === 0) {
    return { canExport: false, reason: 'Add dated events with start and end times to enable calendar export.', events: [] };
  }
  const events = [];
  for (const [index, event] of schedule.events.entries()) {
    if (!event || typeof event !== 'object') return { canExport: false, reason: `Event ${index + 1}: add a valid event with dates and times.`, events: [] };
    const start = resolveEventTime(event, schedule);
    const end = resolveEventTime(event, schedule, true);
    // ICS timestamps have whole-second precision and four-digit years.
    const validYear = (timestamp) => new Date(timestamp).getUTCFullYear() >= 1 && new Date(timestamp).getUTCFullYear() <= 9999;
    const error = start.error || end.error ||
      (!validYear(start.timestamp) || !validYear(end.timestamp) ? 'The resolved calendar date must be between years 0001 and 9999.' : '') ||
      (Math.floor(end.timestamp / 1000) <= Math.floor(start.timestamp / 1000) ? 'The end must be later than the start by at least one second. Add an end date for overnight events.' : '');
    if (error) return { canExport: false, reason: `${event.title || `Event ${index + 1}`}: ${error}`, events: [] };
    events.push({ event, start: start.timestamp, end: end.timestamp });
  }
  return { canExport: true, reason: '', events };
}

export function getScheduleExportStatus(schedule) {
  const { canExport, reason } = resolveCalendarEvents(schedule);
  return { canExport, reason };
}

const escapeIcsText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const formatIcsUtc = (timestamp) => new Date(timestamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// RFC 5545 folds content lines at 75 UTF-8 octets; continuation whitespace
// counts toward the next line's limit. Iterate code points to preserve emoji.
function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

// Returns an empty string when dates/times cannot be resolved without guessing.
export function generateIcsCalendar(schedule) {
  const resolved = resolveCalendarEvents(schedule);
  if (!resolved.canExport) return '';
  const dtStamp = formatIcsUtc(Date.now());

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lumen AI//Daily Schedule Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(schedule.title || 'Lumen Schedule')}`
  ];

  for (const [index, { event: ev, start, end }] of resolved.events.entries()) {
    const uid = `${String(schedule.scheduleId || 'lumen').replace(/[^a-zA-Z0-9_-]/g, '')}-${index}@lumen.ai`;
    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatIcsUtc(start)}`,
      `DTEND:${formatIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(ev.title)}`,
      `DESCRIPTION:${escapeIcsText(ev.description || '')}`
    );
    if (ev.location) {
      icsLines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }
    icsLines.push('END:VEVENT');
  }

  icsLines.push('END:VCALENDAR');
  return `${icsLines.map(foldIcsLine).join('\r\n')}\r\n`;
}

// Fallback: extracts schedule blocks from text if the model outputted a text agenda with timestamps
export function extractScheduleFromMarkdown(text) {
  if (typeof text !== 'string' || text.length < 20) {
    return { cleanText: text, scheduleWidget: null };
  }

  const lines = text.split('\n');
  const eventRegex = /^\s*[-*•]?\s*(?:\*\*)?((?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\d{1,2}:\d{2}))(?:\s*[-–—to]+\s*(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\d{1,2}:\d{2}))?(?:\*\*)?\s*[:\-–—]\s*(.+)$/i;

  const foundEvents = [];
  let scheduleStart = -1;
  let scheduleEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(eventRegex);
    if (match) {
      if (scheduleStart === -1) scheduleStart = i;
      scheduleEnd = i;
      const timeStr = match[1].trim();
      let rest = match[2].trim().replace(/^\*\*|\*\*$/g, '');
      let location;
      let tag;

      // Extract location if (Location: ...) or at Location
      const locMatch = rest.match(/\((?:at|location:?)\s*([^)]+)\)/i);
      if (locMatch) {
        location = locMatch[1].trim();
        rest = rest.replace(locMatch[0], '').trim();
      }

      foundEvents.push({
        time: timeStr,
        title: rest,
        location,
        tag
      });
    } else if (scheduleStart !== -1 && foundEvents.length >= 3 && line.trim().startsWith('#')) {
      break;
    }
  }

  if (foundEvents.length < 3) {
    return { cleanText: text, scheduleWidget: null };
  }

  let title = 'Daily Timeline & Schedule';
  if (scheduleStart > 0) {
    for (let p = scheduleStart - 1; p >= Math.max(0, scheduleStart - 3); p--) {
      const prev = lines[p].trim();
      if (prev.startsWith('#') || prev.startsWith('**')) {
        title = prev.replace(/^[#*]+\s*/, '').replace(/[*#]+$/, '').trim();
        break;
      }
    }
  }

  const scheduleWidget = buildScheduleWidget({
    title,
    events: foundEvents
  });

  const beforeLines = lines.slice(0, scheduleStart);
  if (beforeLines.length > 0 && /^[#*]+\s*(?:Schedule|Itinerary|Timeline|Agenda|Daily Plan)/i.test(beforeLines[beforeLines.length - 1].trim())) {
    beforeLines.pop();
  }
  const cleanLines = [...beforeLines, ...lines.slice(scheduleEnd + 1)];
  const cleanText = cleanLines.join('\n').trim();

  return { cleanText, scheduleWidget };
}

