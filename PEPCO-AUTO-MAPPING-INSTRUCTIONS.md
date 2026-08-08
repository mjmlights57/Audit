# PEPCO Automatic Mapping — v2.7

## Imported project data
In **For_PEPCO_Wrkbk** or **For_PEPCO_Online**, select an imported appointment and use the load button. The administrator dashboard fills available customer, address, account, meter, contact, building, square-footage, and heating-fuel fields from the Asana CSV Notes/Description. Blank source data remains blank for review.

## Auditor lighting data
In **For_PEPCO_Wrkbk**, select the same project and choose **Load auditor lighting data**. Interior and exterior lighting lines stored in this browser are converted into workbook inventory rows. This requires the Admin portal and auditor app to use the same browser profile until central audit synchronization is added.

## Catalog matches
Exact Propose Measure matches fill Measure Type, Measure Description, and Proposed Control Manufacturer from PData. Exact Ctrl Type matches fill Control Type, Control Select, and Control Mounting from Control Data.

## Dates
Application Date is recalculated as today. Expected Completion Date is recalculated as two calendar months from today every time the worksheet is rendered or saved.
