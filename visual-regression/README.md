# Zero One Visual Regression

This module owns deterministic Chromium snapshots for the Zero One Console and
Public Site. It uses only browser-level API fixtures; no live database, monitor,
or external service is consulted. Time, timezone, DPR, viewports and dynamic
canvas inputs are fixed by the test configuration and visual-test adapters.
The versioned Playwright container is the source of truth for Linux, bundled
Chromium and system font packages; local runs are smoke tests only.

No reviewed Linux baselines are checked in yet, so the dedicated calibration
workflow is intentionally advisory. It runs in the versioned
`mcr.microsoft.com/playwright:v1.55.1-noble` image and passes
`--update-snapshots=none`; CI cannot update the repository baselines. Missing
or mismatched snapshots produce an Actions warning, while their Playwright
report, actual, diff and trace files are uploaded when produced. Once reviewed
Linux baselines exist, make this job blocking so visual regressions fail the
commit status.

The files under `artifacts/design-qa/` are manual review artifacts. They do not
record this module's network fixture, frozen time, Linux image, font set or
browser revision, so they must not be copied or renamed into
`tests/__screenshots__/` as baselines.

Generate candidate baselines only in the same pinned Playwright image with the
explicit `npm run test:update` command. Commit the resulting
`tests/__screenshots__/` files in a dedicated, human-reviewed snapshot update.
Once every required state has a reviewed baseline and calibration is stable,
make the workflow blocking; only then does the configured `maxDiffPixels: 0`
become a release gate.
