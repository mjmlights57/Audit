# EWPros Auditor 2.5 — Control, PEPCO Workbook, and Invoice

## Auditor changes

Every Interior and Exterior Lighting line now includes **Ctrl Type** immediately after **Ctrl Qty**.

Available Ctrl Type values:

- OS
- DL
- O+D
- Ph

The selected value is included in the generated audit CSV and internal audit report.

## Administrator PData

The PData tab now has two independent editable tables:

1. Proposed Device Data
2. Control Data

The Control Data table starts with the four supplied OS, DL, OD, and Ph records. It supports search, add, duplicate, delete, save, reset, and CSV export.

Both tables are stored separately in the browser.

## For_PEPCO_Wrkbk

The upper project/model area and lower lighting inventory are independent.

The upper section contains:

- General Project Information
- Building Information
- Workbook Submitter Information
- Incentivized Tabs
- Model data table

The lower section contains a wide PEPCO lighting inventory table. Every model and inventory row has **Add** and **Delete** controls.

Use the separate Save and Reset buttons for the upper and lower sections.

## Invoice

The Invoice tab includes:

- Completion date
- Invoice date and number
- Invoice-to information
- Editable line items with Add/Delete
- Automatic line totals
- Project, incentive, material, installation, and balance totals
- Authorized personnel section
- Customer signature section
- Print / Save PDF

Choose a locally signed audit and click **Load audit data**. The invoice will use the customer information, audit equipment, and signature captured in Customer T&C.

### Signature limitation

The current app stores completed audits and signatures on the auditor's device. The Admin portal can automatically access the signature only when it is opened in the same browser/device profile. A signature upload fallback is included. Central cross-device signature access requires a future Supabase completed-audit synchronization feature.
