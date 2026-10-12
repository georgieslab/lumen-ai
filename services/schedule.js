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
  maxTimeChars: 30
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
  const time = rawTime || `${8 + (index * 2)}:00 AM`;
  const description = clip(obj.description || obj.notes || obj.details, SCHEDULE_LIMITS.maxEventDescChars) || undefined;
  const location = clip(obj.location || obj.place || obj.venue, SCHEDULE_LIMITS.maxLocationChars) || undefined;
  const duration = clip(obj.duration || obj.length, SCHEDULE_LIMITS.maxDurationChars) || undefined;
  const tag = clip(obj.tag || obj.category || obj.type, SCHEDULE_LIMITS.maxTagChars) || undefined;
  const rawPeriod = String(obj.period || '').toLowerCase();
  const validPeriods = ['morning', 'afternoon', 'evening', 'night'];
  const period = validPeriods.includes(rawPeriod) ? rawPeriod : inferPeriodFromTime(time);

  return {
    id: `ev-${index + 1}`,
    time,
    title,
    description,
    location,
    duration,
    tag,
    period
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

  // Fallback events if empty
  if (events.length === 0) {
    events.push(
      sanitizeScheduleEvent({ time: '09:00 AM', title: 'Morning Planning & Focus Session', period: 'morning', tag: 'Focus' }, 0),
      sanitizeScheduleEvent({ time: '01:00 PM', title: 'Midday Review & Action Items', period: 'afternoon', tag: 'Productivity' }, 1),
      sanitizeScheduleEvent({ time: '05:30 PM', title: 'Evening Wrap-up & Reflection', period: 'evening', tag: 'Wrap-up' }, 2)
    );
  }

  return {
    widgetType: 'schedule',
    scheduleId: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    date,
    summary,
    events,
    createdAt: Date.now()
  };
}

// Generates an iCalendar (.ics) string for download or calendar import
export function generateIcsCalendar(schedule) {
  if (!schedule || !Array.isArray(schedule.events)) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lumen AI//Daily Schedule Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${schedule.title || 'Lumen Schedule'}`
  ];

  for (let i = 0; i < schedule.events.length; i++) {
    const ev = schedule.events[i];
    const uid = `${schedule.scheduleId || 'lumen'}-${i}@lumen.ai`;
    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.description || ev.time || '').replace(/\n/g, '\\n')}`
    );
    if (ev.location) {
      icsLines.push(`LOCATION:${ev.location}`);
    }
    icsLines.push('END:VEVENT');
  }

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
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

