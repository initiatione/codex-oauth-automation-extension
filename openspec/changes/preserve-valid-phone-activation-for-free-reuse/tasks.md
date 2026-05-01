## 1. Preservation Predicate And Lifecycle

- [x] 1.1 Add a focused helper or predicate in `background/phone-verification-flow.js` that identifies protected free-reuse activations.
- [x] 1.2 Ensure the predicate requires `freePhoneReuseEnabled`, a normalized newly acquired HeroSMS activation, and `phoneCodeReceived`.
- [x] 1.3 Update the phone verification success path to skip `completePhoneActivation` / HeroSMS `setStatus(6)` for protected free-reuse activations.
- [x] 1.4 Keep local `currentPhoneActivation` cleanup after successful phone verification while preserving `freeReusablePhoneActivation`.
- [x] 1.5 Keep default success behavior unchanged when `freePhoneReuseEnabled` is disabled.

## 2. Cancellation And Replacement Safety

- [x] 2.1 Verify `cancelPhoneActivation` still skips HeroSMS `setStatus(8)` for code-received activations.
- [x] 2.2 Ensure phone numbers that never receive a valid code can still be released with HeroSMS `setStatus(8)` during timeout, banned-number, or abort cleanup.
- [x] 2.3 Ensure `setStatus(3)` for requesting another SMS remains allowed before a valid code is received.
- [x] 2.4 Ensure the preserved free-reuse branch remains independent from `heroSmsReuseEnabled` paid `reactivate`.

## 3. Logging And Documentation

- [x] 3.1 Add a log entry when HeroSMS completion `setStatus(6)` is skipped to preserve a phone for manual free reuse.
- [x] 3.2 Update `项目完整链路说明.md` to state that free reuse skips both `setStatus(6)` completion and `setStatus(8)` cancellation after a valid code.
- [x] 3.3 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or responsibilities change materially.
- [x] 3.4 Update `项目开发规范（AI协作）.md` only if the implementation introduces a new development boundary.
- [x] 3.5 Check touched Chinese docs, logs, and errors for mojibake.

## 4. Tests

- [x] 4.1 Add a phone-flow test proving free reuse enabled records a valid new phone without HeroSMS `setStatus(6)` or `setStatus(8)`.
- [x] 4.2 Add a phone-flow test proving free reuse disabled still calls HeroSMS `setStatus(6)` after successful phone verification.
- [x] 4.3 Add a phone-flow test proving free reuse enabled and paid reactivation disabled still preserves the valid activation without calling `reactivate`.
- [x] 4.4 Add a phone-flow test proving paid reactivation enabled does not disable free-reuse preservation for a newly acquired valid activation.
- [x] 4.5 Add or keep a regression test proving saved free phone handoff fills the number and stops before `getNumber`, `getNumberV2`, `reactivate`, `setStatus(6)`, or `setStatus(8)`.
- [x] 4.6 Add or keep a regression test proving numbers without valid codes can still be cancelled/released during replacement.
- [x] 4.7 Run focused phone verification tests.
- [x] 4.8 Run `npm test`.
