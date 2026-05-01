## ADDED Requirements

### Requirement: Step 6 cleanup uses three-second wait
The system SHALL use a fixed 3-second wait for the Step 6 login-cookie cleanup stabilization period before continuing to the OAuth login step.

#### Scenario: Step 6 finishes cookie cleanup
- **WHEN** Step 6 completes its cookie deletion and any browsingData cleanup work
- **THEN** the next stabilization wait MUST be 3 seconds before Step 6 completes

#### Scenario: Plus mode hides Step 6
- **WHEN** Plus mode is enabled and the normal Step 6 cookie cleanup step is not executed
- **THEN** the 3-second cleanup wait MUST NOT be inserted into the Plus-mode checkout chain
