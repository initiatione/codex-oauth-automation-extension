## ADDED Requirements

### Requirement: Detect banned phone after resend

The system SHALL detect an OpenAI phone-verification page message indicating that SMS cannot be sent to the current phone number after the automation clicks resend.

#### Scenario: Chinese banned-number message appears after resend
- **WHEN** the phone verification page shows "无法向此电话号码发送短信" after "重新发送短信" is clicked
- **THEN** the content script SHALL report a banned-number resend failure instead of reporting resend success

#### Scenario: No banned-number message appears after resend
- **WHEN** the resend button is clicked and no banned-number or resend-throttle message appears
- **THEN** the content script SHALL report resend success using the existing result shape

### Requirement: Replace banned phone inside Step 9

The system SHALL treat a banned-number resend failure as a recoverable current-number failure and replace the phone number within Step 9.

#### Scenario: Current phone is banned after resend
- **WHEN** Step 9 receives a banned-number resend failure for the current HeroSMS activation
- **THEN** the background flow SHALL cancel or release the current activation when it owns the activation
- **AND** it SHALL clear the current activation state
- **AND** it SHALL request a fresh phone number
- **AND** it SHALL submit the fresh number on the add-phone page without restarting Step 7

#### Scenario: Replacement limit is exhausted
- **WHEN** banned-number resend failures cause the Step 9 number replacement count to exceed the configured replacement limit
- **THEN** the background flow SHALL stop the phone verification attempt with an error that includes the final banned-number reason

### Requirement: Preserve manual free reuse handoff

The system SHALL NOT run automatic banned-number replacement while the free phone reuse handoff has intentionally stopped automation for manual SMS refresh.

#### Scenario: Free reuse handoff stops automation
- **WHEN** free phone reuse mode fills a saved phone number and stops automatic mode before submitting the phone form
- **THEN** the banned-number replacement path SHALL NOT request, reactivate, cancel, or replace any HeroSMS activation

### Requirement: Log banned phone replacement

The system SHALL log a clear warning when it replaces a phone because OpenAI reports that SMS cannot be sent to that number.

#### Scenario: Banned number triggers replacement
- **WHEN** Step 9 replaces a number after the resend-time banned-number message
- **THEN** the log SHALL include the affected phone number when available
- **AND** the log SHALL state that OpenAI rejected SMS sending to the number and that a new number is being requested
