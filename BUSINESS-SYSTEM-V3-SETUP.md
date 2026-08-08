# EWPros Integrated Business System v3.0 — Setup & Operating Guide

Version 3.0 expands the existing EWPros Auditor application without replacing the field-audit workflow. The auditor PWA remains at `/`, the administrator system remains at `/admin/`, and a worker-only timesheet portal is available at `/time/`.

## What v3.0 adds

- CRM with leads/customers, customer history, projects, invoices, transactions, notes, and follow-up reminders.
- Five EWPros business lines with line-level and consolidated reporting:
  - StrikeCheck Inspections
  - StrikeCheck Referrals
  - Utility Programs
  - EWPros Electrical
  - EWPros Renovation
- Banking statement import for CSV, OFX, and QFX.
- Duplicate prevention using account + bank transaction ID when available, otherwise a stable transaction fingerprint.
- Review-before-posting bank workflow and import audit trail.
- Keyword transaction rules, including the requested Callture, ReceptionHQ, YMCA, and ACTIVE CASH VISA starter rules.
- Income, expenses, owner contributions/draws, transfers, credit-card payments, vendor payments, and customer payments.
- Double-entry journal behind posted financial transactions.
- W-2 and 1099 worker profiles, timesheets, approvals, worker payments, and payroll-ready hours.
- Separate worker timesheet portal with email + worker PIN access.
- Project management and period/project profitability.
- Mileage tracking with project/customer/business-line attribution.
- Dashboard and financial/management reports.
- Existing invoice worksheet can be synchronized into the shared CRM/accounting database.

## Before deployment

1. Make a Supabase database backup or export of the existing `appointments` and `import_batches` tables.
2. Keep the current Netlify environment variables. Version 3.0 does **not** require a new secret or bank-integration credential.
3. Open Supabase **SQL Editor**.
4. Run the complete `EWPROS-BUSINESS-SYSTEM-SCHEMA.sql` file once.
5. Confirm the script finishes without an error.

The migration is additive. It does not delete or rename the existing auditor tables. It creates the new business-management tables and then synchronizes existing appointment/customer data into the CRM. Future appointment imports continue to update the CRM automatically through a database trigger.

## Deploy the application

1. Replace the repository files with the v3.0 package contents.
2. Commit/push the changes to GitHub.
3. In Netlify, run **Deploys → Trigger deploy → Clear cache and deploy site**.
4. Sign into `/admin/` using the existing administrator password.
5. Verify the **Business Dashboard** opens without a “schema not installed” message.
6. On an iPad using the existing PWA, close/reopen the app. If an old cached release remains, remove the Home Screen PWA and reinstall it from Safari.

## First-time financial setup

Do these in this order:

1. Open **Banking** and create each real EWPros bank or credit-card account. Enter a correct opening balance and opening-balance date.
2. Review the five business lines already created by the migration.
3. Open **CRM** and verify migrated customers.
4. Create or update projects and make sure each project has the correct customer and business line.
5. Add vendors under **Accounting**.
6. Add employees/contractors under **Team & Timesheets**. Give each worker a unique email and a 4–10 digit Timesheet PIN if the worker will use `/time/`.
7. Review **Transaction Rules** under Banking. The starter rules can be edited or disabled.
8. Import a small bank statement first, preview it, review the duplicate/rule results, and then confirm the import.

## Weekly bank workflow

1. Download the statement activity from the bank as CSV, OFX, or QFX.
2. Open **Banking** and choose the account.
3. Upload the file and select **Preview**.
4. Review total rows, new rows, duplicates, and rule matches.
5. Confirm the import. Duplicate rows are not re-added.
6. Review pending transactions.
7. Confirm category, business line, customer/project/vendor when relevant, and the other account for a transfer or credit-card payment.
8. Post the transaction or mark it ignored.

Each confirmed import receives an import-batch record. Each imported transaction retains its source batch, original description, rule match, review status, and review timestamp.

## Accounting behavior in this release

The operational bookkeeping workflow is intentionally **cash-basis**: income is recognized when received and expenses when paid/charged. Open invoices are tracked separately as outstanding receivables on the dashboard and invoice screens, but an unsatisfied invoice is not automatically recognized as ledger revenue/Accounts Receivable.

Posted transactions create balanced journal entries. Owner draws are posted to equity and are marked personal, so they do not reduce business P&L. Transfers and credit-card payments move balance-sheet accounts and do not create revenue/expense.

If EWPros later needs accrual-basis books, the invoice tables and Accounts Receivable ledger are already present; an invoice-posting/AR workflow can be added without redesigning the CRM, projects, or journal.

## Transaction rules

A rule may contain one or multiple keywords and can use **Any keyword** or **All keywords** matching. Matching is case-insensitive. Rules can assign a category and optionally a business line/customer/project. Rules run after each bank file is parsed; the administrator still reviews the transaction before posting.

Starter rules:

| Keyword | Category |
| --- | --- |
| Callture | Telephone Services |
| ReceptionHQ | Office Services |
| YMCA | Owner's Draw (Personal) |
| ACTIVE CASH VISA | Credit Card Payment |

## Worker timesheets

Administrators can enter time in `/admin/`. Workers can use `/time/` without access to the admin/accounting system.

- Worker signs in with the email and PIN stored on the worker profile.
- Worker enters date, project, regular hours, overtime, and notes.
- Project selection automatically controls the business line.
- Submitted time appears in **Team & Timesheets** for administrator approval.
- Approved/paid time contributes labor cost to project and customer profitability.

Worker payment records are tracked separately from timesheet labor cost so that paying someone does not double-count project labor expense in project-cost reports.

## Reports

The Reports module supports a date range and optional business-line filter. It includes:

- Profit & Loss
- Balance Sheet
- Cash Flow
- Income by business line
- Expense by category
- Vendor spending
- Customer profitability
- Project profitability
- Revenue by income stream
- Monthly comparison
- Yearly comparison

The Balance Sheet includes a calculated **Current Earnings** equity line because this lightweight ledger does not require a formal month-end/year-end closing entry before each report.

## Direct bank connections

A direct bank/OAuth connection is **not enabled in v3.0**. The weekly CSV/OFX/QFX importer was implemented as the safer, simpler deployment path and does not require EWPros to store online-banking credentials. A provider such as Plaid can be connected later to feed the same `bank_transactions` review/posting workflow without redesigning accounting.

## Important operating controls

- Do not post a bank row until its category and business line are correct.
- For a transfer, select the other EWPros financial account.
- For a credit-card payment, select the related bank/card account whenever possible so account balances stay traceable.
- Reconcile imported statement activity to the bank at least monthly.
- Back up/export financial data before making structural database changes.
- Have the final chart of accounts, tax treatment, and year-end reports reviewed by the company's bookkeeper/CPA before filing tax returns.
