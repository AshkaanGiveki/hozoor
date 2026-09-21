# OnTyme implementation backlog

This backlog tracks the product capabilities being implemented in priority order.

## P0 — workforce operations foundation

- [x] Complete leave balances and leave-ledger enforcement
- [x] Implement configurable multi-step approval workflows
- [x] Complete employee lifecycle administration
- [x] Add work schedules, shifts, and schedule assignments
- [x] Add holiday/calendar administration

## P1 — operational control and reporting

- [x] Complete attendance-device management and employee mappings
- [x] Expand reports and add payroll-ready CSV/XLSX exports
- [x] Add audit-log administration and search
- [x] Complete attachment support for requests
- [x] Add saved report filters API
- [x] Add report export history

## P2 — communication and integrations

- [x] Add provider-neutral notification webhook integration point
- [ ] Add email/SMS delivery adapters
- [x] Add automated device synchronization hook
- [x] Add payroll-ready integration export interface
- [ ] Add target-specific payroll/HR adapters and outbound webhooks
- [x] Add public API documentation

## P3 — mobile and advanced operations

- [x] Add mobile/self-service attendance with optional location metadata
- [x] Add configurable geofencing/privacy controls for self-service attendance
- [x] Add richer analytics and management dashboards
- [x] Add protected scheduled attendance recalculation job
- [x] Add scheduled canonical device imports
- [x] Add scheduled report job

## Verification standard

Each item must include server-side authorization, validation, UI coverage where applicable, automated tests for domain rules, and a clean typecheck/build before it is marked complete.

## Payroll implementation backlog

## P0 â€” payroll integrity and scope

- [x] Define the payroll source-of-truth model: one employee, one compensation record, one payroll result, one payslip, and one payment record.
- [x] Prohibit shadow salaries, duplicate salary bases, silent overwrites, and reports that differ from the actual payment.
- [x] Document earned compensation, deductions, net payable, paid amount, and employer cost.
- [ ] Define the supported Iranian employment/payroll scope and explicitly mark unsupported cases.
- [ ] Obtain and version the official annual Labour, Tax Administration, and Social Security rules before enabling production payroll.
- [ ] Define the legal review and annual rule-update process.

## P0 â€” employee compensation and contracts

- [x] Add compensation profiles with effective dates and full change history.
- [x] Support base salary, daily/hourly rate, allowances, bonuses, commissions, overtime rate, benefits, loans, advances, and deductions.
- [ ] Store contract type, dates, department, position, insurance status, tax status, and payroll identifier.
- [x] Prevent overlapping or ambiguous compensation periods.
- [x] Require authorization and an audit reason for every compensation change.
- [x] Add restricted employee bank/payment details with change history.
- [ ] Validate that actual compensation satisfies applicable minimum legal requirements.

## P0 â€” legal calculation engine

- [x] Create versioned annual legal rule tables; never hard-code yearly values in UI code.
- [ ] Calculate ordinary wages, overtime, night work, Friday/holiday work, leave, absence, lateness, and early departure from actual source data.
- [ ] Calculate taxable bases, tax exemptions/brackets, employee insurance, employer insurance, ceilings, and required deductions.
- [ ] Calculate annual benefits, seniority-related amounts, end-of-service/severance accruals, and final settlement items where in scope.
- [ ] Calculate official holidays from a versioned Persian-calendar holiday table.
- [x] Show the exact rule version and formula behind every calculated amount.
- [x] Add warnings instead of silently guessing when a legal rule or employee input is missing.

## P0 â€” payroll periods and calculation workflow

- [x] Add payroll periods with Persian-calendar dates and a clear lifecycle: draft, calculated, review, approved, paid, locked, reversed, corrected.
- [x] Snapshot attendance, leave, compensation, legal rules, and company policy when a payroll run is calculated.
- [x] Make recalculation explicit and auditable.
- [x] Prevent source-data changes from silently changing approved or paid payroll.
- [x] Add maker-checker approval for payroll finalization.
- [x] Add controlled correction and reversal workflows instead of editing locked payroll.
- [x] Reconcile every paid payroll result with a payment batch and payment reference.

