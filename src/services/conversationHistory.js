// Keep interactive artifacts in the conversation itself so reloads and later turns share one state.
import { finishMission, missionActivity } from './mission.js';

const clip = (value, max = 120) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function getConversationStorageKey(user) {
  if (!user) return 'lumen_standalone_history';
  if (user.provider === 'google' && user.email) return `lumen_history_${user.email}`;
  return `lumen_history_${user.provider || 'account'}_${user.id}`;
}

export function conversationForProject(messages = [], projectId = null) {
  return messages.filter(message => (message.projectId || message.serverMission?.projectId || message.missionRequest?.projectId || null) === (projectId || null));
}

function artifactId(widget) {
  return widget?.checklistId || widget?.scheduleId || widget?.budgetId || widget?.comparisonId || widget?.reportId || widget?.id;
}

export function isFloatingStageWidget(widget) {
  return Boolean(widget) && ['weather', 'crypto', 'pdf_document', 'jobs'].includes(widget.widgetType);
}

export function getAutomaticStageWidget(widgets = []) {
  return widgets.find(widget => widget && ['weather', 'crypto', 'pdf_document'].includes(widget.widgetType)) || null;
}

export function updateMessageArtifact(messages, messageId, widgetIndex, nextWidget, now = Date.now()) {
  if (!nextWidget || !Number.isInteger(widgetIndex) || widgetIndex < 0) return messages;
  return messages.map(message => {
    if (message.id !== messageId || !Array.isArray(message.widgets)) return message;
    const current = message.widgets[widgetIndex];
    if (!current || current.widgetType !== nextWidget.widgetType) return message;
    return {
      ...message,
      widgets: message.widgets.map((widget, index) => index === widgetIndex
        ? { ...nextWidget, editedAt: now }
        : widget)
    };
  });
}

export function restoreConversationMessages(messages, stoppedText = 'This task was interrupted. You can try again.') {
  return messages.map(message => {
    if (message.serverMissionId || message.missionRequest) {
      const active = ['queued', 'running', 'pausing'].includes(message.serverMission?.status);
      return { ...message, isStreaming: false, mission: undefined, missionActionPending: false,
        missionConnectionError: active ? 'Reconnecting to your saved mission…' : message.missionConnectionError };
    }
    if (!message.isStreaming && message.mission?.status !== 'running') return message;
    return {
      ...message,
      text: message.text || stoppedText,
      isStreaming: false,
      isStopped: true,
      mission: undefined,
      activity: message.mission ? missionActivity(finishMission(message.mission, { status: 'stopped' })) : message.activity
    };
  });
}

// A final SSE snapshot must not replace a checkbox change made while the answer was streaming.
export function mergeArtifactUpdates(incoming = [], current = []) {
  return incoming.map((widget, index) => {
    const id = artifactId(widget);
    const edited = current.find((candidate, currentIndex) => candidate?.editedAt &&
      candidate.widgetType === widget.widgetType &&
      (id ? artifactId(candidate) === id : currentIndex === index));
    return edited || widget;
  });
}

function summarizeArtifact(widget) {
  const base = { type: widget.widgetType, title: clip(widget.title) };
  const id = artifactId(widget);
  if (id) base.id = clip(id, 80);
  let itemsKey;
  if (widget.widgetType === 'checklist') {
    const items = Array.isArray(widget.items) ? widget.items : [];
    base.completed = items.filter(item => item.completed).length;
    base.total = items.length;
    base.items = items.slice(0, 30).map(item => ({ id: clip(item.id, 40), text: clip(item.text), completed: Boolean(item.completed) }));
    itemsKey = 'items';
  } else if (widget.widgetType === 'schedule') {
    const events = Array.isArray(widget.events) ? widget.events : [];
    base.date = clip(widget.date, 30);
    base.timeZone = clip(widget.timeZone, 60);
    base.completed = events.filter(event => event.completed).length;
    base.total = events.length;
    base.events = events.slice(0, 24).map(event => ({
      id: clip(event.id, 40), title: clip(event.title), date: clip(event.date, 30),
      time: clip(event.time, 30), endTime: clip(event.endTime, 30), endDate: clip(event.endDate, 30),
      start: clip(event.start, 40), end: clip(event.end, 40), timeZone: clip(event.timeZone, 60),
      duration: clip(event.duration, 30), completed: Boolean(event.completed)
    }));
    itemsKey = 'events';
  } else if (widget.widgetType === 'budget') {
    base.currency = clip(widget.currency, 8);
    base.totalBudget = widget.totalBudget;
    base.allocatedTotal = widget.allocatedTotal;
    base.categories = (Array.isArray(widget.categories) ? widget.categories : []).slice(0, 8)
      .map(category => ({ name: clip(category.name, 60), allocated: category.allocated }));
    itemsKey = 'categories';
  } else if (widget.widgetType === 'comparison') {
    base.criteria = (Array.isArray(widget.criteria) ? widget.criteria : []).slice(0, 8).map(value => clip(value, 60));
    base.recommendation = clip(widget.recommendation, 220);
    base.options = (Array.isArray(widget.options) ? widget.options : []).slice(0, 6).map(option => ({
      name: clip(option.name, 80),
      values: Object.fromEntries(base.criteria.map(criterion => [criterion, clip(option.values?.[criterion], 80)]))
    }));
    itemsKey = 'options';
  } else {
    return null;
  }
  // Bound each summary without truncating JSON or including image/PDF/HTML payloads.
  const initialCount = base[itemsKey].length;
  while (JSON.stringify(base).length > 1400 && base[itemsKey].length) base[itemsKey].pop();
  if (base[itemsKey].length < initialCount) base.omitted = initialCount - base[itemsKey].length;
  return base;
}

export function buildConversationHistory(history = []) {
  return history.slice(-8).map(message => {
    const artifacts = (Array.isArray(message.widgets) ? message.widgets : [])
      .filter(widget => widget && ['checklist', 'schedule', 'budget', 'comparison'].includes(widget.widgetType))
      .slice(0, 4).map(summarizeArtifact).filter(Boolean);
    const state = artifacts.length ? `\n\n[Current artifact state]\n${JSON.stringify(artifacts)}` : '';
    return { role: message.role, text: `${message.text || ''}${state}` };
  });
}
