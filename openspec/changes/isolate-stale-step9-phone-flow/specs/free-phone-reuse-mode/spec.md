## ADDED Requirements

### Requirement: Stale Step 9 cannot modify free reusable phone record
The free reusable phone record SHALL only be modified by the currently active phone-verification flow or by explicit user action.

#### Scenario: Stale automatic reuse preparation times out
- **WHEN** an obsolete Step 9 automatic free-reuse preparation flow times out after a new registration round has started
- **THEN** the system MUST NOT clear, retire, or overwrite the saved free reusable phone record

#### Scenario: Current automatic reuse preparation fails legitimately
- **WHEN** the current Step 9 automatic free-reuse preparation flow fails while its owner token is still current
- **THEN** the system MAY apply the existing current-flow failure behavior for the saved free reusable phone record

#### Scenario: User manually clears record
- **WHEN** the user clicks the clear action for the saved free reusable phone
- **THEN** the system MUST still clear the saved free reusable phone record immediately
