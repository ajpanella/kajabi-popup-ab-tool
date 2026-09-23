var SPREADSHEET_ID = "1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w";
var SHEET_NAME = "Popup Events";
var COMPACT_SHEET_NAME = "Popup Compact Events";
var SNAPSHOT_SHEET_NAME = "Popup Variant Snapshots";
var PULSE_GROUP_SHEET_NAME = "Popup Pulse Summary";
var PULSE_SESSION_SHEET_NAME = "Popup Pulse Sessions";
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

var COMPACT_HEADERS = [
  "timestamp", "testId", "configVersion", "changeNote", "variant", "variantLabel",
  "snapshotKey", "eventType", "pageUrl", "deviceType", "sessionId", "rawRow"
];
var SNAPSHOT_HEADERS = ["key", "snapshot"];
var PULSE_GROUP_HEADERS = [
  "key", "testId", "configVersion", "variant", "variantLabel", "changeNote",
  "firstSeen", "lastSeen", "sessions", "quizCompletions", "leads", "snapshotKey"
];
var PULSE_SESSION_HEADERS = ["key", "groupKey", "sessionCounted", "quizCounted", "leadCounted"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Popup Tracker")
    .addItem("Rebuild fast summaries", "rebuildTrackingSummaries")
    .addToUi();
}

function doPost(e) {
  var payload = parsePayload(e);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    ensureHeaders(sheet);
    var timestamp = payload.timestamp || new Date().toISOString();
    payload.timestamp = timestamp;
    sheet.appendRow(HEADERS.map(function (header) {
      if (header === "timestamp") return timestamp;
      return payload[header] || "";
    }));
    var rawRow = sheet.getLastRow();
    updateFastTrackingSheets(payload, rawRow);
  } finally {
    lock.releaseLock();
  }

  return textResponse("ok");
}

function doGet(e) {
  if (e && e.parameter && e.parameter.mode === "pulse") {
    return jsonResponse(buildPulseSummary(e.parameter.testId || ""));
  }
  if (e && e.parameter && e.parameter.mode === "dashboard") {
    return jsonResponse(buildDashboardData(e.parameter.testId || ""));
  }
  return textResponse("Kajabi popup webhook is running.");
}

function buildDashboardData(testId) {
  var sheet = getSupportSheet(COMPACT_SHEET_NAME, COMPACT_HEADERS);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var fields = COMPACT_HEADERS.slice();
  var rows = [];
  var dictionary = [];
  var dictionaryIndexes = {};

  function encodeValue(value) {
    var text = String(value == null ? "" : value);
    var key = "$" + text;
    if (Object.prototype.hasOwnProperty.call(dictionaryIndexes, key)) return dictionaryIndexes[key];
    var index = dictionary.length;
    dictionary.push(text);
    dictionaryIndexes[key] = index;
    return index;
  }

  var batchSize = 10000;
  for (var offset = 0; offset < rowCount; offset += batchSize) {
    var batchRows = Math.min(batchSize, rowCount - offset);
    var values = sheet.getSheetValues(offset + 2, 1, batchRows, COMPACT_HEADERS.length);
    for (var i = 0; i < values.length; i += 1) {
      if (testId && String(values[i][1] || "") !== testId) continue;
      rows.push(values[i].map(encodeValue));
    }
  }

  var snapshots = readSnapshotMap();

  return {
    ok: true,
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    rowsProcessed: rowCount,
    sourceBytes: 0,
    fields: fields,
    dictionary: dictionary,
    snapshots: snapshots,
    rows: rows
  };
}

function compactDashboardSnapshot(value) {
  if (!value) return null;
  try {
    var snapshot = JSON.parse(value);
    delete snapshot.trackingFingerprint;
    delete snapshot.trackingSources;
    return snapshot;
  } catch (error) {
    return null;
  }
}

