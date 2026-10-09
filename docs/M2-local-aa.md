# Local AA ledger — 2026-10-09

The budget page links to pages/aa/aa. Reuses the existing trip service, expense store, theme and icon assets; no new dependency, copied OpenTrip implementation, server or paid service.

- Trip.aaMembers stores explicit member IDs/names; Trip.aaSettlements stores confirmed offline transfers in integer cents. One storage write persists each member/settlement mutation.
- Expenses use the existing expenses collection with split: { version: 1, payerId, shares: [{ memberId, cents }] }. budget-service validates the split before writing. Ordinary records remain unchanged and are excluded from AA balances.
- Equal splits allocate remainder cents by member creation order. Payer may be excluded. New members do not change past splits. Amounts are capped at 1,000,000 CNY per expense.
- Balance = paid - allocated share + transfers sent - transfers received. Suggestions match debtors and creditors deterministically; they are not claimed to minimize transaction count globally.
- Settlement confirmation checks current suggestions and uses an operation ID for replay safety. Local page save guard prevents double taps. This is not cross-device concurrency control.
- Undo removes a mistaken settlement marker only. Expense deletion preserves confirmed transfers, recalculating balances including reverse obligations if necessary.
- Corrupt collections, malformed splits, foreign members and failed persistence surface errors instead of silently resetting data.

Validation: original 1449 assertions and 40 Node tests pass (12 AA tests included). 23 WXML and 24 WXSS files compile using the installed WeChat compiler. Final AA UI selection binding change verified by the 12 AA tests again. Real simulator/device interaction remains pending; native compiler success does not imply visual acceptance.

Follow-up: device acceptance, member rename/removal rules, explicit old-expense conversion, unequal shares if demanded, local backup/export. Later M3/M4 add authenticated backend, permissions, synchronization and share invitations. No claims of actual payment, invitation or multi-user sync in current UI.
