## Why

The free phone reuse workflow still loses its core value if the extension cancels the HeroSMS activation after the API has already returned a valid SMS code. Once a code has been received, the phone number must remain usable for the manual reuse path, so the automation must not call the SMS platform cancellation endpoint for that activation.

## What Changes

- Treat "valid SMS code received from HeroSMS" as a lifecycle boundary for the current activation.
- After a valid code is received, mark the current activation as code-received / protected from cancellation.
- Prevent `setStatus(8)` cancellation for a code-received activation during later code-submit failure, page-loop recovery, exception cleanup, stop cleanup, or number replacement.
- Keep successful completion behavior separate from cancellation: the flow may still mark the activation completed if the platform requires success status, but it must not mark it canceled after code receipt.
- Ensure the free reusable phone record is not invalidated or indirectly canceled after the first code arrives.
- Add logs/tests proving no HeroSMS cancellation request is made after a valid code has been returned.

## Capabilities

### New Capabilities
- `phone-activation-preservation-after-code`: Activation lifecycle protection that prevents SMS platform cancellation after a valid phone verification code has been received.

### Modified Capabilities

None.

## Impact

- Affects Step 9 phone verification in `background/phone-verification-flow.js`.
- Affects the HeroSMS provider lifecycle around `getStatus/getStatusV2`, `setStatus(6)`, `setStatus(8)`, replacement-number recovery, exception cleanup, and free phone reuse state.
- Affects runtime session state if implementation persists a code-received/protected flag on `currentPhoneActivation`.
- Affects tests for phone activation completion, cancellation, replacement, timeout, invalid code, and free phone reuse.
- No sidepanel configuration change is expected; this is a correctness fix for the existing free reuse behavior.
- No external dependency is introduced.
- No project structure change is expected unless implementation extracts focused lifecycle helpers; if files are added/deleted/renamed, update `项目文件结构说明.md`.
- The feature chain changes, so `项目完整链路说明.md` should be updated if implementation lands.
- `项目开发规范（AI协作）.md` likely does not need changes unless implementation introduces a new architectural boundary.
