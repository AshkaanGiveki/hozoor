# Payroll legal scope and activation gate

OnTyme’s payroll engine is designed for transparent Iranian payroll records, but it must not be treated as a legal authority. A company must load and approve the applicable annual rules from official sources before production calculation.

Primary legal sources supplied for this implementation are the [Iranian Labour Law](https://rc.majlis.ir/fa/law/show/99612) and the [Iranian Direct Taxation Act](https://rc.majlis.ir/fa/law/show/91488). These sources establish the legal baseline; annual wage, budget, tax, insurance, and administrative notices remain separately versioned inputs. The repository includes a draft `IR-1405` private-sector Labour Law/Social Security rules fixture in `src/server/iranian-payroll-law.ts`; it is not production-approved automatically.

## Current supported scope

- One company, one employee compensation profile effective for the payroll period, one calculated payroll run, one payslip, and one payment record.
- Monetary values stored as integer Iranian rials and rounded through the stored company-policy setting.
- Configurable annual rule inputs for working time, overtime multiplier, tax rate or brackets, employee/employer insurance rates, insurance ceiling, exemptions, and minimum monthly salary.
- IRR-first annual payroll values: 1405 minimum daily wage, 7× daily insurance ceiling, 7% employee insurance, 23% employer-side insurance, progressive annualized salary tax, seniority, housing, consumer, marriage, child, Eidi, and severance inputs.
- Employee tax categories, including the 1405 faculty/judge special-rate category, are represented separately from the ordinary progressive bracket table.
- Eidi and severance are calculated from actual final wage and service days; they are not confused with monthly seniority allowance.
- Attendance-derived worked time, approved overtime, leave, absence, lateness, early departure, allowances, bonuses, commissions, benefits, loan/advance repayments, deductions, and payment reconciliation when the source data and rules are present.
- Versioned rule sets with checksums, source references, snapshots, formula/source data, review approval, correction revisions, and reversal reasons.
- Baseline Labour Law constraints are validated for ordinary covered employment: article 51 working-time limits, article 53 night window, article 58 night premium, article 59 overtime premium, article 39 proportional part-time pay basis, and article 62 paid weekly rest. Annual values remain rule-set data.

## Explicitly unsupported until implemented and legally reviewed

- Any annual Labour, Tax Administration, or Social Security rates that have not been entered from a verified official publication.
- Annual salary-tax exemption amounts under Direct Taxation Act article 84 and annual wage/tax changes under the budget or subsequent official notices.
- The supplied 1405 values remain a draft fixture until the company attaches its official wage resolution, Social Security circular, budget/tax notice, and reviewer approvals.
- Automatic official Persian-calendar holiday rules, night-work rules, Friday/holiday premiums, annual benefits, seniority benefits, severance/final settlement, and official tax/insurance submission formats.
- Legal interpretation for special employment categories, exemptions, disputed attendance, commissions, or benefits without an approved rule definition.
- Automatic submission to government, bank, accounting, HR, or payroll systems without verified provider documentation and credentials.

## Approval and annual update process

1. Obtain the current official publications and record the issuing authority, publication identifier, effective dates, and retrieval date in `sourceReference` and the rule-set audit trail.
2. Enter the values as a new versioned draft. Never edit an approved rule set in place.
3. Run deterministic fixtures and boundary tests for the rule version.
4. Have an authorized accounting reviewer and a different legal reviewer validate the values in order. The API requires `DRAFT → ACCOUNTING_REVIEWED → LEGAL_REVIEWED → APPROVED`, rejects approval without a source reference or complete required values, and stores each reviewer identity.
5. Create a new rule version for every annual change, calculate only periods that reference that version, and retain the old version for historical reproducibility.
6. Obtain independent legal/accounting review before enabling production payroll for a new jurisdictional scope.

Production calculation and payment are also protected by a deployment gate. Production requires both `PAYROLL_PRODUCTION_ENABLED=true` and a non-empty `PAYROLL_LEGAL_APPROVAL_REFERENCE`. The reference should identify the independent legal/accounting approval or release record; without both values, calculation and payment APIs return a production-gate error.
