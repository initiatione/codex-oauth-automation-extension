## 1. Consent Wait Timing

- [x] 1.1 Inspect `waitForStep8Ready` and Step 9 caller timeout handling to identify where phone verification consumes the OAuth consent readiness window.
- [x] 1.2 Update the readiness loop so completing inline phone verification restarts the local post-phone consent/button readiness timer.
- [x] 1.3 Moderately extend the local post-phone consent readiness allowance without removing bounded waits.
- [x] 1.4 Ensure the existing overall OAuth flow timeout still applies when `oauthFlowTimeoutEnabled` is enabled and remains disabled when the user turns it off.

## 2. Consent-Like Page Recovery And Diagnostics

- [x] 2.1 Treat `/sign-in-with-chatgpt/.../consent` URLs with missing or disabled continue buttons as recoverable pending consent states until the local post-phone wait expires.
- [x] 2.2 Add or adjust diagnostics for consent-like pending states, including URL, `consentPage`, `buttonFound`, `buttonEnabled`, and `buttonText`.
- [x] 2.3 Ensure Step 9 does not restart from Step 7 when the tab is already on a consent-like URL and only the continue button readiness is pending.
- [x] 2.4 Keep existing hard failures for non-consent retry pages, disabled SMS mode on phone pages, Cloudflare/security blocks, and true timeout exhaustion.

## 3. Free Phone Reuse Preservation Safety

- [x] 3.1 Verify the phone verification success path still skips HeroSMS `setStatus(6)` for protected valid free-reuse activations.
- [x] 3.2 Verify protected valid free-reuse activations still skip HeroSMS `setStatus(8)` cancellation.
- [x] 3.3 Verify paid same-number reactivation remains controlled by `heroSmsReuseEnabled` and is not triggered by the Step 9 consent wait fix.
- [x] 3.4 Keep logs clear that the Step 9 consent wait fix is separate from HeroSMS lifecycle preservation.

## 4. Tests

- [x] 4.1 Add or update a `waitForStep8Ready` unit test where phone verification takes longer than the original readiness timeout and Step 9 still waits freshly for consent afterward.
- [x] 4.2 Add or update a test where the auth tab is already on `/sign-in-with-chatgpt/.../consent` but the continue button is initially not ready.
- [x] 4.3 Add or update Step 9 tests proving disabled OAuth total-timeout still uses local waits for consent readiness.
- [x] 4.4 Add or keep regression coverage proving free phone reuse still avoids HeroSMS `setStatus(6)` after a valid SMS code.
- [x] 4.5 Run focused Step 9 / Step 8 readiness / phone verification tests.
- [x] 4.6 Run `npm test`.

## 5. Documentation And Quality

- [x] 5.1 Update `项目完整链路说明.md` to describe the Step 9 phone-verification-to-consent timing boundary if implementation changes observable chain behavior.
- [x] 5.2 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or responsibilities materially change.
- [x] 5.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 5.4 Check touched Chinese logs, errors, and docs for mojibake.
