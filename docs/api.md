# OnTyme API surface

All API routes are under `/api/v1`, use the authenticated session cookie, and return `{ data, meta }` on success or `{ error: { code, message } }` on failure.

## Authentication

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/change-password`
- `GET|PATCH /auth/profile`
- `POST /auth/avatar`
- `GET /me`

## Workforce and organization

- `GET|POST /employees`
- `PATCH /employees/:id`
- `GET|POST /groups`
- `GET|POST /devices`
- `PATCH /devices/:id`
- `POST /device-mappings`
- `GET|POST /schedules`
- `PATCH /schedules/:id`
- `POST /schedule-assignments`
- `GET|POST /holidays`
- `PATCH|DELETE /holidays/:id`
- `GET|POST /leave-types`
- `PATCH /leave-types/:id`
- `GET|POST /leave-balances`
- `GET|POST /workflows`

## Attendance and requests

- `GET /attendance`
- `POST /self-attendance` — authenticated employee check-in/check-out with optional location metadata
- `GET|PATCH /self-attendance/settings` — administrator-managed optional geofence
- `POST /imports`
- `GET|POST /requests`
- `GET|POST /approvals`
- `GET /dashboard`
- `GET /notifications`
- `POST /attachments`
- `GET /attachments/:id`

## Reports and administration

- `GET /reports/attendance` — JSON by default, or `format=csv|xlsx`
- `GET /report-exports`
- `GET /report-exports/:id`
- `GET|POST /saved-filters`
- `DELETE /saved-filters/:id`
- `GET /audit-logs`
- `POST /device-sync` — canonical hardware/device event ingestion using `x-device-sync-token`
- `GET /integrations/payroll/attendance` — payroll-ready attendance CSV
- `POST /jobs/attendance` — protected scheduled attendance recalculation using `CRON_SECRET`
- `POST /jobs/reminders` — protected daily pending-request reminder job
- `POST /jobs/reports` — protected scheduled attendance export job
- `POST /jobs/import` — protected scheduled canonical device-event import job

Optional outbound integrations:

- `NOTIFICATION_WEBHOOK_URL` receives `notification.created` events.
- `NOTIFICATION_WEBHOOK_SECRET` is sent as a bearer token when configured.
- `DEVICE_SYNC_TOKEN` authorizes vendor-neutral device event ingestion.
- `CRON_SECRET` authorizes scheduled recalculation jobs.

All organization-scoped endpoints enforce company isolation and role/team scope on the server.

Notification debugging:

- `POST /notifications/test-delivery` is administrator-only and accepts `attempts` from 1 to 5.
- Failed delivery responses include the provider HTTP status, truncated response body, or network error.
- Set `NOTIFICATION_DEBUG=true` temporarily to log the same diagnostic information server-side; disable it in production.

## Payroll and compensation

- `GET|POST /payroll/compensation` â€” versioned employee compensation profiles; overlapping effective periods are rejected.
- `GET|POST /payroll/rules` â€” versioned legal-rule sets with source references and checksums.
- `PATCH /payroll/rules/:id` â€” approve or retire a rule set.
- `GET|POST /payroll/periods` â€” create and list Persian-calendar payroll periods; creation requires an approved rule set for the same year.
- `GET|PATCH /payroll/periods/:id` â€” inspect a payroll snapshot or move it through its controlled lifecycle.
- `POST /payroll/periods/:id/calculate` â€” calculate from attendance, compensation, and the snapshotted rule set.
- `GET /payroll/payments` â€” list payment records for reconciliation.
- `PATCH /payroll/payments/:id` â€” submit, confirm, fail, or reverse a payment; a paid amount must exactly match net payable.
- `GET|POST /payroll/adjustments` â€” add or review audited employee earnings/deductions before payroll is locked.
- `PATCH /payroll/compensation/:id` â€” archive an old compensation profile; historical payroll records remain unchanged.
- `POST /payroll/periods/:id/publish` â€” publish all finalized payslips in a period.
- `POST /payroll/runs/:id/publish` â€” publish one finalized payslip.
- `POST /payroll/runs/:id/acknowledge` â€” employee acknowledgement of a published payslip.
- `GET /payroll/runs/:id/print` â€” printable, browser PDF-save payslip view.

 - `GET /payroll/reports` — finalized payroll CSV with gross, deductions, net payable, payment status, and payment reference.

Payroll calculation refuses to run when required legal-rule values are missing. A finalized payroll is not silently recalculated, and every result is linked to the compensation profile, rule-set checksum, attendance inputs, and audit history that produced it.
File imports support automatic detection for canonical events, ZKTeco/FaraTechno raw exports, Suprema BioStar T&A exports, and daily first-in/last-out summaries. See [attendance import formats](attendance-import-formats.md).
