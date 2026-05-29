# Kajabi Popup A/B Tool Install

## 1. Configure the popup

Edit `popup/variants.js`:

- Set `testId` to a stable experiment name.
- Set `webhookUrl` to your deployed Google Apps Script Web App URL.
- Replace `kajabiFormEmbed` with the single JavaScript embed line from your Kajabi form.
- If Kajabi's embed does not render reliably, use `formMode: "zapier"` and paste a Zapier Catch Hook URL into `leadWebhookUrl`. The popup will render its own Name and Email fields and send the lead data to Zapier.
- Use the dashboard's saved color palette and text alignment controls to keep visual tests consistent.
- If the Kajabi fields do not appear in local preview, set `kajabiEmbedMode` to `iframe` or use the dashboard's `Kajabi embed mode` control. Some third-party embeds behave differently when injected into an already-loaded page.
- Set `Delay seconds` to control the time-based popup trigger. The popup also supports the `Scroll trigger %` setting.
- Adjust the active variants and `trafficSplit` values. Traffic splits are weighted and do not need to total 100, though that is easier to read.

Every variant uses the same `kajabiFormEmbed`, so Kajabi form automations still handle tags, email sequences, offers, and other follow-up actions.

## 2. Create the Google Sheet

Create a Google Sheet with a tab named `Popup Events`.

This project has a dedicated starter tracker here:

```text
https://docs.google.com/spreadsheets/d/1qIp6VXteTDFmDH60CSkXhssxKZ3Iwb96C_ezVdREGHY
```

Use these columns:

```text
timestamp
testId
configVersion
changeNote
variant
variantLabel
variantSnapshot
eventType
pageUrl
pageTitle
referrer
deviceType
utm_source
utm_medium
utm_campaign
utm_content
utm_term
userAgent
sessionId
```

The Apps Script also accepts optional downstream submission fields:

```text
email
name
createdAt
formName
tag
```

## 3. Deploy the webhook

1. In the Google Sheet, open `Extensions > Apps Script`.
2. Paste the contents of `server/google-apps-script.js`.
3. Deploy as a Web App.
4. Set access to allow anonymous requests if the popup will post directly from public blog pages.
5. Copy the Web App URL into `webhookUrl` in `popup/variants.js`.

## 4. Add the popup to Kajabi blog articles

Upload or host these files somewhere public:

- `popup/variants.js`
- `popup/popup.css`
- `popup/popup.js`

Then add this to the Kajabi blog custom code area or a shared blog article template:

```html
<link rel="stylesheet" href="https://YOUR-HOST/popup/popup.css">
<script src="https://YOUR-HOST/popup/variants.js"></script>
<script src="https://YOUR-HOST/popup/popup.js" defer></script>
```

The popup appears after 35 seconds or 50% scroll depth. Closing it creates a 7-day cooldown. A submit attempt creates a 90-day cooldown.

### GitHub Pages hosting

This project is ready to host from GitHub Pages. Publish the repository from the `main` branch, then enable:

```text
Settings > Pages > Build and deployment > Deploy from a branch
Branch: main
Folder: / (root)
```

After GitHub Pages deploys, use the Pages URL as the dashboard's `Public asset base URL`, for example:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME
```

The live Kajabi embed should then use:

```html
<link rel="stylesheet" href="https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/popup/popup.css">
<script src="https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/popup/variants.js"></script>
<script src="https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME/popup/popup.js" defer></script>
```

## 5. Keep the Kajabi embed URL stable

Host the popup files at stable public URLs, for example:

```text
https://YOUR-HOST/kajabi-popup-ab-tool/popup/variants.js
https://YOUR-HOST/kajabi-popup-ab-tool/popup/popup.css
https://YOUR-HOST/kajabi-popup-ab-tool/popup/popup.js
```

Kajabi can keep using the same embed code forever. When you change copy, image, colors, font, size, or traffic splits, publish a new `popup/variants.js` file to the same URL.

Before publishing a meaningful change, update `configVersion` in the dashboard, for example `v2-headline-image-test`, and write a short `changeNote`. Popup events will include both fields, plus a `variantSnapshot`, so historical results remain analyzable after the live popup changes.

Changing `configVersion` also starts a fresh 30-day variant assignment for that version, so the new version can run its own clean A/B split.

The dashboard's `Save & Test` button records a `variant_save_test` row with a readable `variantLabel`, such as CTA text, colors, width, font, text alignment, and image status. Use it before publishing a new version so the Sheet has a marker for exactly what changed.

## 6. Publish data for the dashboard

In Google Sheets, choose `File > Share > Publish to web`, then publish the `Popup Events` sheet as CSV.

Open the dashboard with:

```text
dashboard/index.html?csv=YOUR_PUBLISHED_CSV_URL&doc=YOUR_GOOGLE_DOC_URL
```

The dashboard is read-only in v1. Variant changes are made in `popup/variants.js`.

## 7. Better completed opt-in tracking

For confirmed Kajabi submissions, create a Zap:

```text
Kajabi Form Submitted
-> Webhooks by Zapier or Google Sheets
-> Add row to Popup Events
eventType = kajabi_form_submitted
```

Alternative Zapier-first flow:

```text
Webhooks by Zapier: Catch Hook
-> Kajabi: create/update contact or submit/enroll through the target form workflow
-> Kajabi: add tag or subscribe to sequence
-> Google Sheets: add row to Popup Events
```

For the Zapier lead webhook, the popup sends only `name` and `email`. Keep analytics fields in the separate Google Sheets webhook.

Include `email`, `name`, `createdAt`, `formName`, and `tag` when available.

To attribute confirmed submissions to a popup variant later, add a hidden Kajabi field named `popup_variant` and have the popup write the assigned variant into it after the embedded form loads.
