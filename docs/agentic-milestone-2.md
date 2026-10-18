# Agentic milestone 2: persistent text missions

Implemented 17 October 2026. This slice carries ordinary text work from a request-scoped tool loop into a durable mission owned by the server. [Milestone 1](agentic-milestone-1.md) records the earlier planning-tool implementation; its statements about background work describe that earlier slice.

## What is implemented

An ordinary text request, including a request with explicitly shared page text or an approved page-building brief, creates a saved mission. The record contains the request, bounded conversation context, loaded provider/profile/memory context, completed tool calls, artifacts, and resumable checkpoints. The browser receives full mission snapshots and replaces the visible reply instead of appending duplicate text after reconnecting.

The transcript shows mission status, checkpoint and tool-call counts, tool activity, and controls:

| Action | Behavior |
| --- | --- |
| Pause / Stop / Escape | Ask the worker to stop the active attempt and save its recoverable checkpoint. Speculative model text can be discarded if its round was unfinished. Completed artifacts and tool results remain available. |
| Resume | Continue the same mission ID and saved checkpoint, retaining its total tool budget. Completed tool calls are reused. |
| Cancel mission | End the mission explicitly. Closing a browser stream alone does not cancel it. |
| Reconnect / recover | Read current state and reconnect to the existing server mission. A lost creation response is recovered with the same request ID and exact input. |
| Missions | List the owner's latest 20 missions and reopen one in the transcript. |
| Clear conversation | Disconnect the browser views and clear that account's local conversation. Saved missions continue and remain accessible through Missions. |

Checklist and schedule completion edits remain browser-local. Full server snapshots preserve edits already made to matching artifacts in the current conversation; they do not synchronize checkbox state between browsers. Generated speech plays once on completion of a newly initiated request, using Polly when available and browser speech as fallback. Reopening or reconnecting does not replay speech.

## Execution and recovery boundaries

Queued/running missions continue while the browser is closed or its event stream is disconnected. A server restart recovers queued records and marks interrupted running work as paused with a visible recovery reason. The user can resume it. Persistence provides checkpoints, not continuous execution while the server is stopped.

The runner saves tool-call intent and completed results before continuing. It reuses a completed call when resuming rather than repeating it to reconstruct history. Currently registered tools read public data or create local artifacts; this slice adds no email sending, calendar writes, purchases, or other external actions. A call whose outcome is uncertain is not blindly replayed. Future tools that change external systems will need their own idempotency and approval rules.

Images, PDF attachments, screen snapshots, and approved research workflows remain request-scoped. They use their existing cancellation behavior and do not gain durable background execution in this slice. Recurring schedules, automatic mission wakeups, external connectors, project memory, and a linked graph of editable artifacts remain future work.

## Ownership and idempotent creation

Signed-in runs are scoped to the server-verified account owner. Guests use a random server-issued HttpOnly owner cookie with a 30-day lifetime. A dedicated cookie-only bootstrap request finishes before creation, so losing the creation response does not also lose the only copy of a newly assigned guest identity. The client then creates a mission with a UUID request ID. Repeating the same owner/request ID/input returns that mission; changing the input for the same ID is rejected.

The cookie is never read by frontend JavaScript. Mission reads, event streams, and controls include credentials and enforce ownership on the server. Account changes disconnect the previous views. Guest missions do not automatically migrate to a signed-in account, and losing the guest cookie loses that browser's access to its guest missions. Clearing the conversation is not a server deletion mechanism; a mission deletion/retention UI is not included in this slice.

## Private storage and production setup

The default store is `.lumen-data/missions` under the server directory. `LUMEN_MISSION_STORE_DIR` selects another directory. Each mission is committed as a JSON record using a temporary file and atomic rename. The directory is private application data, not frontend content.

