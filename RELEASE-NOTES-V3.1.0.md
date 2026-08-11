# EWPros Integrated Business System v3.1.0

## CRM becomes the customer master

v3.1.0 changes EWPros from an appointment-centered customer flow to a CRM-centered flow. A customer is created/imported once in CRM and that same customer record is referenced by appointments, projects, invoices, transactions, mileage, and reports.

### CRM customer management
- Add and edit master customer records.
- Filter by stage and business line.
- Import customer CSV files with a preview before posting.
- Duplicate checks use email, then phone, then customer name + service address.
- Optional import mode updates matching customers using only nonblank imported values.
- Export all CRM customers to CSV, including inactive/archived records for backup.
- `CRM-CUSTOMER-IMPORT-TEMPLATE.csv` is included as a reusable template.

### CRM -> Appointments -> Auditor Wizard
- Schedule an appointment directly inside a customer record.
- Assign business line, project, date/time, utility, utility account, worker/auditor, service address and notes.
- `Show in Auditor Wizard` controls whether the appointment is sent to the field app; a worker/auditor must be assigned before that option can be used.
- CRM appointments reference the existing customer; they do not create duplicate CRM customers.
- Cancelling an appointment keeps it in customer history.
- New/changed appointments refresh the Administrator appointment view.
- Auditor Wizard wording is no longer Asana-specific.

### CRM -> Projects
- Create a project directly from the customer detail page.
- Project/customer/business-line relationships continue to feed accounting, profitability, invoices, mileage and time costing.

### Legacy Asana compatibility
- The existing Asana CSV importer remains available as **Legacy Asana Import**.
- The new v3.1 appointment linker first tries to connect imported appointments to an existing CRM customer.
- Matching order is prior legacy link, email, phone, then customer name + service address.
- Existing appointment/audit data is preserved.

### Database migration
Run `EWPROS-V3.1.0-MIGRATION.sql` once after the earlier v3 migrations. It adds CRM reference columns to the existing appointments table and replaces the old one-appointment/one-customer synchronization trigger. It does not delete current customer, appointment, project, invoice, banking or accounting data.

### Auditor assignment note
The current Auditor Wizard still uses the existing shared auditor login. Assignment is stored and displayed, but v3.1.0 does not yet create separate per-auditor application logins. That can be added later without changing the CRM/customer structure introduced here.
