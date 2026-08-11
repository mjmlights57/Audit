# EWPros v3.0.3 — Bank Import & Categories Fix

## Banking
- Selecting a CSV/OFX/QFX file now enables **Import transactions** immediately.
- **Preview statement** remains available but is optional before importing.
- Import reads the currently selected file/account at click time and still uses server-side duplicate prevention.
- If a preview finds that every row is already imported, the Import button is disabled and explains why.

## Accounting Categories
The `/admin.html` entry point now shows the same Accounting Categories panel as `/admin/`.

Added/standardized:
- Permits & Licenses
- Tools & Small Equipment
- Rent & Storage
- Utilities
- Training & Certification
- Legal & Accounting
- Payroll Wages (W-2 employee wages)
- Payroll Taxes (Employer payroll taxes)
- Employee Benefits
- Contractor Labor (1099)
- Shipping & Delivery
- Refunds & Adjustments
- Interest Expense
- Loan Payment - Principal
- Sales Tax Payable
- Subcontractor (contract a company)

Removed from active selections:
- Labor
- Subcontractor

Historical records are preserved. Loan principal and sales-tax payments are posted to liability accounts rather than incorrectly appearing as operating expenses.
