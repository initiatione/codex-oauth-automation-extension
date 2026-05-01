## Context

Step 9 uses `waitForStep8Ready` to wait for the OAuth consent page before clicking the continue button and listening for the localhost callback. The same helper also recovers from `add-phone` and `phone-verification` pages by calling the phone verification flow inline. Its local timeout starts before that recovery work begins.

In real runs, SMS polling, resend, and number replacement can consume the entire consent readiness timeout. After the valid phone code is submitted, OpenAI can already be on `/sign-in-with-chatgpt/.../consent`, but `waitForStep8Ready` immediately exits because the timeout window started before phone verification. This produces the misleading error "long time not entered OAuth consent page" and triggers Step 7 restart even though the chain actually reached the OAuth consent page.

The free phone reuse changes already protect valid HeroSMS activations by skipping `setStatus(6)` completion. This change must not alter that lifecycle branch.

## Goals / Non-Goals

**Goals:**

- Separate phone verification recovery time from post-phone OAuth consent readiness time.
- Restart or refresh the local readiness window after `completePhoneVerificationFlow` returns from a phone page.
- Keep waiting when the current page is already consent-like but the continue button is not yet detected or enabled.
- Add diagnostics that make consent URL/button readiness problems visible in logs or tests.
- Slightly extend the default local post-phone consent readiness wait to tolerate slow OpenAI transitions.
- Preserve existing free phone reuse and HeroSMS lifecycle behavior.

**Non-Goals:**

- Do not redesign Step 9 callback capture or consent-click strategies.
- Do not change Step 7 or Step 8 login-code behavior except through the existing Step 9 handoff.
- Do not change sidepanel configuration or add a new switch.
- Do not change HeroSMS API lifecycle semantics, including the free reuse `setStatus(6)` skip.
- Do not remove the existing OAuth total-timeout feature; when enabled, it can still cap the overall chain outside the local post-phone readiness window.

## Decisions

1. Reset the local readiness timer after phone verification recovery.
   - Rationale: phone verification is a nested recovery path with its own waits. Once it succeeds, Step 9 needs a fresh local window to observe the OAuth consent page and button.
   - Alternative considered: increase `STEP8_READY_WAIT_TIMEOUT_MS` globally. That would reduce the symptom but still let SMS wait consume the consent wait.

2. Keep `waitForStep8Ready` responsible for phone-page recovery, but make the timeout model phase-aware.
   - Rationale: existing Step 9 callers already rely on `waitForStep8Ready` to handle add-phone pages. Keeping that integration avoids a larger control-flow rewrite.
   - Alternative considered: move phone verification out of `waitForStep8Ready` into `confirm-oauth.js`. That is cleaner long-term, but larger and riskier for this targeted bug fix.

3. Treat consent-like URL without ready button as pending, with diagnostics.
   - Rationale: the user log shows the tab URL is already the OAuth consent URL while the helper reports failure. Button readiness can lag DOM/page transition, so this is not a Step 7 restart condition until the local post-phone wait expires.
   - Alternative considered: return success when URL matches consent even without a button. That would let the click path fail later and lose useful diagnostics.

4. Extend only the local post-phone readiness allowance.
   - Rationale: the slow part is the OpenAI transition after phone verification. A modestly longer local wait is safer than disabling all Step 9 waits.
   - Alternative considered: disable Step 9 consent readiness timeout completely. That could hang automation on broken pages.

5. Keep HeroSMS preservation untouched.
   - Rationale: the activation lifecycle fix and this consent timeout fix are adjacent but independent. A valid free-reuse activation must remain protected from `setStatus(6)` completion and `setStatus(8)` cancellation.
   - Alternative considered: reuse activation preservation state as a signal to skip consent wait. That would couple SMS cost behavior to OAuth UI readiness and would be brittle.

## Risks / Trade-offs

- [Risk] A longer local wait can delay real failures on a broken consent page. -> Mitigation: keep the wait bounded and log consent URL/button diagnostics.
- [Risk] Resetting the timer inside `waitForStep8Ready` could hide an overall OAuth timeout. -> Mitigation: keep the existing `getOAuthFlowStepTimeoutMs` / remaining budget checks in Step 9 so the global timeout still applies when enabled.
- [Risk] Consent page DOM changes could still prevent button detection. -> Mitigation: record `consentPage`, `buttonFound`, `buttonEnabled`, `buttonText`, and URL diagnostics to guide selector updates.
- [Risk] Future edits may accidentally touch HeroSMS lifecycle calls while fixing Step 9 timing. -> Mitigation: include regression tests proving free reuse still skips `setStatus(6)` after a valid code.
- [Risk] Chinese log or docs text can become mojibake. -> Mitigation: scan touched Chinese text after implementation.
