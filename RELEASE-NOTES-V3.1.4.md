# EWPros v3.1.4 — CRM Customer Notes Fix

This is a focused CRM update built on v3.1.3. All other EWPros behavior remains unchanged.

## Changes

- Customer Notes are editable again from the customer Overview panel, even after one or more projects have been created.
- The Edit Customer form again includes the Customer Notes field.
- Activity comments now have Edit and Delete controls.
- The CRM customer list Notes column shows the newest Activity comment first.
- If a customer has no Activity comments, the Notes column falls back to the main Customer Notes field.
- The customer Overview shows the latest Activity comment and its timestamp beneath the editable Customer Notes field.
- Adding, editing, or deleting a comment refreshes the CRM list immediately so the newest comment is reflected without a manual page reload.

## Database

No Supabase migration is required for v3.1.4. It uses the existing `customers.notes` and `customer_notes` tables already present in the v3 business schema.

## Validation

75/75 automated regression tests passed.
