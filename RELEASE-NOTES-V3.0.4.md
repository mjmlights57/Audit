# EWPros v3.0.4 — Bank Import & Worker Removal Reliability Fix

## Fixed

- `Import transactions` is no longer shipped disabled in HTML. It stays clickable and validates the selected CSV/OFX/QFX file when clicked.
- File selection status now shows the selected statement filename.
- Both `change` and `input` events update the bank import UI.
- Preview errors no longer leave the Import button disabled.
- Added cache-busting query versions for the admin JS/CSS files so a prior Netlify/browser copy cannot keep the old behavior.
- Worker removal no longer uses the browser's native confirmation prompt. It now uses a clear EWPros in-app dialog with `Cancel` and `Remove worker`.
- Workers with history are still deactivated rather than having historical time/mileage/payment/project links erased.

## Database

No new Supabase migration is required for v3.0.4 if v3.0.3 migration has already been run.
