## 1. Activation Lifecycle State

- [x] 1.1 Extend activation normalization/persistence to carry an internal code-received/protected-from-cancel marker without breaking existing saved state.
- [x] 1.2 Mark the current activation immediately after `getStatus` or `getStatusV2` returns a valid SMS code and before submitting the code to OpenAI.
- [x] 1.3 Persist the marked activation back to `currentPhoneActivation` so later cleanup paths see the protected state.
- [x] 1.4 Ensure the free reusable phone record retains enough identity to match the protected activation without exposing unnecessary UI changes.

## 2. Guard SMS Platform Cancellation

- [x] 2.1 Add a shared guard in or around `cancelPhoneActivation` that skips HeroSMS `setStatus(8)` for code-received activations.
- [x] 2.2 Apply the guard to exception cleanup, stop cleanup, add-phone loop recovery, invalid-code recovery, and number replacement cleanup.
- [x] 2.3 Preserve existing cancellation behavior for activations that never received a valid SMS code.
- [x] 2.4 Verify successful completion handling remains distinct from cancellation and does not fall through to `setStatus(8)` afterward.
- [x] 2.5 Add a warning/info log when cancellation is skipped because a code was already received.

## 3. Free Reuse Behavior

- [x] 3.1 Ensure free phone reuse recording still happens after the first valid SMS code is received.
- [x] 3.2 Ensure code-received activations are not canceled after OpenAI code submission fails or returns to add-phone.
- [x] 3.3 Ensure manually clearing the saved free reusable phone removes only local saved state and does not call HeroSMS cancellation.
- [x] 3.4 Ensure a new number can still be requested after a code-received activation is preserved, subject to the existing replacement limit.

## 4. Tests

- [x] 4.1 Add tests proving no HeroSMS `setStatus(8)` is called after a valid SMS code is returned.
- [x] 4.2 Add tests for invalid code / replacement after code receipt proving local state is cleared but SMS platform cancellation is skipped.
- [x] 4.3 Add tests proving pre-code timeout or rejection still uses the existing cancellation path.
- [x] 4.4 Add tests proving manual clear of the free reusable phone record does not call HeroSMS cancellation.
- [x] 4.5 Update existing phone-flow tests whose expected cancellation behavior changes after code receipt.
- [x] 4.6 Run focused phone verification tests.
- [x] 4.7 Run `npm test`.

## 5. Documentation And Verification

- [x] 5.1 Update `项目完整链路说明.md` to document that a HeroSMS activation must not be canceled after a valid phone code has been received.
- [x] 5.2 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or their responsibilities change materially.
- [x] 5.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 5.4 Check touched Chinese docs, logs, errors, and UI copy for mojibake.
