# Verification

## Automated coverage

The repository contains seven Node tests and 50 browser cases (25 per engine), plus installed-extension smoke checks for Chrome/Chromium and Firefox. The browser cases assert measured values, band geometry and visible behavior rather than screenshot pixel identity.

- Geometry: ordinary flex, block margins, grid columns/rows, wrapping, reversed/reordered items, `display: contents`, borders, positive scale, obstacle avoidance and clipping.
- Explicit unsupported states: rotation, direct text nodes, generated content and oversized child collections.
- Interaction: hover, exact/container targeting, freeze/resume, parent selection, moving controls, Escape, reinjection, stop/start, link interception and restored navigation.
- Dynamic behavior: fixed-height layout movement, container scrolling and open-shadow targeting.
- Isolation: host-page CSS, narrow layouts, and a strict-CSP installed-extension fixture.
- Popup: start/stop, top-frame-only injection, restricted-page rejection, failed-injection feedback and retry. API transport is simulated in popup/UI tests; installed smoke checks exercise real scripting and messaging.
- Packages: required assets, no QA files or persistent host permissions, fixed ZIP timestamps, repeated builds of the archive under UTC and Asia/Kolkata.

The installed smoke driver uses temporary profiles, real MV3 bundles, a QA-only loopback host permission and a QA background driver. This replaces the native toolbar gesture's permission grant. It is not a test of browser-owned permission UI, browser stores or Mozilla signing. The production manifests contain only `activeTab` and `scripting`; the QA permissions and driver never enter release packages.

## Initial local evidence

The initial implementation was checked on Linux with Node 26, system Chromium and a task-local Playwright Firefox binary. Both engines passed the geometry/interaction/popup cases; Mozilla's linter reported zero errors, notices or warnings. Both installed-extension smoke checks passed. ZIP generation and checksums were exercised locally. Workflow syntax was checked using actionlint 1.7.12.

Rendered desktop (1100×1000), narrow (390×844) and popup states were inspected in both engines. `preview.png` shows the actual inspector bundle on `tests/fixtures/demo.html`; only messaging transport was simulated for that screenshot. Synthetic meeting content is not a live account or user record.

The first Firefox installed smoke attempt did not inject because the QA driver's URL query did not match the port-bearing loopback URL. Querying existing tabs and comparing their URLs resolved the harness failure. A test fixture's missing navigation destination and a shadow fixture outside the viewport were also corrected. These were harness defects, not passing evidence. No full-size third-party site corpus or performance benchmark was run.

## GitHub evidence

[CI run 43997164302](https://github.com/gitfudge0/Gaplighter/actions/runs/43997164302) passed on implementation commit `52042a1`: 50 browser cases, seven unit/package tests, both installed-extension smoke checks, lint/build and artifact upload. The downloaded Chrome and Firefox ZIPs passed SHA-256 verification and matched the locally built package checksums. GitHub release-tag execution and AMO signing were not run.

## Source review

A distinct direct review covered the content/popup code, geometry, styles, manifests/build scripts, archive generation, tests and workflow permission/secrets boundaries. Archive timestamps were changed to fixed local wall-clock dates after review found a time-zone-dependent ZIP encoding. Unrelated prototype artifacts are ignored and excluded from the public repository. No independent reviewer or browser-store review is implied.

## Remaining manual/external checks

- Native toolbar activation and browser-owned permission UI in branded Chrome and stock Firefox, especially supported minimum versions.
- Mozilla add-on ID availability, first submission, actual signing and signed-XPI installation/update.
- Chrome Web Store listing, upload and review.
- Release-tag publishing and signing credentials in the GitHub account. The release workflow is configured to create drafts; implementing the feature does not create a tag or release.
- Broader third-party websites, closed-shadow/frame contents, nonrectangular clipping and advanced layouts beyond the documented supported cases.

The live GitHub CI result is available from the README badge and Actions tab. Local success does not establish that a remote run passed; check the run for the exact commit.
