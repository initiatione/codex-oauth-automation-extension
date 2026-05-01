## Why

iCloud verification mails often arrive before the iCloud Mail tab finishes opening. The current content script snapshots the visible mailbox before refreshing, which can classify a newly arrived verification mail as old and push the flow into repeated mailbox communication recovery and premature resend clicks.

The recovery path also allows the remaining timeout budget to shrink the retried iCloud `POLL_EMAIL` response window to about one second, causing repeated "page communication abnormal" loops even after the mailbox tab is reloaded and reinjected.

## What Changes

- Add an iCloud-specific first-pass mailbox polling path that refreshes the mailbox before taking the old-mail snapshot.
- Before falling back to the existing snapshot-based logic, inspect the newest matching iCloud message and use it immediately when its timestamp is close to the verification request timestamp.
- Keep the existing snapshot and fallback behavior when no near-time matching iCloud message is found or when the message timestamp cannot be trusted.
- Ensure iCloud mailbox recovery retries use a practical minimum `POLL_EMAIL` response window instead of collapsing to one second after reload/reinject.
- Preserve existing behavior for non-iCloud providers and for later iCloud polling rounds after the first-pass check.

## Capabilities

### New Capabilities
- `icloud-verification-polling`: Covers iCloud Mail verification polling, first-pass near-time mail detection, old-mail snapshot timing, and iCloud-specific communication recovery budgets.

### Modified Capabilities

## Impact

- Affected code:
  - `content/icloud-mail.js`
  - `background/verification-flow.js`
  - `background/tab-runtime.js`
  - Step 4 and Step 8 verification flows when `mailProvider` resolves to iCloud inbox.
- Tests:
  - Add focused content-script tests for iCloud first-pass polling behavior.
  - Add background/tab-runtime tests for iCloud mail recovery response timeout floors.
  - Run existing Step 4, Step 8, iCloud, and verification-flow tests.
- No new external dependencies or user-facing settings are expected.
