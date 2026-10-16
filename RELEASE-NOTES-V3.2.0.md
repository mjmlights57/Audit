# EWPros v3.2.0 Release Notes

## CRM
- New Customer now uses **Customer Notes & Requirements**.
- New Customer requires **EWP/MJM Customer**: EWPros or MJMLight.
- CRM stages are now: Prospects, Customers, Follow-up, Inactive.
- Customer detail keeps Customer Notes & Requirements read-only in the top information strip until Edit is opened.
- Overview shows only Latest Comment (the old notes editor was removed from Overview).
- Activity is simplified into Next Action Tasks and Comments.
- Next Action Tasks use checkboxes; completed tasks are visually darkened/struck through and the next unchecked due task feeds the CRM Next Action / Due Date columns.
- CRM Notes cells remain ellipsized to prevent text bleeding.

## Proposals & invoices
- Customer drawer now has Proposal and Invoice actions.
- Proposal branding follows the customer's EWP/MJM selection.
- EWPros and MJMLight templates use their respective company information.
- Proposal number, customer name, property address and date are auto-filled.
- Scope, terms and itemized line items are editable and support copy/paste.
- Proposals download directly as PDF.
- Invoices are generated from the latest saved proposal, remain editable, are saved into EWPros invoices, and download directly as PDF.

## Audit Tools
- Added **eSign** linking to https://ewpros.com/esign/index.php after StrikeCheck CRM.

## Notes page
- Added an editable Notes page containing the requested CRM usage guidance.
- Notes are stored in Supabase so they are shared across administrator devices.

## Database
Run `EWPROS-V3.2.0-MIGRATION.sql` once before deploying the code. It is additive and introduces customer branding/stages, proposal storage, proposal-to-invoice linkage and shared app notes.

## Validation
- `npm run check`: 82/82 tests passed.
- No `.env` file is included in the release package.
