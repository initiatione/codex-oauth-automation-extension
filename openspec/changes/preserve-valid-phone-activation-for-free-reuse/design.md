## Context

Step 9 phone verification currently manages HeroSMS activation lifecycle in `background/phone-verification-flow.js`. When the flow receives a valid SMS code from `getStatus` or `getStatusV2`, it marks the activation as code-received and records `freeReusablePhoneActivation` if the free phone reuse switch is enabled. After the OpenAI phone code submission succeeds, the same success path still calls HeroSMS `setStatus(6)`, which the HeroSMS API defines as completing the activation. That platform-side completion removes the activation from the live reusable state the user wants to keep for manual free reuse.

Earlier cleanup work already skipped `setStatus(8)` cancellation after a valid code. The remaining issue is the successful-completion call, not only cancellation. HeroSMS `setStatus(3)` remains a separate operation used to request another SMS during the same activation and should not be conflated with completion or cancellation.

## Goals / Non-Goals

**Goals:**

- Preserve a newly acquired HeroSMS activation after it receives a valid code when `freePhoneReuseEnabled` is enabled.
- Prevent protected free-reuse activations from receiving HeroSMS `setStatus(6)` completion or `setStatus(8)` cancellation.
- Keep successful OAuth completion behavior intact: phone code submission should still continue to OAuth consent and later platform callback verification.
- Keep the saved free reusable phone record available across single-account task completion and normal reset until the user manually clears it.
- Preserve existing paid same-number reuse behavior under `heroSmsReuseEnabled` without coupling it to the free reuse preservation branch.
- Add logs and tests that make the distinction between `setStatus(6)` completion and `setStatus(8)` cancellation explicit.

**Non-Goals:**

- Do not introduce a new SMS provider or change the HeroSMS API endpoint contract.
- Do not add a third switch; use the existing free phone reuse switch for preservation.
- Do not automatically perform paid `reactivate` as part of free reuse handoff.
- Do not change phone numbers that fail before any valid code is received; those can still be released or cancelled according to existing replacement rules.
- Do not redesign Step 9 OAuth consent clicking in this change, except where tests need to prove the phone preservation state survives the phone success path.

## Decisions

1. Gate completion skipping on the free reuse preservation condition.
   - Condition: `freePhoneReuseEnabled` is true, the activation is normalized, the activation came from a newly acquired HeroSMS number, and the activation has `phoneCodeReceived`.
   - Rationale: this protects only the branch where the user intentionally wants to keep the first paid number for manual reuse.
   - Alternative considered: always skip `setStatus(6)` after any valid code. This could leave unrelated paid activations open when free reuse is disabled.

2. Keep `setStatus(3)` behavior unchanged.
   - Rationale: requesting another SMS is part of the current activation and is required before the first valid code in some flows.
   - Alternative considered: skip all `setStatus` calls in free reuse mode. That would prevent legitimate same-activation resend attempts before a valid code arrives.

3. Preserve by skipping provider lifecycle finalization, not by delaying it.
   - Rationale: the user wants the platform activation to remain available after the extension finishes the OAuth flow. Delaying `setStatus(6)` would still eventually close it and defeat manual reuse.
   - Alternative considered: call `setStatus(6)` after Step 10 succeeds. This would still close the activation and is therefore not compatible with free reuse.

4. Keep local current activation cleanup.
   - Rationale: the active run should not keep an in-flight `currentPhoneActivation` after phone verification succeeds; the durable reuse record lives in `freeReusablePhoneActivation`.
   - Alternative considered: keep `currentPhoneActivation` as the reuse source. That would mix current-run state with cross-run user-managed reuse state.

5. Keep paid platform reactivation separate.
   - Rationale: `heroSmsReuseEnabled` controls `reactivate` and may charge again. `freePhoneReuseEnabled` controls manual fill-and-stop reuse and should not trigger paid calls.
   - Alternative considered: merge both switches into a single reuse mode. This would hide the cost difference the user explicitly wants to control.

## Risks / Trade-offs

- [Risk] An open HeroSMS activation may eventually expire platform-side even if the extension skips `setStatus(6)`. -> Mitigation: preserve the activation ID and phone number locally and hand control to the user for manual SMS refresh; do not promise indefinite platform availability.
- [Risk] Skipping `setStatus(6)` might leave cost/accounting state different from a normal completed activation. -> Mitigation: apply only when the user enabled free phone reuse and a valid code has already been received.
- [Risk] Future cleanup code may accidentally call completion or cancellation on protected activations. -> Mitigation: centralize the preservation predicate or helper and add tests for success, failure, and stop/cleanup paths.
- [Risk] Logs could still call this "cancellation" and hide the real issue. -> Mitigation: add explicit log copy that says HeroSMS completion `setStatus(6)` was skipped for manual free reuse.
- [Risk] Chinese logs/docs can become mojibake. -> Mitigation: run touched-file mojibake scan after implementation.
