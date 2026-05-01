## ADDED Requirements

### Requirement: Step 9 phone flow is bound to its owner execution
The system SHALL bind each Step 9 phone-verification flow to the active Step 9/auth execution that created it.

#### Scenario: Phone flow starts during active Step 9
- **WHEN** Step 9 detects `add-phone` or `phone-verification` and starts phone-verification work
- **THEN** the phone-verification work MUST receive an ownership token that identifies the active Step 9 execution

#### Scenario: New Step 9 supersedes old Step 9
- **WHEN** a new Step 9 execution starts while an older Step 9 phone-verification flow is still pending
- **THEN** the older phone-verification flow MUST become stale before it performs further page or HeroSMS side effects

### Requirement: Stale phone flow cannot call HeroSMS APIs
The system SHALL stop stale Step 9 phone-verification flows before any HeroSMS API call that can poll, reactivate, acquire, complete, cancel, or request another SMS.

#### Scenario: Old flow is polling SMS during a new round
- **WHEN** an old Step 9 phone-verification flow is waiting for SMS and the auto-run session has changed or been cleared for a new round
- **THEN** the old flow MUST stop before calling HeroSMS `getStatus` or `getStatusV2` again

#### Scenario: Old flow is about to request another SMS
- **WHEN** an old Step 9 phone-verification flow is stale and would otherwise call HeroSMS `setStatus(3)`
- **THEN** the old flow MUST NOT call `setStatus(3)`

#### Scenario: Old flow is about to acquire or reactivate a number
- **WHEN** an old Step 9 phone-verification flow is stale and would otherwise call HeroSMS `getNumber`, `getNumberV2`, `getPrices`, or `reactivate`
- **THEN** the old flow MUST NOT call those acquisition or reactivation APIs

#### Scenario: Old flow is about to complete or cancel activation
- **WHEN** an old Step 9 phone-verification flow is stale and would otherwise call HeroSMS `setStatus(6)` or `setStatus(8)`
- **THEN** the old flow MUST NOT call completion or cancellation APIs for that stale flow

### Requirement: Stale phone flow cannot mutate current page or phone records
The system SHALL stop stale Step 9 phone-verification flows before mutating the active auth page or reusable phone records.

#### Scenario: Old flow tries to submit saved phone in new registration page
- **WHEN** an old Step 9 phone-verification flow becomes stale before submitting a saved reusable phone
- **THEN** it MUST NOT fill or submit the phone number into the currently active auth page

#### Scenario: Old flow tries to replace number
- **WHEN** an old Step 9 phone-verification flow becomes stale before replacing a number
- **THEN** it MUST NOT return to add-phone, buy a new number, reactivate a saved number, or increment replacement attempts

#### Scenario: Old flow times out while preparing automatic free reuse
- **WHEN** an old Step 9 automatic free-reuse preparation flow is stale
- **THEN** it MUST NOT clear, retire, or overwrite `freeReusablePhoneActivation`

### Requirement: Flow invalidation follows auto-run and auth boundaries
The system SHALL invalidate outstanding Step 9 phone-verification flows when their owning auto-run or auth execution is abandoned or superseded.

#### Scenario: Fresh auto-run round resets state
- **WHEN** auto-run starts a fresh round or fresh retry by resetting step state before Step 1
- **THEN** any outstanding Step 9 phone-verification flow from the previous attempt MUST be invalidated

#### Scenario: User stops automation
- **WHEN** the user stops automation
- **THEN** any outstanding Step 9 phone-verification flow MUST be invalidated and MUST stop through the same stop-aware path as other long-running background work

#### Scenario: OAuth URL is refreshed for a new auth chain
- **WHEN** the OAuth URL is refreshed for a new Step 7 auth chain
- **THEN** any outstanding Step 9 phone-verification flow tied to the previous OAuth URL MUST be invalidated

### Requirement: Stale termination is diagnostic and non-destructive
The system SHALL log stale Step 9 phone-flow termination concisely and avoid treating stale termination as a phone failure for the active round.

#### Scenario: Stale flow exits
- **WHEN** a stale Step 9 phone-verification flow exits because its owner token is invalid
- **THEN** the system MUST log that an obsolete Step 9 phone task was stopped before further HeroSMS calls

#### Scenario: Active round continues after stale flow exits
- **WHEN** a stale Step 9 phone-verification flow exits while a newer round is running
- **THEN** the newer round MUST NOT receive a failed phone-verification status, replacement count increment, or reusable-phone clear caused by the stale flow

### Requirement: Current Step 9 behavior remains unchanged for valid owner token
The system SHALL preserve existing Step 9 phone-verification behavior when the phone flow owner token is still current.

#### Scenario: Current flow receives valid SMS code
- **WHEN** the current Step 9 phone-verification flow receives a valid HeroSMS code
- **THEN** it MUST continue to submit the code, preserve valid-code activation lifecycle rules, and proceed to OAuth consent recovery as before

#### Scenario: Current flow detects banned resend error
- **WHEN** the current Step 9 phone-verification flow detects banned-number or configured high-risk throttled resend text
- **THEN** it MUST continue to replace the number according to the existing replacement-limit behavior
