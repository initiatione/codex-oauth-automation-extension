## Why

Step 9 currently starts the OAuth consent readiness timeout before it may run the full phone verification flow. When phone SMS polling, resend, or number replacement consumes that window, a successful phone code submission can return to the consent URL and immediately fail with "long time not entered OAuth consent page", sending the chain back to Step 7 even though phone verification succeeded.

## What Changes

- Reset the local OAuth consent/button readiness wait after Step 9 completes phone verification from an `add-phone` or `phone-verification` page.
- Treat a current `/sign-in-with-chatgpt/.../consent` URL with a temporarily missing or disabled continue button as a recoverable waiting state, not an immediate Step 7 restart.
- Add clearer diagnostics when Step 9 is on a consent-like URL but the continue button is not ready, including URL and button detection state.
- Moderately extend the local post-phone consent readiness wait so slow OpenAI transitions have more time after SMS verification succeeds.
- Preserve the existing free phone reuse behavior: valid HeroSMS activations protected for manual free reuse must still skip `setStatus(6)` completion and remain independent from paid same-number reactivation.

## Capabilities

### New Capabilities

- `step9-phone-consent-recovery`: Step 9 recovers correctly from phone verification into OAuth consent readiness without reusing SMS wait time as consent wait time.

### Modified Capabilities

None.

## Impact

- Affects Step 9 OAuth confirmation in `background/steps/confirm-oauth.js` and the shared readiness helper in `background.js`.
- Affects phone verification handoff from `background/phone-verification-flow.js` only as needed to consume its result safely; the HeroSMS lifecycle preservation behavior must remain unchanged.
- Affects content-side Step 8/9 state interpretation in `content/signup-page.js` only if additional consent diagnostics or URL recognition are needed.
- Affects tests around `waitForStep8Ready`, Step 9 timeout recovery, phone verification handoff, and disabled OAuth total-timeout behavior.
- Affects the Step 9 feature chain documentation in `项目完整链路说明.md`.
- No project structure changes are expected unless implementation extracts a small helper. `项目文件结构说明.md` only needs an update if files are added, deleted, renamed, or responsibilities materially change.
- `项目开发规范（AI协作）.md` is not expected to change because no new development boundary is introduced.
