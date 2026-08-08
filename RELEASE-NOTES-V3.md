# EWPros v3.0 Release Notes

## New integrated business system

The existing EWPros Auditor PWA and audit/invoice workspace remain in place. Version 3.0 adds a shared Supabase-backed business layer for CRM, multi-business accounting, banking, projects, labor, mileage, and reporting.

### Added
- CRM and automatic migration/synchronization of existing appointment customer data.
- Five independent EWPros business lines plus consolidated company reporting.
- Financial accounts and dedicated ledger accounts per bank/credit-card account.
- CSV/OFX/QFX statement import, duplicate prevention, review queue, and import audit trail.
- Editable/disableable keyword transaction rules and requested starter rules.
- Double-entry journal for posted transactions.
- Owner contribution/draw, transfers, credit-card payment, vendor/customer payment handling.
- Projects linked to customer, business line, transactions, invoices, labor, and mileage.
- W-2/1099 worker profiles, timesheets, approvals, worker-payment tracking, and payroll-ready data.
- Worker self-service timesheet portal at `/time/` using email + assigned PIN.
- Mileage tracking and CSV mileage export.
- Dashboard, P&L, Balance Sheet, Cash Flow, business-line, category, vendor, customer, project, income-stream, monthly, and yearly reports.
- Invoice worksheet **Sync to CRM / Accounting** action.

### Preserved
- Existing auditor PWA and appointment synchronization.
- BGE/PEPCO T&C PDF workflows.
- Lighting/HVAC audit workflow.
- Existing invoice/workbook/archive behavior.
- Existing Netlify/Supabase/Resend environment variable names.

### Validation
- JavaScript syntax validation passes.
- 39 automated tests pass, including all prior auditor tests and new business-system/bank-import/worker-portal tests.

### Banking choice
Direct bank OAuth is not included in this release. Weekly CSV/OFX/QFX statement import is the implemented production path. Its database/import interface is designed so a bank-feed provider can be added later without replacing the accounting workflow.
