# Deploy EWPros Auditor 2.3

## 1. Upload the full project to GitHub

Replace the files in the repository connected to `https://ewpros55audit.netlify.app/` with the contents of this package. Do not upload `node_modules` or a `.env` file.

Confirm these new or updated files are present:

```text
lighting-catalog.js
assets/TC_PEPCO.pdf
app.js
audit-export.js
sw.js
```

## 2. Netlify variables

Keep the existing variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_PASSWORD
RESEND_API_KEY
```

No new environment variables are required.

## 3. Redeploy

Open:

**Deploys → Trigger deploy → Clear cache and deploy site**

## 4. Clear the old PWA version

After deployment:

1. Completely close the installed PWA.
2. Reopen it and synchronize.
3. If the old version remains, remove the app from the iPad Home Screen.
4. Open the site in Safari and add it to the Home Screen again.

## 5. Re-import appointments

1. Open `https://ewpros55audit.netlify.app/admin/`.
2. Upload the current Asana CSV.
3. Select Preview changes.
4. Verify the Utility column shows BGE or PEPCO for each appointment.
5. Confirm the import.
6. Open the auditor PWA and select Synchronize now.

## 6. Field test

Complete two test audits:

- One Asana appointment with `Utility: BGE`
- One Asana appointment with `Utility: PEPCO`

Confirm:

- The correct utility badge appears.
- Interior Equipment offers HVAC and Lighting.
- Lighting lines can be added, duplicated, photographed, and deleted.
- BGE generates only the BGE T&C PDF.
- PEPCO generates only the PEPCO T&C PDF.
- The audit CSV and supporting JPG photos are included in the Share Sheet.
- The notification email arrives at `audit@ewpros.com`.
