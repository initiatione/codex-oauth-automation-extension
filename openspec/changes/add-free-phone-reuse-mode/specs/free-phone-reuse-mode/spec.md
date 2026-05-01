## ADDED Requirements

### Requirement: Free phone reuse setting
The system SHALL provide a persisted sidepanel switch for free phone reuse mode, and changes to the switch MUST affect subsequent phone-verification decision points without requiring extension reload or a new browser session.

#### Scenario: User enables free phone reuse
- **WHEN** the user enables the free phone reuse switch in the sidepanel
- **THEN** the background phone-verification flow MUST observe the enabled value the next time it evaluates an add-phone page

#### Scenario: User disables free phone reuse
- **WHEN** the user disables the free phone reuse switch in the sidepanel
- **THEN** the background phone-verification flow MUST stop using the saved free reusable phone for subsequent add-phone handoffs

### Requirement: First successful new SMS records free reusable phone
The system SHALL record a free reusable phone candidate after a newly acquired HeroSMS activation receives its first SMS verification code while free phone reuse mode is enabled.

#### Scenario: New activation receives first code
- **WHEN** free phone reuse mode is enabled and a new `getNumber` or `getNumberV2` activation returns a valid SMS code from `getStatus` or `getStatusV2`
- **THEN** the system MUST persist the phone number, country id, country label, source activation id, and recorded timestamp as the free reusable phone candidate

#### Scenario: Existing reactivation receives code
- **WHEN** a code is received from an activation acquired by HeroSMS `reactivate`
- **THEN** the system MUST NOT overwrite the free reusable phone candidate as if it were a newly acquired free-reuse source

#### Scenario: Activation never receives code
- **WHEN** a newly acquired activation times out, is rejected, or is replaced before receiving a valid SMS code
- **THEN** the system MUST NOT persist that activation as the free reusable phone candidate

### Requirement: Free reusable phone survives normal run reset
The system SHALL keep the saved free reusable phone record across normal run resets, single-account task completion, and state resets that preserve user settings.

#### Scenario: Task count is one
- **WHEN** a run completes with only one requested account after saving a free reusable phone record
- **THEN** the saved free reusable phone record MUST remain visible in the sidepanel

#### Scenario: User clears saved phone manually
- **WHEN** the user clicks the sidepanel clear action for the saved free reusable phone
- **THEN** the system MUST remove the saved free reusable phone record and stop using it for future handoffs

### Requirement: Free reuse handoff does not call paid HeroSMS activation APIs
The system SHALL use the saved free reusable phone before any HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` call on the next add-phone page.

#### Scenario: Saved free phone exists on next add-phone page
- **WHEN** free phone reuse mode is enabled, a saved free reusable phone exists, and the OAuth auth page is on add-phone
- **THEN** the system MUST fill the saved phone number into the add-phone page before calling HeroSMS acquisition or reactivation APIs

#### Scenario: Handoff path starts
- **WHEN** the system starts the free reuse handoff
- **THEN** it MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` for that handoff

### Requirement: Free reuse handoff fills only and stops automation
The system SHALL fill the saved free reusable phone number into the add-phone page, avoid clicking the submit button, stop automatic mode immediately, and log a manual SMS refresh instruction.

#### Scenario: Fill-only handoff
- **WHEN** the saved free reusable phone is applied to an add-phone page
- **THEN** the phone number field MUST be filled and the add-phone submit button MUST NOT be clicked by automation

#### Scenario: Automatic mode stops
- **WHEN** the saved free reusable phone has been filled for manual reuse
- **THEN** the system MUST stop automatic mode and emit a log indicating that manual phone reuse has started and the user should refresh SMS manually

### Requirement: Existing HeroSMS lifecycle remains available
The system SHALL preserve the existing HeroSMS new-number, polling, resend, replacement, completion, cancellation, and optional paid reactivation behavior when free phone reuse mode is disabled or when no saved free reusable phone is available.

#### Scenario: No saved free phone
- **WHEN** free phone reuse mode is enabled but no saved free reusable phone exists
- **THEN** the system MUST continue with the existing new HeroSMS activation flow

#### Scenario: Free reuse disabled
- **WHEN** free phone reuse mode is disabled
- **THEN** the system MUST use the existing HeroSMS phone verification behavior, including any separately configured paid reactivation behavior
