## Context

Step 9 waits for the OAuth localhost callback after phone verification. The current local callback guard uses a fixed 240-second timeout. That is useful when a click was blocked or the page is stuck, but it is too aggressive when Step 9 is intentionally cycling through phone numbers and waiting for an SMS code.

The sidepanel already has broader OAuth-flow timeout controls and phone-verification retry settings. The new behavior needs to stay compatible with those settings while adding one dedicated Step 9 callback-timeout switch and changing the replacement-limit semantics so `0` is an explicit unlimited mode.

## Goals / Non-Goals

**Goals:**

- Add a persisted sidepanel setting that enables or disables the Step 9 local localhost-callback timeout.
- Preserve existing default behavior by keeping the Step 9 local callback timeout enabled by default.
- Keep Stop/cancel behavior effective even when the Step 9 local callback timeout is disabled.
- Keep the broader OAuth-flow timeout setting independent from the Step 9 local callback timeout.
- Allow `phoneVerificationReplacementLimit = 0` to mean unlimited phone-number replacements for one Step 9 run.
- Make UI validation, persisted-setting normalization, background normalization, logs, and tests consistently preserve the `0 = unlimited` meaning.

**Non-Goals:**

- Do not change HeroSMS provider selection, pricing, country ordering, or SMS polling intervals.
- Do not remove the existing global OAuth-flow timeout feature.
- Do not make a disabled Step 9 timeout survive a manual Stop request.
- Do not introduce new dependencies or server-side storage.

## Decisions

1. Add a dedicated boolean setting for the Step 9 local callback timeout.

   Use a new persisted setting such as `step9LocalhostCallbackTimeoutEnabled`, defaulting to `true`. `background/steps/confirm-oauth.js` will read this setting and skip only the local 240-second callback deadline when it is `false`.

   Alternative considered: reuse the existing global OAuth-flow timeout switch. That would be simpler in the UI, but it would make it impossible to keep the broader authorization-chain budget while allowing long-running Step 9 phone attempts.

2. Keep the global OAuth-flow timeout independent.

   The existing global timeout can still end the broader authorization chain if it is enabled. Disabling the Step 9 local callback timeout only prevents the fixed 240-second local callback guard from rejecting the step.

   Alternative considered: disabling every timeout while Step 9 phone verification is active. That would match a long-running phone flow, but it would hide other stuck-state failures and change more behavior than the user requested.

3. Preserve cancellation as the highest-priority exit path.

   Stop/cancel signals must continue to invalidate the active Step 9 task, stop HeroSMS polling/replacement work, remove callback listeners, and reject the step. The disabled-timeout mode only changes the local elapsed-time guard.

   Alternative considered: let a disabled timeout keep all listeners alive until callback without any local cleanup path. That risks stale tasks and repeat purchases after a user stops and restarts.

4. Treat `phoneVerificationReplacementLimit = 0` as unlimited.

   Normalize `0` as a valid value in sidepanel and background settings. Positive values continue to enforce the existing replacement guard. Negative, blank, NaN, and non-numeric values normalize to the safe default rather than becoming unlimited accidentally.

   Alternative considered: use a separate unlimited checkbox. That is more explicit, but it creates two coupled controls where one numeric value already has a common unlimited convention.

5. Make unlimited mode visible in logs and validation text.

   Logs that currently print replacement progress as `current/max` should render an unlimited label when the max is `0`, so users can tell that the process is still intentionally trying numbers. The sidepanel input should accept `0` and label it as unlimited.

   Alternative considered: silently accept `0` without log or label changes. That would make troubleshooting harder, especially when Step 9 runs for a long time.

## Risks / Trade-offs

- Long-running Step 9 runs can consume more HeroSMS balance when both the local timeout is disabled and replacements are unlimited. Mitigation: keep the default timeout enabled, require explicit user configuration for unlimited mode, and keep Stop effective.
- Separating the Step 9 local timeout from the global OAuth timeout can be confusing. Mitigation: label the sidepanel control as Step 9/local callback specific and keep defaults matching prior behavior.
- Existing tests may assume non-positive replacement limits fall back to positive defaults. Mitigation: update tests to distinguish `0` from invalid negative/blank values.
- Unlimited mode can make progress logs noisy. Mitigation: keep the existing per-attempt logging cadence and only adjust the max label.

## Migration Plan

1. Add the new setting with default `true` so existing users keep the 240-second Step 9 local callback guard.
2. Update settings normalization to preserve `0` for `phoneVerificationReplacementLimit` and reject invalid non-zero values to the existing safe default.
3. Update the sidepanel input minimum/help text and collect/restore logic.
4. Update Step 9 callback waiting and phone replacement guard behavior.
5. Add focused tests, then run the existing test suite.

Rollback is straightforward: restore the default Step 9 local timeout path and previous positive-only replacement normalization. Existing saved `0` values would then normalize back to the fallback limit.

## Open Questions

- The exact Chinese label text for the new sidepanel switch can be finalized during implementation to match nearby controls.
