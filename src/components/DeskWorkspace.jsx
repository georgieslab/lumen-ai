import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DESK_ACTIONS, WATCH_INTERVALS, addProjectFile, buildDeskMission, conversationArtifacts, controlWatch, createProject, createWatch,
  dayDefaults, getProject, listNotifications, listProjects, listWatches, pinProjectArtifact, readNotification,
  removeProjectFile, safeSourceUrl, saveProject, unpinProjectArtifact, updateWatch, validateProjectFile } from '../services/deskWorkspace.js';
import { getMissionRun } from '../services/missionRuns.js';
import './DeskWorkspace.css';

export function DeskIcon({ name, ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {name === 'day' && <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M7 14h4M7 17h8" /></>}
    {name === 'decision' && <><path d="M12 3v18M5 6h14M5 6l-3 7h6L5 6ZM19 6l-3 7h6l-3-7ZM8 21h8" /></>}
    {name === 'verify' && <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>}
    {name === 'watches' && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9 21h6" /><circle cx="18" cy="4" r="2" /></>}
    {name === 'projects' && <><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M7 13h10M7 17h6" /></>}
  </svg>;
}

export function DeskActionDock({ onSelect, activeAction, notificationCount = 0, projectName }) {
  return <nav className="desk-action-dock" aria-label="Lumen desk actions">
    <div className="desk-dock-heading"><span>YOUR DESK</span>{projectName && <span className="desk-project-context">{projectName}</span>}</div>
    <div className="desk-dock-actions">{DESK_ACTIONS.map(action => <button type="button" key={action.id}
      className={`desk-dock-action ${activeAction === action.id ? 'is-active' : ''}`} onClick={() => onSelect(action.id)}
      aria-label={`${action.title}: ${action.description}`} title={action.description}>
      <DeskIcon name={action.icon} /><span>{action.title}</span>
      {action.id === 'watches' && notificationCount > 0 && <span className="desk-notification-count" aria-label={`${notificationCount} unread alerts`}>{notificationCount > 9 ? '9+' : notificationCount}</span>}
    </button>)}</div>
  </nav>;
}

const Field = ({ label, hint, children, className = '' }) => <label className={`desk-field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
const ErrorNotice = ({ error }) => error ? <p className="desk-error" role="alert">{error}</p> : null;
const stamp = value => value ? new Date(value).toLocaleString() : 'Not checked yet';

function ProjectIcon({ name = 'folder' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'folder' && <><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M8 14h8M8 17h5" /></>}
    {name === 'person' && <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>}
    {name === 'file' && <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>}
    {name === 'pin' && <><path d="m16 3 5 5-4 1-3 5v3l-7-7h3l5-3 1-4ZM7 17l-4 4" /></>}
    {name === 'missions' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    {name === 'settings' && <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>}
    {name === 'plus' && <path d="M12 5v14M5 12h14" />}
    {name === 'arrow' && <path d="M6 18 18 6M6 6h12v12" />}
    {name === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>;
}

function MissionForm({ kind, messages, projectId, onRun }) {
  const [day, setDay] = useState(() => dayDefaults());
  const [decision, setDecision] = useState({ question: '', options: '', criteria: '', constraints: '' });
  const [verify, setVerify] = useState({ content: '', context: '' });
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setReview(null); setError(''); }, [kind, projectId]);
  const change = (setter, key) => event => { const value = event.target.value; setter(previous => ({ ...previous, [key]: value })); setReview(null); };
  const prepare = event => {
    event.preventDefault(); setError('');
    try { setReview(buildDeskMission(kind, kind === 'day' ? day : kind === 'decision' ? decision : verify, { messages, projectId })); }
    catch (failure) { setError(failure.message); }
  };
  const run = async () => {
    setSubmitting(true); setError('');
    try { await onRun(review.prompt, { actionKind: review.actionKind, projectId: review.projectId, actionData: review.actionData }); }
    catch (failure) { setError(failure.message); }
    finally { setSubmitting(false); }
  };
  return <div className="desk-mission-form">
    {review ? <section className="desk-review" aria-label="Review mission brief">
      <span className="desk-eyebrow">READY FOR YOUR REVIEW</span><h3>{review.review.title}</h3>
      <dl>{review.review.rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      <p>Lumen will save this mission, show its tools and results, and keep a resumable checkpoint.</p>
      {['decision', 'verify'].includes(kind) && <p>This action uses live web research to review sources.</p>}
      <ErrorNotice error={error} /><div className="desk-form-footer"><button type="button" className="desk-secondary" onClick={() => setReview(null)} disabled={submitting}>Edit brief</button><button type="button" className="desk-primary" onClick={run} disabled={submitting}>{submitting ? 'Starting…' : 'Start mission'} <span aria-hidden="true">↗</span></button></div>
    </section> : <form onSubmit={prepare}>
      {kind === 'day' && <>
        <div className="desk-two-columns"><Field label="Date"><input required type="date" value={day.date} onChange={change(setDay, 'date')} /></Field><Field label="Time zone"><input required value={day.timeZone} maxLength={80} onChange={change(setDay, 'timeZone')} autoComplete="off" /></Field></div>
        <Field label="What matters today?" hint="One priority per line. Existing unfinished checklist and schedule items in this context can help the plan."><textarea required rows={5} maxLength={1800} placeholder="Write the launch brief&#10;Prepare for the 14:00 review&#10;Leave time for a walk" value={day.priorities} onChange={change(setDay, 'priorities')} /></Field>
        <div className="desk-two-columns"><Field label="Start time"><input required type="time" value={day.startTime} onChange={change(setDay, 'startTime')} /></Field><Field label="Available hours"><input required type="number" min="0.5" max="16" step="0.5" value={day.availableHours} onChange={change(setDay, 'availableHours')} /></Field></div>
        <Field label="City (optional)" hint="Useful when weather or local context affects your day."><input value={day.city} maxLength={120} placeholder="Vienna" onChange={change(setDay, 'city')} /></Field>
      </>}
      {kind === 'decision' && <>
        <Field label="What are you deciding?"><textarea required rows={2} maxLength={600} placeholder="Which option best fits my needs?" value={decision.question} onChange={change(setDecision, 'question')} /></Field>
        <div className="desk-two-columns"><Field label="Options" hint="At least two, one per line."><textarea required rows={5} maxLength={1400} placeholder="Option A&#10;Option B" value={decision.options} onChange={change(setDecision, 'options')} /></Field><Field label="Decision criteria" hint="What should the comparison measure?"><textarea required rows={5} maxLength={1800} placeholder="Total cost&#10;Reliability&#10;Time required" value={decision.criteria} onChange={change(setDecision, 'criteria')} /></Field></div>
        <Field label="Constraints and preferences" hint="Lumen separates sourced facts, assumptions, and unknowns. Estimates are labeled."><textarea rows={3} maxLength={1200} placeholder="Budget, deadlines, must-haves, and what you value most" value={decision.constraints} onChange={change(setDecision, 'constraints')} /></Field>
      </>}
      {kind === 'verify' && <>
        <Field label="Claim, passage, or public URL" hint="Up to 6,000 characters. Lumen checks the main factual claims against sources it actually reads."><textarea required rows={8} maxLength={6000} placeholder="Paste the material you want to check…" value={verify.content} onChange={change(setVerify, 'content')} /></Field>
        <Field label="What should we focus on? (optional)"><textarea rows={3} maxLength={800} placeholder="Is this still accurate? Does the source support the headline?" value={verify.context} onChange={change(setVerify, 'context')} /></Field>
        <div className="desk-info-note"><DeskIcon name="verify" /><span>Each claim gets a supported, contradicted, or unresolved verdict with evidence and uncertainty.</span></div>
      </>}
      <ErrorNotice error={error} /><div className="desk-form-footer"><span>Review the brief before work starts.</span><button type="submit" className="desk-primary">Review brief <span aria-hidden="true">→</span></button></div>
    </form>}
  </div>;
}

function SourceLinks({ sources = [], url }) {
  const links = [...(url ? [{ url, title: 'Open source' }] : []), ...sources.map(source => typeof source === 'string' ? { url: source } : source)]
    .filter(source => safeSourceUrl(source.url)).slice(0, 5);
  return links.length ? <div className="desk-source-links">{links.map((source, index) => <a key={`${source.url}-${index}`} href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.url).hostname} ↗</a>)}</div> : null;
}

function WatchesPanel() {
  const [watches, setWatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({ kind: 'url', target: '', title: '', intervalMs: 3600000 });
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refreshSequence = useRef(0);
  const createRequest = useRef(null);
  const refresh = async (signal, quiet = false) => {
    if (!quiet) setLoading(true);
    const current = generation.current;
    const sequence = ++refreshSequence.current;
    try {
      const [runs, alerts] = await Promise.all([listWatches({ signal }), listNotifications({ signal })]);
      if (current !== generation.current || sequence !== refreshSequence.current) return;
      setWatches(runs.watches || []); setNotifications(alerts.notifications || []); setError('');
    } catch (failure) { if (!signal?.aborted && current === generation.current && sequence === refreshSequence.current) setError(failure.message); }
    finally { if (current === generation.current && sequence === refreshSequence.current) setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController(); void refresh(controller.signal);
    const timer = setInterval(() => void refresh(controller.signal, true), 30000);
    return () => { generation.current++; controller.abort(); clearInterval(timer); };
  }, []);
  const execute = async (key, operation) => {
    if (busy) return;
    setBusy(key); setError('');
    try { await operation(); await refresh(undefined, true); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  };
  const save = event => {
    event.preventDefault();
    if (form.kind === 'url' && !safeSourceUrl(form.target)) { setError('Enter a complete public http:// or https:// URL.'); return; }
    if (!form.target.trim()) { setError('Add a public page URL or search topic.'); return; }
    void execute('create', async () => {
      if (editing) await updateWatch(editing, { ...(form.title.trim() ? { title: form.title.trim() } : {}), intervalMs: Number(form.intervalMs) });
      else {
        const payload = { kind: form.kind, target: form.target.trim(), ...(form.title.trim() ? { title: form.title.trim() } : {}), intervalMs: Number(form.intervalMs) };
        const key = JSON.stringify(payload);
        if (createRequest.current?.key !== key) createRequest.current = { key, id: crypto.randomUUID() };
        await createWatch({ ...payload, requestId: createRequest.current.id });
        createRequest.current = null;
      }
      setEditing(null); setForm({ kind: 'url', target: '', title: '', intervalMs: 3600000 });
    });
  };
  const displayed = watches.filter(watch => showArchived || watch.status !== 'archived');
  return <div className="desk-watches">
    <div className="desk-info-note"><DeskIcon name="watches" /><span>Checks run while the Lumen server is online. Alerts appear here when something changes; delivery is in-app.</span></div>
    <form className="desk-surface" onSubmit={save}>
      <h3>{editing ? 'Edit watch' : 'Create a watch'}</h3>
      <div className="desk-two-columns"><Field label="Watch type"><select value={form.kind} disabled={Boolean(editing)} onChange={event => setForm(previous => ({ ...previous, kind: event.target.value }))}><option value="url">A public page</option><option value="topic">A search topic</option></select></Field><Field label="Check frequency"><select value={form.intervalMs} onChange={event => setForm(previous => ({ ...previous, intervalMs: Number(event.target.value) }))}>{WATCH_INTERVALS.map(interval => <option key={interval.value} value={interval.value}>{interval.label}</option>)}</select></Field></div>
      <Field label={form.kind === 'url' ? 'Public page URL' : 'Search topic'}><input required maxLength={1000} readOnly={Boolean(editing)} placeholder={form.kind === 'url' ? 'https://example.com/updates' : 'New funding for urban cycling in Vienna'} value={form.target} onChange={event => setForm(previous => ({ ...previous, target: event.target.value }))} /></Field>
      <Field label="Name (optional)"><input maxLength={120} value={form.title} placeholder="A name you’ll recognize" onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></Field>
      <div className="desk-form-footer">{editing && <button type="button" className="desk-secondary" onClick={() => { setEditing(null); setForm({ kind: 'url', target: '', title: '', intervalMs: 3600000 }); }}>Cancel edit</button>}<button type="submit" className="desk-primary" disabled={Boolean(busy)}>{busy === 'create' ? 'Saving…' : editing ? 'Save watch' : 'Start watching'}</button></div>
    </form>
    <ErrorNotice error={error} />
    <div className="desk-section-heading"><h3>Your watches</h3><label className="desk-checkbox"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Show archived</label><button type="button" className="desk-text-button" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
    {loading && <p role="status" className="desk-muted">Loading watches…</p>}
    {!loading && !displayed.length && <div className="desk-empty"><DeskIcon name="watches" /><strong>Keep an eye on what matters.</strong><p>Add a page or topic above. The first check establishes a baseline; later changes create an alert.</p></div>}
    <div className="desk-record-list">{displayed.map(watch => <article className="desk-record" key={watch.id}>
      <div className="desk-record-heading"><h4>{watch.title || watch.target}</h4><span className={`desk-status status-${watch.status}`}>{watch.checking ? 'Checking…' : watch.status}</span></div>
      <p className="desk-record-target">{watch.target}</p><div className="desk-record-meta"><span>{watch.baselineReady ? `Last checked ${stamp(watch.lastCheckedAt)}` : 'Establishing baseline'}</span>{watch.status === 'active' && watch.nextCheckAt && <span>Next {stamp(watch.nextCheckAt)}</span>}</div>
      {watch.error && <p className="desk-error" role="status">{watch.error}</p>}
      {watch.latestChange && <details className="desk-change"><summary>{watch.latestChange.summary || 'View latest change'}</summary><div className="desk-two-columns"><div><small>Before</small><pre>{watch.latestChange.before || 'No previous excerpt'}</pre></div><div><small>After</small><pre>{watch.latestChange.after || 'No current excerpt'}</pre></div></div><SourceLinks sources={watch.latestChange.sources} url={watch.latestChange.url} /></details>}
      {watch.status !== 'archived' && <div className="desk-record-actions"><button type="button" onClick={() => void execute(watch.id, () => controlWatch(watch.id, 'check'))} disabled={Boolean(busy) || watch.checking}>Check now</button><button type="button" onClick={() => void execute(watch.id, () => controlWatch(watch.id, watch.status === 'paused' ? 'resume' : 'pause'))} disabled={Boolean(busy)}>{watch.status === 'paused' ? 'Resume' : 'Pause'}</button><button type="button" onClick={() => { setEditing(watch.id); setForm({ kind: watch.kind, target: watch.target, title: watch.title || '', intervalMs: watch.intervalMs }); }} disabled={Boolean(busy)}>Edit</button><button type="button" onClick={() => void execute(watch.id, () => updateWatch(watch.id, { status: 'archived' }))} disabled={Boolean(busy)}>Archive</button></div>}
    </article>)}</div>
    <div className="desk-section-heading"><h3>Change alerts</h3><span className="desk-muted">{notifications.filter(alert => !alert.readAt).length} unread</span></div>
    {!notifications.length && <p className="desk-muted">No changes reported yet. Unchanged checks stay quiet.</p>}
    <div className="desk-record-list">{notifications.map(alert => <article className={`desk-record desk-alert ${alert.readAt ? 'is-read' : ''}`} key={alert.id}><div className="desk-record-heading"><h4>{alert.watchTitle || 'Watch changed'}</h4><time>{stamp(alert.createdAt)}</time></div><p>{alert.summary}</p>{(alert.before || alert.after) && <details className="desk-change"><summary>Compare excerpts</summary><div className="desk-two-columns"><div><small>Before</small><pre>{alert.before}</pre></div><div><small>After</small><pre>{alert.after}</pre></div></div></details>}<SourceLinks sources={alert.sources} url={alert.url} />{!alert.readAt && <button type="button" className="desk-text-button" disabled={Boolean(busy)} onClick={() => void execute(alert.id, () => readNotification(alert.id))}>Mark read</button>}</article>)}</div>
  </div>;
}

function ProjectsPanel({ projects, projectsLoading, refreshProjects, currentProjectId, onProjectChange, messages, onOpenMission }) {
  const [selected, setSelected] = useState(currentProjectId || '');
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState({ name: '', description: '', instructions: '' });
  const [newProject, setNewProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pinIndex, setPinIndex] = useState('');
  const fileRef = useRef(null);
  const candidates = useMemo(() => conversationArtifacts(messages, selected), [messages, selected]);
  useEffect(() => {
    setPinIndex('');
    if (!selected) { setDetail(null); setLoading(false); setError(''); return; }
    const controller = new AbortController(); setLoading(true); setError(''); setDetail(null);
    getProject(selected, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setDetail(data); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => { if (detail?.project) setEditing({ name: detail.project.name, description: detail.project.description || '', instructions: detail.project.instructions || '' }); }, [detail?.project?.id]);
  const mutate = async (key, operation) => {
    if (busy) return;
    setBusy(key); setError('');
    try {
      const result = await operation();
      if (result?.project) {
        setDetail(previous => ({ ...previous, project: result.project }));
        const refreshed = await getProject(result.project.id); setDetail(refreshed);
      }
      await refreshProjects();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  };
  const create = event => {
    event.preventDefault();
    void mutate('create', async () => { const result = await createProject({ name: newName.trim() }); setSelected(result.project.id); setNewName(''); setNewProject(false); onProjectChange(result.project.id); return result; });
  };
  const project = detail?.project;
  const upload = event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !project) return;
    void mutate('upload', async () => { if (file.size > 400000) throw new Error('Choose a plain text file with at most 100,000 characters.'); return addProjectFile(project.id, validateProjectFile(file.name, await file.text())); });
  };
  const openPinned = async pin => {
    setBusy(pin.id); setError('');
    try { const mission = (detail.recentMissions || []).find(item => item.id === pin.missionId) || await getMissionRun(pin.missionId); await onOpenMission(mission); }
    catch (failure) { setError(failure.message); } finally { setBusy(''); }
  };
  const visibleProjects = projects.filter(item => showArchived || !item.archived);
  return <div className="desk-projects">
    <div className="desk-project-toolbar">
      <div><span className="desk-project-kicker">YOUR SPACES</span><p>Keep the context. Find the work.</p></div>
      <button type="button" className="desk-secondary desk-project-create-toggle" aria-expanded={newProject} onClick={() => setNewProject(value => !value)}><ProjectIcon name="plus" /> New project</button>
    </div>
    {newProject && <form className="desk-inline-create" onSubmit={create}><Field label="Project name"><input autoFocus required maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Launch, research, travel…" /></Field><button type="submit" className="desk-primary" disabled={Boolean(busy)}>{busy === 'create' ? 'Creating…' : 'Create'}</button></form>}
    <ErrorNotice error={error} />
    {projectsLoading && <p className="desk-muted" role="status">Loading project spaces…</p>}
    <div className="desk-project-layout">
      <aside className="desk-project-sidebar">
        <div className="desk-project-sidebar-heading"><span>Workspaces</span><span>{visibleProjects.length}</span></div>
        <nav className="desk-project-list" aria-label="Project spaces">
          <button type="button" disabled={Boolean(busy)} className={!selected ? 'is-selected' : ''} aria-pressed={!selected} onClick={() => { setSelected(''); onProjectChange(null); }}>
            <span className="desk-project-picker-icon"><ProjectIcon name="person" /></span><span className="desk-project-picker-copy"><strong>Personal workspace</strong><small>No project context</small></span>{!currentProjectId && <span className="desk-project-current-dot" aria-label="Active workspace" />}
          </button>
          {visibleProjects.map(item => <button type="button" key={item.id} disabled={Boolean(busy)} className={selected === item.id ? 'is-selected' : ''} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span className="desk-project-picker-icon"><ProjectIcon /></span><span className="desk-project-picker-copy"><strong>{item.name}</strong><small>{item.archived ? 'Archived' : `${item.fileCount ?? 0} files · ${item.pinCount ?? 0} pins`}</small></span>{currentProjectId === item.id && <span className="desk-project-current-dot" aria-label="Active project" />}
          </button>)}
        </nav>
        <label className="desk-checkbox"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Show archived</label>
      </aside>
      <div className="desk-project-detail" aria-busy={loading}>
        {loading && <p className="desk-muted desk-project-loading" role="status">Loading project…</p>}
        {!loading && !project && <div className="desk-empty desk-project-welcome"><span className="desk-project-welcome-icon"><ProjectIcon /></span><span className="desk-project-kicker">ROOM FOR WHAT'S NEXT</span><strong>A home for ongoing work.</strong><p>Create or choose a project to keep instructions, reference files, missions, and useful results together.</p><button type="button" className="desk-primary" onClick={() => setNewProject(true)}><ProjectIcon name="plus" /> Create a project</button></div>}
        {project && <>
          <section className="desk-project-overview" aria-label="Selected project">
            <div className="desk-project-overview-heading"><span className="desk-project-overview-icon"><ProjectIcon /></span><div><span className={`desk-status ${project.archived ? 'status-archived' : ''}`}>{project.archived ? 'Archived' : currentProjectId === project.id ? 'Active project' : 'Project space'}</span><h3>{project.name}</h3>{project.description && <p>{project.description}</p>}</div></div>
            <div className="desk-project-overview-footer"><div className="desk-project-stats"><span><ProjectIcon name="file" />{(project.files || []).length} files</span><span><ProjectIcon name="pin" />{(detail.pinnedArtifacts || []).length} pins</span><span><ProjectIcon name="missions" />{(detail.recentMissions || []).length} missions</span></div><div className="desk-record-actions"><button type="button" className="desk-project-use" disabled={project.archived || Boolean(busy) || currentProjectId === project.id} onClick={() => onProjectChange(project.id)}>{currentProjectId === project.id ? <ProjectIcon name="check" /> : <ProjectIcon name="arrow" />}{currentProjectId === project.id ? 'Using this project' : 'Use for new work'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void mutate('archive', async () => { const result = await saveProject(project.id, { archived: !project.archived }); if (!project.archived && currentProjectId === project.id) onProjectChange(null); return result; })}>{project.archived ? 'Reopen project' : 'Archive project'}</button></div></div>
          </section>
          <form className="desk-surface desk-project-settings" onSubmit={event => { event.preventDefault(); void mutate('save', () => saveProject(project.id, editing)); }}>
            <div className="desk-project-card-heading"><span className="desk-project-section-icon"><ProjectIcon name="settings" /></span><div><h3>Project context</h3><p>The details Lumen carries into new work.</p></div></div>
            <div className="desk-project-settings-fields"><Field label="Name"><input required maxLength={100} value={editing.name} onChange={event => setEditing(previous => ({ ...previous, name: event.target.value }))} /></Field><Field label="Description"><textarea rows={2} maxLength={2000} value={editing.description} onChange={event => setEditing(previous => ({ ...previous, description: event.target.value }))} /></Field></div>
            <Field label="Project instructions" hint="Applied to new missions in this project. Avoid credentials or secrets."><textarea rows={4} maxLength={12000} placeholder="Goals, requirements, audience, conventions…" value={editing.instructions} onChange={event => setEditing(previous => ({ ...previous, instructions: event.target.value }))} /></Field>
            <div className="desk-form-footer"><span>{(project.files || []).length}/10 text files</span><button type="submit" className="desk-primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save project'}</button></div>
          </form>
          <section className="desk-surface desk-project-files" aria-labelledby="desk-project-files-title">
            <div className="desk-project-card-heading"><span className="desk-project-section-icon"><ProjectIcon name="file" /></span><div><h3 id="desk-project-files-title">Reference files</h3><p>Knowledge to keep close.</p></div><button type="button" className="desk-text-button" disabled={Boolean(busy) || project.archived || (project.files || []).length >= 10} onClick={() => fileRef.current?.click()}><ProjectIcon name="plus" /> Add file</button></div>
            <input type="file" hidden ref={fileRef} accept=".txt,.text,.md,.markdown,.csv,.json" onChange={upload} /><p className="desk-muted">Plain TXT, Markdown, CSV, or JSON · 100,000 characters per file.</p>
            {!(project.files || []).length && <p className="desk-project-section-empty">No reference files yet. Add a brief, notes, or other project context.</p>}
            {(project.files || []).map(file => <div className="desk-file-row" key={file.id}><span className="desk-project-row-icon"><ProjectIcon name="file" /></span><details><summary>{file.name}<small>{file.text.length.toLocaleString()} characters</small></summary><pre>{file.text}</pre></details><button type="button" className="desk-text-button" disabled={Boolean(busy)} aria-label={`Remove ${file.name}`} onClick={() => void mutate(file.id, () => removeProjectFile(project.id, file.id))}>Remove</button></div>)}
          </section>
          <section className="desk-surface desk-project-pins" aria-labelledby="desk-project-pins-title">
            <div className="desk-project-card-heading"><span className="desk-project-section-icon"><ProjectIcon name="pin" /></span><div><h3 id="desk-project-pins-title">Pinned artifacts</h3><p>Useful results, always within reach.</p></div><span className="desk-project-card-count">{(detail.pinnedArtifacts || []).length}</span></div>
            {candidates.length > 0 && !project.archived && <div className="desk-inline-pin"><select aria-label="Artifact to pin" value={pinIndex} onChange={event => setPinIndex(event.target.value)}><option value="">Choose from this conversation…</option>{candidates.map((candidate, index) => <option key={`${candidate.missionId}-${candidate.widgetId}-${index}`} value={index}>{candidate.title} · {candidate.type}</option>)}</select><button type="button" className="desk-secondary" disabled={pinIndex === '' || Boolean(busy)} onClick={() => void mutate('pin', () => pinProjectArtifact(project.id, { missionId: candidates[Number(pinIndex)].missionId, widgetId: candidates[Number(pinIndex)].widgetId }))}>Pin</button></div>}
            {!(detail.pinnedArtifacts || []).length && <p className="desk-project-section-empty">Pin useful cards from a conversation to find them here.</p>}
            {(detail.pinnedArtifacts || []).map(pin => <div className="desk-pin-row" key={pin.id}><span className="desk-project-row-icon"><ProjectIcon name="pin" /></span><div><strong>{pin.title || pin.widget?.title || pin.widgetType}</strong><small>{pin.available ? pin.widgetType : 'Artifact unavailable'}</small></div><button type="button" className="desk-text-button" disabled={Boolean(busy) || !pin.available} onClick={() => void openPinned(pin)}>Open mission <ProjectIcon name="arrow" /></button><button type="button" className="desk-text-button" disabled={Boolean(busy)} onClick={() => void mutate(pin.id, () => unpinProjectArtifact(project.id, pin.id))}>Unpin</button></div>)}
          </section>
          <section className="desk-surface desk-project-missions" aria-labelledby="desk-project-missions-title">
            <div className="desk-project-card-heading"><span className="desk-project-section-icon"><ProjectIcon name="missions" /></span><div><h3 id="desk-project-missions-title">Recent missions</h3><p>Pick up where the work left off.</p></div><span className="desk-project-card-count">{(detail.recentMissions || []).length}</span></div>
            {!(detail.recentMissions || []).length && <p className="desk-project-section-empty">New work in this project will appear here.</p>}
            {(detail.recentMissions || []).map(mission => <button type="button" className="desk-project-mission" key={mission.id} onClick={() => onOpenMission(mission)}><span className="desk-project-mission-copy"><strong>{mission.title}</strong><small><span className={`desk-status status-${mission.status}`}>{mission.status}</span>{stamp(mission.updatedAt)}</small></span><ProjectIcon name="arrow" /></button>)}
          </section>
        </>}
      </div>
    </div>
  </div>;
}

export default function DeskWorkspace({ open, action = 'day', onClose, onRun, onOpenMission, currentProjectId, onProjectChange, messages = [], activeLanguage }) {
  const [active, setActive] = useState(action);
  const [projects, setProjects] = useState([]);
  const [projectError, setProjectError] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);
  const projectsSequence = useRef(0);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelRef = useRef(null);
  useEffect(() => setActive(action), [action]);
  const refreshProjects = async (signal) => {
    const sequence = ++projectsSequence.current; setProjectsLoading(true);
    try { const result = await listProjects(true, { signal }); if (!signal?.aborted && sequence === projectsSequence.current) { setProjects(result.projects || []); setProjectError(''); } }
    catch (failure) { if (!signal?.aborted && sequence === projectsSequence.current) setProjectError(failure.message); }
    finally { if (!signal?.aborted && sequence === projectsSequence.current) setProjectsLoading(false); }
  };
  useEffect(() => { if (!open) return; const controller = new AbortController(); void refreshProjects(controller.signal); return () => controller.abort(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const backdrop = panelRef.current.parentElement;
    const root = backdrop.parentElement;
    const previousInert = new Map();
    const lockBackground = () => [...root.children].filter(element => element !== backdrop && element instanceof HTMLElement).forEach(element => {
      if (!previousInert.has(element)) previousInert.set(element, element.inert);
      element.inert = true;
    });
    lockBackground();
    const observer = new MutationObserver(lockBackground);
    observer.observe(root, { childList: true });
    closeRef.current?.focus({ preventScroll: true });
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current?.(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(panelRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary') || []).filter(element => element.offsetParent !== null);
      const first = targets[0]; const last = targets.at(-1);
      if (!targets.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      observer.disconnect();
      previousInert.forEach((inert, element) => { element.inert = inert; });
      const returnTarget = previous?.isConnected && previous.offsetParent !== null
        ? previous
        : [...root.querySelectorAll('.header-mobile-tools-button, .header-explore-button')].find(element => element.offsetParent !== null);
      returnTarget?.focus?.({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (!open || active !== 'projects') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open, active]);
  if (!open) return null;
  const selected = DESK_ACTIONS.find(item => item.id === active) || DESK_ACTIONS[0];
  return <div className={`desk-workspace-backdrop${active === 'projects' ? ' desk-workspace-backdrop--projects' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panelRef} className={`desk-workspace desk-workspace--${active}`} role="dialog" aria-modal="true" aria-labelledby="desk-workspace-title">
      <header className="desk-workspace-header"><div className="desk-workspace-title-icon"><DeskIcon name={selected.icon} /></div><div><span className="desk-eyebrow">{active === 'projects' ? 'LUMEN WORKSPACES' : 'LUMEN DESK'}</span><h2 id="desk-workspace-title">{selected.title}</h2><p>{selected.description}</p></div><button ref={closeRef} type="button" className="desk-close" onClick={onClose} aria-label="Close desk">×</button></header>
      <nav className="desk-panel-tabs" aria-label="Desk tools">{DESK_ACTIONS.map(item => <button type="button" key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => setActive(item.id)} aria-label={item.title} title={item.title} aria-current={active === item.id ? 'page' : undefined}><DeskIcon name={item.icon} /><span>{item.title}</span></button>)}</nav>
      <div className="desk-workspace-content">
        {!['projects', 'watches'].includes(active) && <div className="desk-context-picker"><DeskIcon name="projects" /><label>Work context<select aria-label="Project for this mission" value={currentProjectId || ''} onChange={event => onProjectChange(event.target.value || null)}><option value="">Personal workspace</option>{projects.filter(project => !project.archived).map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><span>Instructions and files follow the selected project.</span></div>}
        <ErrorNotice error={projectError} />
        {['day', 'decision', 'verify'].includes(active) && <MissionForm kind={active} messages={messages} projectId={currentProjectId} onRun={onRun} />}
        {active === 'watches' && <WatchesPanel />}
        {active === 'projects' && <ProjectsPanel projects={projects} projectsLoading={projectsLoading} refreshProjects={refreshProjects} currentProjectId={currentProjectId} onProjectChange={onProjectChange} messages={messages} onOpenMission={onOpenMission} />}
      </div>
    </section>
  </div>;
}
