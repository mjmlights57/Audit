# EWPros v3.2.1 Release Notes

## CRM ordering and inactive-stage behavior
- The main CRM list now sorts automatically by the next due date, with overdue/earliest due work first and rows with no due date last.
- Customer project lists and the Projects workspace continue to sort active projects by project due date.
- `All Stages` no longer shows customers in the `Inactive` stage. Choose `Inactive` explicitly to view them.

## Activity usability and task assignment
- The Next Action Task and Comments cards now use stronger blue borders and a light blue header treatment.
- Next Action Tasks can be assigned to an active Team member when created.
- Existing tasks can be reassigned from the task row.
- The main CRM toolbar now includes an `Assigned To` filter. It filters customers by assignees on their open Next Action Tasks.
- The current next-action assignee is shown under the task on the CRM list.

## Utility Programs customer fields
- New Customer changes `Contact name` to `Title` in the CRM UI while preserving the existing stored field for compatibility.
- When `Utility Programs` is selected as the Primary business line, three extra fields appear: Utility, Account #, and Business Type.
- These fields are also available in Edit Customer when the customer belongs to Utility Programs.
- CRM CSV export/import supports the three new optional utility fields.

## Customer Documents
- Customer detail now has a fifth `Documents` tab beside Appointments.
- Documents are stored as links to files already kept in Google Drive, Dropbox, OneDrive, or another online storage service.
- Administrators can add a document name, storage provider, share URL, and optional note, then open or remove the CRM link later.
- Removing the CRM link does not delete the original file from the external storage provider.

## Database and deployment
- Adds `EWPROS-V3.2.1-MIGRATION.sql` for the new customer utility fields, task assignee field, and customer document-link table.
- The package includes the corrected v3.2.0 migration from the previous hotfix.
- Database setup errors now identify the specific migration file when v3.2.1 database objects are missing.
- Administrator assets are cache-busted to v3.2.1.