function buildPulseSummary(testId) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "pulse-summary-v1-" + (testId || "all");
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var sheet = getSupportSheet(PULSE_GROUP_SHEET_NAME, PULSE_GROUP_HEADERS);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var values = rowCount ? sheet.getSheetValues(2, 1, rowCount, PULSE_GROUP_HEADERS.length) : [];
  var snapshots = readSnapshotMap();
  var results = values.filter(function (row) {
    return !testId || String(row[1] || "") === testId;
  }).map(function (row) {
    return {
      testId: String(row[1] || ""),
      version: String(row[2] || "unversioned"),
      variant: String(row[3] || "Unknown"),
      label: String(row[4] || ""),
      firstSeen: isoDate(row[6]),
      sessions: Number(row[8] || 0),
      quizCompletions: Number(row[9] || 0),
      leads: Number(row[10] || 0),
      snapshot: compactPulseSnapshot(snapshots[String(row[11] || row[0] || "")])
    };
  });

  var response = {
    ok: true,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    rowsProcessed: Math.max(0, getSheet().getLastRow() - 1),
    testId: testId,
    groups: results
  };
  var serialized = JSON.stringify(response);
  if (serialized.length < 95000) cache.put(cacheKey, serialized, 30);
  return response;
}

function updateFastTrackingSheets(payload, rawRow) {
  var meta = trackingMeta(payload, rawRow);
  var compactSheet = getSupportSheet(COMPACT_SHEET_NAME, COMPACT_HEADERS);
  if (!findValueRow(compactSheet, COMPACT_HEADERS.length, String(rawRow))) {
    compactSheet.appendRow([
      meta.timestamp, meta.testId, meta.version, meta.changeNote, meta.variant, meta.label,
      meta.groupKey, meta.eventType, meta.pageUrl, meta.deviceType, meta.sessionId, rawRow
    ]);
  }
  storeVariantSnapshot(meta.groupKey, payload.variantSnapshot || "");
  updatePulseState(meta);
  clearTrackingCaches(meta.testId);
}

function trackingMeta(payload, rawRow) {
  var testId = String(payload.testId || "");
  var label = String(payload.variantLabel || "");
  var version = normalizePulseVersion(payload.configVersion || "unversioned");
  if (version === "6/30/2026" && label.indexOf("Flow: Single-step") >= 0) {
    version = "6/30/2026 Single Step";
  }
  var variant = String(payload.variant || "Unknown");
  return {
    timestamp: isoDate(payload.timestamp) || new Date().toISOString(),
    testId: testId,
    version: version,
    changeNote: String(payload.changeNote || ""),
    variant: variant,
    label: label,
    groupKey: [testId, version, variant].join("::"),
    eventType: normalizePulseEvent(payload.eventType || ""),
    pageUrl: String(payload.pageUrl || ""),
    deviceType: String(payload.deviceType || ""),
    sessionId: String(payload.sessionId || ""),
    pulseSessionId: String(payload.sessionId || "") || "event-row-" + rawRow,
    rawRow: rawRow
  };
}

function storeVariantSnapshot(key, value) {
  if (!value) return;
  var sheet = getSupportSheet(SNAPSHOT_SHEET_NAME, SNAPSHOT_HEADERS);
  if (findKeyRow(sheet, key)) return;
  var compact = compactDashboardSnapshot(value);
  sheet.appendRow([key, compact ? JSON.stringify(compact) : String(value)]);
}

