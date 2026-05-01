## Context

Step 9 (`background/steps/confirm-oauth.js`) owns OAuth consent click and localhost callback capture. When the auth page enters `add-phone` or `phone-verification`, it delegates inline phone work to `background/phone-verification-flow.js`.

The current stop guard is mostly global (`throwIfStopped`). It does not prove that a long-running Step 9 phone task still belongs to the current auto-run session, current OAuth URL, or current auth page. If a previous Step 9 task is still polling HeroSMS while a new round starts, the new round can clear the global stop state and the stale task can continue calling HeroSMS, replacing numbers, or mutating the free reusable phone record.

## Goals / Non-Goals

**Goals:**
- Bind Step 9 phone-verification work to an active execution token that becomes invalid when the owning auto-run/auth execution is obsolete.
- Stop stale phone tasks before HeroSMS API calls, page submissions, replacement decisions, cancellation/completion, or free reusable phone mutations.
- Preserve current behavior for valid, current Step 9 executions: consent recovery, free phone preservation, automatic free reuse, resend banned/throttled detection, and replacement limits.
- Produce short diagnostic logs when stale phone work is abandoned so future logs explain why no API action followed.

**Non-Goals:**
- Add a user-facing switch or setting.
- Change HeroSMS pricing, reuse limits, country selection, or resend policy.
- Change step ordering or visible sidepanel step definitions.
- Rebuild the OAuth chain or phone verification flow as a separate system.

## Decisions

1. Use a runtime Step 9 phone-flow token rather than only global stop state.

   The token should identify the execution that owns phone work. A practical shape is:
   - `id`: generated per Step 9 phone-flow entry.
   - `autoRunSessionId`: current auto-run session if present.
   - `visibleStep`: Step 9 or Plus equivalent.
   - `oauthUrl`: the OAuth URL that started the Step 9 execution.
   - `signupTabId`: auth tab when known.

   Rationale: global stop state can be cleared for a new run, while a token remains able to distinguish old work from current work. This is safer than relying on step status alone because Step 9 can be marked completed or reset while internal async work is still unwinding.

2. Validate the token at every external side-effect boundary.

   Guard checks should run before:
   - HeroSMS `getStatus`, `getStatusV2`, `setStatus(3)`, `setStatus(6)`, `setStatus(8)`, `reactivate`, `getNumber`, `getNumberV2`, and `getPrices`.
   - Filling/submitting a phone number.
   - Submitting a phone verification code.
   - Retiring or clearing a free reusable phone record.
   - Replacing a number or returning to add-phone.

   Rationale: stale work is most dangerous at side-effect boundaries. Guarding only at loop starts is not enough because waits and content-script probes can span round resets.

3. Invalidate tokens from flow boundaries that abandon or supersede Step 9.

   Token invalidation should happen when:
   - A fresh auto-run attempt resets state before Step 1.
   - Auto-run retry abandons the current attempt.
   - Auto-run stops.
   - A new Step 9 execution starts for the same auth chain.
   - The current OAuth URL changes to a new authorization chain.

   Rationale: these are the boundaries shown in the failure log: a new registration round starts while the old Step 9 phone loop is still waiting.

4. Treat stale-token termination as cancellation of obsolete work, not an active-round phone failure.

   Stale phone work should throw/use a stop-like internal error that avoids number replacement, avoids clearing reusable phone records, avoids failed round records for the new run, and logs a concise diagnostic such as “旧 Step 9 接码任务已失效，停止继续调用 HeroSMS。”

   Rationale: the obsolete task should disappear quietly enough not to poison the current round, while still leaving a useful audit trail.

5. Keep the token in background runtime/session state only.

   This is runtime safety state, not persisted user configuration. It can live in `chrome.storage.session` or in service-worker memory backed by existing reset/invalidation hooks. If session state is used, it must be cleared on stop/reset and must not be exported/imported as settings.

## Risks / Trade-offs

- [Risk] Too broad token invalidation could stop a legitimate Step 9 during normal phone verification. -> Mitigation: bind invalidation to clear ownership changes and add tests for a normal phone verification success path.
- [Risk] Guarding every HeroSMS boundary may add plumbing through several helper functions. -> Mitigation: centralize the guard function and pass a compact `flowGuard`/`flowToken` option through phone helpers rather than duplicating checks.
- [Risk] MV3 service worker suspension can clear in-memory tokens. -> Mitigation: if relying on memory, ensure Step 9 is active only while the service worker execution promise is alive; otherwise store the active token in `chrome.storage.session`.
- [Risk] Chinese diagnostic logs can become noisy. -> Mitigation: log once per stale flow, keep the message short, and verify no mojibake appears in docs/log text.
