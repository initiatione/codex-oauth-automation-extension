## MODIFIED Requirements

### Requirement: First successful new SMS records free reusable phone
The system SHALL record a free reusable phone candidate immediately after a newly acquired HeroSMS activation receives its first SMS verification code while free phone reuse mode is enabled, before later OAuth consent or platform verification work can hide the local record.

#### Scenario: New activation receives first code
- **WHEN** free phone reuse mode is enabled and a new `getNumber` or `getNumberV2` activation returns a valid SMS code from `getStatus` or `getStatusV2`
- **THEN** the system MUST persist the phone number, country id, country label, source activation id when available, and recorded timestamp as the free reusable phone candidate before Step 10 platform verification completes
- **AND** the system MUST broadcast the saved free reusable phone record to sidepanel listeners

#### Scenario: Existing reactivation receives code
- **WHEN** a code is received from an activation acquired by HeroSMS `reactivate`
- **THEN** the system MUST NOT overwrite the free reusable phone candidate as if it were a newly acquired free-reuse source

#### Scenario: Activation never receives code
- **WHEN** a newly acquired activation times out, is rejected, or is replaced before receiving a valid SMS code
- **THEN** the system MUST NOT persist that activation as the free reusable phone candidate

### Requirement: Free reusable phone survives normal run reset
The system SHALL keep the saved free reusable phone record across normal run resets, single-account task completion, and state resets that preserve user settings, including records created by the sidepanel phone-only fallback.

#### Scenario: Task count is one
- **WHEN** a run completes with only one requested account after saving a free reusable phone record
- **THEN** the saved free reusable phone record MUST remain visible in the sidepanel

#### Scenario: User records phone-only fallback
- **WHEN** the user manually records a phone-only free reusable phone from the sidepanel
- **THEN** the saved free reusable phone record MUST remain available for future add-phone handoffs until the user clears it

#### Scenario: User clears saved phone manually
- **WHEN** the user clicks the sidepanel clear action for the saved free reusable phone
- **THEN** the system MUST remove the saved free reusable phone record and stop using it for future handoffs

### Requirement: Free reuse handoff fills only and stops automation
The system SHALL fill the saved free reusable phone number into the add-phone page, avoid clicking the submit button, stop automatic mode immediately, and log a manual SMS refresh instruction when automatic free reuse is disabled, including when the saved record only contains a phone number.

#### Scenario: Fill-only handoff
- **WHEN** the saved free reusable phone is applied to an add-phone page and automatic free reuse is disabled
- **THEN** the phone number field MUST be filled and the add-phone submit button MUST NOT be clicked by automation

#### Scenario: Phone-only saved record handoff
- **WHEN** the saved free reusable phone record has a phone number but no HeroSMS activation id and automatic free reuse is disabled
- **THEN** the phone number field MUST still be filled for manual reuse
- **AND** the system MUST NOT call HeroSMS paid acquisition or reactivation APIs during that handoff

#### Scenario: Automatic mode stops
- **WHEN** the saved free reusable phone has been filled for manual reuse
- **THEN** the system MUST stop automatic mode and emit a log indicating that manual phone reuse has started and the user should refresh SMS manually
