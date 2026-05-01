## MODIFIED Requirements

### Requirement: Detect resend throttling during the full SMS wait
Step 9 SHALL continue checking the phone-verification page for resend throttling errors while waiting for SMS, regardless of whether a resend request has already been made, and SHALL apply the high-probability banned-number replacement policy only when the resend-throttled risk switch is enabled.

#### Scenario: Chinese resend-throttled text appears during first SMS wait with risk switch enabled
- **WHEN** Step 9 submits a phone number, HeroSMS is still returning `STATUS_WAIT_CODE`, the resend-throttled risk switch is enabled, and the page shows "尝试重新发送的次数过多。请稍后重试。" before any resend request
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number immediately
- **AND** the replacement reason MUST identify the high-probability resend-throttled signal

#### Scenario: Chinese resend-throttled text appears after resend click with risk switch enabled
- **WHEN** Step 9 clicks "重新发送短信", the content helper returns resend success, the resend-throttled risk switch is enabled, and the page later shows "尝试重新发送的次数过多。请稍后重试。" while HeroSMS is still returning `STATUS_WAIT_CODE`
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number immediately
- **AND** the replacement reason MUST identify the high-probability resend-throttled signal

#### Scenario: English resend-throttled text appears after resend click with risk switch enabled
- **WHEN** Step 9 clicks "Resend text message", the content helper returns resend success, the resend-throttled risk switch is enabled, and the page later shows equivalent English throttling text such as "Tried to resend too many times. Please try again later."
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number immediately
- **AND** the replacement reason MUST identify the high-probability resend-throttled signal

#### Scenario: Resend-throttled text appears with risk switch disabled
- **WHEN** Step 9 sees resend-throttled page text while the resend-throttled risk switch is disabled
- **THEN** Step 9 MUST NOT apply the high-probability banned-number replacement policy solely because of that text
- **AND** Step 9 MUST continue using the existing conservative resend-throttle behavior

#### Scenario: Replacement limit is exhausted by high-probability throttled replacements
- **WHEN** high-probability resend-throttled replacements cause the Step 9 number replacement count to exceed the configured replacement limit
- **THEN** the background flow MUST stop the phone verification attempt with an error that includes the final resend-throttled reason
