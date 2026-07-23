# EWPros Auditor 2.4.0

## Audit lighting line updates

- Added **Proposed Device**, **Proposed Qty**, **Ctrl#**, and **Notes** after the equipment-image column.
- Proposed Device uses the shared PData catalog while still allowing typed values.
- Added the proposed fields to the generated audit CSV and internal audit report.
- Duplicate and delete actions preserve the proposed fields; duplicated photos are intentionally cleared.

## Matching Interior and Exterior workflows

- Exterior Equipment now has the same **HVAC / Lighting** selector as Interior Equipment.
- Both sections support dependent existing-device codes, equipment photos, proposed-device data, add, duplicate, and delete.

## Administrator workbook tabs

- Added **Main**, **PData**, **For_PEPCO_Wrkbk**, **For_PEPCO_Online**, and **Invoice** tabs.
- Main uses a dashboard/control-center layout and preserves appointment/import metrics.
- PData includes all 47 supplied proposed-device records across 18 editable columns.
- PData supports search, add, edit, duplicate, delete, save, reset, and CSV export.
- For_PEPCO_Wrkbk, For_PEPCO_Online, and Invoice are reserved as blank workspaces.
- PData edits are stored in the current browser; the project’s built-in defaults remain in `p-data.js`.

## Main-tab design note

- A polished control-center design is included. The referenced Image3 was not included with the request, so exact visual matching can be completed after that image is supplied.

# EWPros Auditor 2.3.1

## Full lighting device catalog

- Added all 40 supplied Existing Device Category choices.
- Added 592 supplied source entries, normalized into 542 unique device codes.
- Existing Device Code now changes automatically with the selected category.
- Manual code entry remains available through **Other / enter manually**.
- Categories with no supplied codes—Five Foot Fluorescent T8 and Neon—remain available and automatically use manual code entry.
- Corrected the visible category label from “Five Foot Foot Fluorescent T8” to “Five Foot Fluorescent T8.”

# EWPros Auditor 2.3 - PEPCO T&C and Lighting Inventory

## Utility-specific signed forms

- Imports the utility from the Asana Description/Notes.
- Normalizes recognized values to BGE or PEPCO.
- Shows the detected utility in the administrator CSV preview and auditor appointment.
- Generates only the T&C form that matches the appointment utility.
- Locks the signed utility and form version once the customer signs.
- Requires a one-time BGE/PEPCO selection only when the Asana utility is missing or unrecognized.

## PEPCO form

- Adds the supplied PEPCO Terms and Conditions and Customer Acknowledgement PDF, effective 4/16/2025.
- Fills the page 3 project and customer fields.
- Selects Service Provider for payment.
- Applies the customer signature and date to both the Customer Acknowledgement and Payment Information signature lines.

## Interior Equipment

- Adds an HVAC/Lighting selector.
- Adds a lighting line-item table with Location, >300SF, dependent Device Category/Code, Quantity, and camera capture.
- Supports Add, Duplicate, Delete, Retake photo, and Remove photo.
- Includes lighting data in the audit CSV and supporting photos in the iPad Share Sheet.

## Lighting catalog note

- Includes the confirmed Compact Fluorescent examples: `1c0005`, `1c0007`, `1c0009`, and `1c00011`.
- Includes the Eight Foot Fluorescent T8 category scaffold.
- Allows manual device-code entry where the full code list has not yet been supplied.
