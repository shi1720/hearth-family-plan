# Everyday navigation and next steps

November 4, 2026.

- Quick find searches pages, people, documents, accounts, giving intentions, tasks, claims and money records already present in the permission-filtered workspace. It matches names without requiring accents and caps results at twelve. It does not search technical IDs, hidden source snapshots or arbitrary note text. Search queries are not sent to a model or stored in the URL.
- The header button and Cmd/Ctrl+K open quick find. Arrow keys and Enter select a result. Escape closes it. The shortcut preserves an existing form instead of replacing an unsaved draft.
- Recognised page fragments support refresh, Back and Forward. Record IDs and search terms are excluded. Refresh ends a temporary permission preview in the existing way; a URL fragment never grants access.
- Next steps have All/Open/Completed filters, completion counts and progress. Past due and Due today labels use the recorded date and local time; completion and evidence remain deliberate actions. They are not delivery of reminders or validation of legal deadlines.
- Date/time fields commit their visible input before another field changes or the form is saved.
- Save confirmations appear over the page near the lower corner, above the mobile navigation. They pause while a form or More sheet is open.
- Quick find uses an accessible combobox, named results, keyboard navigation, a clear action and a useful empty state. Its footer remains visible on short desktop and small phone layouts.

## Checks

Nine new tests exercise page fragments, empty and bounded finder results, accent matching, omission of technical data, actual helper-filtered state, non-mutation, and overdue/today/completed/invalid-date boundaries. All 81 unit tests pass.

Browser checks exercise person and task opening, empty search and recovery, keyboard opening, preserving a changed form, page history and refresh, read-only helper documents, exclusion of private helper accounts, task filters/progress, persisted dates and visible save feedback. All seven pages were opened through quick find at 320px with no horizontal overflow; the finder measured 300px wide with its Close action inside the 740px viewport.

This is an interaction and regression pass. It does not change permissions, legal authority, model credentials, legal rules, notification delivery or payment behavior. The existing manual Google popup verification and operational launch requirements still apply.
