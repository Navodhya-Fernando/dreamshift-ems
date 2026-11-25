# DreamShift EMS 2.0 — release setup and acceptance checks

## Existing application
Master remains the deployment branch. Preserve the existing environment variables, MongoDB data and authentication. New collections are additive. MongoDB must support transactions (replica set / Atlas); standalone MongoDB will not support the new timer and timesheet mutations. Back up before deploying. No production database migration or seed is required.

## Configure Google integrations
See GOOGLE_CALENDAR.md. Enable Calendar API and, for the optional task-list integration, Tasks API. Set server-only GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI, GOOGLE_CALENDAR_TOKEN_KEY. Generate the latter with openssl rand -base64 32. Each employee explicitly authorizes a Google account and chooses a dedicated work calendar or task list. Never put secrets in NEXT_PUBLIC variables or repository files.

## Configure device notifications
Run node scripts/generate-vapid.mjs and set the generated EMS_VAPID_PRIVATE_KEY and EMS_VAPID_SUBJECT in Vercel. Replace the example email with a real administrator contact. Preserve the VAPID key across deployments; changing it requires re-enrollment. The implementation uses RFC 8291 encrypted payloads and RFC 8292 VAPID, sends only generic lock-screen text, and accepts supported push service endpoints. Enroll each browser/device from Settings > Device notifications. Click Send test notification; an accepted provider response is not proof of device delivery. iOS requires an installed Home Screen web app and a supported OS/browser.

## Scheduler
The existing Vercel daily deadline job remains. It attempts bounded integration batches, but once-daily execution is not sufficient for near-real-time synchronization. On a commercially permitted Vercel plan configure frequent authenticated cron invocations for /api/cron/google-calendar, /api/cron/google-tasks and /api/cron/device-push, or reuse an existing Linux host and run scripts/sync-integrations.sh. Store EMS_BASE_URL and CRON_SECRET in a protected environment file, chmod 600, source that file from your own scheduler, and run every 1–5 minutes. The script uses flock to prevent overlapping executions. Actual sync latency depends on batches, provider quotas, connection count, and host scheduling. The calendar page also requests a stale background sync when enabled. No new paid messaging service is required; hosting and provider quotas still apply.

## Acceptance checklist (test environment first)
- Authenticate owner, employee and workspace manager; confirm admin routes reject ordinary employees and workspace-only managers.
- Find a project beyond the first five of a workspace; verify filtering and Cmd/Ctrl+K search.
- Preview a CSV, import twice with the same request ID, verify a single task per row; schedule a recurrence and verify generation and pause/resume.
- Start a timer on device A, pause/resume on device B, stop once and retry; verify one entry and one task total increment. Create/edit/delete a manual entry and verify totals.
- Install EMS on supported macOS, Windows/Linux, Android and iOS browsers. Test notification permission, a real device alert, click-through, and disable/remove.
- Connect a dedicated Google work calendar; import, export, change a single-assignee deadline in Google, and verify EMS update. Test simultaneous edits and deletion protection. Publish an organized meeting, confirm attendee invitation and Meet link.
- Link a dedicated Google Tasks list and a test project. Import a task, update due date/title/completion from each side, test retries and conflicting edits. Ensure shared tasks and unrelated private lists are excluded.
- Review Admin > System health for integration errors and timer counts. Check cron authorization and actual execution.
- Run npm test, npx tsc --noEmit and npm run build. A passing build is not a substitute for the above live provider/device checks.

## Known boundaries
Calendar writes only cover owned calendars, open explicitly assigned tasks and organizer-owned meetings in a bounded date window. No silent deletion or remote removal of EMS records. Google Tasks dates are date-only; shared assignments and custom workflow completion changes are protected. Google-only calendar events are private calendar entries, not automatically shared tasks. Project favourites remain local to a browser. Device alerts are best effort and are not a replacement for the in-app inbox. Workspace visibility remains shared as in the prior system; the role catalog is not a complete resource-level authorization redesign. Offline mutations are not supported. Semantic AI search and custom role editing are not included.