function updatePulseState(meta) {
  var sessionSheet = getSupportSheet(PULSE_SESSION_SHEET_NAME, PULSE_SESSION_HEADERS);
  var sessionKey = meta.groupKey + "::" + meta.pulseSessionId;
  var sessionRow = findKeyRow(sessionSheet, sessionKey);
  var sessionValues = sessionRow
    ? sessionSheet.getRange(sessionRow, 1, 1, PULSE_SESSION_HEADERS.length).getValues()[0]
    : [sessionKey, meta.groupKey, false, false, false];
  var countedSession = sessionValues[2] === true || String(sessionValues[2]).toLowerCase() === "true";
  var countedQuiz = sessionValues[3] === true || String(sessionValues[3]).toLowerCase() === "true";
  var countedLead = sessionValues[4] === true || String(sessionValues[4]).toLowerCase() === "true";
  var countsAsSession = [
    "popup_view", "popup_quiz_submit", "popup_submit_attempt", "popup_lead_submit", "kajabi_form_submitted"
  ].indexOf(meta.eventType) >= 0;
  var sessionDelta = countsAsSession && !countedSession ? 1 : 0;
  var quizDelta = meta.eventType === "popup_quiz_submit" && !countedQuiz ? 1 : 0;
  var leadDelta = (meta.eventType === "popup_lead_submit" || meta.eventType === "kajabi_form_submitted") && !countedLead ? 1 : 0;

  sessionValues[2] = countedSession || countsAsSession;
  sessionValues[3] = countedQuiz || meta.eventType === "popup_quiz_submit";
  sessionValues[4] = countedLead || meta.eventType === "popup_lead_submit" || meta.eventType === "kajabi_form_submitted";
  if (sessionRow) sessionSheet.getRange(sessionRow, 1, 1, PULSE_SESSION_HEADERS.length).setValues([sessionValues]);
  else sessionSheet.appendRow(sessionValues);

  var groupSheet = getSupportSheet(PULSE_GROUP_SHEET_NAME, PULSE_GROUP_HEADERS);
  var groupRow = findKeyRow(groupSheet, meta.groupKey);
  var groupValues = groupRow
    ? groupSheet.getRange(groupRow, 1, 1, PULSE_GROUP_HEADERS.length).getValues()[0]
    : [meta.groupKey, meta.testId, meta.version, meta.variant, meta.label, meta.changeNote, meta.timestamp, meta.timestamp, 0, 0, 0, meta.groupKey];
  if (meta.label) groupValues[4] = meta.label;
  if (meta.changeNote) groupValues[5] = meta.changeNote;
  if (!groupValues[6] || meta.timestamp < isoDate(groupValues[6])) groupValues[6] = meta.timestamp;
  if (!groupValues[7] || meta.timestamp > isoDate(groupValues[7])) groupValues[7] = meta.timestamp;
  groupValues[8] = Number(groupValues[8] || 0) + sessionDelta;
  groupValues[9] = Number(groupValues[9] || 0) + quizDelta;
  groupValues[10] = Number(groupValues[10] || 0) + leadDelta;
  if (groupRow) groupSheet.getRange(groupRow, 1, 1, PULSE_GROUP_HEADERS.length).setValues([groupValues]);
  else groupSheet.appendRow(groupValues);
}

function rebuildTrackingSummaries() {
  var rawSheet = getSheet();
  ensureHeaders(rawSheet);
  var initialLastRow = rawSheet.getLastRow();
  var rowCount = Math.max(0, initialLastRow - 1);
  var compactSheet = resetSupportSheet(COMPACT_SHEET_NAME, COMPACT_HEADERS);
  var snapshotSheet = resetSupportSheet(SNAPSHOT_SHEET_NAME, SNAPSHOT_HEADERS);
  var groupSheet = resetSupportSheet(PULSE_GROUP_SHEET_NAME, PULSE_GROUP_HEADERS);
  var sessionSheet = resetSupportSheet(PULSE_SESSION_SHEET_NAME, PULSE_SESSION_HEADERS);
  var groups = {};
  var snapshotRows = {};
  var batchSize = 20000;

  for (var offset = 0; offset < rowCount; offset += batchSize) {
    var batchRows = Math.min(batchSize, rowCount - offset);
    var startRow = offset + 2;
    var af = rawSheet.getSheetValues(startRow, 1, batchRows, 6);
    var hi = rawSheet.getSheetValues(startRow, 8, batchRows, 2);
    var deviceTypes = rawSheet.getSheetValues(startRow, 12, batchRows, 1);
    var sessionIds = rawSheet.getSheetValues(startRow, 19, batchRows, 1);
    var compactRows = [];

    for (var i = 0; i < batchRows; i += 1) {
      var rawRow = startRow + i;
      var payload = {
        timestamp: af[i][0], testId: af[i][1], configVersion: af[i][2], changeNote: af[i][3],
        variant: af[i][4], variantLabel: af[i][5], eventType: hi[i][0], pageUrl: hi[i][1],
        deviceType: deviceTypes[i][0], sessionId: sessionIds[i][0]
      };
      var meta = trackingMeta(payload, rawRow);
      compactRows.push([
        meta.timestamp, meta.testId, meta.version, meta.changeNote, meta.variant, meta.label,
        meta.groupKey, meta.eventType, meta.pageUrl, meta.deviceType, meta.sessionId, rawRow
      ]);
      if (!snapshotRows[meta.groupKey]) snapshotRows[meta.groupKey] = rawRow;
      if (!groups[meta.groupKey]) {
        groups[meta.groupKey] = {
          meta: meta,
          firstSeen: pulseDate(meta.timestamp),
          lastSeen: pulseDate(meta.timestamp),
          sessions: {}, actionSessions: {}, quizSessions: {}, leadSessions: {},
          views: 0, actions: 0, quizEvents: 0, leadEvents: 0
        };
      }
      var group = groups[meta.groupKey];
      if (meta.label) group.meta.label = meta.label;
      if (meta.changeNote) group.meta.changeNote = meta.changeNote;
      accumulatePulseGroup(group, meta.eventType, meta.sessionId);
      var timestamp = pulseDate(meta.timestamp);
      if (timestamp && (!group.firstSeen || timestamp < group.firstSeen)) group.firstSeen = timestamp;
      if (timestamp && (!group.lastSeen || timestamp > group.lastSeen)) group.lastSeen = timestamp;
    }
    writeRows(compactSheet, compactRows);
  }

  var snapshots = readRawSnapshots(rawSheet, snapshotRows);
  var snapshotOutput = Object.keys(snapshots).map(function (key) {
    var compact = compactDashboardSnapshot(snapshots[key]);
    return [key, compact ? JSON.stringify(compact) : String(snapshots[key] || "")];
  });
  writeRows(snapshotSheet, snapshotOutput);

  var groupOutput = [];
  var sessionOutput = [];
  Object.keys(groups).forEach(function (key) {
    var group = groups[key];
    Object.keys(group.actionSessions).forEach(function (sessionId) { group.sessions[sessionId] = true; });
    var sessions = Object.keys(group.sessions);
    var quizSessions = Object.keys(group.quizSessions);
    var leadSessions = Object.keys(group.leadSessions);
    var sessionUnion = {};
    sessions.concat(quizSessions, leadSessions).forEach(function (sessionId) { sessionUnion[sessionId] = true; });
    Object.keys(sessionUnion).forEach(function (sessionId) {
      sessionOutput.push([
        key + "::" + sessionId,
        key,
        Boolean(group.sessions[sessionId]),
        Boolean(group.quizSessions[sessionId]),
        Boolean(group.leadSessions[sessionId])
      ]);
    });
    groupOutput.push([
      key, group.meta.testId, group.meta.version, group.meta.variant, group.meta.label, group.meta.changeNote,
      group.firstSeen ? group.firstSeen.toISOString() : "",
      group.lastSeen ? group.lastSeen.toISOString() : "",
      sessions.length || Math.max(group.views, group.actions, group.leadEvents),
      quizSessions.length || group.quizEvents,
      leadSessions.length || group.leadEvents,
      key
    ]);
  });
  writeRows(groupSheet, groupOutput);
  writeRows(sessionSheet, sessionOutput);

  var currentLastRow = rawSheet.getLastRow();
  for (var catchUpRow = initialLastRow + 1; catchUpRow <= currentLastRow; catchUpRow += 1) {
    updateFastTrackingSheets(payloadFromRawRow(rawSheet, catchUpRow), catchUpRow);
  }
  clearTrackingCaches("");
  PropertiesService.getScriptProperties().setProperty("TRACKING_SUMMARY_READY_AT", new Date().toISOString());
  return "Rebuilt fast summaries for " + rowCount + " existing events.";
}

