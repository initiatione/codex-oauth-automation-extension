## Why

Step 9 phone verification can outlive the auto-run round that started it, allowing stale SMS polling and HeroSMS actions to continue while a new registration round is already running. This is dangerous because an obsolete Step 9 task can keep polling, reactivate saved phones, buy/replace numbers, or clear reusable-phone records against the wrong auth page.

## What Changes

- Add execution isolation for Step 9 phone-verification work so stale tasks stop before any HeroSMS API action, page submission, replacement, or reusable-phone mutation.
- Invalidate outstanding Step 9 phone flows when an auto-run session changes, a fresh round resets state, retry abandons the current attempt, or the user stops automation.
- Keep existing successful phone verification, automatic free reuse, manual free reuse, banned-number detection, and consent recovery behavior when the Step 9 flow is still current.
- Add concise diagnostic logs when a stale Step 9 phone flow is terminated, without treating it as a new business failure for the active round.

## Capabilities

### New Capabilities
- `step9-phone-flow-isolation`: Ensures Step 9 phone-verification tasks are bound to the active auto-run/auth execution and cannot perform stale HeroSMS or page actions after their owner flow is obsolete.

### Modified Capabilities
- `step9-phone-consent-recovery`: Step 9 consent recovery must remain bounded to the current Step 9 execution when phone verification recovery is involved.
- `free-phone-reuse-mode`: Free reusable phone records must not be cleared or mutated by stale Step 9 phone flows from previous rounds.

## Impact

- Affected steps: Step 9 OAuth confirm and inline phone verification; auto-run round reset/retry/stop boundaries that can obsolete Step 9 work.
- Affected providers/APIs: HeroSMS `getStatus`, `getStatusV2`, `setStatus(3)`, `setStatus(6)`, `setStatus(8)`, `reactivate`, `getNumber`, and `getNumberV2`.
- Affected configuration domains: none; this is a safety behavior change and should not add a user-facing switch.
- Affected code areas: `background/steps/confirm-oauth.js`, `background/phone-verification-flow.js`, `background/auto-run-controller.js`, `background.js` assembly/runtime guards, and focused tests around Step 9/phone verification.
- Root docs: update `项目完整链路说明.md` and `项目文件结构说明.md` if a new module or persistent runtime field is introduced; update `项目开发规范（AI协作）.md` only if a new general development rule is added.
