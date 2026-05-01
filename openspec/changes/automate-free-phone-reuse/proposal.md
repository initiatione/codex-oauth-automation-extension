## Why

Free phone reuse currently stops automation after filling the saved phone number, which still requires the operator to refresh HeroSMS manually and resume the flow. The observed HeroSMS lifecycle allows a preserved code-received activation to be moved back into SMS waiting with `setStatus(3)`, so the extension can automate the reuse path while keeping the same cost-saving behavior.

## What Changes

- Add a persisted sidepanel switch for automatic free phone reuse, separate from the existing free phone reuse recording switch and the paid same-number reactivation switch.
- When automatic free reuse is enabled and a saved free reusable phone exists, Step 9 will reactivate the saved activation for SMS waiting using HeroSMS `setStatus(3)`, verify that the activation is waiting for a new SMS, submit the saved number to OpenAI, poll HeroSMS for the new code, and continue the existing phone verification flow.
- Keep manual free reuse behavior when the automatic switch is disabled.
- Track successful automatic free reuse attempts across any later registration round, not only the second email, and retire the saved free reusable phone after `maxUses` successful phone verifications.
- Preserve existing page-side banned-number and resend-throttling detection during the automated reuse SMS wait.
- Clear or retire the saved free reusable phone when it is exhausted, rejected, banned, throttled, cancelled, or otherwise no longer usable, then fall back to the existing new-number or paid-reactivation behavior.

## Capabilities

### New Capabilities
- `automatic-free-phone-reuse`: Covers automated reuse of a saved valid HeroSMS phone activation through `setStatus(3)`, status confirmation, phone submission, SMS polling, success counting, and failure fallback.

### Modified Capabilities
- `free-phone-reuse-mode`: Change the saved free phone handoff from always fill-only/manual stop to manual or automatic behavior depending on the new automatic free reuse switch.

## Impact

- Affected steps: Step 9 phone verification, especially add-phone handling, phone-code polling, activation preservation, number replacement, and OAuth continuation after phone verification.
- Affected provider/API: HeroSMS `setStatus(3)`, `getStatus` / `getStatusV2`, existing `setStatus(6)` skip behavior, and existing `setStatus(8)` cancellation behavior for non-code-received activations.
- Affected configuration: sidepanel UI, persisted settings normalization, import/export/state restore, and hot-effect behavior for the new automatic free reuse switch.
- Affected docs/tests: update `项目完整链路说明.md` for the automated free reuse branch; update `项目文件结构说明.md` only if files are added or responsibilities materially move; update `项目开发规范（AI协作）.md` only if a new development boundary is introduced.
