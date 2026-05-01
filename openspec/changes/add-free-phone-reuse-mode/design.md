## Context

Step 6 currently performs login-cookie cleanup before the OAuth authorization chain. The requested behavior is to shorten the fixed post-cleanup wait so the automation reaches OAuth sooner without changing the cleanup scope.

The Step 9 phone verification flow currently has two different paid-provider interactions that are easy to confuse with free reuse:

- New HeroSMS activation uses `getNumber` / `getNumberV2`.
- Cross-run same-number reuse uses HeroSMS `reactivate`, which can bill again.
- Same activation resend uses `setStatus(3)`, which is only an in-activation SMS request and is not the requested cross-run free reuse behavior.

The requested free reuse mode is a manual handoff workflow: after one successful new-number phone OAuth, the plugin remembers that phone number, and on the next registration it fills the same number without submitting or calling HeroSMS reactivation. The user then manually refreshes SMS outside the plugin.

## Goals / Non-Goals

**Goals:**

- Reduce the Step 6 cookie-cleanup wait to a fixed 3 seconds.
- Add a persisted, hot-effective sidepanel switch for free phone-number reuse mode.
- Record the first newly acquired phone number once its first SMS code is successfully obtained.
- Keep the free reusable phone record across normal run resets and single-account task completion until the user clears it manually.
- On the next phone-verification add-phone page, fill the saved number only, do not submit, stop automation immediately, and log a clear manual handoff message.
- Keep the free reuse mode independent from HeroSMS `reactivate` so enabling the free path does not create a paid reactivation call.

**Non-Goals:**

- Do not automatically fetch or submit the second reuse SMS code.
- Do not click the add-phone submit button during the free reuse handoff.
- Do not remove the existing HeroSMS activation, polling, resend, cancellation, or optional `reactivate` implementation.
- Do not change step order, visible step ids, or Plus-mode step definitions.
- Do not introduce a new SMS provider.

## Decisions

1. **Represent free reuse as a separate persisted setting plus separate runtime record.**

   Use a boolean setting such as `freePhoneReuseEnabled` and a distinct record such as `freeReusablePhoneNumber` / `freeReusablePhoneActivation` rather than overloading `heroSmsReuseEnabled` or `reusablePhoneActivation`.

   Rationale: `heroSmsReuseEnabled` currently means HeroSMS `reactivate`. Overloading it would preserve the billing ambiguity that caused this change.

   Alternative considered: reuse `reusablePhoneActivation` and add a mode flag. That increases migration risk and makes it easier for existing `reactivate` code to accidentally consume the free record.

2. **Capture the free candidate when the first new activation receives its first SMS code.**

   The phone flow should record a candidate only for newly acquired HeroSMS activations, not for activations returned by `reactivate` or already-entered free reuse.

   Rationale: the user wants the first real, SMS-capable number to be carried forward after a confirmed SMS arrives. Capturing after `getStatus`/`getStatusV2` yields a code avoids storing numbers that never receive SMS.

   Alternative considered: capture immediately after `getNumber`. That could persist unusable or dead numbers.

3. **Finalize the free record after the first phone OAuth succeeds, but never require automatic cancellation.**

   When the code submission succeeds and the flow continues to OAuth consent, keep the phone number as the free reusable record. The existing successful activation completion call (`setStatus(6)`) can remain part of the normal paid activation lifecycle, but free reuse must not call `setStatus(8)` cancellation for that record.

   Rationale: the user explicitly wants to avoid cancelling the number after the first successful OAuth so it can be manually refreshed/reused. Existing failure cleanup should still cancel non-free current activations when replacing numbers or aborting.

   Alternative considered: never call any final HeroSMS status after success. That may leave the provider activation in an undefined state and is broader than the request; the important constraint is no cancel and no paid reactivation for the next use.

4. **Free reuse handoff runs before any new HeroSMS acquisition on the next add-phone page.**

   If the setting is enabled and a saved free phone number exists, Step 9 should fill the number and stop before `acquirePhoneActivation()` performs `reactivate`, `getPrices`, or `getNumber`.

   Rationale: this is the only reliable way to guarantee the next attempt does not create a new paid API event.

   Alternative considered: try free reuse only after normal acquisition fails. That defeats the cost-saving intent.

5. **Use a dedicated content-script action for fill-only phone entry.**

   Add or extend the phone content helper so the background can select the country and fill the phone number without clicking submit.

   Rationale: the existing `SUBMIT_PHONE_NUMBER` helper intentionally clicks submit. Reusing it would violate the manual handoff requirement.

   Alternative considered: fill then intercept before click. That is more brittle and harder to test.

6. **Stop automation through the existing stop/status path.**

   The background should set the run into stopped/manual state using existing auto-run controls, clear current in-flight activation if needed, and emit a log such as `开始手动复用手机，请到 SMS 上刷新`.

   Rationale: the user needs immediate control, and the extension must not continue into automatic OAuth or number replacement.

7. **Sidepanel shows the saved free reusable phone and exposes manual clear.**

   The saved record must survive `resetState()` and task completion. Only the clear button, disabling the feature with an explicit clear policy if implemented, or user storage reset should remove it.

   Rationale: the user said the record must remain even if the task count is one.

## Risks / Trade-offs

- **Risk: The saved number might not be accepted by OpenAI on the next registration.** -> Mitigation: the automation stops before submission, so the user can decide whether to continue manually, clear the record, or disable free reuse.
- **Risk: Existing HeroSMS `reactivate` still has ambiguous UI copy.** -> Mitigation: keep free reuse as a separate switch and update labels/logs so `reactivate` is not presented as free reuse.
- **Risk: Hot-effect changes during an active phone flow can be surprising.** -> Mitigation: check the setting at Step 9 add-phone decision points and when saving candidates; do not interrupt an already-submitted paid activation unless the flow reaches a safe handoff point.
- **Risk: A persistent phone number is sensitive data.** -> Mitigation: show it only in the sidepanel runtime/settings area, allow manual clear, and avoid logging more than the project already logs for current phone activations.
- **Risk: Stopping automation may leave step state looking failed.** -> Mitigation: use an explicit manual-handoff status/log so tests and users can distinguish intended stop from error.

## Migration Plan

Add new persisted setting with default disabled unless implementation deliberately chooses otherwise for compatibility. Existing users keep current behavior until enabling the free reuse switch. Existing `reusablePhoneActivation` data remains untouched and continues to belong to HeroSMS `reactivate`.

Rollback removes the switch and fill-only handoff; any stored free reusable phone record becomes ignored data until manually cleared or storage is reset.

## Open Questions

- Whether the existing HeroSMS `reactivate` switch should be relabeled during implementation to reduce confusion. The free reuse mode must be separate either way.
- Whether the free reusable phone record should store only the phone number and country, or also the original activation id and code timestamp for diagnostics. The minimum required record is phone number, country id, country label, source activation id, and recorded time.
