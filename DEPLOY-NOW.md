# Deploy EWPros Auditor 2.0

## 1. Upload the project to GitHub

Replace the files in the repository connected to `https://audit57.netlify.app/` with the contents of this package. Do not upload `node_modules` or a `.env` file.

## 2. Enter the Netlify environment variables

Open the Netlify site and go to:

**Site configuration → Environment variables**

Add:

```text
SUPABASE_URL = your Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY = your Supabase server-side service role key
ADMIN_IMPORT_PASSWORD = your chosen administrator password
RESEND_API_KEY = your existing Resend API key
```

The Supabase service-role key and Resend key must remain in Netlify only.

## 3. Redeploy

Open:

**Deploys → Trigger deploy → Clear cache and deploy site**

## 4. Use the application

Administrator dashboard:

```text
https://audit57.netlify.app/admin/
```

Auditor PWA:

```text
https://audit57.netlify.app/
Username: Auditor
Password: audit123
```

## 5. First CSV import

1. Open the administrator dashboard.
2. Upload the Asana CSV.
3. Leave **complete project export** unchecked for the first import.
4. Select **Preview changes**.
5. Review skipped subtasks, valid customers, new records, updates, and errors.
6. Select **Confirm import**.
7. Open the auditor PWA and select **Synchronize now**.
