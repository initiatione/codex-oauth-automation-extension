## ADDED Requirements

### Requirement: iCloud first-pass refresh before old-mail snapshot
The iCloud mailbox polling flow SHALL refresh the iCloud inbox once before it records the visible thread list as old mail for a verification polling request.

#### Scenario: Verification mail is already visible after opening iCloud
- **WHEN** Step 4 or Step 8 starts iCloud mailbox polling and the newest matching verification mail is already visible after the first refresh
- **THEN** the iCloud content script MUST evaluate that message before adding it to the old-mail signature snapshot

#### Scenario: No near-time matching message after first refresh
- **WHEN** the first refresh does not reveal a matching verification mail close to the verification request time
- **THEN** the iCloud content script MUST wait briefly, record the current visible thread signatures as the old-mail snapshot, and continue with the existing polling loop

### Requirement: iCloud near-time mail fast path
The iCloud mailbox polling flow SHALL use the newest matching iCloud message immediately when its timestamp is close to the verification request timestamp and the message yields a non-excluded verification code.

#### Scenario: Newest matching message is close to request time
- **WHEN** the newest matching iCloud message has a parsed timestamp within the accepted near-time window around `filterAfterTimestamp`
- **AND** the message body or preview contains a verification code that is not in `excludeCodes`
- **THEN** the iCloud content script MUST return that code without waiting for another mail or clicking the OpenAI resend button

#### Scenario: Matching message timestamp is stale
- **WHEN** the newest matching iCloud message is older than the accepted near-time window around `filterAfterTimestamp`
- **THEN** the iCloud content script MUST NOT accept that message through the first-pass fast path
- **AND** it MUST continue with the existing snapshot-based polling behavior

#### Scenario: Matching message timestamp cannot be parsed
- **WHEN** the newest matching iCloud message has no reliable parsed timestamp
- **THEN** the iCloud content script MUST NOT accept that message solely through the first-pass fast path
- **AND** it MUST continue with the existing snapshot-based polling behavior

### Requirement: Preserve existing iCloud mail matching rules
The iCloud first-pass fast path MUST use the same sender filters, subject filters, body inspection, target-code extraction, and excluded-code checks as the existing iCloud polling path.

#### Scenario: Newest message does not match sender or subject filters
- **WHEN** the newest visible iCloud thread is close in time but does not match the configured sender or subject filters
- **THEN** the iCloud content script MUST ignore it for the verification fast path

#### Scenario: Matching message contains an excluded code
- **WHEN** the newest near-time matching iCloud message contains a code listed in `excludeCodes`
- **THEN** the iCloud content script MUST skip that code and continue polling instead of returning it

### Requirement: iCloud recovery response timeout floor
The background mail-content-script recovery path SHALL use a practical minimum response timeout for iCloud `POLL_EMAIL` retries after mailbox reload or reinjection.

#### Scenario: Remaining overall budget is nearly exhausted after iCloud recovery
- **WHEN** `sendToMailContentScriptResilient` reloads or reinjects the iCloud Mail tab after a retryable communication error
- **AND** the remaining overall timeout would otherwise produce a `POLL_EMAIL` response timeout near one second
- **THEN** the retried iCloud `POLL_EMAIL` dispatch MUST receive the configured iCloud minimum response timeout floor when the overall timeout still allows another attempt

#### Scenario: Non-iCloud providers retry polling
- **WHEN** another mail provider retries `POLL_EMAIL` after a retryable communication error
- **THEN** the iCloud-specific response timeout floor MUST NOT change that provider's existing timeout behavior

### Requirement: Avoid premature resend on near-time iCloud mail
The verification flow SHALL NOT request a new OpenAI verification email when iCloud first-pass polling has found and returned a valid near-time verification code.

#### Scenario: iCloud fast path returns a valid code
- **WHEN** Step 8 iCloud polling returns a valid code from the first-pass near-time mail
- **THEN** the background verification flow MUST submit that code through the existing verification-code submission path
- **AND** it MUST NOT click "重新发送电子邮件" for that verification attempt
