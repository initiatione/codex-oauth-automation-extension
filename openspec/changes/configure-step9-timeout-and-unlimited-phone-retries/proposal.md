## Why

Step 9 can spend longer than the current 240-second localhost callback window while it keeps replacing phone numbers and waiting for valid SMS codes. When that happens, the callback timer can fail the whole OAuth flow even though the phone verification branch is still actively trying useful work.

The phone replacement limit also currently treats invalid or non-positive values as the default limit, so users cannot explicitly choose "keep trying until success or manual stop" for long-running phone-code attempts.

## What Changes

- Add a dedicated Step 9 localhost callback timeout setting in the sidepanel.
- When the Step 9 callback timeout setting is off, Step 9 MUST keep listening for localhost callback while its local click and phone-verification sub-actions continue using their own bounded waits and Stop remains effective.
- Keep the existing global OAuth-flow timeout setting behavior for the broader Step 7+ authorization chain.
- Change phone number replacement-limit semantics so `0` means unlimited replacements within the current Step 9 run.
- Update sidepanel validation, persisted settings normalization, background phone-flow normalization, logs, and tests to preserve and explain the new `0 = unlimited` behavior.

## Capabilities

### New Capabilities
- `step9-timeout-and-phone-retry-controls`: Covers Step 9 localhost callback timeout control and phone-number replacement limit semantics.

### Modified Capabilities

## Impact

- Affected code:
  - `sidepanel/sidepanel.html`
  - `sidepanel/sidepanel.js`
  - `background.js`
  - `background/message-router.js`
  - `background/steps/confirm-oauth.js`
  - `background/phone-verification-flow.js`
- Tests:
  - Add sidepanel settings tests for the Step 9 timeout switch and `0` replacement limit.
  - Add background normalization tests for persisted settings.
  - Add Step 9 timeout tests proving the 240-second local callback timer can be disabled without disabling Stop.
  - Add phone-flow tests proving `phoneVerificationReplacementLimit = 0` does not trip the replacement-limit guard.
- No new external dependencies are expected.
