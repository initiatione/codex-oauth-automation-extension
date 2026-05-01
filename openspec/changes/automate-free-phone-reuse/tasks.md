## 1. Settings And Sidepanel

- [x] 1.1 Add a persisted `freePhoneReuseAutoEnabled` setting with default disabled, normalization, reset/import/export handling, and background state propagation.
- [x] 1.2 Add a sidepanel switch for automatic free phone reuse near the existing free phone reuse controls, with copy that distinguishes record/preserve mode, automatic free reuse, and paid same-number reactivation.
- [x] 1.3 Ensure the automatic free reuse switch is hot-effective for subsequent Step 9 add-phone decisions without extension reload or browser restart.
- [x] 1.4 Ensure disabling the base free phone reuse switch prevents automatic free reuse even when the automatic switch value remains enabled in storage.

## 2. HeroSMS Preparation Flow

- [x] 2.1 Add a helper that prepares a saved free reusable activation by calling HeroSMS `setStatus(3)` on the saved activation id.
- [x] 2.2 Add a short preparation poll that confirms the saved activation reaches `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, `STATUS_WAIT_RESEND`, or an equivalent V2 waiting payload before OpenAI phone submission.
- [x] 2.3 Ensure stale pre-submit `STATUS_OK` / V2 code payloads are not treated as valid codes for the new registration.
- [x] 2.4 Return an explicit failure reason when preparation cannot confirm a waiting state, the activation is cancelled, or HeroSMS returns a terminal non-waiting state.

## 3. Step 9 Automatic Reuse Integration

- [x] 3.1 Replace the current manual free phone handoff with a branch that chooses manual handoff when auto mode is disabled and automatic reuse when auto mode is enabled.
- [x] 3.2 In automatic mode, set the saved free reusable activation as the current Step 9 activation only after preparation succeeds.
- [x] 3.3 Submit the saved phone number through the existing add-phone submit path after preparation succeeds.
- [x] 3.4 Reuse existing `waitForPhoneCodeOrRotateNumber`, code submission, OAuth consent continuation, and localhost callback handling after the saved phone is submitted.
- [x] 3.5 Keep free automatic reuse higher priority than paid HeroSMS `reactivate`, `getPrices`, `getNumber`, and `getNumberV2`.
- [x] 3.6 Preserve the existing manual fill-only stop behavior when automatic free reuse is disabled.

## 4. Lifecycle, Limits, And Fallback

- [x] 4.1 Increment the saved free phone `successfulUses` only after automatic reuse completes phone verification successfully.
- [x] 4.2 Clear or retire the saved free phone record when `successfulUses` reaches `maxUses`, defaulting missing `maxUses` to three.
- [x] 4.3 Clear or retire the saved free phone record when automatic preparation fails, OpenAI rejects the number, resend errors indicate banned/throttled status, HeroSMS reports cancellation, or the saved phone is otherwise unusable.
- [x] 4.4 After a saved free phone is cleared or retired, fall back to the existing paid reactivation or new-number acquisition path according to existing settings.
- [x] 4.5 Do not call HeroSMS `setStatus(6)` or `setStatus(8)` for a protected code-received activation solely because the local free reuse record is cleared.
- [x] 4.6 Keep existing page-side banned-number and resend-throttling detection active throughout automatic reuse SMS waiting.

## 5. Tests

- [x] 5.1 Add sidepanel/settings tests for default disabled automatic free reuse, persistence, import/export or settings payload collection, and hot-effective UI restore.
- [x] 5.2 Update the existing manual free phone handoff test to verify manual behavior remains unchanged when automatic free reuse is disabled.
- [x] 5.3 Add a phone verification flow test where automatic free reuse calls `setStatus(3)`, confirms waiting state, submits the saved phone, receives a new code, and continues without stopping automation.
- [x] 5.4 Add a test proving automatic free reuse has priority over paid same-number reactivation when both switches are enabled.
- [x] 5.5 Add tests for stale pre-submit `STATUS_OK`, preparation failure, cancellation, add-phone rejection, banned-number text, and resend-throttled text clearing the saved free record and falling back.
- [x] 5.6 Add tests for successful use counting across later registration rounds and clearing the saved record when the maximum use count is reached.
- [x] 5.7 Run focused sidepanel/settings and phone verification flow tests.
- [x] 5.8 Run `npm test`.

## 6. Documentation And Quality

- [x] 6.1 Update `项目完整链路说明.md` with the automatic free phone reuse branch, including `setStatus(3)`, waiting-state confirmation, polling, failure fallback, and max-use retirement.
- [x] 6.2 Update `项目文件结构说明.md` only if implementation adds files or materially changes file responsibilities.
- [x] 6.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 6.4 Check touched Chinese logs, errors, sidepanel copy, docs, and tests for mojibake.
