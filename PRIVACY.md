# Privacy

Gaplighter reads element geometry and computed styles only on the page where you activate inspection. Element tag names and IDs are used locally to identify the current selection.

The extension does not collect or transmit page contents, browsing history, personal information, telemetry, analytics or crash reports. It makes no network requests, stores no page data and uses no cookies, accounts or external services. Inspection state exists only in the current document's memory.

Permissions:

- `activeTab`: temporary access to the page you explicitly choose to inspect.
- `scripting`: inject the locally bundled inspector into that page's top frame.

There are no persistent host permissions, automatic content scripts, background services or remotely hosted extension code. Exiting inspection removes the overlay, animation loop and input handlers. A small message listener remains in that document until navigation so inspection can be restarted without duplicate registration.

Development and GitHub Actions tools may download dependencies and browser binaries. Those are not part of the shipped extension.
