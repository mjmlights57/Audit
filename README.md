# EWPros Auditor Wizard 2.3

This project contains two connected interfaces:

- **Auditor PWA:** `/`
- **Administrator Dashboard:** `/admin/`

The administrator exports the Asana appointment project as CSV, previews the changes, and imports customer appointments. Netlify Functions process the CSV and save appointments in Supabase. The auditor PWA retrieves active appointments and preserves the audit work stored on the field device.

## Current workflow

1. Export **(2) On-Going Projects (Customers)** from Asana as CSV.
2. Open `/admin/`.
3. Enter the administrator import password.
4. Upload the CSV and select **Preview changes**.
5. Confirm that each appointment shows the correct **Utility** value.
6. Confirm the import.
7. Open the auditor PWA and select **Synchronize now**.
8. Search for and open the appointment.
9. Complete the customer confirmation, photos, equipment, and customer T&C sections.
10. Select **Submit Audit & Share BGE T&C + CSV** or **Submit Audit & Share PEPCO T&C + CSV**.
11. The app generates only the utility-specific signed T&C PDF, the audit CSV, and supporting JPG photographs, then opens the iPad Share Sheet.

## Asana CSV fields

The importer is tailored to the current Asana columns:

- `Task ID` — permanent unique identifier
- `Name` — customer/facility name
- `Section/Column` — appointment status
- `Assignee` and `Assignee Email`
- `Due Date` — appointment date
- `Notes` — contact, utility, project ID, account number, phone, email, address, and optional appointment time
- `Parent task` — subtasks are skipped automatically

The importer reads values such as:

```text
Utility: BGE
Utility: PEPCO
Appointment Time: 10:30 AM
Project ID: 123456
```

Utility variations are normalized to `BGE`, `PEPCO`, or missing/unrecognized. The administrator preview shows the detected utility before import. If no recognized utility is present, the auditor must select BGE or PEPCO before the customer signs.

Sections containing **Done**, **Payment is Received**, **Completed**, or **Archive** are stored as archived and do not appear in the active auditor list.

## Utility-specific Terms and Conditions PDFs

### BGE

The app uses the supplied three-page BGE T&C template. It fills page 3 with customer information, selects the service-provider payment option, enters **EWPros** as the rebate assignee, and places the customer signature and date on the authorized-representative line.

### PEPCO

The app uses the supplied three-page PEPCO T&C template, effective 4/16/2025. It fills page 3 with project/customer information, selects **Service Provider**, and places the customer signature and date in both:

- Customer Acknowledgement
- Payment Information authorization

Only the form matching the appointment utility is generated and shared.

## Interior Equipment: HVAC and Lighting

The Interior Equipment section now has two modes:

- **HVAC** — preserves the existing equipment workflow
- **Lighting** — line-item lighting inventory optimized for iPad use

Each lighting line includes:

- Line number
- Location
- `>300SF` Yes/No
- Existing Device Category
- Dependent Existing Device Code
- Quantity
- Equipment photo
- Duplicate and Delete actions

The auditor can add unlimited lines, duplicate a similar line, delete a line, and capture or retake the equipment photo.

### Lighting device catalog

The supplied request included these confirmed examples:

```text
Compact Fluorescents:
1c0005
1c0007
1c0009
1c00011

Eight Foot Fluorescent T8
```

Those entries are configured in `lighting-catalog.js`. Because the complete category/code matrix was not included, categories with no configured code list automatically allow manual code entry. Add the complete utility catalog to `lighting-catalog.js` when available; no redesign is required.

## PDF, CSV, photos, and iPad Share Sheet

When an audit is submitted, the PWA:

1. Locks the utility and T&C template version used for the signature.
2. Marks the audit completed on the device.
3. Queues the existing Resend notification email to `audit@ewpros.com`.
4. Generates the correct filled BGE or PEPCO T&C PDF.
5. Generates a detailed audit CSV containing HVAC and lighting records.
6. Adds captured building and equipment photos as supporting JPG files.
7. Opens the iPad Share Sheet so the auditor can select Dropbox, Files, AirDrop, Mail, or another destination.

The app cannot choose Dropbox automatically because iPadOS requires the user to select a destination. If multi-file sharing is unavailable, the files download individually.

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

The current login is intended for a controlled internal pilot. Upgrade it to real user authentication before broad production use.

## Deployment

1. Replace the files in the GitHub repository connected to Netlify.
2. Do not upload `node_modules` or a `.env` file.
3. In Netlify, choose **Deploys → Trigger deploy → Clear cache and deploy site**.
4. Completely close and reopen the installed PWA after deployment. If the old version remains cached, remove it from the iPad Home Screen and reinstall it from Safari.
5. Open `/admin/`, preview the Asana CSV, and verify the Utility column.
6. Import the CSV and synchronize the auditor PWA.
7. Complete one BGE test and one PEPCO test before field rollout.

No new Netlify environment variables are required for version 2.3.

## Data-protection behavior

CSV imports update appointment/scheduling information in Supabase. Field audit work remains in the auditor PWA's local storage, including:

- Checklist progress
- Confirmed account information
- HVAC equipment
- Lighting inventory and photos
- Building/exterior photos
- Notes
- Signature
- Signed utility and template version
- Completion status

A later appointment refresh merges current Asana information with locally saved audit work. Once the customer signs, the selected utility and template version remain locked to that audit.

## Development checks

```bash
npm install
npm run check
npm run dev
```

`npm run check` validates the JavaScript and runs the Asana parser, utility routing, BGE/PEPCO PDF, HVAC/lighting CSV, and export tests.
