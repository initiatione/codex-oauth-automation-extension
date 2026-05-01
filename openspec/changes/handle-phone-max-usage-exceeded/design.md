## Context

Step 9 submits a phone number on `auth.openai.com/add-phone`, then waits for the SMS code and the localhost OAuth callback. Some submitted numbers are rejected by OpenAI with a rendered add-phone error page that includes `phone_max_usage_exceeded`. This means the number has reached OpenAI's usage ceiling; polling HeroSMS for that number or saving it for reuse cannot recover the flow.

The project already tracks current phone activations and reusable/free-reusable phone records. Recovery must clear the rejected number from those states before acquiring a new number, otherwise the flow can loop back into the same rejected phone.

## Goals / Non-Goals

**Goals:**

- Detect the OpenAI add-phone max-usage error when the page displays `phone_max_usage_exceeded`.
- Treat the error as a recoverable rejection of the current phone number.
- Clear current activation state and any reusable/free-reusable phone record that matches the rejected number.
- Return the auth page to the add-phone form and retry Step 9 with a new number.
- Preserve Stop/cancel and stale-task checks while recovering.
- Emit clear logs explaining that the number was discarded because OpenAI reported max usage.

**Non-Goals:**

- Do not change HeroSMS pricing, country ordering, or code polling strategy.
- Do not mark all provider/country numbers as bad because one number hit OpenAI's usage limit.
- Do not restart from Step 7 when the auth page remains in the add-phone phone-verification branch.
- Do not persist rejected-number history beyond the existing current/reusable state cleanup unless needed to prevent same-run reuse.

## Decisions

1. Detect the error from auth-page state after phone submission.

   The implementation will inspect the auth page after submitting a phone number and while waiting for SMS/code transitions. It will match both the machine-readable token `phone_max_usage_exceeded` and a localized visible error containing that token.

   Alternative considered: infer max-usage from HeroSMS or code polling timeout. That is less precise and wastes time waiting for an SMS that cannot complete verification.

2. Model max-usage as a bad-number replacement path.

   The phone flow will convert this page state into a dedicated recoverable result/error, for example `PHONE_MAX_USAGE_EXCEEDED`, that feeds the same replacement loop used for other unusable-number cases. This keeps retry limits, unlimited-retry semantics, and stale-flow guards centralized.

   Alternative considered: hard-fail Step 9. That avoids more purchases but contradicts the desired behavior of returning to add-phone with a fresh number.

3. Clear only matching phone state.

   Recovery will remove the current activation and any reusable/free-reusable activation whose normalized phone number matches the rejected number. Other stored price tiers, country preferences, and unrelated activation data should remain intact.

   Alternative considered: clear all phone-related storage. That reduces accidental reuse but discards useful state and can disrupt unrelated recovery paths.

4. Return to the add-phone form before acquiring a new number.

   If the page shows the error screen with a Retry button, recovery should click Retry or navigate back to `/add-phone` so the next number is submitted into a clean add-phone form. The flow should verify that the phone input is available before typing the new number.

   Alternative considered: type a new number directly without resetting the page. That is brittle when the rendered error screen has no phone input.

5. Keep cancellation checks around every async recovery segment.

   Before clearing state, clicking Retry, acquiring a new number, or submitting the new number, the flow must assert the active Step 9 token is still current. This prevents a stopped stale task from buying or submitting additional numbers.

   Alternative considered: perform cleanup without token checks because it is short. The prior repeated-purchase bug shows that stale Step 9 work needs strict boundaries.

## Risks / Trade-offs

- The rendered error text may change. Mitigation: match the stable error token `phone_max_usage_exceeded` first and keep localized text matching as a fallback.
- Clicking Retry may not always restore the add-phone form. Mitigation: support a fallback navigation to the add-phone URL and verify the phone input before continuing.
- Clearing the wrong reusable record could discard a usable number. Mitigation: compare normalized phone digits and only clear matching current/reuse entries.
- Automatic retry can spend additional HeroSMS balance. Mitigation: run through existing replacement-limit and Stop controls, and log each discarded number clearly.

## Migration Plan

1. Add auth-page error detection helper(s) for `phone_max_usage_exceeded`.
2. Add a dedicated recoverable phone-flow result/error and route it through replacement logic.
3. Add matching-number cleanup for current/reusable/free-reusable phone activation state.
4. Add retry-to-add-phone navigation/click recovery before submitting the next number.
5. Add focused tests for detection, cleanup, retry, and Stop/stale behavior.

Rollback is limited to removing the new max-usage recovery path; existing phone-flow behavior would resume treating the page as a generic failure or timeout.

## Open Questions

- During implementation, confirm the exact auth-page content helper currently available for reading rendered error text so the new detector fits the existing messaging style.
