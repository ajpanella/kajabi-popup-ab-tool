import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/andrewpanella/Documents/New project 2/outputs";
const outputPath = `${outputDir}/kajabi-popup-events.xlsx`;

const headers = [
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

const workbook = Workbook.create();
const events = workbook.worksheets.add("Popup Events");
events.showGridLines = false;
events.freezePanes.freezeRows(1);

events.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
events.getRangeByIndexes(1, 0, 5, headers.length).values = Array.from({ length: 5 }, () => headers.map(() => ""));
events.tables.add(`A1:AG6`, true, "PopupEventsTable");
events.getRange("A1:AG1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true
};
events.getRange("A:AG").format = {
  wrapText: true
};
events.getRange("A:A").format.columnWidthPx = 170;
events.getRange("B:F").format.columnWidthPx = 150;
events.getRange("G:G").format.columnWidthPx = 300;
events.getRange("H:H").format.columnWidthPx = 150;
events.getRange("I:K").format.columnWidthPx = 240;
events.getRange("L:X").format.columnWidthPx = 150;

const readme = workbook.worksheets.add("Setup Notes");
readme.showGridLines = false;
readme.getRange("A1:D1").values = [["Kajabi Popup A/B Tracker", "", "", ""]];
readme.getRange("A1:D1").merge();
readme.getRange("A1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF", size: 16 }
};
readme.getRange("A3:D7").values = [
  ["Step", "What to do", "Where", "Notes"],
  ["1", "Deploy Google Apps Script webhook", "Extensions > Apps Script", "Paste server/google-apps-script.js."],
  ["2", "Use this spreadsheet as the active sheet", "Apps Script bound to this file", "Rows append to the Popup Events tab."],
  ["3", "Publish Popup Events as CSV", "File > Share > Publish to web", "Use the published CSV URL in the dashboard."],
  ["4", "Paste webhook URL into dashboard", "Dashboard > Webhook URL", "Save & Test will write variant_save_test rows."]
];
readme.getRange("A3:D3").format = {
  fill: "#E5E7EB",
  font: { bold: true }
};
readme.getRange("A:D").format = { wrapText: true };
readme.getRange("A:A").format.columnWidthPx = 80;
readme.getRange("B:D").format.columnWidthPx = 260;

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 2000
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan"
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Popup Events",
  range: "A1:H6",
  scale: 1,
  format: "png"
});
await fs.writeFile(`${outputDir}/kajabi-popup-events-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);
console.log(outputPath);
