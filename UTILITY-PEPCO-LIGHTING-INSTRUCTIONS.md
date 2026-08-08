# Utility Routing, PEPCO T&C, and Lighting Inventory

## Asana Description format

Include a utility line in the main customer task Description/Notes:

```text
Utility: BGE
```

or:

```text
Utility: PEPCO
```

The importer reads the utility automatically. In the administrator import preview, confirm the **Utility** column before selecting Confirm Import.

## Result at audit submission

| Imported utility | Files generated |
|---|---|
| BGE | Filled BGE T&C PDF + audit CSV + supporting JPG photos |
| PEPCO | Filled PEPCO T&C PDF + audit CSV + supporting JPG photos |
| Missing/unrecognized | Auditor must select BGE or PEPCO before signing |

The app never generates both utility PDFs for a normal audit.

## PEPCO signature behavior

The same customer signature is placed on page 3 in:

1. Customer Acknowledgement signature line
2. Payment Information authorization signature line

The signature date is entered beside both signatures, and Service Provider is selected.

## Lighting inventory

Open an appointment, select **Interior Equipment**, then choose **Lighting**.

- Select **+ Add line** for each fixture group.
- Enter the room or area in Location.
- Select Yes or No for >300SF.
- Choose the Existing Device Category.
- Choose the dependent Existing Device Code, or manually enter the code if that category does not yet have a configured list.
- Enter quantity.
- Select Take photo.
- Use Duplicate for a similar line; the photo is intentionally not copied.
- Use Delete to remove an incorrect line.

## Adding the full device-code catalog

Open `lighting-catalog.js` and add each category with its permitted codes:

```javascript
window.EWPROS_LIGHTING_DEVICE_CATALOG = Object.freeze({
  'Compact Fluorescents': Object.freeze([
    '1c0005',
    '1c0007',
    '1c0009',
    '1c00011'
  ]),
  'Eight Foot Fluorescent T8': Object.freeze([
    // Add approved codes here.
  ])
});
```

The complete category/code source should be provided as a spreadsheet, CSV, or clearly formatted table to prevent incorrect utility measure codes from being introduced.
