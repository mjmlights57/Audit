# EWPros Auditor 2.8 — Model, Incentive, Invoice, and Project Archive Update

## Key changes

### PEPCO workbook
- Adds **Proposed LED Device** after Reported Efficacy in Section A.
- Automatically builds one unique model row for each matching Propose Measure.
- Assigns Model IDs chronologically as M-01, M-02, and so on.
- Renames Lighting Inventory **Model ID** to **Model Select**.
- Automatically links each inventory line to the matching Model ID.

### PData
- `INC` is now **BGE Incentives**.
- Adds **PEPCO Incentives**.
- `INC 2` is now **Unit Price**.
- Existing INC and INC 2 values are preserved through migration.
- New PEPCO incentive values are blank until entered by the administrator.

### Control Data
- Proposed Control Manufacturer is now **BGE Ctrl Incentives**.
- Proposed Control Model Number is now **PEPCO Ctrl Incentives**.
- The four default rows remain available. Incentive values are blank until entered.

### Invoice
- Uses the supplied EWPros logo.
- Uses the supplied authorized-personnel signature.
- Generates seven-digit sequential invoice numbers starting at `1000001`.
- Loads customer data from the selected imported appointment.
- Creates invoice lines from the current PEPCO Workbook Lighting Inventory.
- Unit Price comes from PData.
- Line Total = Quantity × Unit Price.
- The selected project utility controls which device and control incentive columns are used.
- Admin-only Reported Wattage and incentive reference columns are hidden when printing.
- Total Project Cost = sum of line totals.
- Incentive Amount = selected utility device incentives + selected utility control incentives.
- Material Cost = 35% of Total Project Cost.
- Installation Cost = 65% of Total Project Cost.
- Balance Due = Total Project Cost − Incentive Amount.

### Complete project archive
Use **Main → Complete Project Archive**:
- Download all project data as one JSON file.
- Upload the file later to restore PData, Control Data, PEPCO Workbook, PEPCO Online, Invoice, signed local audit data, photos, signatures, and invoice numbering.
- Archives with many photos may be large because images are included.

## Recommended workflow

1. Import the Asana CSV.
2. Select the project in For_PEPCO_Wrkbk.
3. Load CSV project data.
4. Load auditor lighting data.
5. Review the automatically generated model list and Model Select values.
6. Enter PEPCO and BGE incentive values in PData and Control Data where needed.
7. Open Invoice.
8. Select the same imported appointment.
9. Select **Load from PEPCO Workbook**.
10. Review and print/save the invoice.
11. Download the Complete Project Archive after the project is finished.

## Invoice numbering limitation

The seven-digit sequence is maintained in the current browser and is included in the Complete Project Archive. Two unrelated devices working independently can still issue overlapping numbers until invoice numbering is moved to a central database.
