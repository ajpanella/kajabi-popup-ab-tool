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
  var sheet = getSheet();
  ensureHeaders(sheet);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var fields = ["timestamp", "testId", "configVersion", "changeNote", "variant", "variantLabel", "snapshotKey", "eventType", "pageUrl", "deviceType", "sessionId"];
  var rows = [];
  var snapshotRows = {};
  var snapshots = {};
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

  if (rowCount) {
    var af = sheet.getRange(2, 1, rowCount, 6).getValues();
    var hi = sheet.getRange(2, 8, rowCount, 2).getDisplayValues();
    var deviceTypes = sheet.getRange(2, 12, rowCount, 1).getDisplayValues();
    var sessionIds = sheet.getRange(2, 19, rowCount, 1).getDisplayValues();

    for (var i = 0; i < rowCount; i += 1) {
      var rowTestId = String(af[i][1] || "");
      if (testId && rowTestId !== testId) continue;
      var version = normalizePulseVersion(af[i][2] || "unversioned");
      var variant = String(af[i][4] || "Unknown");
      var label = String(af[i][5] || "");
      if (version === "6/30/2026" && label.indexOf("Flow: Single-step") >= 0) {
        version = "6/30/2026 Single Step";
      }
      var snapshotKey = rowTestId + "::" + version + "::" + variant;
      if (!snapshotRows[snapshotKey]) snapshotRows[snapshotKey] = i + 2;
      var timestamp = pulseDate(af[i][0]);
      rows.push([
        timestamp ? timestamp.toISOString() : String(af[i][0] || ""),
        rowTestId,
        version,
        String(af[i][3] || ""),
        variant,
        label,
        snapshotKey,
        String(hi[i][0] || ""),
        String(hi[i][1] || ""),
        String(deviceTypes[i][0] || ""),
        String(sessionIds[i][0] || "")
      ].map(encodeValue));
    }
  }

  var snapshotKeys = Object.keys(snapshotRows);
  var ranges = snapshotKeys.length
    ? sheet.getRangeList(snapshotKeys.map(function (key) { return "G" + snapshotRows[key]; })).getRanges()
    : [];
  snapshotKeys.forEach(function (key, index) {
    snapshots[key] = compactDashboardSnapshot(ranges[index] ? ranges[index].getDisplayValue() : "");
  });

  return {
    ok: true,
    schemaVersion: 2,
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
  var cacheKey = "pulse-v2-" + (testId || "all");
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var sheet = getSheet();
  ensureHeaders(sheet);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var groups = {};

  if (rowCount) {
    var abc = sheet.getRange(2, 1, rowCount, 3).getValues();
    var ef = sheet.getRange(2, 5, rowCount, 2).getDisplayValues();
    var eventTypes = sheet.getRange(2, 8, rowCount, 1).getDisplayValues();
    var sessionIds = sheet.getRange(2, 19, rowCount, 1).getDisplayValues();

    for (var i = 0; i < rowCount; i += 1) {
      var rowTestId = String(abc[i][1] || "");
      if (testId && rowTestId !== testId) continue;
      var version = normalizePulseVersion(abc[i][2] || "unversioned");
      var variant = String(ef[i][0] || "Unknown");
      if (version === "6/30/2026" && String(ef[i][1] || "").indexOf("Flow: Single-step") >= 0) {
        version = "6/30/2026 Single Step";
      }
      var key = rowTestId + "::" + version + "::" + variant;
      if (!groups[key]) {
        groups[key] = {
          testId: rowTestId,
          version: version,
          variant: variant,
          label: String(ef[i][1] || ""),
          firstSeen: pulseDate(abc[i][0]),
          snapshotRow: i + 2,
          sessions: {},
          actionSessions: {},
          quizSessions: {},
          leadSessions: {},
          views: 0,
          actions: 0,
          quizEvents: 0,
          leadEvents: 0
        };
      }
      accumulatePulseGroup(groups[key], eventTypes[i][0], sessionIds[i][0]);
      var timestamp = pulseDate(abc[i][0]);
      if (timestamp && (!groups[key].firstSeen || timestamp < groups[key].firstSeen)) {
        groups[key].firstSeen = timestamp;
      }
    }
  }

  var groupKeys = Object.keys(groups);
  var snapshotRanges = groupKeys.length
    ? sheet.getRangeList(groupKeys.map(function (key) { return "G" + groups[key].snapshotRow; })).getRanges()
    : [];
  var results = groupKeys.map(function (key, index) {
    var group = groups[key];
    Object.keys(group.actionSessions).forEach(function (sessionId) {
      group.sessions[sessionId] = true;
    });
    var sessions = Object.keys(group.sessions).length || Math.max(group.views, group.actions, group.leadEvents);
    var quizCompletions = Object.keys(group.quizSessions).length || group.quizEvents;
    var leads = Object.keys(group.leadSessions).length || group.leadEvents;
    var snapshotValue = snapshotRanges[index] ? snapshotRanges[index].getDisplayValue() : "";
    return {
      testId: group.testId,
      version: group.version,
      variant: group.variant,
      label: group.label,
      firstSeen: group.firstSeen ? group.firstSeen.toISOString() : "",
      sessions: sessions,
      quizCompletions: quizCompletions,
      leads: leads,
      snapshot: compactPulseSnapshot(snapshotValue)
    };
  });

  var response = {
    ok: true,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rowsProcessed: rowCount,
    testId: testId,
    groups: results
  };
  var serialized = JSON.stringify(response);
  if (serialized.length < 95000) cache.put(cacheKey, serialized, 300);
  return response;
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
    var source = JSON.parse(value);
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
