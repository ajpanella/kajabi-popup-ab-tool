var SHEET_NAME = "Popup Events";
var HEADERS = [
  "timestamp",
  "testId",
  "configVersion",
  "changeNote",
  "variant",
  "variantLabel",
  "variantSnapshot",
  "eventType",
  "pageUrl",
  "pageTitle",
  "referrer",
  "deviceType",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "userAgent",
  "sessionId",
  "email",
  "name",
  "targetWeightLbs",
  "age",
  "strengthDays",
  "source",
  "ctaVariant",
  "popupVariant",
  "createdAt",
  "formName",
  "tag"
];

function doPost(e) {
  var payload = parsePayload(e);
  var sheet = getSheet();
  ensureHeaders(sheet);

  sheet.appendRow(HEADERS.map(function (header) {
    if (header === "timestamp") return payload.timestamp || new Date().toISOString();
    return payload[header] || "";
  }));

  return jsonResponse({ ok: true });
}

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Kajabi popup webhook is running."
  });
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return e.parameter || {};
  }
}

function getSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  return sheet || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders(sheet) {
  var range = sheet.getRange(1, 1, 1, HEADERS.length);
  var current = range.getValues()[0];
  var hasHeaders = current.some(function (value) {
    return Boolean(value);
  });

  if (!hasHeaders) {
    range.setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  HEADERS.forEach(function (header, index) {
    if (current[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
