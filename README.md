# EWPros Auditor Wizard PWA — Netlify + Resend

This is the original offline-first EWPros Auditor Wizard with production email notifications added through a Netlify Function and the official Resend Node.js SDK.

## Email behavior

When an auditor completes an audit, the app saves the completed audit locally first and queues an email notification. If online, it sends immediately. If offline or a send fails, the request remains in local storage and retries automatically after reconnection and while the app is open.

The notification is sent from and to `audits@ewpros.com` by default. Its subject is `Audit Completed – {Appointment Number}` and it states that the completed audit has been uploaded to Dropbox.

> This release adds the email notification workflow. It does not itself upload files to Dropbox; only use the Dropbox statement after your actual Dropbox upload workflow has succeeded.

## Required Netlify environment variable

Create this in **Netlify → Site configuration → Environment variables** and make it available to **Functions**:

- `RESEND_API_KEY` = your Resend API key

Do not put the API key in frontend JavaScript or commit it to source control.

## Optional environment variables

- `AUDIT_EMAIL_FROM` = `EWPros Auditor Wizard <audits@ewpros.com>`
- `AUDIT_EMAIL_TO` = `audits@ewpros.com` (comma-separated addresses are supported)
- `AUDIT_TIME_ZONE` = `America/New_York`

If omitted, the function uses those values as defaults.

## Deploy to Netlify

1. Extract this project and replace the files in the repository connected to your existing Netlify site.
2. Do not upload `node_modules` or a `.env` file.
3. In Netlify, add `RESEND_API_KEY` under **Site configuration → Environment variables** with Functions scope.
4. Commit and push the files to your connected Git repository, or drag the folder into Netlify after installing dependencies through a Git-based build.
5. In **Deploys**, choose **Trigger deploy → Clear cache and deploy site** so the updated service worker is distributed.
6. After deployment, confirm that Netlify lists the `send-audit-email` function.
7. Complete a test audit while online and verify the message in the Resend dashboard and the `audits@ewpros.com` inbox.
8. Test offline mode: disconnect the device, complete an audit, reconnect, and confirm that the queued email sends automatically.

## Local testing

```bash
npm install
```

Create a local `.env` file (do not commit it):

```text
RESEND_API_KEY=re_your_key
AUDIT_EMAIL_FROM=EWPros Auditor Wizard <audits@ewpros.com>
AUDIT_EMAIL_TO=audits@ewpros.com
AUDIT_TIME_ZONE=America/New_York
```

Then run:

```bash
npm run dev
```

Use the localhost URL displayed by Netlify CLI. A basic static server alone cannot execute the Netlify Function.

## Existing demo accounts

- `abu` / `audit123`
- `maria` / `audit123`

## New and modified files

- `netlify/functions/send-audit-email.js` — secure server-side Resend call
- `netlify.toml` — static publish and Functions configuration
- `package.json` — Resend SDK and local Netlify development tools
- `app.js` — completion hook, offline email queue, retries, statuses, and error logging
- `sw.js` — cache version increment so clients receive the update
