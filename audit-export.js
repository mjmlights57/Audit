(function (root, factory) {
  let pdfLib = root && root.PDFLib;
  if (!pdfLib && typeof require === 'function') {
    try { pdfLib = require('pdf-lib'); } catch {
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const vm = require('node:vm');
        vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'assets', 'pdf-lib.min.js'), 'utf8'));
        pdfLib = globalThis.PDFLib;
      } catch {}
    }
  }
  const api = factory(pdfLib);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EWProsAuditExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PDFLib) {
  'use strict';

  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const LEFT = 48;
  const RIGHT = 564;
  const TOP = 748;
  const BOTTOM = 48;

  function safe(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function ascii(value) {
    return safe(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x20-\x7E\n\r\t]/g, '?');
  }

  function pdfEscape(value) {
    return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function csvEscape(value) {
    const text = safe(value).replace(/\r?\n/g, ' ');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return safe(value);
    return date.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function fileSafe(value) {
    return ascii(value).trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'Audit';
  }

  function buildFileBaseName(audit) {
    const id = fileSafe(audit.id || audit.externalTaskId || 'Appointment');
    const customer = fileSafe(audit.customer || 'Customer');
    const date = safe(audit.completedAt || audit.date || new Date().toISOString()).slice(0, 10);
    return `EWPros_Audit_${id}_${customer}_${date}`;
  }

  function normalizeUtilityProgram(value) {
    const raw = safe(value).trim();
    const compact = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (compact.includes('BGE') || compact.includes('BALTIMOREGASELECTRIC') || compact.includes('BALTIMOREGASANDELECTRIC')) return 'BGE';
    if (compact.includes('PEPCO') || compact.includes('POTOMACELECTRICPOWER')) return 'PEPCO';
    return '';
  }

  function utilityProgramForAudit(audit) {
    return normalizeUtilityProgram(audit?.signedUtility || audit?.utility);
  }

  function templateVersionForProgram(program) {
    return program === 'BGE' ? 'BGE-C&I-202510' : program === 'PEPCO' ? 'PEPCO-04-2025' : '';
  }

  function photoFileName(audit, area, index, item) {
    const base = buildFileBaseName(audit);
    const location = fileSafe(item?.location || `${area}_${index}`);
    return `${base}_${area}_${String(index).padStart(2, '0')}_${location}.jpg`;
  }

  function equipmentRows(audit) {
    const rows = [];
    ['interior', 'exterior'].forEach(area => {
      const items = audit.equipment?.[area] || [];
      if (!items.length) {
        rows.push({ area, empty: true });
      } else {
        items.forEach((item, index) => rows.push({ area, index: index + 1, item }));
      }
    });
    return rows;
  }

  function buildAuditCsv(audit) {
    const headers = [
      'Appointment Number', 'Asana Task ID', 'Customer', 'Contact Name', 'Phone', 'Email',
      'Service Address', 'Utility', 'Signed Utility', 'Template Version', 'Utility Account Number', 'Appointment Date', 'Appointment Time',
      'Auditor', 'Asana Assignee', 'Completion Date/Time', 'Audit Status', 'Area', 'Equipment #',
      'Category', 'Equipment Type', 'Manufacturer', 'Model', 'Serial Number', 'Quantity', 'Location',
      'Capacity', 'Efficiency', 'Condition', '>300 SF', 'Existing Device Category', 'Existing Device Code',
      'Equipment Photo Captured', 'Equipment Photo File', 'Proposed Device', 'Proposed Quantity', 'Control Number',
      'Equipment Notes', 'Audit Notes', 'Customer Accepted Terms',
      'Signature Name', 'Signature', 'Address Confirmed', 'Front Photo Captured', 'Front Photo File',
      'Interior Section Completed', 'Exterior Section Completed'
    ];
    const rows = equipmentRows(audit).map(row => {
      const item = row.item || {};
      const equipmentPhoto = item.photo ? photoFileName(audit, row.area, row.index || 1, item) : '';
      const frontPhoto = audit.photos?.front ? `${buildFileBaseName(audit)}_Building_Front.jpg` : '';
      return [
        audit.id, audit.externalTaskId, audit.customer, audit.contactName, audit.phone, audit.email,
        audit.address, audit.utility, audit.signedUtility, audit.templateVersion, audit.account, audit.date, audit.time,
        audit.auditorName || audit.auditor, audit.auditorName, formatDateTime(audit.completedAt), audit.status,
        row.area, row.index || '', item.category, item.type, item.manufacturer, item.model, item.serial,
        item.quantity, item.location, item.capacity, item.efficiency, item.condition, item.over300sf,
        item.deviceCategory, item.deviceCode, item.photo ? 'Yes' : 'No', equipmentPhoto,
        item.proposedDevice, item.proposedQty, item.ctrlNumber, item.notes,
        audit.notes, audit.tasks?.terms ? 'Yes' : 'No', audit.signatureName, audit.signature,
        audit.tasks?.confirm ? 'Yes' : 'No', audit.photos?.front ? 'Yes' : 'No', frontPhoto,
        audit.tasks?.interior ? 'Yes' : 'No', audit.tasks?.exterior ? 'Yes' : 'No'
      ];
    });
    return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  }

  function wrapText(text, maxWidth, fontSize) {
    const clean = ascii(text).replace(/\s+/g, ' ').trim();
    if (!clean) return [''];
    const maxChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.52)));
    const words = clean.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if (!line) {
        line = word;
      } else if ((line + ' ' + word).length <= maxChars) {
        line += ' ' + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function bytesFromString(value) {
    return new TextEncoder().encode(value);
  }

  function concatBytes(chunks) {
    const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(chunk => { out.set(chunk, offset); offset += chunk.length; });
    return out;
  }

  function base64ToBytes(value) {
    if (typeof atob !== 'function') return null;
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function jpegInfo(dataUrl) {
    const match = /^data:image\/jpeg;base64,(.+)$/i.exec(safe(dataUrl));
    if (!match) return null;
    const bytes = base64ToBytes(match[1]);
    if (!bytes || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xFF) { i += 1; continue; }
      const marker = bytes[i + 1];
      i += 2;
      if (marker === 0xD8 || marker === 0xD9) continue;
      if (i + 1 >= bytes.length) break;
      const length = (bytes[i] << 8) + bytes[i + 1];
      const isSof = [0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker);
      if (isSof && i + 7 < bytes.length) {
        const height = (bytes[i + 3] << 8) + bytes[i + 4];
        const width = (bytes[i + 5] << 8) + bytes[i + 6];
        return { bytes, width, height };
      }
      if (length < 2) break;
      i += length;
    }
    return null;
  }

  function buildAuditPdfBytes(audit) {
    const pages = [[]];
    let pageIndex = 0;
    let y = TOP;
    const image = jpegInfo(audit.photos?.front);

    const cmd = value => pages[pageIndex].push(value);
    const newPage = () => { pages.push([]); pageIndex += 1; addPageHeader(); y = 728; };
    const ensure = height => { if (y - height < BOTTOM) newPage(); };
    const textLine = (text, size = 10, bold = false, indent = 0) => {
      ensure(size + 6);
      cmd(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${LEFT + indent} ${y} Tm (${pdfEscape(text)}) Tj ET\n`);
      y -= size + 4;
    };
    const paragraph = (text, size = 10, bold = false, indent = 0) => {
      const width = RIGHT - LEFT - indent;
      wrapText(text, width, size).forEach(line => textLine(line, size, bold, indent));
    };
    const rule = () => { ensure(10); cmd(`0.7 w ${LEFT} ${y} m ${RIGHT} ${y} l S\n`); y -= 12; };
    const section = title => {
      ensure(30);
      y -= 4;
      cmd(`0.83 0 0.2 rg ${LEFT} ${y - 4} 4 18 re f 0 0 0 rg\n`);
      cmd(`BT /F2 13 Tf 1 0 0 1 ${LEFT + 12} ${y} Tm (${pdfEscape(title)}) Tj ET\n`);
      y -= 21;
    };
    const keyValue = (label, value) => {
      const display = safe(value) || 'Not provided';
      paragraph(`${label}: ${display}`, 10, false, 8);
    };
    function addPageHeader() {
      cmd(`0.83 0 0.2 rg ${LEFT} 767 516 3 re f 0 0 0 rg\n`);
      cmd(`BT /F2 9 Tf 1 0 0 1 ${LEFT} 754 Tm (EWPros Audit Report) Tj ET\n`);
    }

    addPageHeader();
    y = 718;
    cmd(`BT /F2 20 Tf 1 0 0 1 ${LEFT} ${y} Tm (Energy Audit Report) Tj ET\n`); y -= 30;
    textLine(`Appointment ${audit.id || audit.externalTaskId || ''}`, 12, true);
    textLine(`Completed: ${formatDateTime(audit.completedAt) || 'Draft export'}`, 10);
    rule();

    section('Appointment Information');
    keyValue('Customer', audit.customer);
    keyValue('Contact', audit.contactName);
    keyValue('Phone', audit.phone);
    keyValue('Email', audit.email);
    keyValue('Service address', audit.address);
    keyValue('Utility', audit.utility);
    keyValue('Utility account', audit.account);
    keyValue('Appointment date', audit.date);
    keyValue('Appointment time', audit.time);
    keyValue('Asana Task ID', audit.externalTaskId);
    keyValue('Auditor', audit.auditorName || audit.auditor);

    section('Completion Checklist');
    const checklist = [
      ['Address and account confirmed', audit.tasks?.confirm],
      ['Building-front photo captured', audit.tasks?.front],
      ['Interior equipment completed', audit.tasks?.interior],
      ['Exterior equipment completed', audit.tasks?.exterior],
      ['Customer terms accepted', audit.tasks?.terms]
    ];
    checklist.forEach(([label, done]) => textLine(`${done ? '[X]' : '[ ]'} ${label}`, 10, false, 8));

    if (image) {
      section('Building Front Photo');
      ensure(190);
      const maxW = 300;
      const maxH = 175;
      const ratio = Math.min(maxW / image.width, maxH / image.height);
      const drawW = Math.round(image.width * ratio);
      const drawH = Math.round(image.height * ratio);
      const x = LEFT + Math.max(0, (RIGHT - LEFT - drawW) / 2);
      const imageY = y - drawH;
      cmd(`q ${drawW} 0 0 ${drawH} ${x} ${imageY} cm /Im1 Do Q\n`);
      y = imageY - 15;
    } else if (audit.photos?.front) {
      section('Building Front Photo');
      paragraph('A photo is stored with this audit but could not be embedded in this export. Reopen the photo section and save the image again to convert it to JPEG.', 9);
    }

    ['interior', 'exterior'].forEach(area => {
      section(`${area[0].toUpperCase() + area.slice(1)} Equipment`);
      const items = audit.equipment?.[area] || [];
      if (!items.length) {
        paragraph(audit.noEquipment?.[area] ? 'Auditor marked: no equipment present.' : 'No equipment records entered.', 10, false, 8);
      }
      items.forEach((item, index) => {
        ensure(120);
        const isLighting = item.kind === 'lighting' || item.category === 'Lighting';
        textLine(`${index + 1}. ${isLighting ? 'Lighting' : (item.category || 'Equipment')} - ${isLighting ? (item.deviceCategory || 'Unspecified category') : (item.type || 'Unspecified type')}`, 11, true, 8);
        if (isLighting) {
          keyValue('Location', item.location);
          keyValue('Area greater than 300 SF', item.over300sf);
          keyValue('Existing device category', item.deviceCategory);
          keyValue('Existing device code', item.deviceCode);
          keyValue('Existing quantity', item.quantity || 1);
          keyValue('Equipment photo captured', item.photo ? 'Yes' : 'No');
          keyValue('Proposed device', item.proposedDevice);
          keyValue('Proposed quantity', item.proposedQty || '');
          keyValue('Control number', item.ctrlNumber);
        } else {
          keyValue('Manufacturer / model', [item.manufacturer, item.model].filter(Boolean).join(' '));
          keyValue('Serial number', item.serial);
          keyValue('Quantity', item.quantity || 1);
          keyValue('Location', item.location);
          keyValue('Capacity', item.capacity);
          keyValue('Efficiency', item.efficiency);
          keyValue('Condition', item.condition);
        }
        if (item.notes) keyValue('Equipment notes', item.notes);
        y -= 4;
      });
    });

    ensure(60);
    section('Auditor Notes');
    paragraph(audit.notes || 'No additional audit notes were entered.', 10, false, 8);

    ensure(82);
    section('Customer Acceptance');
    keyValue('Customer accepted terms', audit.tasks?.terms ? 'Yes' : 'No');
    keyValue('Customer name', audit.signatureName);
    keyValue('Typed signature', audit.signature);

    const fontNormalId = 3;
    const fontBoldId = 4;
    const imageId = image ? 5 : null;
    const firstPageId = image ? 6 : 5;
    const objectChunks = [];
    const pageIds = [];
    const contentIds = [];
    pages.forEach((_, index) => {
      pageIds.push(firstPageId + index * 2);
      contentIds.push(firstPageId + index * 2 + 1);
    });

    objectChunks[1] = bytesFromString('<< /Type /Catalog /Pages 2 0 R >>');
    objectChunks[2] = bytesFromString(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    objectChunks[fontNormalId] = bytesFromString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objectChunks[fontBoldId] = bytesFromString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    if (image) {
      const prefix = bytesFromString(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      const suffix = bytesFromString('\nendstream');
      objectChunks[imageId] = concatBytes([prefix, image.bytes, suffix]);
    }

    pages.forEach((commands, index) => {
      const resources = image
        ? `<< /Font << /F1 ${fontNormalId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >>`
        : `<< /Font << /F1 ${fontNormalId} 0 R /F2 ${fontBoldId} 0 R >> >>`;
      objectChunks[pageIds[index]] = bytesFromString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentIds[index]} 0 R >>`);
      const stream = bytesFromString(commands.join(''));
      objectChunks[contentIds[index]] = concatBytes([
        bytesFromString(`<< /Length ${stream.length} >>\nstream\n`), stream, bytesFromString('endstream')
      ]);
    });

    const maxId = objectChunks.length - 1;
    const chunks = [bytesFromString('%PDF-1.4\n%EWPROS\n')];
    const offsets = new Array(maxId + 1).fill(0);
    let offset = chunks[0].length;
    for (let id = 1; id <= maxId; id += 1) {
      const header = bytesFromString(`${id} 0 obj\n`);
      const body = objectChunks[id];
      const footer = bytesFromString('\nendobj\n');
      offsets[id] = offset;
      chunks.push(header, body, footer);
      offset += header.length + body.length + footer.length;
    }
    const xrefOffset = offset;
    let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(bytesFromString(xref));
    return concatBytes(chunks);
  }


  function formatFormDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return safe(value);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  }

  function splitServiceAddress(audit) {
    const direct = {
      street: safe(audit.streetAddress).trim(),
      city: safe(audit.city).trim(),
      state: safe(audit.stateCode || audit.state).trim(),
      zip: safe(audit.zipcode || audit.zip).trim()
    };
    if (direct.street && direct.city && direct.state && direct.zip) return direct;

    const raw = safe(audit.address).replace(/\s+/g, ' ').trim();
    const commaParts = raw.split(',').map(value => value.trim()).filter(Boolean);
    if (commaParts.length >= 4) {
      direct.street ||= commaParts.slice(0, -3).join(', ');
      direct.city ||= commaParts.at(-3);
      direct.state ||= commaParts.at(-2);
      direct.zip ||= commaParts.at(-1);
      return direct;
    }
    if (commaParts.length === 3) {
      direct.street ||= commaParts[0];
      direct.city ||= commaParts[1];
      const stateZip = commaParts[2].match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (stateZip) { direct.state ||= stateZip[1]; direct.zip ||= stateZip[2]; }
      return direct;
    }

    const match = raw.match(/^(.*?)[,\s]+([A-Za-z][A-Za-z .'-]*?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (match) {
      direct.street ||= match[1].replace(/,$/, '').trim();
      direct.city ||= match[2].trim();
      direct.state ||= match[3].toUpperCase();
      direct.zip ||= match[4];
    } else {
      direct.street ||= raw;
    }
    return direct;
  }

  function dataUrlBytes(dataUrl) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(safe(dataUrl));
    if (!match) return null;
    const isBase64 = /;base64,/i.test(dataUrl);
    if (isBase64) return base64ToBytes(match[2]);
    return new TextEncoder().encode(decodeURIComponent(match[2]));
  }

  async function loadTermsTemplateBytes(program) {
    const filename = program === 'PEPCO' ? 'TC_PEPCO.pdf' : 'TC_CA_App.pdf';
    if (typeof window === 'undefined' && typeof require === 'function') {
      const fs = require('node:fs');
      const path = require('node:path');
      return new Uint8Array(fs.readFileSync(path.join(__dirname, 'assets', filename)));
    }
    const response = await fetch(new URL(`assets/${filename}`, document.baseURI), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${program} Terms PDF template could not be loaded (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }

  function fittedFontSize(font, text, width, preferred = 8.5, minimum = 6) {
    let size = preferred;
    while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
    return size;
  }

  function drawFormField(page, font, value, x, lineY, width, preferredSize = 8.5) {
    const text = safe(value).trim();
    page.drawRectangle({ x: x - 1, y: lineY - 1, width: width + 2, height: 13, color: PDFLib.rgb(1, 1, 1) });
    page.drawLine({ start: { x, y: lineY }, end: { x: x + width, y: lineY }, thickness: 0.45, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    if (!text) return;
    const size = fittedFontSize(font, text, width - 3, preferredSize);
    page.drawText(text, { x: x + 1, y: lineY + 2.2, size, font, color: PDFLib.rgb(0, 0, 0), maxWidth: width - 2 });
  }

  async function buildFilledBgeTermsPdfBytes(audit) {
    if (!PDFLib?.PDFDocument) throw new Error('The PDF form component is unavailable. Refresh the app and try again.');
    const template = await loadTermsTemplateBytes('BGE');
    const pdfDoc = await PDFLib.PDFDocument.load(template);
    const pages = pdfDoc.getPages();
    if (pages.length < 3) throw new Error('The BGE Terms PDF template does not contain page 3.');
    const page = pages[2];
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const italic = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    const address = splitServiceAddress(audit);
    const representative = audit.signatureName || audit.contactName || audit.customer || '';
    drawFormField(page, font, audit.customer, 112, 709, 457, 8.5);
    drawFormField(page, font, audit.account, 170, 697, 398, 8.5);
    drawFormField(page, font, address.street, 232, 684, 335, 8.5);
    drawFormField(page, font, address.city, 77, 672, 303, 8.5);
    drawFormField(page, font, address.state, 404, 672, 67, 8.5);
    drawFormField(page, font, address.zip, 488, 672, 79, 8.5);
    drawFormField(page, font, representative, 207, 659, 201, 8.2);
    drawFormField(page, font, audit.contactTitle, 430, 659, 134, 8.2);
    drawFormField(page, font, audit.email, 83, 646, 327, 8.2);
    drawFormField(page, font, audit.phone, 439, 646, 126, 8.2);
    drawFormField(page, font, 'EWPros', 59, 491, 398, 9);
    page.drawRectangle({ x: 196, y: 353, width: 285, height: 38, color: PDFLib.rgb(1, 1, 1) });
    page.drawLine({ start: { x: 197, y: 354 }, end: { x: 480, y: 354 }, thickness: 0.45, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    const signatureBytes = dataUrlBytes(audit.signatureImage);
    if (signatureBytes?.length) {
      const image = /^data:image\/jpe?g/i.test(audit.signatureImage) ? await pdfDoc.embedJpg(signatureBytes) : await pdfDoc.embedPng(signatureBytes);
      const dims = image.scale(1);const scale = Math.min(270 / dims.width, 32 / dims.height);
      page.drawImage(image, { x: 202, y: 357, width: dims.width * scale, height: dims.height * scale });
    } else if (audit.signature || representative) {
      const signatureText = audit.signature || representative;const size = fittedFontSize(italic, signatureText, 268, 14, 9);
      page.drawText(signatureText, { x: 203, y: 360, size, font: italic, color: PDFLib.rgb(0, 0, 0) });
    }
    drawFormField(page, font, formatFormDate(audit.signatureDate || audit.completedAt), 505, 354, 63, 7.5);
    pdfDoc.setTitle(`BGE Terms and Conditions - ${safe(audit.customer)}`);
    pdfDoc.setSubject('Completed BGE Terms and Conditions and Customer Acknowledgement');
    pdfDoc.setAuthor('EWPros');pdfDoc.setCreator('EWPros Auditor PWA');
    return new Uint8Array(await pdfDoc.save({ useObjectStreams: false }));
  }

  function setPdfTextField(form, name, value) {
    try { form.getTextField(name).setText(safe(value).trim()); }
    catch (error) { console.warn(`[PEPCO Terms PDF] Field ${name} could not be filled.`, error); }
  }

  async function drawSignatureInRect(pdfDoc, page, audit, rect) {
    const [x1, y1, x2, y2] = rect;const width=x2-x1,height=y2-y1;
    const signatureBytes=dataUrlBytes(audit.signatureImage);
    if(signatureBytes?.length){const image=/^data:image\/jpe?g/i.test(audit.signatureImage)?await pdfDoc.embedJpg(signatureBytes):await pdfDoc.embedPng(signatureBytes);const dims=image.scale(1);const scale=Math.min((width-8)/dims.width,(height-5)/dims.height);const drawWidth=dims.width*scale,drawHeight=dims.height*scale;page.drawImage(image,{x:x1+4,y:y1+Math.max(2,(height-drawHeight)/2),width:drawWidth,height:drawHeight});return}
    const text=audit.signature||audit.signatureName||audit.contactName||audit.customer||'';if(!text)return;const italic=await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique);const size=fittedFontSize(italic,text,width-8,13,8);page.drawText(text,{x:x1+4,y:y1+Math.max(3,(height-size)/2),size,font:italic,color:PDFLib.rgb(0,0,0)});
  }

  async function buildFilledPepcoTermsPdfBytes(audit) {
    if (!PDFLib?.PDFDocument) throw new Error('The PDF form component is unavailable. Refresh the app and try again.');
    const template = await loadTermsTemplateBytes('PEPCO');
    const pdfDoc = await PDFLib.PDFDocument.load(template);
    const pages = pdfDoc.getPages();if(pages.length<3)throw new Error('The PEPCO Terms PDF template does not contain page 3.');
    const page=pages[2],form=pdfDoc.getForm(),font=await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),address=splitServiceAddress(audit),representative=audit.signatureName||audit.contactName||audit.customer||'';
    setPdfTextField(form,'Project Name',audit.customer);
    setPdfTextField(form,'Project ID as shown in the welcome email',audit.projectId||audit.id||audit.externalTaskId);
    setPdfTextField(form,'Street Address',address.street);setPdfTextField(form,'City',address.city);setPdfTextField(form,'State',address.state);setPdfTextField(form,'Zip',address.zip);
    setPdfTextField(form,'Customer Name',representative);setPdfTextField(form,'Title',audit.contactTitle);setPdfTextField(form,'Email',audit.email);setPdfTextField(form,'Phone Number',audit.phone);
    const signedDate=formatFormDate(audit.signatureDate||audit.completedAt);setPdfTextField(form,'Date19_af_date',signedDate);setPdfTextField(form,'Date20_af_date',signedDate);
    try{form.getCheckBox('Check Box21').check()}catch{}try{form.getCheckBox('Check Box22').uncheck()}catch{}
    form.updateFieldAppearances(font);form.flatten();
    await drawSignatureInRect(pdfDoc,page,audit,[104.4,384.48,383.28,409.92]);await drawSignatureInRect(pdfDoc,page,audit,[104.52,194.64,383.28,220.08]);
    pdfDoc.setTitle(`PEPCO Terms and Conditions - ${safe(audit.customer)}`);pdfDoc.setSubject('Completed PEPCO Terms and Conditions and Customer Acknowledgement');pdfDoc.setAuthor('EWPros');pdfDoc.setCreator('EWPros Auditor PWA');
    return new Uint8Array(await pdfDoc.save({useObjectStreams:false}));
  }

  async function buildFilledTermsPdfBytes(audit) {
    const program=utilityProgramForAudit(audit);
    if(program==='BGE')return buildFilledBgeTermsPdfBytes(audit);
    if(program==='PEPCO')return buildFilledPepcoTermsPdfBytes(audit);
    throw new Error('Utility program is missing or unrecognized. Select BGE or PEPCO in Customer T & C.');
  }

  async function normalizeImageFileToJpeg(file, maxDimension = 1600, quality = 0.82) {
    if (!file) throw new Error('No image selected.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The selected photo could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('The selected photo could not be opened.'));
        image.onload = () => {
          const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function dataUrlMime(dataUrl) { return /^data:([^;,]+)/i.exec(safe(dataUrl))?.[1] || 'image/jpeg'; }

  function photoFilesForAudit(audit) {
    const files=[];const base=buildFileBaseName(audit);
    if(audit.photos?.front){const bytes=dataUrlBytes(audit.photos.front);if(bytes?.length)files.push(new File([bytes],`${base}_Building_Front.jpg`,{type:dataUrlMime(audit.photos.front)}));}
    ['interior','exterior'].forEach(area=>(audit.equipment?.[area]||[]).forEach((item,index)=>{if(!item.photo)return;const bytes=dataUrlBytes(item.photo);if(bytes?.length)files.push(new File([bytes],photoFileName(audit,area,index+1,item),{type:dataUrlMime(item.photo)}));}));
    return files;
  }

  async function createAuditFiles(audit) {
    const baseName=buildFileBaseName(audit),program=utilityProgramForAudit(audit);
    if(!program)throw new Error('Utility program is missing or unrecognized. Select BGE or PEPCO in Customer T & C.');
    let pdfBytes;try{pdfBytes=await buildFilledTermsPdfBytes(audit)}catch(error){console.error(`[${program} Terms PDF]`,error);throw error}
    const enriched={...audit,signedUtility:audit.signedUtility||program,templateVersion:audit.templateVersion||templateVersionForProgram(program)};
    const csv=buildAuditCsv(enriched);
    const files=[new File([pdfBytes],`${baseName}_${program}_Terms.pdf`,{type:'application/pdf'}),new File([`﻿${csv}`],`${baseName}.csv`,{type:'text/csv;charset=utf-8'}),...photoFilesForAudit(audit)];
    files.program=program;return files;
  }

  function downloadFile(file) {const url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download=file.name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}

  async function shareOrDownloadAudit(audit) {
    const files=await createAuditFiles(audit),program=files.program||utilityProgramForAudit(audit);
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){try{await navigator.share({title:`${program} Terms - ${audit.customer||audit.id}`,text:`Completed ${program} Terms and Conditions PDF, EWPros audit CSV, and captured audit photos.`,files});return{mode:'shared',files,program}}catch(error){if(error?.name==='AbortError')return{mode:'cancelled',files,program};console.warn('[Audit Export] Share failed; using downloads.',error)}}
    files.forEach((file,index)=>setTimeout(()=>downloadFile(file),index*350));return{mode:'downloaded',files,program};
  }

  return {
    buildAuditCsv,
    buildAuditPdfBytes,
    buildFilledTermsPdfBytes,
    buildFilledBgeTermsPdfBytes,
    buildFilledPepcoTermsPdfBytes,
    normalizeUtilityProgram,
    templateVersionForProgram,
    splitServiceAddress,
    buildFileBaseName,
    createAuditFiles,
    normalizeImageFileToJpeg,
    shareOrDownloadAudit
  };
});
