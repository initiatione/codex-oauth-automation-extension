## 1. HeroSMS Status Parsing

- [x] 1.1 Update the shared HeroSMS waiting-status helper so `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, and `STATUS_WAIT_RESEND` are accepted with either end-of-string or a colon suffix.
- [x] 1.2 Ensure waiting statuses with suffixes are never treated as verification codes; only `STATUS_OK:<code>` and valid V2 code payloads may produce codes.
- [x] 1.3 Apply the shared waiting-status helper consistently in automatic free reuse preparation, normal SMS polling, and page-error probe logging paths that depend on waiting status.

## 2. Automatic Free Reuse Preparation

- [x] 2.1 Change automatic free reuse preparation to call `setStatus(3)`, wait a short delay, then poll HeroSMS status before submitting the saved phone.
- [x] 2.2 Add a bounded preparation retry loop that can repeat `setStatus(3)` and status confirmation when an old `STATUS_OK:<code>` or not-ready state remains.
- [x] 2.3 Treat suffixed waiting statuses like `STATUS_WAIT_RETRY:597243` as successful preparation, preserving the saved free phone and continuing with the saved phone number.
- [x] 2.4 Keep old `STATUS_OK:<code>` responses as stale preparation signals: wait/retry preparation and do not submit the stale code.
- [x] 2.5 Preserve existing handling for terminal states such as `STATUS_CANCEL` and API failures, but do not convert preparation failure into paid acquisition fallback.

## 3. No-Paid-Fallback Safety Boundary

- [x] 3.1 When `freePhoneReuseAutoEnabled` is enabled and a saved free reusable phone exists, prevent preparation failure from falling through to HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` in the same handoff.
- [x] 3.2 On automatic preparation failure, stop or fail the current automatic flow with a clear reason instead of buying a new phone number.
- [x] 3.3 Ensure paid same-number reactivation and new-number acquisition still work normally when no saved free phone is selected, automatic free reuse is disabled, manual free reuse is not active, or the saved phone has already been submitted to OpenAI and then explicitly rejected/blocked.

## 4. Logging

- [x] 4.1 Replace verbose automatic free reuse preparation logs with concise milestone logs for reactivation, delayed status check, waiting-state confirmation, stale-code retry, and failure stop.
- [x] 4.2 Ensure failure logs explicitly say that no new HeroSMS number will be purchased for this automatic free reuse handoff.
- [x] 4.3 Keep logs useful for sidepanel-only diagnosis by including the phone number, activation status text, retry count, and final reason where relevant.

## 5. Tests

- [x] 5.1 Add a phone verification flow test showing `STATUS_WAIT_RETRY:<oldCode>` after `setStatus(3)` is accepted as waiting state and uses the saved phone without calling paid acquisition APIs.
- [x] 5.2 Add a test showing old `STATUS_OK:<oldCode>` during preparation is not submitted and triggers delayed preparation retry before the saved phone is submitted.
- [x] 5.3 Add a test showing exhausted automatic preparation retries stop/fail without calling `reactivate`, `getPrices`, `getNumber`, or `getNumberV2`.
- [x] 5.4 Add or update a normal SMS polling test showing suffixed waiting statuses do not throw terminal HeroSMS errors.
- [x] 5.5 Update existing automatic free reuse priority/fallback tests to assert no paid fallback occurs after preparation failure, while post-submit OpenAI rejection still uses existing replacement behavior.
- [x] 5.6 Run focused phone verification flow tests.
- [x] 5.7 Run `npm test`.

## 6. Documentation And Quality

- [x] 6.1 Update `项目完整链路说明.md` with the stabilized automatic free reuse preparation sequence, no-paid-fallback boundary, and concise log semantics.
- [x] 6.2 Update `项目文件结构说明.md` only if implementation adds files or materially changes file responsibilities.
- [x] 6.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 6.4 Check touched Chinese logs, docs, and tests for mojibake.
- [x] 6.5 Run `openspec validate stabilize-automatic-free-phone-reuse --strict`.
