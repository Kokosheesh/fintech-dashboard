/**
 * Founder's Seat — waitlist capture.
 * Each POST from the landing page appends one row to the "Waitlist" tab of
 * the Google Sheet below. Duplicate emails are ignored.
 *
 * Deploy: Deploy → New deployment → Web app
 *   Execute as: Me    Who has access: Anyone
 * Copy the /exec URL into WAITLIST_ENDPOINT in index.html.
 */
const SPREADSHEET_ID = '1qRCfzjut-m9lE6Kw2xSNJ4ZR0h-i9eDbNtPTQfdcLd8';
const SHEET_NAME = 'Waitlist';
const HEADERS = ['Timestamp', 'Email', 'Role', 'Form', 'UTM source', 'UTM medium', 'UTM campaign', 'Referrer', 'Page'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    const email = String(p.email || '').trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'invalid_email' });

    const sheet = getSheet_();
    const last = sheet.getLastRow();
    if (last > 1) {
      const existing = sheet.getRange(2, 2, last - 1, 1).getValues().flat();
      if (existing.indexOf(email) !== -1) return json_({ ok: true, duplicate: true });
    }
    const clip = (v) => String(v || '').slice(0, 500);
    sheet.appendRow([
      new Date(), email, clip(p.role), clip(p.source),
      clip(p.utm_source), clip(p.utm_medium), clip(p.utm_campaign),
      clip(p.referrer), clip(p.page)
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: "Founder's Seat waitlist" });
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
