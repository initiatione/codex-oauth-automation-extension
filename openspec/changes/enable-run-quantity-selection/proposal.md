## Why

The sidepanel exposes a top-run quantity input, but operators cannot reliably select multiple tasks before starting automation. This blocks the existing multi-round auto-run controller from being used through the plugin UI, forcing one account at a time even when the backend already supports `totalRuns`.

## What Changes

- Make the top `运行次数` control reliably editable for normal providers, including manual typing, spinner changes, and value normalization before auto-run starts.
- Preserve existing automatic run-count locking for configured email pools, where the task count must match the pool size.
- Ensure the sidepanel sends the selected run quantity to the background auto-run entry point and keeps the visible running label/countdown in sync with that quantity.
- Keep invalid, empty, fractional, or below-minimum values clamped to a safe integer before launch.
- Add focused regression coverage for sidepanel run-count normalization and auto-run start payload behavior.

## Capabilities

### New Capabilities
- `auto-run-quantity-selection`: Covers selecting, validating, locking, and launching multiple auto-run tasks from the sidepanel quantity control.

### Modified Capabilities

## Impact

- Affected UI: top sidepanel run quantity input beside the `自动` button, including disabled state while auto-run is active or when an email pool locks the count.
- Affected configuration domain: runtime auto-run launch options only; this should not introduce a new persisted setting unless implementation discovers an existing setting contract to reuse.
- Affected background flow: auto-run start message and `background/auto-run-controller.js` should continue using `totalRuns` and round summaries without changing step semantics.
- Affected providers: custom email pool and custom mail-provider pool retain their existing count-lock behavior.
- Affected docs: `项目完整链路说明.md` may need a small update describing quantity selection; `项目文件结构说明.md` only if new files are added; `项目开发规范（AI协作）.md` is not expected to change.
