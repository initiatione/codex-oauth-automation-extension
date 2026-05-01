## ADDED Requirements

### Requirement: Preserve valid activation for free reuse
When free phone reuse is enabled, the system SHALL preserve a newly acquired HeroSMS activation after it receives a valid phone verification code, without completing or cancelling the activation on HeroSMS.

#### Scenario: Free reuse preserves activation after valid code
- **WHEN** Step 9 acquires a new HeroSMS phone number and `getStatus` or `getStatusV2` returns a valid code
- **AND** `freePhoneReuseEnabled` is enabled
- **THEN** the system SHALL record the phone as `freeReusablePhoneActivation`
- **AND** the system SHALL NOT call HeroSMS `setStatus` with status `6` for that activation
- **AND** the system SHALL NOT call HeroSMS `setStatus` with status `8` for that activation

#### Scenario: Free reuse disabled keeps normal completion
- **WHEN** Step 9 receives a valid phone verification code
- **AND** `freePhoneReuseEnabled` is disabled
- **THEN** the system SHALL keep the existing successful-completion behavior
- **AND** it SHALL call HeroSMS `setStatus` with status `6` when the OpenAI phone verification succeeds

### Requirement: Preserve separation from paid same-number reactivation
The system SHALL keep free phone activation preservation independent from the paid HeroSMS same-number reactivation switch.

#### Scenario: Free reuse enabled and paid reactivation disabled
- **WHEN** `freePhoneReuseEnabled` is enabled
- **AND** `heroSmsReuseEnabled` is disabled
- **AND** a newly acquired HeroSMS activation receives a valid code
- **THEN** the system SHALL preserve the activation for manual free reuse
- **AND** it SHALL NOT call HeroSMS `reactivate` for that preservation

#### Scenario: Paid reactivation enabled does not disable preservation
- **WHEN** `freePhoneReuseEnabled` is enabled
- **AND** `heroSmsReuseEnabled` is enabled
- **AND** a newly acquired HeroSMS activation receives a valid code
- **THEN** the system SHALL still preserve that activation without HeroSMS `setStatus(6)` or `setStatus(8)`

### Requirement: Keep manual free reuse handoff local-only
When a saved free reusable phone exists, the system SHALL fill that phone number on the next add-phone page and stop automation without making paid HeroSMS lifecycle calls.

#### Scenario: Next run uses saved free phone manually
- **WHEN** a saved `freeReusablePhoneActivation` exists
- **AND** `freePhoneReuseEnabled` is enabled
- **AND** the next registration reaches the `add-phone` page
- **THEN** the system SHALL fill the saved phone number
- **AND** it SHALL stop automatic mode for manual SMS refresh
- **AND** it SHALL NOT call HeroSMS `getNumber`, `getNumberV2`, `reactivate`, `setStatus(6)`, or `setStatus(8)` for that handoff

### Requirement: Release numbers that never received a valid code
The system SHALL continue releasing or cancelling current HeroSMS activations that never received a valid code when Step 9 replaces numbers or aborts cleanup.

#### Scenario: Timeout number without code is replaced
- **WHEN** a newly acquired HeroSMS activation does not receive a valid code
- **AND** Step 9 replaces that number due to timeout or explicit page rejection
- **THEN** the system MAY call HeroSMS `setStatus(8)` according to the existing cleanup behavior
- **AND** it SHALL NOT record that phone as a free reusable phone

### Requirement: Log preserved activation lifecycle
The system SHALL log clearly when a valid HeroSMS activation is preserved for free reuse instead of being completed or cancelled.

#### Scenario: Completion is skipped for free reuse
- **WHEN** Step 9 skips HeroSMS `setStatus(6)` for a protected free-reuse activation
- **THEN** the log SHALL identify the phone number when available
- **AND** the log SHALL state that HeroSMS completion was skipped to preserve the phone for manual free reuse
