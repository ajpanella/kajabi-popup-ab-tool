# Assisted Protein Experiments

The Experiments workspace monitors High Protein only. It does not publish new
variants automatically. Anti-inflammatory tracking, the existing performance
table, Pulse, and lifetime variant identities remain separate and unchanged.

## Activate Tracking Once

1. Open the dashboard's Experiments workspace and select **Copy tracker update**.
2. Open the [tracking spreadsheet](https://docs.google.com/spreadsheets/d/1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w/edit).
3. Select **Extensions > Apps Script** and replace the existing tracker source.
4. Save, then **Deploy > Manage deployments > Edit > New version > Deploy**.
5. Keep the existing deployment URL. Do not rebuild or clear historical data.

No new Kajabi embed is needed. New round counts begin after this tracker update
receives round-tagged traffic. Earlier lifetime totals are not backfilled into a
new round or reset. Missing data is blocked, never interpreted as zero conversion.

## Measurement And Decisions

- The primary metric for current copy tests is deduplicated lead sessions divided
  by deduplicated popup-viewing sessions within the same round.
- A session is the existing browser-tab session identifier, not a unique person.
- Assignment is stable for a round. Repeated views and submissions count once.
- All three arms must reach a checkpoint: 700, 1,400, or 2,800 settled viewing
  sessions. At least seven days must have elapsed since the first recorded round
  event. A round ends as inconclusive at 28 days if no clear winner emerges.
- Each session has a 24-hour conversion-attribution window, starting when the
  tracker first receives its round event. Complete UTC-day cohorts settle within
  48 hours. Later leads still belong in existing lifetime reporting but not in a
  closed round cohort.
- Exact Clopper-Pearson intervals use a Bonferroni adjustment across three arms
  and three planned looks. Promotion requires non-overlapping bounds plus at
  least 10% relative and 0.1 percentage-point absolute improvement over both
  alternatives. These deliberately conservative rules assume independent
  sessions and stable randomized assignment; they do not establish causality
  when those assumptions fail.
- No repeated outcome-based peeking between checkpoints. Missed checkpoints are
  consumed rather than retested on the same observations. A higher raw CVR alone
  does not establish a winner.
- Stale summaries, changed configurations, impossible counts, missing versions,
  and severe allocation imbalance block decisions. The allocation check uses
  eligible sessions, before popup display.

The current headline round retains C as its control without altering any copy,
image, tracking version, or lifetime statistics. Future reviewed rounds place
the retained control in A and preserve its tracking sources and version.

## Cloud Monitor

`.github/workflows/experiment-monitor.yml` checks every six hours. GitHub can
delay scheduled runs; this is not an exact-time service. It fetches only the
small `mode=experiment` summary, not the raw events sheet. Response size is
bounded while reading. The Google tracker maintains incremental round totals.

Only aggregate counts, round metadata, and checkpoint decisions are saved in
`experiments/high-protein-monitor.json`. When the round changes, the previous
report is retained in `experiments/round-history.json`. Variant snapshots remain
in the existing version history and Git revisions. No email addresses or other
lead details are copied into these reports.

Meaningful decisions and blocking changes create or update the GitHub issue
**Protein experiment review**. Unchanged checks stay quiet. GitHub account
notification preferences determine email delivery. The dashboard reads the
latest monitor data directly, avoiding reliance on a Pages rebuild for each check.

## Review And Prepare

After a fresh winner or inconclusive review, a ready queue item can prepare two
draft challengers. Both clone the retained control and change only the selected
variable. Exact known configurations and previously scheduled queue concepts
are rejected. This is not semantic detection of every similar marketing idea;
historical context still needs review.

Review drafts in Build, then use the existing Review & Publish workflow. Editing
the retained control or a second variable blocks monitored-round publication.
To make unrelated manual changes, prepare and publish a pause first.

Research-backed ideas are a curated starting queue, not an automatically updated
research feed. Public food-blog examples are inspiration, not verified proof of
their conversion rates. Image, layout, flow, and offer tests require assets or
review. Timing tests remain gated until eligible-session conversion is supported
as their primary decision metric. Automated generation, autonomous publishing,
and recurring external research are future phases, not enabled features.

## Verification

Run `npm run check` and `npm run test:experiments`. Browser coverage is available
with `node test/experiments.cjs --ui` and requires Playwright with Chrome.
Existing popup regressions are `test/protein-headline-test.cjs` and
`test/external-cta.cjs`. Statistical primitives use the pinned jStat 1.9.6 bundle;
its MIT license is retained in `vendor/jstat-LICENSE`.
