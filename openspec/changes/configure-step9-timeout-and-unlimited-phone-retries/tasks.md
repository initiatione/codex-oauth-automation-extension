## 1. Settings and Sidepanel

- [ ] 1.1 Add a persisted `step9LocalhostCallbackTimeoutEnabled` setting with default `true` in background defaults and persistent-setting normalization.
- [ ] 1.2 Update sidepanel settings collection and restore logic for the Step 9 timeout switch.
- [ ] 1.3 Add the sidepanel UI control for the Step 9 local callback timeout near the existing OAuth/phone verification controls.
- [ ] 1.4 Change phone replacement limit UI validation/help text so `0` is accepted and explained as unlimited.
- [ ] 1.5 Update background and sidepanel replacement-limit normalization so `0` is preserved while invalid blank/negative/non-numeric values use a safe positive default.

## 2. Step 9 Runtime Behavior

- [ ] 2.1 Update `background/steps/confirm-oauth.js` so the fixed local localhost-callback timeout is skipped when the new Step 9 setting is disabled.
- [ ] 2.2 Keep broader OAuth-flow timeout checks independent so the global deadline can still fail the chain when enabled.
- [ ] 2.3 Verify Stop/cancel still removes callback listeners, invalidates the active Step 9 phone task, and prevents further HeroSMS calls when the local timeout is disabled.

## 3. Phone Replacement Flow

- [ ] 3.1 Update `background/phone-verification-flow.js` so replacement-limit `0` means unlimited and positive limits retain existing guard behavior.
- [ ] 3.2 Update phone replacement progress logs to display unlimited mode clearly when the replacement limit is `0`.
- [ ] 3.3 Ensure per-provider fetch/poll/click waits remain bounded even when replacement count is unlimited.

## 4. Tests and Verification

- [ ] 4.1 Add sidepanel tests for the Step 9 timeout switch and saving/restoring `phoneVerificationReplacementLimit = 0`.
- [ ] 4.2 Add background settings tests for the new boolean default/normalization and `0` replacement-limit persistence.
- [ ] 4.3 Add Step 9 callback timeout tests for enabled timeout, disabled timeout, global timeout independence, and Stop cancellation.
- [ ] 4.4 Add phone-verification-flow tests for unlimited replacement mode and invalid replacement-limit fallback.
- [ ] 4.5 Run focused tests for changed modules, then run the full test suite.