## P0 â€” transparent payslips and employee access

- [x] Generate one detailed payslip per employee per payroll period.
- [x] Show attendance, overtime, leave, allowances, bonuses, gross compensation, every deduction, net payable, and payment date.
- [x] Show taxable and insurable bases separately only when legally required, with explanations and rule references.
- [x] Show employer-side costs separately, never as employee deductions.
- [x] Provide downloadable PDF and structured payslip data.
- [x] Allow employees to view only their own payslips and payment history.
- [x] Add payslip publication, acknowledgement, and correction-notification history.

## P1 â€” company compensation policy

- [ ] Add configurable policies for rounding, grace periods, overtime approval, bonuses, commissions, loans, advances, and payment dates.
- [x] Ensure company policies cannot override mandatory legal requirements.
- [x] Add policy effective dates, version history, assignments, precedence, and simulation before activation.
- [x] Warn when a policy produces unlawful or inconsistent results.

## P1 â€” payroll review, reports, and exports

- [x] Add payroll dashboard with gross, deductions, net payable, employer cost, exceptions, and approval status.
- [x] Add employee calculation drill-down and formula explanations.
- [x] Add department/cost-center summaries and payroll register.
- [x] Add tax, insurance, bank-payment, accounting, and payroll exports from the finalized payroll snapshot.
- [x] Add schema versioning, export history, checksums, permissions, and duplicate-submission protection.
- [ ] Add reconciliation: calculated net, exported net, paid net, and unmatched records.

## P1 â€” security, privacy, and audit

- [ ] Restrict payroll access by role, organization, department, and employee scope.
- [ ] Protect bank details and sensitive compensation data.
- [ ] Audit every view, create, change, approval, export, payment, reversal, and download.
- [ ] Add immutable payroll snapshots and tamper-evident audit records.
- [ ] Separate compensation editing, payroll approval, and payment confirmation duties.
- [ ] Preserve legally required payroll evidence through retention and archival policies.

## P1 â€” testing and legal safety

- [ ] Add deterministic unit tests for every payroll formula and rounding rule.
- [ ] Add boundary tests for minimum wage, tax thresholds, insurance ceilings, month lengths, leap years, holidays, and partial employment.
- [ ] Add regression fixtures for each supported annual legal-rule version.
- [ ] Add end-to-end tests from attendance through payslip, export, payment, and reconciliation.
- [ ] Add authorization tests for payroll privacy and mutation rights.
- [ ] Require independent legal/accounting review before production activation.
- [ ] Require clean typecheck, build, tests, and migration validation for each payroll release.

## P2 â€” external integrations

- [ ] Add a provider-neutral payroll integration interface.
- [ ] Add target-specific adapters only after the target systemâ€™s API/schema and authentication method are known.
- [ ] Add tax, insurance, accounting, and bank integrations only with verified official/provider documentation.
- [ ] Add idempotency, retries, failure queues, response storage, and integration audit history.
- [ ] Never mark an external submission successful until the provider confirms it.

## Payroll launch gates

- [ ] No production payroll until the supported legal scope and annual rule tables are approved.
- [ ] No report may use a different salary source from the payment calculation.
- [ ] No finalized payroll may be silently changed.
- [ ] Every employee-facing amount must be explainable from stored source data and a versioned formula.
- [ ] Every exported or submitted amount must trace back to the finalized payroll snapshot.

## External inputs still required

- Notification delivery needs the chosen email/SMS provider and credentials.
- Automated hardware synchronization needs the device vendor/protocol or a scheduled export endpoint.
- Payroll/HR integration needs the target system’s API/schema and authentication method.
- Mobile location controls need the organization’s privacy/geofencing policy.
