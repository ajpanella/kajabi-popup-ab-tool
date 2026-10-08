# Anti-inflammatory YouTube test

The anti-inflammatory campaign has three single-screen URL invitations:

- A: Explore My YouTube Channel (34% traffic)
- B: Get Simple Tips on YouTube (33% traffic)
- C: Subscribe on YouTube (33% traffic)

The October 8, 2026 experiment varies only the button copy. All use the same
20-second delay, collage image, layout, headline, and supporting copy:

- Headline: Make Anti-Inflammatory Eating Feel Simple
- Subheadline: Practical videos on food and everyday habits to help you build
  a healthier routine, one manageable change at a time.

The destination is https://www.youtube.com/@Longevity_EDU, without an automatic
subscription confirmation prompt. Each variant has a fresh tracking version;
earlier test results remain archived under the same campaign test ID.
There is no email collection, reminder tab, or timed repeat popup.

The campaign was activated September 30, 2026 after live schema-3 tracking
verification: two clicks in one viewed session produced one CTA conversion
and zero leads. The protein summary remained available with 26 groups.

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
