## 1. Detection and Classification

- [x] 1.1 Add an auth-page detector for visible `phone_max_usage_exceeded` errors after phone submission.
- [x] 1.2 Add a dedicated recoverable phone-flow result/error for phone max-usage exceeded.
- [x] 1.3 Route the detector through Step 9 phone-submission and SMS-wait checkpoints so max-usage is detected before SMS polling timeout.

## 2. State Cleanup

- [x] 2.1 Add a helper to normalize phone numbers for matching activation/reuse records.
- [x] 2.2 Clear current phone activation and verification-code state when they match the rejected number.
- [x] 2.3 Clear matching reusable and free-reusable activation records without removing unrelated phone state.
- [x] 2.4 Guard cleanup with active Step 9 task checks so stale tasks cannot clear newer state.

## 3. Add-Phone Recovery and Retry

- [x] 3.1 Implement recovery from the max-usage error screen back to a ready add-phone form using Retry when available.
- [x] 3.2 Add fallback navigation to `/add-phone` and wait for the phone input when Retry is unavailable or ineffective.
- [x] 3.3 Continue Step 9 with a fresh phone number after cleanup and form recovery.
- [x] 3.4 Reuse the existing finite/unlimited phone replacement-limit behavior for repeated max-usage recoveries.
- [x] 3.5 Preserve Stop/cancel behavior so no new phone is acquired or submitted after cancellation.

## 4. Logging and Tests

- [x] 4.1 Log that the rejected phone reached OpenAI max usage and was removed from reuse.
- [x] 4.2 Log that Step 9 returned to add-phone and is retrying with a fresh number.
- [x] 4.3 Add phone-flow tests for max-usage detection, matching-state cleanup, unrelated-state preservation, and retry with a new number.
- [x] 4.4 Add Step 9 stale/Stop tests for max-usage recovery boundaries.
- [x] 4.5 Run focused Step 9/phone-flow tests, then run the full test suite.
