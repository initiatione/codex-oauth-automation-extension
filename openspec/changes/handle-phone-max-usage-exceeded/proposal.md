## Why

OpenAI can reject a submitted phone number with `phone_max_usage_exceeded`, meaning the number has reached its account-usage ceiling. Step 9 should treat this as a recoverable bad-number signal, discard that number from reusable state, and return to the add-phone form to try a fresh number instead of waiting on SMS or reusing the same activation again.

## What Changes

- Detect the OpenAI add-phone error page/message containing `phone_max_usage_exceeded`.
- Classify this condition as a phone-number max-usage rejection for the current Step 9 attempt.
- Clear the current phone activation and any reusable/free-reusable record that matches the rejected number so it will not be reused.
- Navigate or click back to the add-phone form, then continue Step 9 with a newly acquired number.
- Keep existing Stop/cancel and stale-task protections effective while this recovery is happening.
- Log a clear warning that the number reached OpenAI's usage limit and was removed from reuse.

## Capabilities

### New Capabilities
- `phone-max-usage-exceeded-recovery`: Covers detecting OpenAI phone max-usage errors and recovering Step 9 with a new phone number.

### Modified Capabilities

## Impact

- Affected code:
  - `background/phone-verification-flow.js`
  - `background/steps/confirm-oauth.js`
  - authentication-page content helpers that read visible error text or page state
  - phone activation/reuse storage helpers
- Tests:
  - Add phone-flow tests for `phone_max_usage_exceeded` detection, reuse-state cleanup, and retry with a new number.
  - Add Step 9 page-state tests proving the flow returns to add-phone instead of restarting Step 7.
  - Add stale/Stop tests so recovery does not purchase numbers after cancellation.
- No new external dependencies are expected.
