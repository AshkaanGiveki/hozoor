# Payroll legal scope and activation gate

OnTyme’s payroll engine is designed for transparent Iranian payroll records, but it must not be treated as a legal authority. A company must load and approve the applicable annual rules from official sources before production calculation.

## Current supported scope

- One company, one employee compensation profile effective for the payroll period, one calculated payroll run, one payslip, and one payment record.
- Monetary values stored as integer Iranian rials and rounded through the stored company-policy setting.
- Configurable annual rule inputs for working time, overtime multiplier, tax rate or brackets, employee/employer insurance rates, insurance ceiling, exemptions, and minimum monthly salary.
- Attendance-derived worked time, approved overtime, leave, absence, lateness, early departure, allowances, bonuses, commissions, benefits, loan/advance repayments, deductions, and payment reconciliation when the source data and rules are present.
- Versioned rule sets with checksums, source references, snapshots, formula/source data, review approval, correction revisions, and reversal reasons.

## Explicitly unsupported until implemented and legally reviewed

- Any annual Labour, Tax Administration, or Social Security rates that have not been entered from a verified official publication.
- Automatic official Persian-calendar holiday rules, night-work rules, Friday/holiday premiums, annual benefits, seniority benefits, severance/final settlement, and official tax/insurance submission formats.
- Legal interpretation for special employment categories, exemptions, disputed attendance, commissions, or benefits without an approved rule definition.
- Automatic submission to government, bank, accounting, HR, or payroll systems without verified provider documentation and credentials.

## Approval and annual update process

1. Obtain the current official publications and record the issuing authority, publication identifier, effective dates, and retrieval date in `sourceReference` and the rule-set audit trail.
2. Enter the values as a new versioned draft. Never edit an approved rule set in place.
3. Run deterministic fixtures and boundary tests for the rule version.
4. Have an authorized payroll/accounting reviewer validate the values and approve the rule set. The API rejects approval without a source reference or complete required values.
5. Create a new rule version for every annual change, calculate only periods that reference that version, and retain the old version for historical reproducibility.
6. Obtain independent legal/accounting review before enabling production payroll for a new jurisdictional scope.

Production calculation and payment are also protected by a deployment gate. Production requires both `PAYROLL_PRODUCTION_ENABLED=true` and a non-empty `PAYROLL_LEGAL_APPROVAL_REFERENCE`. The reference should identify the independent legal/accounting approval or release record; without both values, calculation and payment APIs return a production-gate error.
