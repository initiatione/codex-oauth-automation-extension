## ADDED Requirements

### Requirement: Resend-throttled risk switch
The system SHALL provide a persisted sidepanel switch that controls whether OpenAI resend-throttled phone-verification messages are treated as high-probability banned or unusable phone signals.

#### Scenario: Switch defaults to disabled
- **WHEN** the extension initializes without a saved value for the resend-throttled risk switch
- **THEN** the setting MUST be disabled by default

#### Scenario: User enables the risk switch
- **WHEN** the user enables the resend-throttled risk switch in the sidepanel
- **THEN** subsequent Step 9 phone SMS waits MUST treat resend-throttled page text as an immediate number replacement signal
- **AND** the change MUST take effect without extension reload or browser restart

#### Scenario: User disables the risk switch
- **WHEN** the user disables the resend-throttled risk switch in the sidepanel
- **THEN** subsequent Step 9 phone SMS waits MUST NOT apply the high-probability banned-number replacement policy for resend-throttled page text

### Requirement: Resend-throttled risk disclosure
The sidepanel SHALL disclose that treating resend throttling as a banned-number signal is a probability-based heuristic with false-positive risk.

#### Scenario: Switch copy warns about risk
- **WHEN** the sidepanel displays the resend-throttled risk switch
- **THEN** the visible label or hover title MUST explain that the signal is "大概率" or equivalent
- **AND** it MUST mention that the number may be mistakenly replaced or discarded

### Requirement: Resend-throttled risk setting participates in settings persistence
The resend-throttled risk switch SHALL be saved, restored, normalized, imported, and exported through the existing settings flow.

#### Scenario: Settings are saved and restored
- **WHEN** the user changes the resend-throttled risk switch and saves settings
- **THEN** the background state MUST store the normalized boolean value
- **AND** reopening the sidepanel MUST restore the switch value from state

#### Scenario: Settings are imported or exported
- **WHEN** settings are imported or exported
- **THEN** the resend-throttled risk setting MUST participate in the same persisted settings payload as other phone-verification settings
