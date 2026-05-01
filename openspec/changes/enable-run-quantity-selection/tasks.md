## 1. Sidepanel Quantity Control

- [x] 1.1 Audit `#input-run-count` event handlers, CSS state, and auto-run button state transitions to identify why manual multi-quantity selection is lost or blocked.
- [x] 1.2 Add or refine a sidepanel run-count normalization helper that returns a positive integer and writes normalized values back on `change`/`blur` and before launch.
- [x] 1.3 Keep typing permissive while editing so the user can clear and replace the number without the UI immediately forcing `1` mid-edit.
- [x] 1.4 Ensure `setDefaultAutoRunButton()` and active auto-run states disable the run-count input only when auto-run is active or provider-owned pool locking applies.
- [x] 1.5 Verify the quantity control remains visually and interactively enabled for normal providers in `sidepanel/sidepanel.css`.

## 2. Auto-Run Launch Contract

- [x] 2.1 Ensure the auto-run start path reads the normalized run quantity immediately before launching.
- [x] 2.2 Ensure the runtime message sent to background includes `totalRuns` equal to the selected quantity when no pool lock applies.
- [x] 2.3 Preserve custom email pool and custom mail-provider pool locking so locked pool size overrides manual quantity and is sent as `totalRuns`.
- [x] 2.4 Ensure risk prompts, scheduled start, interval countdown, running labels, retry labels, stop labels, and completion labels all use the selected `totalRuns`.

## 3. Tests

- [x] 3.1 Add focused sidepanel regression tests for manual run-count input, spinner/change behavior, empty value normalization, and invalid/below-minimum normalization.
- [x] 3.2 Add or update tests proving locked custom email pools and custom mail-provider pools override manual run quantity.
- [x] 3.3 Add or update tests proving the auto-run start message carries the selected multi-run `totalRuns` to background.
- [x] 3.4 Add or update tests proving auto-run status labels preserve `currentRun/totalRuns` for multi-run states.
- [x] 3.5 Run the focused tests changed for this feature.
- [x] 3.6 Run `npm test`.

## 4. Documentation And Quality

- [x] 4.1 Update `项目完整链路说明.md` if implementation changes the described sidepanel auto-run quantity behavior.
- [x] 4.2 Update `项目文件结构说明.md` only if new files are added or existing file responsibilities materially change.
- [x] 4.3 Check touched Chinese UI/log/docs/test text for mojibake.
- [x] 4.4 Run `openspec validate enable-run-quantity-selection --strict`.
