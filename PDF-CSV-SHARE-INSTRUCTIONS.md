# PDF and CSV Share Workflow

## Auditor workflow

1. Complete all five required audit sections.
2. Tap **Submit Audit & Share Files**.
3. The audit is marked complete and the email notification is queued.
4. The app creates two files on the iPad:
   - `EWPros_Audit_<appointment>_<customer>_<date>.pdf`
   - `EWPros_Audit_<appointment>_<customer>_<date>.csv`
5. The iPad Share Sheet opens with both files.
6. Select Dropbox, Files, AirDrop, Mail, or another available destination.

## PDF contents

- Appointment and customer information
- Utility and account information
- Appointment date and time
- Completion checklist
- Building-front photo
- Interior equipment
- Exterior equipment
- Auditor notes
- Customer acceptance and typed signature

## Retry behavior

If the auditor cancels the Share Sheet, the audit remains completed. Open the appointment and tap **Share PDF & CSV again**.

If the device/browser does not support sharing files, the app downloads both files. They can then be moved from the Files app to Dropbox.

## Important

This workflow does not upload automatically to a fixed Dropbox folder. iPadOS intentionally requires the auditor to choose the destination. A future Dropbox API integration can perform automatic background uploads.
