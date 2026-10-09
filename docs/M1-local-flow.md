# M1 local travel flow

Implemented on 2026-10-08 on `codex/student-travel-mvp`.

## Behavior

- Manual creation builds one empty day per date, inclusive; same-day trips are supported.
- Example generation uses the existing local Mock service, passes its budget parameter, and normalizes string activities to dated, named objects. The UI identifies this as example data.
- `utils/itinerary-model.js` defines the page-facing itinerary shape. Legacy saved days are adapted on read without writing storage until a user saves an edit.
- Day-page mutations go through trip-service. Long-press editing is wired for all three periods; storage failures show an error rather than a success toast.
- `services/expense-store.js` owns the existing MIT-licensed demo expense fixtures and stored ledger. Trip summaries derive spentBudget from this same ledger; no independently maintained summary is required.
- Expense totals sum integer cents before converting back to the existing yuan interface. New amounts must be finite, positive and have at most two decimal places. Full AA accounting is not implemented here.
- Home/list trip cards use the same `select` event with a tripId. Date labels bind to trip properties.
- Progress-ring inline styles are single-line for compatibility with the bundled WXML compiler.

## Verification

`npm.cmd test`: 1449 upstream assertions and 12 MVP regression tests pass.
Tests cover creation, serialization, edit/delete, actual example generation, summary consistency across page controllers, decimal totals, failed writes, legacy data and navigation/event wiring.

All 22 WXML templates compile with the WXML compiler shipped in the installed WeChat Developer Tools. This is a template compilation check, not a full IDE build or visual test.

The user confirmed the prior version opened its home page. Attempts to connect IDE automation for the updated version returned `wait IDE port timeout`; updated simulator/real-device interaction remains unverified. No app configuration or existing user storage was intentionally changed. No OpenTrip source was copied.

## Next

Verify the updated app in the simulator: Hangzhou, three days, budget 600; add/edit/delete an activity; add expense 100, observe remaining 500; reopen and verify persistence. Then proceed to M2 local members and integer-cent AA. Demo-data cleanup, full async local/remote service adapters, backend collaboration, and sharing remain separate work.

## Resumed M1 cleanup (2026-10-08)

Fresh installs now start with no trips or expenses. Profile offers an explicit, idempotent Hangzhou example; existing saved records are not removed. The sample carries an `isExample` label and no fake expenses. Legacy expense fixtures moved to data/mock-expenses.js for explicit test setup only.

The itinerary-service CRUD API now adapts the same embedded days used by pages. Its dayIndex is still one-based. Creating a day fills the corresponding date slot; deleting clears it without shifting dates. Legacy separate itinerary records are read only when embedded days are absent, and are not erased. Page/service round trips are tested.

Core collection reads now propagate failures and reject malformed collections instead of falling back to empty arrays that could overwrite data. Profile's destructive reset is accurately labeled and reports failure; it was not executed on user data. Food/place destinations and diary trip lists read real trips.

Latest validation: 1449 existing assertions plus 17 MVP regression tests pass; all 22 WXML templates compile; 22 changed/new JS files pass syntax checks. The historical suite explicitly seeds its in-memory fixtures; run through `npm.cmd test`, not against live device storage.

Simulator automation is still unverified. Port inspection shows running IDE processes, but does not establish a usable automation connection. Full async service adapters and M2–M5 are not yet implemented. The earlier Next paragraph's demo cleanup and duplicate itinerary storage items have now been addressed.
