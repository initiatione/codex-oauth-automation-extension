## Why

HeroSMS `setStatus(6)` means "complete activation" and ends the activation after a valid SMS code is received. For the free phone reuse workflow, ending the activation prevents the same paid number from remaining available for the next manual SMS refresh, even though the extension already records the phone number for reuse.

## What Changes

- Preserve a newly acquired HeroSMS activation after it receives a valid phone verification code when the `freePhoneReuseEnabled` switch is enabled.
- Skip both HeroSMS `setStatus(6)` completion and `setStatus(8)` cancellation for that preserved activation.
- Keep recording `freeReusablePhoneActivation` for the first newly acquired phone that yields a valid code, then hand that saved phone to the next registration by filling the number and stopping automation for manual SMS refresh.
- Keep the paid platform same-number reactivation flow separate: the `heroSmsReuseEnabled` switch continues to control `reactivate` behavior and does not decide whether a free-reuse activation is preserved.
- Keep default behavior unchanged when free phone reuse is disabled: successful phone verification still completes the HeroSMS activation through `setStatus(6)`.
- Clarify logs and docs so future work distinguishes `setStatus(6)` completion from `setStatus(8)` cancellation.

## Capabilities

### New Capabilities

- `free-phone-activation-preservation`: Preserve a valid HeroSMS activation for manual free phone reuse without completing or cancelling it.

### Modified Capabilities

None.

## Impact

- Affects Step 9 phone verification in `background/phone-verification-flow.js`, especially the success path after `getStatus / getStatusV2` returns a valid code.
- Affects HeroSMS lifecycle API usage: `setStatus(3)` remains allowed for requesting another SMS; `setStatus(6)` must be skipped only for protected free-reuse activations; `setStatus(8)` remains skipped after a valid code and for protected activations.
- Affects free phone reuse state stored as `freeReusablePhoneActivation`.
- Affects tests covering phone verification success, cancellation cleanup, free reuse handoff, and paid `reactivate` behavior.
- Affects the feature chain documentation in `项目完整链路说明.md`.
- No project structure changes are expected unless implementation extracts a small helper. `项目文件结构说明.md` only needs an update if files are added, deleted, renamed, or responsibilities materially change.
- `项目开发规范（AI协作）.md` is not expected to change because no new development boundary is introduced.
