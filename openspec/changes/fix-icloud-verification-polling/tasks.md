## 1. iCloud Polling Tests

- [x] 1.1 Add focused tests for iCloud first-pass refresh before the old-mail snapshot is recorded.
- [x] 1.2 Add tests for accepting the newest matching iCloud message when its parsed timestamp is close to `filterAfterTimestamp`.
- [x] 1.3 Add tests for rejecting first-pass iCloud messages when their timestamp is stale, unparseable, or their code is excluded.

## 2. iCloud Content Script Implementation

- [x] 2.1 Add timestamp parsing helpers for common iCloud list/header timestamp formats used by recent messages.
- [x] 2.2 Add a first-pass helper in `content/icloud-mail.js` that refreshes once, inspects the newest matching thread, and returns a valid near-time code when eligible.
- [x] 2.3 Preserve the existing sleep, old-mail signature snapshot, polling loop, fallback matching, and excluded-code behavior when the first-pass helper does not return a code.

## 3. Background Recovery Timeout

- [x] 3.1 Add focused tests for iCloud `POLL_EMAIL` recovery so reload/reinject retries do not dispatch with a near-one-second response timeout.
- [x] 3.2 Add an iCloud-specific minimum response timeout floor in the mail resilient sender or its call options without changing non-iCloud provider timeout behavior.

## 4. Verification Flow Regression

- [x] 4.1 Verify Step 8 iCloud fast-path success submits the returned code and does not request a resend.
- [x] 4.2 Run focused tests for iCloud, Step 4/Step 8 verification, tab-runtime recovery, and verification-flow behavior.
- [x] 4.3 Run the full Node test suite.

## 5. Documentation and Spec Cleanup

- [x] 5.1 Update project chain/structure documentation if the iCloud polling behavior or touched file responsibilities change.
- [x] 5.2 Mark tasks complete only after tests pass and the implementation matches `icloud-verification-polling` requirements.
