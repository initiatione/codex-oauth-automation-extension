## ADDED Requirements

### Requirement: Automatic free reuse preparation confirms waiting state
The system SHALL prepare a saved free reusable HeroSMS activation by re-requesting SMS delivery, waiting briefly, and confirming the activation is in a waiting-for-SMS state before submitting the saved phone number to OpenAI.

#### Scenario: Waiting state confirmed after reactivation
- **WHEN** automatic free phone reuse is enabled, a saved free reusable phone exists, Step 9 reaches add-phone, and HeroSMS returns `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, or `STATUS_WAIT_RESEND` after `setStatus(3)`
- **THEN** Step 9 MUST submit the saved phone number to OpenAI
- **AND** Step 9 MUST continue polling the same saved activation for the new SMS code
- **AND** Step 9 MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` before using the saved phone

#### Scenario: Waiting state with suffix is accepted
- **WHEN** automatic free phone reuse preparation receives a HeroSMS status such as `STATUS_WAIT_RETRY:597243`, `STATUS_WAIT_CODE:597243`, or `STATUS_WAIT_RESEND:597243`
- **THEN** Step 9 MUST treat the status as a waiting-for-SMS state
- **AND** Step 9 MUST NOT treat the suffix as a verification code
- **AND** Step 9 MUST NOT clear the saved free reusable phone because of the suffix

### Requirement: Automatic free reuse retries stale-code preparation safely
The system SHALL retry automatic free reuse preparation when the saved activation still exposes an old code or has not reached a confirmed waiting state yet.

#### Scenario: Old code remains after reactivation
- **WHEN** automatic free phone reuse preparation calls `setStatus(3)` and a later HeroSMS status check still returns `STATUS_OK:<code>` for the saved activation
- **THEN** Step 9 MUST wait and retry preparation within a bounded retry budget
- **AND** Step 9 MUST NOT submit that old code to OpenAI during preparation
- **AND** Step 9 MUST NOT immediately buy a new phone number

#### Scenario: Preparation retry later reaches waiting state
- **WHEN** an automatic free reuse preparation retry later receives `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, `STATUS_WAIT_RESEND`, or one of those statuses with a suffix
- **THEN** Step 9 MUST continue with the saved phone number
- **AND** Step 9 MUST keep the saved free reusable phone record available for lifecycle tracking

### Requirement: Automatic free reuse preparation failure stops without paid fallback
The system SHALL stop the current automatic flow when a saved free reusable phone cannot be prepared for automatic reuse, and SHALL NOT fall through to paid HeroSMS acquisition or same-number reactivation in that same handoff.

#### Scenario: Preparation budget exhausted
- **WHEN** automatic free phone reuse is enabled, a saved free reusable phone exists, and preparation cannot confirm a waiting state before the retry budget is exhausted
- **THEN** Step 9 MUST stop the automatic flow with a clear failure reason
- **AND** Step 9 MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` in the same handoff
- **AND** Step 9 MUST NOT buy a new phone number as fallback

#### Scenario: Preparation reaches terminal cancelled state
- **WHEN** automatic free phone reuse preparation receives a terminal cancellation status such as `STATUS_CANCEL`
- **THEN** Step 9 MUST stop the automatic flow or retire the local saved record according to the existing terminal cleanup policy
- **AND** Step 9 MUST NOT silently continue into paid new-number acquisition in that same handoff


### Requirement: Submitted automatic free reuse phone keeps existing replacement behavior
After the saved free reusable phone has been prepared and submitted to OpenAI, the system SHALL treat explicit OpenAI phone rejection, banned-number, and configured high-risk resend-throttled signals as post-submit phone failure rather than preparation failure.

#### Scenario: Submitted saved phone is explicitly rejected by OpenAI
- **WHEN** automatic free phone reuse has submitted the saved phone number to OpenAI and the phone-verification page reports that SMS cannot be sent to this phone number
- **THEN** Step 9 MUST treat the saved phone as rejected by OpenAI
- **AND** Step 9 MAY clear or retire the saved free reusable phone record according to existing replacement behavior
- **AND** Step 9 MAY continue with the existing Step 9 number replacement flow, including acquiring a new number if replacement limits allow

#### Scenario: Submitted saved phone hits configured resend-throttled replacement policy
- **WHEN** automatic free phone reuse has submitted the saved phone number to OpenAI, the page shows resend-throttled text, and the high-risk throttled-as-banned switch is enabled
- **THEN** Step 9 MAY treat the submitted saved phone as unavailable for OpenAI and use the existing replacement flow
- **AND** this MUST NOT be classified as automatic free reuse preparation failure

#### Scenario: Preparation has not submitted the saved phone yet
- **WHEN** automatic free phone reuse is still in `setStatus(3)` or HeroSMS waiting-state confirmation before the saved phone is submitted to OpenAI
- **THEN** any failure in that phase MUST remain a preparation failure
- **AND** Step 9 MUST NOT buy a new number as fallback for that preparation failure

### Requirement: Automatic free reuse logs are concise and diagnostic
The system SHALL write concise Step 9 logs for automatic free reuse preparation that identify the saved phone lifecycle milestone and final stop reason without excessive repeated text.

#### Scenario: Successful preparation logs milestones
- **WHEN** automatic free phone reuse preparation succeeds
- **THEN** Step 9 logs MUST show that it reactivated the saved phone, checked HeroSMS status, confirmed waiting state, and submitted the saved phone
- **AND** the logs SHOULD include the phone number and status text where useful

#### Scenario: Failed preparation logs no-paid-fallback boundary
- **WHEN** automatic free phone reuse preparation fails and the flow stops
- **THEN** Step 9 logs MUST state that automatic free reuse preparation failed
- **AND** the logs MUST state that no new HeroSMS number will be purchased for that handoff
