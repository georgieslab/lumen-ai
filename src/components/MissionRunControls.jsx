import React from 'react';

const labels = {
  queued: 'Queued', running: 'Working', pausing: 'Saving checkpoint…', paused: 'Paused',
  completed: 'Completed', failed: 'Needs attention', cancelled: 'Cancelled'
};

export default function MissionRunControls({ message, onAction }) {
  const mission = message.serverMission;
  const status = mission?.status;
  const active = ['queued', 'running'].includes(status) || (!mission && message.missionRequest && message.isStreaming);
  const recoverable = ['paused', 'failed'].includes(status) && mission.canResume;
  const tools = Array.isArray(mission?.toolsUsed) ? mission.toolsUsed : [];
  return <section className={`durable-mission durable-mission--${status || 'disconnected'}`} aria-label="Mission controls">
    <div className="durable-mission-heading">
      <span className="durable-mission-dot" aria-hidden="true" />
      <strong>{labels[status] || (message.isStreaming ? 'Saving mission…' : 'Recover saved mission')}</strong>
      {mission?.checkpoint && <span className="durable-mission-checkpoint">Checkpoint {mission.checkpoint.round || 0} · {mission.checkpoint.toolCalls || 0} tool calls</span>}
    </div>
    {tools.length > 0 && <details className="durable-mission-detail"><summary>{active ? 'Live activity' : 'Activity'} · {tools.length} tool{tools.length === 1 ? '' : 's'}</summary><div className="durable-mission-tools">{tools.map((tool, index) => <span key={`${tool.toolUseId || tool.name}-${index}`}>{String(tool.name || 'Tool').replaceAll('_', ' ')}{tool.status === 'error' ? ' · failed' : ''}</span>)}</div></details>}
    {(mission?.error || mission?.recoveryReason || message.missionActionError || message.missionConnectionError) && <p role="status">{message.missionActionError || message.missionConnectionError || mission.error || mission.recoveryReason}</p>}
    {status === 'paused' && !mission.error && <p>Your progress is saved. Resume from this checkpoint whenever you’re ready.</p>}
    <fieldset className="durable-mission-actions" disabled={message.missionActionPending}>
      {active && <button type="button" onClick={() => onAction(message.id, 'pause')}>Ⅱ Pause</button>}
      {recoverable && <button type="button" onClick={() => onAction(message.id, 'resume')}>↻ Resume</button>}
      {(active || recoverable || status === 'pausing' || status === 'paused' || status === 'failed') && <button type="button" onClick={() => onAction(message.id, 'cancel')}>Cancel mission</button>}
      {(message.missionConnectionError || (!mission && message.missionRequest && !message.isStreaming)) && <button type="button" onClick={() => onAction(message.id, 'reconnect')}>Reconnect / recover</button>}
    </fieldset>
  </section>;
}

export function MissionHistoryDrawer({ missions, loading, error, onClose, onRefresh, onOpen }) {
  return <aside className="mission-history-drawer" aria-label="Saved missions">
    <div className="mission-history-header"><h2>Missions</h2><button type="button" onClick={onRefresh} disabled={loading}>Refresh</button><button type="button" onClick={onClose} aria-label="Close missions">×</button></div>
    <p>Saved work continues when you close this tab. Reopen a mission to view its progress or resume a checkpoint.</p>
    {loading && <p role="status">Loading saved missions…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !missions.length && <p>Your next request will appear here.</p>}
    <div className="mission-history-list">{missions.slice(0, 20).map(mission => <button type="button" className="mission-history-item" key={mission.id} onClick={() => onOpen(mission)}>
      <strong>{mission.title || 'Untitled mission'}</strong><span>{labels[mission.status] || mission.status} · {new Date(mission.updatedAt || mission.createdAt).toLocaleString()}</span>
    </button>)}</div>
  </aside>;
}
