# EWPros v3.1.1 — Minimal CRM Interface

## Purpose

v3.1.1 keeps the CRM-centered data model from v3.1.0 and redesigns only the CRM experience to be simpler, cleaner, and easier to navigate.

## CRM changes

- Replaced the stacked CRM forms/cards with one clean customer list.
- Added a compact toolbar: Search, Stage, Business Line, Import, Export, and New Customer.
- New-customer and customer-import workflows open only when requested.
- Clicking a customer opens a right-side detail drawer inspired by modern task/CRM tools.
- Customer detail is organized into four tabs: Overview, Appointments, Projects, and Activity.
- Quick actions at the top of the customer drawer: Schedule, New Project, and Edit.
- Delete/Archive remains available inside Edit so destructive actions are not visually dominant.
- Notes, reminders, invoices, transactions, and appointment history remain available without crowding the main customer list.
- Both `/admin.html` and `/admin/` use the same CRM layout.

## Data and backend

No schema changes were introduced in v3.1.1. All v3.1.0 CRM, appointment, Auditor Wizard, import/export, project, and accounting behavior remains in place.

## Validation

62 automated regression tests pass, including the new minimal-CRM layout tests.
