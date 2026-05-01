## MODIFIED Requirements

### Requirement: Free reuse handoff does not call paid HeroSMS activation APIs
The system SHALL use the saved free reusable phone before any HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` call on the next add-phone page, and automatic free reuse preparation failure SHALL NOT fall through to those paid activation APIs in the same handoff.

#### Scenario: Saved free phone exists on next add-phone page
- **WHEN** free phone reuse mode is enabled, a saved free reusable phone exists, and the OAuth auth page is on add-phone
- **THEN** the system MUST fill or automatically prepare the saved phone number before calling HeroSMS acquisition or paid reactivation APIs

#### Scenario: Manual handoff path starts
- **WHEN** the system starts the manual free reuse handoff
- **THEN** it MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` for that handoff

#### Scenario: Automatic handoff preparation starts
- **WHEN** automatic free phone reuse is enabled and the system starts preparing the saved free reusable phone
- **THEN** it MUST use HeroSMS `setStatus(3)` and status polling for that saved activation only
- **AND** it MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` unless the saved free reusable phone path is not selected for that handoff

#### Scenario: Automatic handoff preparation fails
- **WHEN** automatic free phone reuse preparation fails before the saved phone is submitted
- **THEN** the system MUST stop or fail that handoff without buying a new phone number
- **AND** it MUST NOT call HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` as a fallback in the same handoff

#### Scenario: Automatic handoff submitted phone is later rejected
- **WHEN** automatic free phone reuse has already submitted the saved phone to OpenAI and OpenAI explicitly rejects or rate-limits that phone according to existing banned/resend-throttled replacement rules
- **THEN** the system MAY clear or retire the saved free reusable phone record
- **AND** the system MAY continue the existing replacement flow, including paid new-number acquisition if replacement limits allow
- **AND** this behavior MUST NOT be blocked by the no-paid-fallback rule for preparation failures

### Requirement: Free reuse handoff fills only and stops automation
The system SHALL fill the saved free reusable phone number into the add-phone page, avoid clicking the submit button, stop automatic mode immediately, and log a manual SMS refresh instruction when automatic free reuse is disabled.

#### Scenario: Fill-only handoff
- **WHEN** the saved free reusable phone is applied to an add-phone page and automatic free reuse is disabled
- **THEN** the phone number field MUST be filled and the add-phone submit button MUST NOT be clicked by automation

#### Scenario: Automatic mode stops
- **WHEN** the saved free reusable phone has been filled for manual reuse and automatic free reuse is disabled
- **THEN** the system MUST stop automatic mode and emit a log indicating that manual phone reuse has started and the user should refresh SMS manually

#### Scenario: Automatic free reuse enabled
- **WHEN** automatic free reuse is enabled and the saved free reusable phone is confirmed ready for SMS waiting
- **THEN** the system MAY click the add-phone submit button and continue polling the saved activation for a new SMS code
- **AND** this automatic path MUST follow the automatic free reuse preparation stability requirements
