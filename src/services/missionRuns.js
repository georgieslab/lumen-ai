import { consumeJsonEventStream } from './eventStream.js';
import { buildConversationHistory, mergeArtifactUpdates } from './conversationHistory.js';
import { activityFromTools } from './mission.js';

const API_URL = import.meta.env?.VITE_API_URL || '';
export const isMissionActive = mission => ['queued', 'running', 'pausing'].includes(mission?.status);
const timestamp = value => typeof value === 'number' ? value : Date.parse(value);

function snapshotActivity(snapshot) {
  if (isMissionActive(snapshot)) return null;
  const duration = timestamp(snapshot.updatedAt) - timestamp(snapshot.createdAt);
  const activity = activityFromTools(snapshot.toolsUsed, Number.isFinite(duration) ? Math.max(0, duration) : 0);
  if (!activity) return null;
  return { ...activity, status: snapshot.status === 'completed' ? 'done' : snapshot.status === 'failed' ? 'failed' : 'stopped',
    steps: activity.steps.map((step, index) => ({ ...step,
      state: snapshot.toolsUsed[index]?.status === 'error' ? 'failed'
        : snapshot.toolsUsed[index]?.status === 'running' ? 'stopped' : 'done',
      meta: { summary: snapshot.toolsUsed[index]?.summary || '' }
    })) };
}

async function request(path, { fetchImpl = globalThis.fetch, ...options } = {}) {
  const response = await fetchImpl(`${API_URL}/api/missions${path}`, {
    ...options, credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Mission request failed (${response.status})`);
  return data;
}

export async function createMissionRun({ history = [], ...payload }, options = {}) {
  // Confirm the anonymous owner cookie before any work can start. A lost create
  // response can then be recovered with the same owner and request ID.
  await request('/session', { ...options, method: 'POST' });
  const data = await request('', { ...options, method: 'POST', body: JSON.stringify({ ...payload, history: buildConversationHistory(history) }) });
  return data.mission;
}
export async function listMissionRuns(options) {
  const data = await request('', options);
  return Array.isArray(data.missions) ? data.missions : [];
}
export async function getMissionRun(id, options) {
  return (await request(`/${encodeURIComponent(id)}`, options)).mission;
}
export async function controlMissionRun(id, action, options) {
  if (!['pause', 'resume', 'cancel'].includes(action)) throw new Error('Unknown mission action');
  return (await request(`/${encodeURIComponent(id)}/${action}`, { ...options, method: 'POST' })).mission;
}

// Reconnect by mission ID. Disconnecting this reader never changes the server run.
export async function watchMissionRun(id, onSnapshot, { signal, fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(`${API_URL}/api/missions/${encodeURIComponent(id)}/events`, {
    credentials: 'include', signal, headers: { Accept: 'text/event-stream' }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Could not reconnect (${response.status})`);
  }
  if (!response.body) throw new Error('Mission updates are unavailable. Reconnect to recover the saved run.');
  let latest;
  await consumeJsonEventStream(response.body, event => {
    if (event.type === 'error') throw new Error(event.error || event.message || 'Mission updates disconnected');
    if (event.type !== 'snapshot' || event.mission?.id !== id) return;
    latest = event.mission;
    onSnapshot(latest);
    if (!isMissionActive(latest)) return false;
  });
  if (!latest || isMissionActive(latest)) throw new Error('Connection lost. Your mission continues on the server.');
  return latest;
}

// Full snapshots replace model output. Local card edits and newer revisions survive reconnects.
export function applyMissionSnapshot(message, snapshot) {
  if (!snapshot?.id || (message.serverMissionId && message.serverMissionId !== snapshot.id)) return message;
  if (message.serverMission && Number(message.serverMission.revision) > Number(snapshot.revision)) return message;
  const widgets = mergeArtifactUpdates(snapshot.widgets || [], message.widgets || []);
  // Speech is a one-time completion effect, never a saved transcript attachment.
  const { audioBase64, ...savedSnapshot } = snapshot;
  return {
    ...message, serverMissionId: snapshot.id, serverMission: savedSnapshot, projectId: snapshot.projectId || null,
    missionRequest: undefined, missionConnectionError: null, missionActionError: null,
    text: snapshot.replyText || '', widgets, webSources: snapshot.webSources || [],
    webType: snapshot.webType || (widgets.length ? 'live_widget' : null),
    mission: undefined, isStreaming: isMissionActive(snapshot), isStopped: false,
    isError: snapshot.status === 'failed',
    activity: snapshotActivity(snapshot)
  };
}
