## ADDED Requirements

### Requirement: Detect phone max-usage errors on the auth page
The system SHALL detect OpenAI add-phone errors that indicate the current phone number reached the maximum usage limit.

#### Scenario: Machine-readable token is visible
- **WHEN** the auth page displays an error containing `phone_max_usage_exceeded`
- **THEN** Step 9 classifies the current phone number as max-usage exceeded

#### Scenario: Error appears after phone submission
- **WHEN** Step 9 submits a phone number and the auth page transitions to a max-usage error screen
- **THEN** Step 9 detects the condition without waiting for the SMS polling window to expire

### Requirement: Discard max-usage phone from reusable state
The system SHALL remove the rejected phone number from current and reusable phone activation state before retrying.

#### Scenario: Current activation matches rejected number
- **WHEN** the current phone activation number matches the number rejected with `phone_max_usage_exceeded`
- **THEN** the system clears the current phone activation and current verification-code state for that number

#### Scenario: Reusable activation matches rejected number
- **WHEN** reusable or free-reusable phone activation state matches the rejected number
- **THEN** the system removes that reusable state so the number will not be selected again

#### Scenario: Unrelated reusable activation exists
- **WHEN** reusable phone activation state contains a different phone number
- **THEN** the system preserves that unrelated reusable state

### Requirement: Retry Step 9 with a fresh phone number
The system SHALL recover from a phone max-usage error by returning to the add-phone form and trying a newly acquired phone number.

#### Scenario: Retry button restores add-phone form
- **WHEN** the max-usage error screen provides a retry action
- **THEN** Step 9 uses it to return to the add-phone form before submitting another number

#### Scenario: Retry action is unavailable
- **WHEN** the max-usage error screen cannot be reset with a retry action
- **THEN** Step 9 navigates back to the add-phone form and waits for the phone input before continuing

#### Scenario: New number is acquired after cleanup
- **WHEN** Step 9 has cleared the rejected number and the add-phone form is ready
- **THEN** Step 9 acquires or selects a different phone number and submits it through the normal phone-verification path

#### Scenario: Replacement limit is enforced
- **WHEN** max-usage recoveries exceed the configured finite phone replacement limit
- **THEN** Step 9 fails with the existing replacement-limit behavior

#### Scenario: Unlimited replacement mode is configured
- **WHEN** phone replacement limit is configured as unlimited
- **THEN** max-usage recoveries continue until Stop, another failure condition, or a successful phone verification occurs

### Requirement: Max-usage recovery respects cancellation
The system SHALL respect Stop and stale Step 9 task boundaries during max-usage recovery.

#### Scenario: Stop is requested during max-usage recovery
- **WHEN** the user requests Stop after the max-usage error is detected
- **THEN** Step 9 cancels recovery and does not acquire or submit another phone number

#### Scenario: Older Step 9 task detects max-usage after restart
- **WHEN** an older Step 9 task sees `phone_max_usage_exceeded` after a newer Step 9 task has started
- **THEN** the older task does not clear newer state, acquire another number, or submit another number

### Requirement: Max-usage recovery is observable
The system SHALL log max-usage recovery actions in a way that distinguishes them from SMS timeout and generic phone failure.

#### Scenario: Max-usage number is discarded
- **WHEN** Step 9 clears a number because OpenAI reported `phone_max_usage_exceeded`
- **THEN** the logs identify that number as discarded due to OpenAI max usage

#### Scenario: Step 9 retries with a new number
- **WHEN** Step 9 returns to the add-phone form after max-usage cleanup
- **THEN** the logs indicate that Step 9 is retrying with a fresh number
