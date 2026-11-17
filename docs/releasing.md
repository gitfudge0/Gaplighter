# Build and release

## Packages

```bash
npm ci
npm run build
npm run lint
npm test
npm run package
```

This creates `release/gaplighter-chrome-VERSION.zip`, `release/gaplighter-firefox-VERSION.zip`, and `release/SHA256SUMS`. ZIP entries are sorted and have fixed timestamps. Tests verify repeat packaging is byte-for-byte identical. Each ZIP has its manifest at the root and contains no tests, dependencies or QA permissions.

The packages share the same source and version. Chrome's manifest sets its minimum version. Firefox adds a stable add-on ID and a declaration that no data is collected. Do not change the add-on ID after first signing; updates must retain it. The initial ID is `gaplighter@extensions.local`; check its availability with AMO before the first submission, and change it in `scripts/build.mjs` if needed.

## GitHub Actions

**CI** runs on branch pushes and pull requests: locked dependency install, both builds, ESLint, Mozilla's add-on linter (warnings are errors), unit/package checks, Chromium and Firefox rendering tests, and installed-extension smoke checks. A passing run uploads both ZIPs and checksums as `extension-packages`. Failure evidence is uploaded separately.

**Release** runs on `v*` tags. Manual dispatches and release-workflow-file pushes run the same verification path with publishing skipped. It reuses CI, verifies that the tag matches `package.json`, verifies package checksums, and creates a **draft GitHub release** with both ZIPs. Review and publish the draft yourself; this workflow does not submit to either browser store or claim that the unsigned Firefox package is installable in normal Firefox.

After updating the version and committing the corresponding source:

```bash
npm version 0.1.1 --no-git-tag-version
npm run check
npm run test:extensions
git add package.json package-lock.json
git commit -m "Release 0.1.1"
git tag v0.1.1
git push origin HEAD
git push origin v0.1.1
```

Use the actual next version; do not reuse an existing tag or overwrite a release. Configure repository Actions access before pushing. No tag or release is created merely by implementing a feature.

## Firefox signing

Normal Firefox releases require Mozilla signing. The separate **Sign Firefox for self-distribution** manual workflow requests an **unlisted** signature and uploads the returned signed XPI as a workflow artifact. It does not attach it to a GitHub release or submit an AMO public listing automatically.

1. Register an AMO developer account and review the [distribution requirements](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).
2. Confirm the stable add-on ID is available before its first release.
3. Create a GitHub environment named `firefox-signing`, restrict it to trusted release tags, and configure required reviewers. Add environment secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` from AMO's API credentials page.
4. Dispatch the signing workflow with an existing tested tag, such as `v0.1.0`. Approve the protected environment after checking the tag.
5. Download the signed XPI artifact and test installation/update in a separate Firefox profile before attaching it to a release. Mozilla review/signing can fail or be delayed; a ZIP is not proof of signing.

Workflow-file pushes register the signing workflow with its signing job skipped; only a manual dispatch can reach AMO. The signing workflow checks out the selected tag, rebuilds/lints/tests, and uses `web-ext sign --channel unlisted`. Credentials go only to that step. First submissions may need AMO metadata or manual developer-hub steps according to current AMO requirements; failures are surfaced rather than bypassed. For a public AMO listing, use the developer hub's listed-submission flow instead. No AMO credentials or signing outcome is assumed by this repository.

## Chrome Web Store

Upload the Chrome ZIP through the Chrome Web Store developer dashboard. Supply the listing, screenshots, privacy information and permission justifications. Store publication and review are not automated; the ZIP is also suitable for unpacked development loading after extraction. A GitHub ZIP is not a signed CRX or a store installation link.

## Recovery

A failed CI job does not create a release. A failed release may leave a draft; inspect it before retrying rather than deleting or retagging a published version. If a published version needs a fix, increment the package version and create a new tag. Keep AMO credentials out of the repository, logs and artifacts.
