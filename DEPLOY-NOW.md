# Deploy EWPros Integrated Business System 3.0

1. Back up the current Supabase `appointments` and `import_batches` data.
2. In **Supabase → SQL Editor**, run `EWPROS-BUSINESS-SYSTEM-SCHEMA.sql` once. This adds the CRM/accounting/project/timesheet tables and migrates existing appointment customer data; it does not delete the existing auditor tables.
3. Extract the full project ZIP and upload all files/folders to the root of the GitHub repository, replacing the old app files.
4. Commit/push the changes.
5. In Netlify, use **Deploys → Trigger deploy → Clear cache and deploy site**.
6. Open `/admin/` and verify **Business Dashboard**, **CRM**, **Banking**, and **Reports** load.
7. Open `/time/` to verify the worker timesheet sign-in page loads.
8. Close and reopen the installed iPad PWA. If an old version remains, remove the Home Screen PWA and reinstall it through Safari.

No new Netlify environment variable is required. Existing Supabase/Resend/admin-password settings remain in use.

See `BUSINESS-SYSTEM-V3-SETUP.md` for first-time bank-account setup and the weekly operating workflow.

## Important v3.0.1 admin URL fix
The integrated business system is served from **`/admin/`**. This release redirects the legacy **`/admin.html`** address and `/admin` to `/admin/` so old bookmarks cannot open the v2.8 administrator page.

After deployment, test these exact paths:
- `https://YOUR-SITE.netlify.app/admin/` — integrated CRM/accounting/business dashboard
- `https://YOUR-SITE.netlify.app/time/` — employee/contractor timesheet portal
- `https://YOUR-SITE.netlify.app/` — field auditor PWA (this intentionally remains the auditor screen)
