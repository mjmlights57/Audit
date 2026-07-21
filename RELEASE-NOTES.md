# EWPros Auditor 2.0 Release Notes

## Added

- Administrator dashboard at `/admin/`
- Asana CSV preview and confirmed import
- Exact Task ID upsert matching
- Automatic subtask skipping using `Parent task`
- Structured Notes extraction for customer contact, utility, account, phone, email, and address
- Legacy Notes fallbacks for older address formats
- Import history and appointment review screens
- Auditor appointment search and filtering
- Supabase access through Netlify Functions only
- Automatic preservation of locally completed audit work during appointment refresh
- Automated parser tests

## Changed

- Temporary auditor login is now `Auditor` / `audit123`
- Old demo appointments are cleared from local storage unless they contain completed audit work
- Done/payment-received Asana sections are archived and hidden from the active auditor list
- Dropbox wording was removed from completion emails until Dropbox upload is implemented
- Service worker no longer caches administrator pages or Netlify Function responses
