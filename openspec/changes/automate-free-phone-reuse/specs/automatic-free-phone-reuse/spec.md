## ADDED Requirements

### Requirement: Automatic free reuse setting
The system SHALL provide a persisted sidepanel switch that enables automatic reuse of the saved free reusable phone, and changes to the switch MUST affect subsequent Step 9 phone-verification decision points without requiring extension reload or a new browser session.

#### Scenario: User enables automatic free reuse
- **WHEN** the user enables the automatic free reuse switch while free phone reuse mode is also enabled
- **THEN** the next add-phone page that has a saved free reusable phone MUST attempt the automatic free reuse flow instead of stopping for manual SMS refresh

#### Scenario: User disables automatic free reuse
- **WHEN** the user disables the automatic free reuse switch
- **THEN** the next add-phone page with a saved free reusable phone MUST keep the existing manual handoff behavior

#### Scenario: Free phone reuse is disabled
- **WHEN** automatic free reuse is enabled but free phone reuse mode is disabled
- **THEN** the system MUST NOT use the saved free reusable phone automatically

### Requirement: Automatic free reuse prepares HeroSMS activation before submit
Before submitting a saved free reusable phone to OpenAI, Step 9 SHALL move the saved HeroSMS activation back into SMS waiting by calling `setStatus(3)` and confirming that the activation can be polled for a new SMS.

#### Scenario: Saved activation enters waiting state
- **WHEN** automatic free reuse starts for a saved free reusable phone
- **THEN** Step 9 MUST call HeroSMS `setStatus` with `status=3` for the saved activation id
- **AND** Step 9 MUST poll the saved activation with its stored status action until HeroSMS reports `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, `STATUS_WAIT_RESEND`, or an equivalent V2 waiting payload

#### Scenario: Saved activation returns a stale code before OpenAI submit
- **WHEN** HeroSMS returns `STATUS_OK` or a V2 code during the pre-submit waiting-state confirmation
- **THEN** Step 9 MUST NOT submit that stale code to OpenAI for the new registration
- **AND** Step 9 MUST continue confirming a new waiting state or fail the saved free reusable phone if waiting cannot be confirmed within the configured preparation window

#### Scenario: Saved activation cannot enter waiting state
- **WHEN** `setStatus(3)` fails, the follow-up status poll fails, or HeroSMS reports cancellation or a terminal non-waiting state
- **THEN** Step 9 MUST clear or retire the saved free reusable phone and continue with the normal new-number or paid-reactivation path

### Requirement: Automatic free reuse submits saved phone and polls for new code
After HeroSMS waiting state is confirmed, Step 9 SHALL submit the saved phone number on the add-phone page, wait for the OpenAI phone-verification page, poll the same saved HeroSMS activation for the new SMS code, submit the code, and continue the normal OAuth consent flow.

#### Scenario: Automatic reuse receives a new SMS code
- **WHEN** automatic free reuse submits the saved phone and HeroSMS returns a valid new code from `getStatus` or `getStatusV2`
- **THEN** Step 9 MUST fill and submit that code using the existing phone verification code submission path
- **AND** Step 9 MUST continue toward OAuth consent without stopping automation

#### Scenario: Automatic reuse waits for SMS
- **WHEN** HeroSMS keeps returning `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, or `STATUS_WAIT_RESEND` after the saved phone has been submitted
- **THEN** Step 9 MUST use the existing SMS wait windows, poll intervals, resend behavior, and replacement limits

#### Scenario: Automatic reuse reaches OAuth consent
- **WHEN** the saved phone verification succeeds and the auth page reaches OAuth consent or localhost callback capture
- **THEN** Step 9 MUST continue the existing OAuth completion flow

### Requirement: Automatic free reuse preserves resend error detection
The automatic free reuse flow SHALL keep the existing page-side banned-number and resend-throttling detection before and after OpenAI phone submission.

#### Scenario: OpenAI rejects the reused phone as unable to receive SMS
- **WHEN** the phone-verification page shows "无法向此电话号码发送短信" or equivalent English text during automatic free reuse
- **THEN** Step 9 MUST stop using the saved free reusable phone, clear or retire its local record, and continue with the normal new-number or paid-reactivation path

#### Scenario: OpenAI reports resend throttling
- **WHEN** the phone-verification page shows "尝试重新发送的次数过多。请稍后重试。" or equivalent English text during automatic free reuse
- **THEN** Step 9 MUST stop using the saved free reusable phone, clear or retire its local record, and continue with the normal new-number or paid-reactivation path

#### Scenario: Probe has no explicit resend error
- **WHEN** the page-side resend error probe reports no explicit banned-number or throttling text during automatic free reuse
- **THEN** Step 9 MUST continue the existing SMS wait behavior

### Requirement: Automatic free reuse tracks successful uses across later registrations
The system SHALL treat saved free phone reuse as a reusable candidate for any later registration round, not only the second email, and SHALL retire the saved record when its successful use count reaches the configured maximum.

#### Scenario: Reuse succeeds below the maximum
- **WHEN** automatic free reuse succeeds and the saved free phone's new successful use count remains below `maxUses`
- **THEN** the saved free reusable phone record MUST remain available for later registration rounds
- **AND** its `successfulUses` value MUST increase by one

#### Scenario: Reuse reaches the maximum
- **WHEN** automatic free reuse succeeds and the saved free phone's new successful use count reaches `maxUses`
- **THEN** the saved free reusable phone record MUST be cleared or retired before the next add-phone page

#### Scenario: Maximum uses defaults to three
- **WHEN** a saved free reusable phone record has no explicit `maxUses`
- **THEN** the system MUST treat the maximum successful uses as three

### Requirement: Automatic free reuse has priority over paid same-number reactivation
When automatic free reuse is enabled and a valid saved free reusable phone is available, Step 9 SHALL attempt automatic free reuse before any paid HeroSMS same-number reactivation or new-number acquisition.

#### Scenario: Both free automatic reuse and paid reactivation are enabled
- **WHEN** Step 9 reaches add-phone with automatic free reuse enabled, free phone reuse enabled, a saved free reusable phone, and a paid reusable activation
- **THEN** Step 9 MUST attempt the saved free reusable phone first
- **AND** it MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` before the free reuse attempt fails or is unavailable

#### Scenario: Free automatic reuse is unavailable
- **WHEN** there is no saved free reusable phone, the saved free phone is exhausted, or the saved free phone has been cleared after failure
- **THEN** Step 9 MAY use the existing paid same-number reactivation or new-number acquisition behavior according to the existing settings

