## ADDED Requirements

### Requirement: Mark activation after valid SMS code

The system SHALL mark the current HeroSMS activation as code-received immediately after the HeroSMS status API returns a valid phone verification code.

#### Scenario: HeroSMS returns a valid code
- **WHEN** Step 9 receives a valid SMS code from `getStatus` or `getStatusV2`
- **THEN** the current activation SHALL be marked as code-received before the code is submitted to OpenAI
- **AND** the marker SHALL be associated with the same activation ID that returned the code

#### Scenario: HeroSMS has not returned a valid code
- **WHEN** Step 9 is still waiting for SMS or times out before receiving a code
- **THEN** the current activation SHALL NOT be marked as code-received

### Requirement: Do not cancel code-received activation

The system SHALL NOT send HeroSMS cancellation status for an activation that has already received a valid SMS code.

#### Scenario: Code-received activation enters cleanup
- **WHEN** a code-received activation reaches exception cleanup, stop cleanup, invalid-code recovery, page-loop recovery, or replacement-number cleanup
- **THEN** the background flow SHALL NOT call HeroSMS `setStatus(8)` for that activation
- **AND** it SHALL clear local in-flight activation state when needed

#### Scenario: Activation has no received code
- **WHEN** an activation that has not received a valid code must be abandoned
- **THEN** the background flow MAY call the existing HeroSMS cancellation path

### Requirement: Preserve free reusable phone after code

The system SHALL preserve the free reusable phone record and its source activation after the first valid SMS code is received.

#### Scenario: Free reuse mode records the first code-received number
- **WHEN** free phone reuse mode is enabled and the first newly acquired activation returns a valid SMS code
- **THEN** the activation SHALL be saved as the free reusable phone record
- **AND** no later cleanup path SHALL cancel that same activation with HeroSMS `setStatus(8)`

#### Scenario: User manually clears free reusable phone
- **WHEN** the user manually clears the free reusable phone record from the sidepanel
- **THEN** the local saved record SHALL be removed
- **AND** the clear action SHALL NOT retroactively cancel a code-received HeroSMS activation

### Requirement: Log skipped cancellation after code

The system SHALL log when it skips SMS platform cancellation because an activation has already received a code.

#### Scenario: Cancellation is skipped for protected activation
- **WHEN** a cleanup path attempts to abandon a code-received activation
- **THEN** the log SHALL state that HeroSMS cancellation was skipped because a verification code was already received
- **AND** the log SHOULD include the phone number or activation ID when available