function payloadFromRawRow(sheet, rowNumber) {
  var values = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  return HEADERS.reduce(function (payload, header, index) {
    payload[header] = values[index];
    return payload;
  }, {});
}

function readRawSnapshots(sheet, snapshotRows) {
  var result = {};
  var keys = Object.keys(snapshotRows);
  var batchSize = 100;
  for (var offset = 0; offset < keys.length; offset += batchSize) {
    var batch = keys.slice(offset, offset + batchSize);
    var ranges = sheet.getRangeList(batch.map(function (key) { return "G" + snapshotRows[key]; })).getRanges();
    batch.forEach(function (key, index) {
      result[key] = ranges[index] ? ranges[index].getDisplayValue() : "";
    });
  }
  return result;
}

function readSnapshotMap() {
  var sheet = getSupportSheet(SNAPSHOT_SHEET_NAME, SNAPSHOT_HEADERS);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var values = rowCount ? sheet.getSheetValues(2, 1, rowCount, SNAPSHOT_HEADERS.length) : [];
  return values.reduce(function (map, row) {
    var value = String(row[1] || "");
    try { map[String(row[0] || "")] = JSON.parse(value); }
    catch (error) { map[String(row[0] || "")] = value; }
    return map;
  }, {});
}

function getSupportSheet(name, headers) {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureSheetHeaders(sheet, headers);
  try { if (!sheet.isSheetHidden()) sheet.hideSheet(); } catch (error) {}
  return sheet;
}

