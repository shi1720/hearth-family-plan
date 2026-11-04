# Everyday usability pass

November 4, 2026.

## Navigation and accessibility

Desktop has a collapsible 82px icon rail. Its preference is remembered on this browser without storing household data. Icons retain accessible names and hover labels. Mobile and portrait tablet layouts use a five-action bottom bar: Home, People, Documents, When needed and More. More opens a sheet containing every page, account controls and preferences.

The sheet traps keyboard focus, restores focus to its trigger, and makes the background inactive. Forms also make background navigation inactive. Escape, outside-click and close actions protect unsaved edits. Saving or uploading prevents the form from closing partway through the operation. Offline status explains why writes are unavailable.

## Documents and sources

PDF, PNG, JPEG and plain text attachments up to 5 MB have consistent client/server limits. The picker and drag-and-drop area show progress and a readable filename. The filename survives saving and reopening. An unsuccessful replacement keeps the existing attachment. Empty, oversized and unsupported files receive an explicit error. A blank document title can be suggested from the filename.

Normal views show the saved source, model, review date and exact quote. They do not show technical hashes or source IDs. Integrity values remain in the underlying evidence record and permitted exports.

## Branding and small conveniences

The original Hearth arch-and-heart icon replaces the starter favicon. SVG, ICO, Apple touch and Android home-screen icons are provided. Search has a clear action and Escape reset. Invitation details use readable labels rather than raw JSON.

## Verification

- Current type check and production build passed.
- 72 unit checks, 12 gateway checks, 14 isolated credential-policy cases, 10 isolated atomic-write cases and 44 built-Worker API cases passed.
- Both 50-pair transport regressions passed without retries.
- All seven pages were exercised at 1440px and 320px with no horizontal overflow.
- Additional responsive checks covered 390px, 768px and a 1280 by 640 laptop.
- Desktop collapse and reload persistence, mobile navigation, More sheet geometry and inactive background were checked in the browser.
- PDF upload/save/reopen, PNG replacement, empty and oversized input, unsupported SVG rejection, and preservation of an existing attachment after rejection were checked with original synthetic files.
- Draft retention, explicit discard, contact save, emergency helper preview, no-results search recovery, charity comparison and intention save, preferences across reload, and business-calculator arithmetic were exercised.
- API regression covers invitations and revocation, role filtering, private file bytes, concurrency, snapshots, export filtering, death reporting, recorded authority, claim packets and exact-cent ledger states. These use synthetic identities in a local test Worker.

The final hosted smoke check and deployment receipt are recorded in the review outputs. The earlier Google popup callback limitation remains a manual check before using real plans. This pass does not claim an independent security assessment, a legal certification, delivery of scheduled notifications or live payments.
