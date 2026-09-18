# EWPros v3.1.2 — CRM Workflow & Project Archive Update

## CRM
- Added **Next Action** immediately after Stage.
- Added **Due Date** immediately after Next Action.
- Replaced the Address column with **Notes**.
- Next Action and Due Date are driven by the customer's earliest open CRM reminder. Completing or deleting the reminder advances the list to the next open follow-up.

## Projects
- Added a **Due date** field to project creation, including the quick project form inside CRM.
- Active projects are sorted by due date ascending: the project due first appears at the top; projects without due dates appear last.
- Added **Active projects**, **Archived projects**, and **All projects** views.
- Non-completed projects can be marked **Complete**.
- Completed projects can be **Archived**.
- Archived projects can be **Restored** to the completed-project list.
- Existing safe Delete behavior remains available.

## Accounting
The following sections now collapse/expand:
- Record income or expense
- Record invoice payment
- Accounting categories

## Banking
The following sections now collapse/expand:
- Transaction review queue
- Transaction rules
- Bank import audit trail

## Audit Tools
- Audit Tools is now one collapsible navigation group.
- It contains Audit Workspace, Legacy Asana Import, Appointments, Import History, Auditor app, and **StrikeCheck CRM**.
- StrikeCheck CRM opens `https://del57.netlify.app/` in a new tab.

## Database
No new Supabase migration is required for v3.1.2. It uses the existing reminder, project `end_date`, and project `status` fields already present in v3.1.x.