function resetSupportSheet(name, headers) {
  var sheet = getSupportSheet(name, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSheetHeaders(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var mismatch = headers.some(function (header, index) { return current[index] !== header; });
  if (mismatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function writeRows(sheet, rows) {
  if (!rows.length) return;
  var batchSize = 5000;
  for (var offset = 0; offset < rows.length; offset += batchSize) {
    var batch = rows.slice(offset, offset + batchSize);
    sheet.getRange(sheet.getLastRow() + 1, 1, batch.length, batch[0].length).setValues(batch);
  }
}

function findKeyRow(sheet, key) {
  return findValueRow(sheet, 1, key);
}

function findValueRow(sheet, column, value) {
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  if (!rowCount) return 0;
  var match = sheet.getRange(2, column, rowCount, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function clearTrackingCaches(testId) {
  var cache = CacheService.getScriptCache();
  if (testId) cache.remove("pulse-summary-v1-" + testId);
  cache.remove("pulse-summary-v1-all");
}

function isoDate(value) {
  var date = pulseDate(value);
  return date ? date.toISOString() : String(value || "");
}

function accumulatePulseGroup(group, rawType, rawSessionId) {
  var type = normalizePulseEvent(rawType);
  var sessionId = String(rawSessionId || "");
  if (["popup_quiz_submit", "popup_lead_submit", "kajabi_form_submitted", "popup_submit_attempt"].indexOf(type) >= 0) {
    group.actions += 1;
    if (sessionId) group.actionSessions[sessionId] = true;
  }
  if (type === "popup_view") {
    group.views += 1;
    if (sessionId) group.sessions[sessionId] = true;
  }
  if (type === "popup_quiz_submit") {
    group.quizEvents += 1;
    if (sessionId) group.quizSessions[sessionId] = true;
  }
  if (type === "popup_lead_submit" || type === "kajabi_form_submitted") {
    group.leadEvents += 1;
    if (sessionId) group.leadSessions[sessionId] = true;
  }
}

function normalizePulseEvent(value) {
  var raw = String(value || "").trim().toLowerCase();
  var normalized = raw.replace(/[^a-z0-9]/g, "");
  var aliases = {
    popupview: "popup_view", view: "popup_view", impression: "popup_view",
    popupquizsubmit: "popup_quiz_submit", quizsubmit: "popup_quiz_submit", quizcompletion: "popup_quiz_submit",
    popupsubmitattempt: "popup_submit_attempt", submitattempt: "popup_submit_attempt", submit: "popup_submit_attempt",
    popupleadsubmit: "popup_lead_submit", leadsubmit: "popup_lead_submit", lead: "popup_lead_submit",
    kajabiformsubmitted: "kajabi_form_submitted", formsubmitted: "kajabi_form_submitted"
  };
  return aliases[normalized] || raw;
}

function normalizePulseVersion(value) {
  var version = String(value || "");
  var automatic = version.match(/^test-(\d{4})(\d{2})(\d{2})(?:\d{4})?$/);
  return automatic ? Number(automatic[2]) + "/" + Number(automatic[3]) + "/" + automatic[1] : (version || "unversioned");
}

function pulseDate(value) {
  var date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date : null;
}

function compactPulseSnapshot(value) {
  if (!value) return null;
  try {
    var source = typeof value === "string" ? JSON.parse(value) : value;
    var compact = pickPulseFields(source, [
      "headline", "headlineHtml", "subheadline", "subheadlineHtml", "buttonText", "imageUrl",
      "accentColor", "brandAccentColor", "backgroundColor", "textColor", "width", "fontFamily",
      "textAlign", "headlineFontWeight", "bodyFontWeight", "buttonFontWeight"
    ]);
    compact.flowSteps = (source.flowSteps || []).map(function (step) {
      return pickPulseFields(step, [
        "enabled", "type", "headline", "headlineHtml", "subheadline", "subheadlineHtml", "buttonText",
        "imageUrl", "emailPlaceholder", "progressEnabled", "progressLabel"
      ]);
    });
    compact.proteinQuiz = pickPulseFields(source.proteinQuiz || {}, [
      "showQuizStep", "showFirstName", "progressEnabled", "multiStepEnabled", "progressSingleStepLabel",
      "emailPlaceholder", "leadHeadline", "leadSubheadline", "leadButtonText"
    ]);
    return compact;
  } catch (error) {
    return null;
  }
}

function pickPulseFields(source, fields) {
  return fields.reduce(function (result, field) {
    if (source && source[field] !== undefined && source[field] !== null && source[field] !== "") {
      result[field] = source[field];
    }
    return result;
  }, {});
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

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
