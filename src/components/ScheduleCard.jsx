import React, { useState } from 'react';

export default function ScheduleCard({ widget }) {
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [completedEvents, setCompletedEvents] = useState(new Set());
  const [copied, setCopied] = useState(false);

  if (!widget || !Array.isArray(widget.events)) return null;

  const {
    title = 'Daily Timeline & Schedule',
    date,
    summary,
    events = []
  } = widget;

  const toggleEvent = (eventId) => {
    setCompletedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const filteredEvents = events.filter((ev) => {
    if (filterPeriod === 'all') return true;
    return (ev.period || 'morning').toLowerCase() === filterPeriod.toLowerCase();
  });

  const morningCount = events.filter((e) => (e.period || '').toLowerCase() === 'morning').length;
  const afternoonCount = events.filter((e) => (e.period || '').toLowerCase() === 'afternoon').length;
  const eveningCount = events.filter((e) => ['evening', 'night'].includes((e.period || '').toLowerCase())).length;

  const periodPillConfig = {
    morning: { label: '🌅 Morning', class: 'period-morning' },
    afternoon: { label: '☀️ Afternoon', class: 'period-afternoon' },
    evening: { label: '🌙 Evening', class: 'period-evening' },
    night: { label: '🌌 Night', class: 'period-night' }
  };

  const handleCopySchedule = async () => {
    try {
      const lines = [`📅 ${title}${date ? ` (${date})` : ''}`, ''];
      if (summary) lines.push(summary, '');

      events.forEach((ev) => {
        const check = completedEvents.has(ev.id) ? '✓' : '•';
        let line = `${check} ${ev.time}: ${ev.title}`;
        if (ev.duration) line += ` [${ev.duration}]`;
        if (ev.location) line += ` (@ ${ev.location})`;
        lines.push(line);
        if (ev.description) lines.push(`   ${ev.description}`);
      });

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  const handleExportIcs = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lumen AI//Daily Schedule Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${title.replace(/[,;]/g, '')}`
    ];

    events.forEach((ev, idx) => {
      const uid = `lumen-${widget.scheduleId || 'sch'}-${idx}@lumen.ai`;
      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `SUMMARY:${ev.title.replace(/[,;]/g, '')}`,
        `DESCRIPTION:${(ev.description || ev.time || '').replace(/\n/g, '\\n').replace(/[,;]/g, '')}`
      );
      if (ev.location) {
        icsLines.push(`LOCATION:${ev.location.replace(/[,;]/g, '')}`);
      }
      icsLines.push('END:VEVENT');
    });

    icsLines.push('END:VCALENDAR');
    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'schedule'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const completedCount = completedEvents.size;
  const progressPercent = events.length > 0 ? Math.round((completedCount / events.length) * 100) : 0;

  return (
    <div className="agent-schedule-card animate-fade-in">
      {/* Header */}
      <div className="agent-schedule-header">
        <div className="agent-schedule-badge">
          <span className="schedule-badge-icon">📅</span>
          <span>Timeline & Schedule</span>
        </div>
        {date && <span className="agent-schedule-date-tag">{date}</span>}
      </div>

      <div className="agent-schedule-title-row">
        <h3 className="agent-schedule-title">{title}</h3>
      </div>

      {summary && <p className="agent-schedule-summary">{summary}</p>}

      {/* Progress Bar if any item completed */}
      {completedCount > 0 && (
        <div className="agent-schedule-progress-wrap">
          <div className="agent-schedule-progress-label">
            <span>Completed</span>
            <span>{completedCount} of {events.length} ({progressPercent}%)</span>
          </div>
          <div className="agent-schedule-progress-track">
            <div className="agent-schedule-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Period Filter Tabs */}
      <div className="agent-schedule-period-tabs">
        <button
          type="button"
          className={`period-tab ${filterPeriod === 'all' ? 'active' : ''}`}
          onClick={() => setFilterPeriod('all')}
        >
          All ({events.length})
        </button>
        {morningCount > 0 && (
          <button
            type="button"
            className={`period-tab ${filterPeriod === 'morning' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('morning')}
          >
            🌅 Morning ({morningCount})
          </button>
        )}
        {afternoonCount > 0 && (
          <button
            type="button"
            className={`period-tab ${filterPeriod === 'afternoon' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('afternoon')}
          >
            ☀️ Afternoon ({afternoonCount})
          </button>
        )}
        {eveningCount > 0 && (
          <button
            type="button"
            className={`period-tab ${filterPeriod === 'evening' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('evening')}
          >
            🌙 Evening ({eveningCount})
          </button>
        )}
      </div>

      {/* Vertical Timeline */}
      <div className="agent-schedule-timeline">
        {filteredEvents.map((ev, idx) => {
          const isDone = completedEvents.has(ev.id);
          const periodConfig = periodPillConfig[ev.period] || periodPillConfig.morning;

          return (
            <div key={ev.id || idx} className={`timeline-item ${isDone ? 'is-completed' : ''}`}>
              {/* Timeline Indicator Column */}
              <div className="timeline-indicator-col">
                <button
                  type="button"
                  className={`timeline-dot ${periodConfig.class} ${isDone ? 'checked' : ''}`}
                  onClick={() => toggleEvent(ev.id)}
                  title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                  aria-label={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                >
                  {isDone ? '✓' : ''}
                </button>
                {idx < filteredEvents.length - 1 && <div className="timeline-connector" />}
              </div>

              {/* Event Content Card */}
              <div className="timeline-content-card">
                <div className="timeline-event-header">
                  <div className="timeline-time-wrap">
                    <span className="timeline-time-pill">{ev.time}</span>
                    {ev.duration && <span className="timeline-duration-badge">⏱ {ev.duration}</span>}
                  </div>
                  <span className={`timeline-period-chip ${periodConfig.class}`}>
                    {periodConfig.label}
                  </span>
                </div>

                <div
                  className={`timeline-event-title ${isDone ? 'title-struck' : ''}`}
                  onClick={() => toggleEvent(ev.id)}
                  role="button"
                  tabIndex={0}
                >
                  {ev.title}
                </div>

                {ev.description && (
                  <p className="timeline-event-description">{ev.description}</p>
                )}

                {/* Footer Chips */}
                {(ev.location || ev.tag) && (
                  <div className="timeline-event-chips">
                    {ev.location && (
                      <span className="timeline-chip location-chip" title="Location">
                        <span className="chip-glyph">📍</span> {ev.location}
                      </span>
                    )}
                    {ev.tag && (
                      <span className="timeline-chip tag-chip" title="Category Tag">
                        <span className="chip-glyph">🏷️</span> {ev.tag}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="agent-schedule-actions">
        <button
          type="button"
          className="agent-schedule-btn is-ics"
          onClick={handleExportIcs}
          title="Download .ics Calendar file for Google Calendar, Apple Calendar, or Outlook"
        >
          <span>📥 Add to Calendar (.ics)</span>
        </button>
        <button
          type="button"
          className="agent-schedule-btn is-copy"
          onClick={handleCopySchedule}
        >
          <span>{copied ? '✓ Copied' : '📋 Copy Timeline'}</span>
        </button>
      </div>
    </div>
  );
}

