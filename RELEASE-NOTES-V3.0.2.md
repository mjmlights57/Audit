# EWPros Integrated Business System v3.0.2

## Stabilization release

This release keeps the existing Auditor Wizard, utility workbooks, invoice/archive tools, Supabase data model, and business modules while fixing the banking/admin form errors and adding safe record-removal controls.

### Fixed
- Fixed `Cannot read properties of null (reading 'reset')` after creating bank accounts, transaction rules, customers, projects, vendors, workers, mileage, and other async forms.
- Fixed bank statement preview error: `Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'`.
- Bank CSV/OFX/QFX preview now completes before enabling **Import transactions**.
- Fixed the same async form-reference issue in the worker timesheet portal.

### Delete / void / archive controls
- Bank accounts: delete when unused; otherwise deactivate.
- Bank statement imports: **Undo import** by batch.
- Imported bank transactions: delete pending/ignored rows; void posted rows and their journal effect.
- Transaction rules: delete.
- Manual accounting transactions: void.
- Vendors: delete when unused; otherwise deactivate.
- Customers: delete when unused; otherwise archive/deactivate.
- Projects: delete when unused; otherwise archive.
- Workers: delete when unused; otherwise deactivate and disable timesheet access.
- Timesheet entries: delete unless marked paid.
- Worker payment records: delete.
- Mileage trips: delete.
- Customer notes and reminders: delete.
- Invoices: void when they have no recorded payments.

### Accounting categories
Added standard categories:
- Rent / Lease
- Utilities (Office/Shop)
- Office Supplies
- Tools & Small Equipment
- Vehicle Maintenance
- Vehicle Insurance
- Parking & Tolls
- Licenses & Permits
- Training & Certifications
- Safety / PPE
- Shipping & Postage
- Business Meals
- Taxes & Filing Fees
- Interest Expense

The Accounting page now also includes **Accounting Categories**, where the administrator can add custom Income or Expense categories and delete/disable them safely.

### Database migration
Run `EWPROS-V3.0.2-MIGRATION.sql` once before deploying the v3.0.2 code. It is additive and does not drop customer, appointment, invoice, banking, or accounting tables.

### Validation
`npm run check` passes with 43/43 automated tests.

### CRM architecture
This stabilization release does not yet reverse the current appointment-to-CRM synchronization. The planned v3.1 step is to make CRM the master customer source and schedule/assign Auditor App appointments from CRM after v3.0.2 is proven stable in production.
