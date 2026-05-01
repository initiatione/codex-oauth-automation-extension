## ADDED Requirements

### Requirement: Valid SMS records free phone before later OAuth work
The system SHALL persist a local free reusable phone record immediately after Step 9 receives a valid HeroSMS SMS code for a newly acquired activation while free phone reuse mode is enabled.

#### Scenario: New number receives valid SMS code
- **WHEN** Step 9 receives a valid SMS code from HeroSMS for a newly acquired activation and free phone reuse mode is enabled
- **THEN** the system MUST persist `freeReusablePhoneActivation` before submitting later OAuth consent or Step 10 platform verification work can complete
- **AND** the record MUST include the phone number, source activation id when available, country id, country label, source, use count, max uses, and recorded timestamp

#### Scenario: Platform activation is preserved but UI must show record
- **WHEN** Step 9 skips HeroSMS completion `setStatus(6)` to preserve a code-received phone for free reuse
- **THEN** the sidepanel MUST be able to display the saved `白嫖号码` without requiring extension reload

### Requirement: Free phone record updates broadcast to sidepanel
The system SHALL broadcast free reusable phone record changes to sidepanel listeners whenever the record is set or cleared.

#### Scenario: Automatic record is saved
- **WHEN** Step 9 saves `freeReusablePhoneActivation` after receiving a valid SMS code
- **THEN** the background MUST broadcast a `DATA_UPDATED` payload containing the saved free reusable phone record
- **AND** the sidepanel MUST render the phone number in the `白嫖号码` display after receiving or fetching the updated state

#### Scenario: Manual record is saved
- **WHEN** the user manually records a free reusable phone number from the sidepanel
- **THEN** the background MUST broadcast a `DATA_UPDATED` payload containing the saved free reusable phone record

#### Scenario: Record is cleared
- **WHEN** the user clears the saved free reusable phone record
- **THEN** the background MUST broadcast a `DATA_UPDATED` payload setting `freeReusablePhoneActivation` to null

### Requirement: Sidepanel supports phone-only fallback recording
The system SHALL provide a compact sidepanel fallback control for manually saving a free reusable HeroSMS phone by entering only the phone number.

#### Scenario: User records phone-only fallback
- **WHEN** the user enters a phone number in the `白嫖号码` fallback input and clicks the record action
- **THEN** the sidepanel MUST send a background message containing that phone number
- **AND** the background MUST persist it as `freeReusablePhoneActivation` using current HeroSMS country defaults and source `free-manual-reuse`
- **AND** the sidepanel MUST refresh and display the saved phone number

#### Scenario: User submits an empty fallback number
- **WHEN** the user clicks the record action with an empty fallback phone number
- **THEN** the sidepanel MUST refuse the action and show a warning without changing `freeReusablePhoneActivation`

### Requirement: Phone-only fallback does not trigger paid automatic acquisition
The system SHALL keep phone-only fallback records from silently falling into paid HeroSMS acquisition when automatic free reuse is enabled.

#### Scenario: Manual reuse with phone-only record
- **WHEN** free phone reuse mode is enabled, automatic free reuse is disabled, and a saved phone-only free reusable record exists
- **THEN** Step 9 MUST fill that phone number into the add-phone page and stop automation for manual SMS handling
- **AND** Step 9 MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` during that handoff

#### Scenario: Automatic reuse with phone-only record
- **WHEN** automatic free reuse is enabled and the saved free reusable record has no HeroSMS activation id
- **THEN** Step 9 MUST stop or fail the automatic free reuse preparation with a clear reason
- **AND** Step 9 MUST NOT buy a new HeroSMS number as fallback for that preparation failure
