# Appointment Time Setup

The importer now recognizes appointment time in either of these places:

1. An Asana custom field exported as `Appointment Time`, `Scheduled Time`, `Start Time`, or `Time`.
2. The Asana task Notes using a line such as:

   `Appointment Time: 10:30 AM`

Recommended: create an Asana custom field named `Appointment Time` and enter values such as `10:30 AM`.

After adding times in Asana:

1. Export the project CSV again.
2. Open the administrator dashboard.
3. Preview and import the updated CSV.
4. In the auditor app, select **Synchronize now**.

Existing appointments are matched by Task ID, so their scheduling data is updated without creating duplicates. Local completed audit information remains preserved.
