# Anti-inflammatory YouTube test

The anti-inflammatory campaign has three single-screen URL invitations:

- A: Inflammation (34% traffic)
- B: Metabolic health (33% traffic)
- C: Hormones (33% traffic)

All use the same 20-second delay, layout, and Subscribe on YouTube button.
The destination is https://urlgeni.us/youtube/channel/InflammationProtocols.
There is no email collection, reminder tab, or timed repeat popup.

The campaign is paused pending deployment of the updated tracker.

## Tracker deployment

Open the Protein Popup Quiz Tracker spreadsheet, then Extensions > Apps Script.
Replace the existing code with server/google-apps-script-protein-tracker.js.
Save, then Deploy > Manage deployments > Edit > Version: New version > Deploy.
Keep the existing deployment URL. Do not run the historical rebuild.

The tracker automatically extends the hidden summary sheets with ctaClicks
and ctaCounted columns without clearing existing rows. Pulse schema version 3
confirms this update is deployed. The protein campaign continues to use leads.

After verifying schema version 3, enable the anti-inflammatory campaign and
publish it. The existing Kajabi loader selects it for slugs containing
anti-inflammatory or inflammation, unless high-protein is also present.

## Measurement

popup_cta_click is a distinct raw event sent with beacon/keepalive before
navigation. It does not send a lead to Zapier or claim a subscription occurred.
YouTube CTR is unique clicking sessions divided by unique popup-viewing
sessions. Repeated clicks are deduplicated. The Pulse summary counts clicks
only for sessions that also have a view, regardless of event arrival order.

The dashboard uses its existing conversion accumulator for this campaign's
click objective, with YouTube labels. Raw events and the tracker leads column
remain distinct. Use a new test ID if changing a campaign's conversion goal.

## Verification

test/external-cta.cjs tests deduplication, out-of-order delivery, protein lead
regression, all three desktop/mobile popups, destination navigation, emitted
event type, and dashboard/Pulse CTR against repeated-event fixtures. It uses
Playwright with Chrome and intercepts network requests to avoid live events.
