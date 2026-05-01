## ADDED Requirements

### Requirement: Sidepanel accepts manual auto-run quantity
The system SHALL allow the operator to select a positive integer auto-run quantity from the sidepanel quantity control before launching automatic execution when no provider-owned pool is locking the run count.

#### Scenario: User enters multiple tasks
- **WHEN** no configured email pool locks the run count and the user enters `5` in the top run quantity control
- **THEN** the sidepanel MUST keep the control editable and preserve `5` as the selected auto-run quantity
- **AND** clicking the auto-run button MUST launch automatic execution with `totalRuns` equal to `5`

#### Scenario: User uses the quantity spinner
- **WHEN** no configured email pool locks the run count and the user increments the top run quantity control above `1`
- **THEN** the sidepanel MUST preserve the incremented integer value
- **AND** the selected value MUST be used for the next automatic execution launch

### Requirement: Run quantity is normalized before launch
The system SHALL normalize the selected run quantity to a safe positive integer before automatic execution starts.

#### Scenario: Empty quantity is launched
- **WHEN** the run quantity control is empty and the user starts automatic execution
- **THEN** the sidepanel MUST treat the run quantity as `1`
- **AND** the value displayed in the control MUST be normalized back to `1`

#### Scenario: Invalid or below-minimum quantity is launched
- **WHEN** the run quantity control contains an invalid, non-numeric, fractional, or below-minimum value and the user starts automatic execution
- **THEN** the sidepanel MUST launch with a positive integer run quantity no lower than `1`
- **AND** the value displayed in the control MUST match the normalized integer quantity

### Requirement: Provider-owned pools lock run quantity
The system SHALL keep provider-owned pool counts authoritative when the selected email configuration maps rounds to configured pool entries.

#### Scenario: Custom email pool locks quantity
- **WHEN** the selected email generator uses a custom email pool with `N` valid email entries
- **THEN** the sidepanel MUST display `N` in the run quantity control
- **AND** the control MUST be disabled while that pool lock applies
- **AND** automatic execution MUST launch with `totalRuns` equal to `N`

#### Scenario: Custom mail-provider pool locks quantity
- **WHEN** the selected custom mail provider has a configured provider pool with `N` valid entries
- **THEN** the sidepanel MUST display `N` in the run quantity control
- **AND** the control MUST be disabled while that pool lock applies
- **AND** automatic execution MUST launch with `totalRuns` equal to `N`

#### Scenario: Pool lock is removed
- **WHEN** the operator changes configuration so no provider-owned pool locks the run quantity
- **THEN** the sidepanel MUST re-enable the run quantity control
- **AND** the operator MUST be able to select a manual quantity for the next automatic execution

### Requirement: Auto-run status reflects selected quantity
The system SHALL keep visible auto-run status and countdown text consistent with the selected total run quantity.

#### Scenario: Multi-run execution starts
- **WHEN** automatic execution starts with `totalRuns` greater than `1`
- **THEN** the sidepanel MUST render running state using the current run and selected total run count
- **AND** the background auto-run status payload MUST retain that total count for subsequent round, retry, stop, and completion updates

#### Scenario: Scheduled or interval state uses selected total
- **WHEN** a multi-run automatic execution is scheduled or waiting between rounds
- **THEN** the visible schedule or interval status MUST reference the selected total run count rather than falling back to `1`
