## ADDED Requirements

### Requirement: Reset consent readiness wait after phone verification
Step 9 SHALL start a fresh local OAuth consent readiness wait after it completes an inline phone verification recovery from an `add-phone` or `phone-verification` page.

#### Scenario: SMS wait consumes the original readiness window
- **WHEN** Step 9 enters `waitForStep8Ready`, detects a phone verification page, waits for SMS long enough to consume the original readiness window, and then successfully submits a valid phone code
- **THEN** Step 9 MUST continue with a fresh bounded wait for OAuth consent readiness instead of immediately throwing the "long time not entered OAuth consent page" error

#### Scenario: Phone verification returns consent-ready state
- **WHEN** the phone verification flow returns a state where OAuth consent is ready after a valid code submission
- **THEN** Step 9 MUST proceed to the configured OAuth consent click strategy without restarting from Step 7

### Requirement: Consent-like URL waits for button readiness
Step 9 SHALL treat a `/sign-in-with-chatgpt/.../consent` URL as a recoverable consent-like state while waiting for the continue button to appear or become enabled.

#### Scenario: Consent URL but button not yet found
- **WHEN** the auth tab URL matches `/sign-in-with-chatgpt/.../consent` but the content state reports no ready continue button
- **THEN** Step 9 MUST keep polling until the local post-phone consent wait expires or the button becomes ready

#### Scenario: Consent URL diagnostics
- **WHEN** Step 9 remains on a consent-like URL without a ready continue button
- **THEN** Step 9 MUST expose diagnostics that include the URL and button readiness state so the failure is distinguishable from never reaching OAuth consent

### Requirement: Preserve free phone reuse lifecycle while fixing consent wait
The consent readiness recovery fix MUST NOT change free phone reuse HeroSMS lifecycle preservation.

#### Scenario: Valid free-reuse activation after consent wait fix
- **WHEN** `freePhoneReuseEnabled` is enabled and a newly acquired HeroSMS activation receives a valid phone verification code
- **THEN** the extension MUST continue to skip HeroSMS `setStatus(6)` completion for that activation while proceeding to OAuth consent readiness

#### Scenario: Paid same-number reactivation remains independent
- **WHEN** free phone reuse and paid same-number reactivation switches are configured independently
- **THEN** Step 9 MUST preserve the existing priority where free manual reuse preservation does not trigger paid platform reactivation or completion calls
