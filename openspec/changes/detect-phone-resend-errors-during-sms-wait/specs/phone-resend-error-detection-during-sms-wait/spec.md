## ADDED Requirements

### Requirement: Detect banned-number errors during the full SMS wait
Step 9 SHALL continue checking the phone-verification page for banned-number resend errors while waiting for SMS, regardless of whether a resend request has already been made.

#### Scenario: Chinese banned-number text appears during first SMS wait
- **WHEN** Step 9 submits a phone number, HeroSMS is still returning `STATUS_WAIT_CODE`, and the page shows "无法向此电话号码发送短信" before any resend request
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_phone_banned`

#### Scenario: Chinese banned-number text appears after resend click
- **WHEN** Step 9 clicks "重新发送短信", the content helper returns resend success, and the page later shows "无法向此电话号码发送短信" while HeroSMS is still returning `STATUS_WAIT_CODE`
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_phone_banned`

#### Scenario: English banned-number text appears after resend click
- **WHEN** Step 9 clicks "Resend text message", the content helper returns resend success, and the page later shows equivalent English text indicating SMS cannot be sent to this phone number
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_phone_banned`

### Requirement: Detect resend throttling during the full SMS wait
Step 9 SHALL continue checking the phone-verification page for resend throttling errors while waiting for SMS, regardless of whether a resend request has already been made.

#### Scenario: Chinese resend-throttled text appears during first SMS wait
- **WHEN** Step 9 submits a phone number, HeroSMS is still returning `STATUS_WAIT_CODE`, and the page shows "尝试重新发送的次数过多。请稍后重试。" before any resend request
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_throttled`

#### Scenario: Chinese resend-throttled text appears after resend click
- **WHEN** Step 9 clicks "重新发送短信", the content helper returns resend success, and the page later shows "尝试重新发送的次数过多。请稍后重试。" while HeroSMS is still returning `STATUS_WAIT_CODE`
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_throttled`

#### Scenario: English resend-throttled text appears after resend click
- **WHEN** Step 9 clicks "Resend text message", the content helper returns resend success, and the page later shows equivalent English throttling text such as "Tried to resend too many times. Please try again later."
- **THEN** Step 9 MUST stop waiting for the current SMS window and replace the current number with reason `resend_throttled`

### Requirement: Preserve normal SMS polling without page-side resend errors
Step 9 SHALL continue normal HeroSMS status polling when no explicit page-side resend error is detected.

#### Scenario: No page-side resend error appears
- **WHEN** Step 9 has requested another SMS and HeroSMS continues returning `STATUS_WAIT_CODE` while the phone-verification page shows no resend rejection or throttling text
- **THEN** Step 9 MUST keep polling until a valid code arrives or the configured SMS timeout/replacement rules apply

#### Scenario: Page probe fails transiently
- **WHEN** the page-side resend error probe fails due to a transient content-script or navigation issue without an explicit resend error
- **THEN** Step 9 MUST not replace the number solely because of that probe failure and MUST continue the existing SMS wait behavior

### Requirement: Preserve existing valid-code activation protection
The late resend error detection MUST NOT weaken existing HeroSMS lifecycle protection for activations that have already received a valid SMS code.

#### Scenario: Activation already received a valid SMS code
- **WHEN** an activation has `phoneCodeReceived` and later cleanup or replacement logic runs
- **THEN** the extension MUST continue to avoid cancelling protected valid-code activations according to the existing free phone reuse preservation rules
