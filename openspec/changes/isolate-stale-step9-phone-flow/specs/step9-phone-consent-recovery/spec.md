## ADDED Requirements

### Requirement: Consent recovery only uses current phone flow
Step 9 consent recovery SHALL only continue after inline phone verification when the completed phone-verification flow still belongs to the current Step 9 execution.

#### Scenario: Current phone flow finishes before consent wait resumes
- **WHEN** Step 9 completes inline phone verification and its owner token is still current
- **THEN** Step 9 MUST reset the consent readiness wait and continue to OAuth consent button readiness as before

#### Scenario: Stale phone flow finishes after a new auth chain starts
- **WHEN** an older inline phone-verification flow finishes or errors after a newer auth chain has started
- **THEN** Step 9 MUST NOT use that stale result to continue, restart, or fail the newer OAuth consent recovery path
