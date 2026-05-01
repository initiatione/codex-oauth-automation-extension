## Why

Automatic free phone reuse can currently abandon a saved valid HeroSMS phone and fall back to buying a new number when the platform returns a waiting status with a suffix, such as `STATUS_WAIT_RETRY:597243`, during the reuse preparation check. This breaks the core purpose of automatic free reuse: reactivating and reusing the previously validated phone instead of consuming another paid phone number.

## What Changes

- Stabilize the automatic free reuse preparation path so it performs `setStatus(3)`, waits briefly, then confirms the saved activation has entered a waiting-for-SMS state before submitting the saved phone to OpenAI.
- Treat HeroSMS waiting statuses with optional suffixes, including `STATUS_WAIT_CODE:*`, `STATUS_WAIT_RETRY:*`, and `STATUS_WAIT_RESEND:*`, as waiting states for reuse preparation and normal SMS polling.
- If the saved activation still shows an old `STATUS_OK:*` code after reactivation, wait and retry preparation instead of submitting the stale code or immediately abandoning the saved phone.
- Add a bounded reactivation retry loop: if the activation is not in a confirmed waiting state yet, retry `setStatus(3)` and status checks a small number of times before failing safely.
- When automatic free reuse is enabled and a saved free reusable phone exists, preparation failure MUST stop the automatic flow with a clear log instead of falling through to HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` and buying a new phone.
- Simplify and clarify Step 9 logs around automatic reuse preparation so future troubleshooting can distinguish reactivation, waiting-state confirmation, old-code waiting, retry, stop, and paid fallback boundaries.

## Capabilities

### New Capabilities
- `automatic-free-phone-reuse-stability`: Covers robust automatic reuse preparation, waiting-status parsing, bounded reactivation retries, no-paid-fallback behavior, and concise diagnostics.

### Modified Capabilities
- `free-phone-reuse-mode`: Automatic free reuse extends the existing saved-phone reuse mode and changes the requirement from manual fill/stop only to a safer automatic path when the auto switch is enabled.

## Impact

- Affected step: Step 9 phone verification and OAuth consent recovery.
- Affected provider/API domain: HeroSMS `setStatus(3)`, `getStatus`, `getStatusV2`, and the paid acquisition/reactivation boundary.
- Affected configuration: existing `freePhoneReuseEnabled` and `freePhoneReuseAutoEnabled`; no new persisted setting is required.
- Affected logs: Step 9 automatic free reuse logs should become shorter and more diagnostic.
- Affected docs/tests: update `项目完整链路说明.md`; update structure/development docs only if implementation adds files or changes boundaries; add focused phone-verification tests.
