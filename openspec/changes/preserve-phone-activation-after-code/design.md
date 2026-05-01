## Context

The phone verification flow currently owns the HeroSMS activation lifecycle inside `background/phone-verification-flow.js`. New numbers are persisted as `currentPhoneActivation`, successful codes are written to `currentPhoneVerificationCode`, free reuse records are saved after a valid SMS code, and cleanup paths call `cancelPhoneActivation`, which sends HeroSMS `setStatus(8)`.

The observed issue is that a valid code has already been received, but a later cleanup path still cancels the activation. This breaks the intended manual/free reuse behavior because the platform record is no longer available for the same-number SMS refresh strategy.

## Goals / Non-Goals

**Goals:**

- Make "HeroSMS returned a valid SMS code" a clear lifecycle boundary.
- Persist enough state on the activation to know that cancellation is no longer allowed after code receipt.
- Prevent every `setStatus(8)` cleanup path from canceling a protected activation.
- Keep cancellation behavior unchanged for activations that never received a valid code.
- Keep the existing successful completion behavior separate from cancellation.
- Cover replacement, invalid code, exception cleanup, stop cleanup, and free reuse tests.

**Non-Goals:**

- Do not add another sidepanel switch.
- Do not change the free reuse manual handoff UI.
- Do not remove number replacement when no SMS code was received.
- Do not change the HeroSMS API adapter beyond guarding status transitions.

## Decisions

1. Store a code-received marker on the normalized activation.
   - Rationale: cleanup paths already pass activation records around. Marking the activation itself makes the guard local and avoids relying only on separate global state.
   - Alternative considered: inspect `currentPhoneVerificationCode` only. That is weaker because code state can outlive or mismatch the current activation after replacement.

2. Add a single guarded cancellation helper.
   - Rationale: all paths that call `cancelPhoneActivation` should share one rule: if the activation has received a valid code, do not send `setStatus(8)`.
   - Alternative considered: manually add `if` checks around each cancellation call. That is easier to miss and would likely regress as new cleanup paths are added.

3. Mark the activation immediately after `pollPhoneActivationCode` returns a valid code and before submitting the code to OpenAI.
   - Rationale: the platform has already delivered value at that moment. Later OpenAI submission outcome must not decide whether the SMS platform activation is canceled.
   - Alternative considered: wait until OpenAI phone verification succeeds. That preserves the existing bug window because invalid-code or page-loop cleanup can cancel after code receipt.

4. Preserve cancellation before code receipt.
   - Rationale: if a number never receives SMS, if OpenAI rejects the phone before a code, or if the flow replaces a number before code receipt, the existing cancellation/release behavior avoids stale paid activations.
   - Alternative considered: never cancel any activation when free reuse mode is enabled. That would leak activations that never produced a usable code.

## Risks / Trade-offs

- [Risk] HeroSMS expects `setStatus(6)` after successful use and treating it as "finished" might affect later manual reuse. -> Mitigation: keep the proposal focused on preventing `setStatus(8)` cancellation after code receipt, then verify whether `setStatus(6)` is acceptable in implementation/tests before changing completion semantics.
- [Risk] Existing tests assume cancellation on invalid code after SMS receipt. -> Mitigation: update tests to reflect the new lifecycle boundary and add explicit pre-code cancellation coverage.
- [Risk] A protected activation might be replaced after OpenAI rejects the code, consuming a new number without canceling the old one. -> Mitigation: this is intentional once SMS has been received; logs should explain that cancellation is skipped because the number is preserved for reuse.
- [Risk] State shape changes could affect sidepanel rendering. -> Mitigation: keep new lifecycle flags internal or tolerate them in existing normalization/rendering without changing visible UI unless needed.
- [Risk] Chinese log/doc text could be corrupted. -> Mitigation: run a touched-file mojibake scan after implementation.
