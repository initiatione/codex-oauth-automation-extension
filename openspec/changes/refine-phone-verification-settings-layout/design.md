## Context

The `接码设置` card currently mixes platform identity, country priority, API key, price preview, SMS timing parameters, reuse switches, risk switches, and runtime state in one long expanded block. Recent phone-reuse features added more controls to the same area, and the visual balance now suffers from uneven two-column spacing, wide blank areas, and a crowded `白嫖号码` runtime row.

This change is limited to the sidepanel presentation layer. The existing IDs and JavaScript bindings must remain stable because sidepanel tests, state rendering, hot updates, and background message handlers already depend on them.

## Goals / Non-Goals

**Goals:**

- Make the expanded HeroSMS settings area easier to scan by grouping related controls.
- Keep numeric controls, units, toggles, selects, and action buttons aligned with stable widths.
- Give runtime state enough space so long phone numbers, codes, and manual fallback controls do not collide.
- Preserve existing UI behavior, hot updates, persisted settings, and Step 9 phone-verification semantics.
- Add focused tests that catch accidental removal of layout hooks or existing controls.

**Non-Goals:**

- Do not add, remove, rename, or repurpose phone-verification settings.
- Do not change HeroSMS API calls, paid same-number reactivation, free reuse priority, banned-number detection, or timeout behavior.
- Do not introduce a new sidepanel module unless implementation reveals CSS-only/HTML-only changes are insufficient.
- Do not change storage keys, import/export shape, defaults, or background routing.

## Decisions

### Use semantic layout groups inside the existing fold

The expanded fold will keep the current `phone-verification-fold` container and add lightweight layout group hooks around existing rows. The intended groups are:

- platform basics: platform display, API key, country priority, effective country order
- acquisition strategy: acquire priority, price preview, max price, paid reactivation
- SMS timing: resend count, replacement limit, wait seconds, timeout windows, poll interval, poll rounds
- reuse/risk switches: free reuse, automatic free reuse, throttled-as-banned risk switch
- runtime state: current number, current code, saved free reusable phone, manual phone fallback

Alternative considered: split `接码设置` into multiple cards. Rejected because it would make a single operational section look heavier and increase vertical travel in the sidepanel.

### Preserve control IDs and data binding

Implementation should move wrappers/classes, not rename IDs. `sidepanel.js` should continue finding the same elements and sending the same messages.

Alternative considered: rebuild the section with new IDs and update JavaScript. Rejected because this layout change does not need behavioral churn.

### Favor compact grid primitives over ad hoc row sizing

CSS should define stable grid columns for compact controls and runtime cells. Numeric inputs should keep fixed compact widths; unit labels and toggles should use predictable action columns; long values should truncate or wrap within their cell rather than resizing the layout.

Alternative considered: tune individual margins on every row. Rejected because it would be brittle as more phone settings are added.

### Keep runtime fallback compact but visible

The `白嫖号码` row should have enough room for the saved number and manual fallback input/actions without overwhelming the whole runtime grid. On narrow sidepanel widths, the manual input/actions can wrap in a controlled way within the runtime group.

Alternative considered: hide the manual fallback behind a secondary popup. Rejected because the user added it specifically as an immediate operational fallback.

## Risks / Trade-offs

- [Risk] The existing sidepanel tests mostly verify element presence, not visual quality. -> Mitigation: add structural assertions for the new layout hooks and run focused tests plus full `npm test`; use browser visual verification when applying if practical.
- [Risk] Moving rows into groups could accidentally break JavaScript selectors or hot display updates. -> Mitigation: preserve every existing ID and only add classes/wrappers.
- [Risk] Compact UI may truncate long phone/country strings. -> Mitigation: use `min-width: 0`, truncation, and stable responsive wrapping for value cells.
- [Risk] Chinese copy or comments could become mojibake while editing HTML/CSS/docs. -> Mitigation: verify touched files render readable Chinese and run the existing test suite.
