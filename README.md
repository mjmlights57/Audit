# EWPros Auditor Wizard 2.0

This project contains two connected interfaces:

- **Auditor PWA:** `/`
- **Administrator Dashboard:** `/admin/`

The administrator exports the Asana project as CSV, previews the changes, and imports customer appointments. Netlify Functions process the CSV and save appointments in Supabase. The auditor PWA retrieves all active appointments and lets the auditor choose the customer being visited.

## Current workflow

1. Export **(2) On-Going Projects (Customers)** from Asana as CSV.
2. Open `/admin/`.
3. Enter the administrator import password.
4. Upload the CSV and select **Preview changes**.
5. Confirm the import.
6. Open the auditor PWA and select **Synchronize now**.
7. Search for and open the customer appointment.

The importer is tailored to the current Asana columns:

- `Task ID` — permanent unique identifier
- `Name` — customer/facility name
- `Section/Column` — status
- `Assignee` and `Assignee Email`
- `Due Date` — appointment date
- `Notes` — contact, utility, account number, phone, email, and address
- `Parent task` — subtasks are skipped automatically

Sections containing **Done**, **Payment is Received**, **Completed**, or **Archive** are stored as archived and do not appear in the auditor's active list.

## Required Netlify environment variables

Add these under **Netlify → Site configuration → Environment variables**:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_PASSWORD
RESEND_API_KEY
```

Optional email variables:

```text
AUDIT_EMAIL_FROM=EWPros Auditor Wizard <audit@ewpros.com>
AUDIT_EMAIL_TO=audit@ewpros.com
AUDIT_TIME_ZONE=America/New_York
```

Never commit the service-role key, Resend key, database password, or `.env` file to GitHub.

## Temporary logins

Auditor PWA:

```text
Username: Auditor
Password: audit123
```

Administrator Dashboard:

```text
URL: /admin/
Password: the value configured as ADMIN_IMPORT_PASSWORD in Netlify
```

The current login is intended for a controlled internal pilot. It should be upgraded to real user authentication before broad production use.

## Deployment

1. Replace the files in the GitHub repository connected to the Netlify site.
2. Add the four required Netlify environment variables.
3. In Netlify, choose **Deploys → Trigger deploy → Clear cache and deploy site**.
4. Confirm these functions appear in Netlify:
   - `admin-dashboard`
   - `get-appointments`
   - `import-appointments`
   - `send-audit-email`
5. Open `/admin/`, upload the Asana CSV, preview it, and confirm the import.
6. Open `/`, sign in as the auditor, and select **Synchronize now**.

## Data protection behavior

CSV imports update only appointment/scheduling information in Supabase. Field audit work remains in the auditor PWA's local storage, including:

- Checklist progress
- Account confirmation
- Equipment
- Photos
- Notes
- Signature
- Completion status

A later appointment refresh merges the latest Asana information with the locally saved audit work. Completed local audits are retained even if the appointment is later archived in Asana.

## Development checks

```bash
npm install
npm run check
npm run dev
```

`npm run check` validates all JavaScript and runs the Asana CSV parser tests.
