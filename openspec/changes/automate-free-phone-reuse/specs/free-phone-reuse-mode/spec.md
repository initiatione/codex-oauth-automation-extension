## MODIFIED Requirements

### Requirement: Free reuse handoff fills only and stops automation
The system SHALL fill the saved free reusable phone number into the add-phone page, avoid clicking the submit button, stop automatic mode immediately, and log a manual SMS refresh instruction when automatic free phone reuse is disabled.

#### Scenario: Fill-only handoff
- **WHEN** the saved free reusable phone is applied to an add-phone page and automatic free phone reuse is disabled
- **THEN** the phone number field MUST be filled and the add-phone submit button MUST NOT be clicked by automation

#### Scenario: Automatic mode stops
- **WHEN** the saved free reusable phone has been filled for manual reuse and automatic free phone reuse is disabled
- **THEN** the system MUST stop automatic mode and emit a log indicating that manual phone reuse has started and the user should refresh SMS manually

#### Scenario: Automatic reuse is enabled
- **WHEN** the saved free reusable phone is available on an add-phone page and automatic free phone reuse is enabled
- **THEN** the system MUST NOT use the manual fill-only stop behavior
- **AND** it MUST hand off to the automatic free phone reuse flow
