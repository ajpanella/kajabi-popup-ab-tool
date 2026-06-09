var SPREADSHEET_ID = "1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w";
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
  "TargetWeight",
  "age",
  "Age",
  "strengthDays",
  "StrengthDays",
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

  return textResponse("ok");
}

function doGet() {
  return textResponse("Kajabi popup webhook is running.");
}

function parsePayload(e) {
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }

  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function getSheet() {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
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

function textResponse(message) {
  return ContentService.createTextOutput(message);
}