Records can contain request text, bounded prior messages, shared-page text, loaded profile/memory context, provider context, tool results, and generated artifacts. The browser saves the exact pending request until creation is confirmed so recovery can use identical input. Consequently, stopping tab sharing or clearing the chat does not erase the page context already stored with a server mission. Profile/memory deletion also does not retroactively redact older mission contexts.

Production requires a private persistent volume and one server process per mission directory. The JSON store does not coordinate multiple replicas or workers. Ephemeral deployment storage loses records on redeploy. Keep the directory outside served assets, exclude it from Git, restrict filesystem access, and apply appropriate private backup and retention policies. Retention/deletion administration remains an operator responsibility in this slice.

Example server configuration:

```dotenv
LUMEN_MISSION_STORE_DIR=/var/data/lumen/missions
```

| Limit | Default behavior |
| --- | --- |
| Saved records | 100 per owner; new records are rejected at the cap rather than silently deleting old work. |
| Stored record size | 8 MiB per mission. |
| Input size | 512 KiB per mission request. |
| Active attempt | 120 seconds per initial attempt/resume; timeout pauses recoverable work. |
| Total tool budget | Six rounds and twelve tool calls across the mission, including resumes, followed by a final answer attempt. |
| Worker concurrency | Two active missions globally, one per owner. Remaining missions queue. |
| Guest ownership | HttpOnly cookie, 30-day lifetime. |

Existing hourly request quotas remain server-local and reset on restart. They are separate from the persisted per-mission tool budget.

## Validation

The integrated suite passes all 257 tests. The production frontend build passes with the existing warning about a JavaScript bundle larger than 500 kB.

Run the automated checks with:

```sh
npm test
npm run build
```

Tests cover checkpoint validation and recovery, tool-result reuse, owner isolation, idempotent creation, storage failures and caps, pause/resume/cancel, provider message history, credentialed event streams, disconnect handling, snapshot replacement, artifact-edit preservation, cookie bootstrap, and browser-history restoration. HTTP integration tests use the real Express router, store, manager and checkpoint runner with deterministic model/tool responses, including an observer disconnect and a pause after a completed tool.

Live local browser checks exercised the configured Bedrock path: one mission produced a checklist, an exact EUR 300 budget, and a dated Vienna schedule through three real tool calls. A second mission was paused with Escape, reloaded, reopened from Missions, resumed using the same mission ID, and reloaded during execution. It completed with the computed result 703 and one checklist. A checkbox edit survived another reload and server snapshot refresh. Restart and uncertain-tool recovery are covered by automated tests; this check does not establish behavior for every provider or production deployment.

Integration review also corrected PDF intent detection, artifact titles accidentally entering the website flow, and Always Web behavior. Forced web lookup now uses the same checkpointed tool runner and retained budget as other tools. The HTML app shell revalidates its cache entry so rebuilt frontend controls become available after reload.

The accompanying header redesign groups Transcript/Missions navigation, quick preferences, and account/settings controls. It uses a two-row phone layout with measured 44-pixel touch targets. Browser checks confirmed control containment in phone and desktop layouts, reachable Settings/Aura popovers, hidden desktop shortcuts on phones, and floating Persona/weather cards kept below the header. Saved drag offsets and menu positions adjust after resizing. Screenshots from verification are in the ignored `scratch/lumen-header-desktop.jpg` and `scratch/lumen-header-mobile.jpg` files.

Suggested acceptance flow:

1. Ask for a calculated budget, checklist, and dated schedule in one text request. Confirm real tool activity and linked outputs in one mission.
2. Pause while work is active, reload, and resume the same mission. Confirm completed tool outputs remain and are not executed again.
3. Close the tab while work is running. Reopen **Missions** and inspect the saved result.
4. Restart the server during an unfinished run. Confirm the mission reappears paused with a recovery reason and can resume.
5. Disconnect the event stream and reconnect. Confirm output is replaced without duplicated text or a second mission.
6. Clear the conversation, then reopen its saved mission. Confirm clearing did not cancel the server work.
