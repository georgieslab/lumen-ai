export const isTaskWidget = widget => ['checklist', 'schedule'].includes(widget?.widgetType);
export function summarizeConversationWork(messages = []) {
  const artifacts = new Map();
  for (const message of messages) for (const [index, widget] of (message.widgets || []).entries()) {
    const id = widget.artifactId || widget.checklistId || widget.scheduleId || widget.budgetId || widget.comparisonId || widget.briefId || widget.reportId || `${message.id}:${index}`;
    artifacts.set(id, widget);
  }
  const outputs = [...artifacts.values()];
  const tasks = outputs.filter(isTaskWidget);
  const items = tasks.flatMap(widget => widget.widgetType === 'checklist' ? widget.items || [] : widget.events || []);
  const active = messages.filter(message => message.role === 'assistant' && (message.isStreaming || ['queued', 'running', 'pausing'].includes(message.serverMission?.status)));
  return { outputCount: outputs.length, taskCount: tasks.length, itemCount: items.length,
    completedCount: items.filter(item => item.completed === true).length, activeCount: active.length };
}

export function widgetCaption(widget) {
  const kind = { checklist: 'Checklist', schedule: 'Schedule', comparison: 'Comparison', budget: 'Budget', evidence_report: 'Evidence review', daily_brief: 'Briefing', pdf_document: 'Document', weather: 'Weather', crypto: 'Markets', jobs: 'Jobs' }[widget.widgetType] || 'Output';
  const items = widget.widgetType === 'checklist' ? widget.items : widget.widgetType === 'schedule' ? widget.events : null;
  return { kind, detail: items ? `${items.filter(item => item.completed).length}/${items.length} done` : widget.widgetType === 'evidence_report' ? `${widget.claims?.length || 0} claims` : '' };
}
