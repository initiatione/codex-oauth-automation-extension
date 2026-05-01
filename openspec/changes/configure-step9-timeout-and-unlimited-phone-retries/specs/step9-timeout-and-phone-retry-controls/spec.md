## ADDED Requirements

### Requirement: Step 9 local callback timeout is configurable
The system SHALL provide a persisted user setting that controls only the Step 9 local localhost-callback timeout.

#### Scenario: Default preserves local callback timeout
- **WHEN** the user has not changed the new Step 9 timeout setting
- **THEN** Step 9 uses the existing local localhost-callback timeout behavior

#### Scenario: Enabled timeout fails after the local deadline
- **WHEN** the Step 9 local callback timeout setting is enabled and no localhost callback is captured before the local deadline
- **THEN** Step 9 fails with the existing local callback timeout error and cleans up its listener state

#### Scenario: Disabled timeout keeps listening
- **WHEN** the Step 9 local callback timeout setting is disabled and phone verification remains active beyond the previous local deadline
- **THEN** Step 9 keeps listening for the localhost callback instead of failing due to the local callback timeout

#### Scenario: Disabled local timeout does not disable global OAuth timeout
- **WHEN** the Step 9 local callback timeout setting is disabled and the broader OAuth-flow timeout setting is enabled
- **THEN** the broader OAuth-flow timeout can still fail the authorization chain according to its own deadline

#### Scenario: Stop cancels disabled-timeout Step 9
- **WHEN** the Step 9 local callback timeout setting is disabled and the user requests Stop
- **THEN** Step 9 cancels the active phone-verification task, removes callback listeners, and stops without continuing HeroSMS calls

### Requirement: Phone replacement limit supports unlimited mode
The system SHALL treat `phoneVerificationReplacementLimit = 0` as unlimited phone-number replacements within the current Step 9 run.

#### Scenario: Zero replacement limit does not trip the count guard
- **WHEN** `phoneVerificationReplacementLimit` is `0` and Step 9 replaces phone numbers repeatedly
- **THEN** the phone-flow does not fail because of the replacement count

#### Scenario: Positive replacement limit is still enforced
- **WHEN** `phoneVerificationReplacementLimit` is a positive value and Step 9 exceeds that replacement count
- **THEN** the phone-flow fails with the existing replacement-limit behavior

#### Scenario: Invalid values do not become unlimited
- **WHEN** the stored or entered replacement limit is blank, negative, NaN, or non-numeric
- **THEN** the system normalizes it to a safe positive default instead of unlimited mode

#### Scenario: Logs show unlimited replacement mode
- **WHEN** `phoneVerificationReplacementLimit` is `0` and Step 9 logs phone replacement progress
- **THEN** the progress text indicates unlimited mode instead of rendering a misleading finite maximum

### Requirement: Sidepanel exposes Step 9 timeout and unlimited replacement controls
The system SHALL expose the Step 9 local callback timeout setting and the unlimited replacement-limit semantics in the sidepanel.

#### Scenario: User disables Step 9 timeout in the sidepanel
- **WHEN** the user turns off the Step 9 local callback timeout control and saves settings
- **THEN** subsequent Step 9 runs use the disabled local callback timeout behavior

#### Scenario: User enters zero replacement limit
- **WHEN** the user enters `0` for the phone replacement limit and saves settings
- **THEN** the saved setting remains `0` and subsequent Step 9 runs use unlimited replacement mode

#### Scenario: Existing settings remain compatible
- **WHEN** a user has no saved Step 9 local callback timeout setting and a positive saved phone replacement limit
- **THEN** the UI restores the timeout as enabled and preserves the positive replacement limit
