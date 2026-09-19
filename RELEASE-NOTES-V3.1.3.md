# EWPros v3.1.3 — Permanent Deletion from Archived Projects

Based on v3.1.2. All previous modules, navigation, sorting, and archive/restore behavior remain unchanged.

## Change
- Under **Projects → Archived projects**, each project now has **Restore** and **Permanently delete**.
- **Permanently delete** requires typing `DELETE` in the confirmation dialog.
- The admin API uses a Supabase database function to remove the archived project and its project-specific appointments, reminders, invoices and invoice lines, payments, manually entered and project-linked financial transactions and their journals, worker payments, timesheets, and mileage trips. Project-worker relationships are removed by the existing foreign key.
- The deletion is a **single database transaction**. If any operation fails, the project and its entries are not partially removed.
- Its underlying master customer, other projects, employees, vendors, bank accounts, and business-line records are not deleted.
- **Original imported bank-statement rows stay in Banking**. Any affected previously posted bank rows are unlinked from this project and returned to the review queue because real bank statement history must not be erased by deleting an internal project. Re-review/repost those rows as needed.
- Historical financial reports can change after permanently deleting a project with recorded income/expenses. This is irreversible; back up Supabase first. Legacy records kept in external systems or browsers are not remotely deleted.
- Both `/admin.html` and `/admin/` load `business.js?v=3.1.3` to avoid retaining an older cached archive view.

## Database
Run `EWPROS-V3.1.3-MIGRATION.sql` in the existing Supabase project **before** deploying v3.1.3 code. The migration creates one server-only function, not a data purge; no projects are deleted simply by running the migration. A project is permanently removed only after you use its new button and confirm.
