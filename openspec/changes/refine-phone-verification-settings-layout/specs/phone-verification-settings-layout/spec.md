## ADDED Requirements

### Requirement: Grouped phone verification settings layout
The sidepanel SHALL present the expanded `接码设置` area in stable, named visual groups for platform basics, acquisition strategy, SMS timing parameters, reuse/risk switches, and runtime state.

#### Scenario: Phone settings are expanded
- **WHEN** the user expands the `接码设置` section
- **THEN** the HeroSMS controls MUST be arranged into grouped layout regions instead of one visually flat list
- **AND** all existing controls for platform, country, API key, price, polling, reuse, risk, and runtime state MUST remain present

### Requirement: Compact controls keep stable proportions
The sidepanel SHALL keep phone-verification form controls aligned with predictable widths so labels, inputs, units, toggles, and buttons do not drift or leave large unbalanced blanks.

#### Scenario: Numeric SMS settings are visible
- **WHEN** resend count, replacement limit, wait seconds, timeout windows, poll interval, and poll rounds are visible
- **THEN** each numeric input MUST use a compact stable width
- **AND** each unit label MUST align next to its input without changing neighboring cell widths

#### Scenario: Toggle settings are visible
- **WHEN** paid same-number reactivation, free reuse, automatic free reuse, or throttled-as-banned settings are visible
- **THEN** each toggle MUST align to the same action side of its setting row
- **AND** the label text MUST remain readable without overlapping the switch

### Requirement: Narrow sidepanel layout does not overlap
The phone-verification settings layout SHALL remain usable when the sidepanel is reduced to a narrow width.

#### Scenario: Sidepanel is narrow
- **WHEN** the sidepanel width is reduced enough that two-column phone settings no longer fit comfortably
- **THEN** the settings grid MUST wrap or collapse in a controlled way
- **AND** labels, values, inputs, switches, and buttons MUST NOT overlap each other

#### Scenario: Runtime free reusable phone row is narrow
- **WHEN** the `白嫖号码` runtime row is visible in a narrow sidepanel
- **THEN** the saved phone display, manual phone input, `记录` button, and `清除` button MUST remain in readable, clickable positions
- **AND** the manual phone input MUST NOT stack on top of the saved phone value or action buttons

### Requirement: Layout refinement preserves behavior
The layout refinement SHALL NOT change phone-verification behavior, storage, or API semantics.

#### Scenario: Existing settings are changed
- **WHEN** the user changes any existing phone-verification setting after the layout refinement
- **THEN** the same setting key and hot-update behavior MUST be used as before

#### Scenario: Step 9 reaches phone verification
- **WHEN** Step 9 uses HeroSMS, free reuse, automatic free reuse, paid same-number reactivation, or banned-number replacement
- **THEN** the behavior MUST match the existing phone-verification flow
- **AND** no additional HeroSMS API call MUST be introduced solely for the layout refinement
