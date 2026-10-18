import React, { useEffect, useMemo, useState } from 'react';
import { generateIcsCalendar, getScheduleExportStatus } from '../../services/schedule.js';

export default function ScheduleCard({ widget, onUpdate }) {
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [localEvents, setLocalEvents] = useState(widget?.events || []);
  const [copied, setCopied] = useState(false);
  useEffect(() => setLocalEvents(widget?.events || []), [widget]);
  const exportStatus = useMemo(() => getScheduleExportStatus(widget), [widget]);

  if (!widget || !Array.isArray(widget.events)) return null;

  const {
    title = 'Daily Timeline & Schedule',
    date,
    summary,
    timeZone
  } = widget;
  const events = typeof onUpdate === 'function' ? widget.events : localEvents;
  const completedEvents = new Set(events.filter((event) => event.completed).map((event) => event.id));

  const toggleEvent = (eventId) => {
    const nextEvents = events.map((event) => event.id === eventId ? { ...event, completed: !event.completed } : event);
    if (typeof onUpdate === 'function') onUpdate({ ...widget, events: nextEvents });
    else setLocalEvents(nextEvents);
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
        const eventDate = ev.date || ev.start?.slice(0, 10);
        let line = `${check} ${eventDate ? `${eventDate} ` : ''}${ev.time || 'Time not set'}${ev.endTime ? `–${ev.endTime}` : ''}: ${ev.title}`;
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
    const ics = generateIcsCalendar(widget);
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
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
        {(date || timeZone) && <span className="agent-schedule-date-tag">{[date, timeZone].filter(Boolean).join(' · ')}</span>}
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
                    <span className="timeline-time-pill">{ev.date || ev.start?.slice(0, 10) ? `${ev.date || ev.start?.slice(0, 10)} · ` : ''}{ev.time || 'Time not set'}{ev.endTime ? `–${ev.endTime}` : ''}</span>
                    {ev.duration && <span className="timeline-duration-badge">⏱ {ev.duration}</span>}
                  </div>
                  <span className={`timeline-period-chip ${periodConfig.class}`}>
                    {periodConfig.label}
                  </span>
                </div>

                <div
                  className={`timeline-event-title ${isDone ? 'title-struck' : ''}`}
                  onClick={() => toggleEvent(ev.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleEvent(ev.id);
                    }
                  }}
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
          disabled={!exportStatus.canExport}
          aria-describedby={!exportStatus.canExport ? `calendar-export-help-${widget.scheduleId || 'schedule'}` : undefined}
          title={exportStatus.canExport ? 'Download .ics Calendar file for Google Calendar, Apple Calendar, or Outlook' : exportStatus.reason}
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
      {!exportStatus.canExport && (
        <p className="agent-schedule-summary" id={`calendar-export-help-${widget.scheduleId || 'schedule'}`}>
          Calendar export: {exportStatus.reason}
        </p>
      )}
    </div>
  );
}

