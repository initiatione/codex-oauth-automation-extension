## Context

The sidepanel already contains `#input-run-count` next to the top `自动` button, and `background/auto-run-controller.js` already models `totalRuns`, current run, attempts, round summaries, interval countdowns, stop handling, and final summaries. The current product gap is at the sidepanel interaction boundary: the visible quantity control can fail to accept or preserve a multi-task value, so the existing backend capability is effectively hidden from normal users.

This change touches the runtime auto-run launch surface, not the step registry or provider execution logic. Existing custom email pool behavior is important: when the selected provider uses a configured pool, the run count is intentionally locked to the pool size so each round maps to one configured email.

## Goals / Non-Goals

**Goals:**

- Let users select an integer run quantity greater than one from the top sidepanel control before starting auto-run.
- Normalize unsafe quantity values to a bounded positive integer before launch.
- Preserve count locking for custom email pools and custom mail-provider pools.
- Ensure sidepanel status labels, countdown labels, risk prompts, and background start payloads all observe the same selected `totalRuns`.
- Add tests that prove the UI-side selection contract and background launch payload cannot regress silently.

**Non-Goals:**

- Do not add a new persisted run-count setting unless implementation finds an existing persisted setting contract that already owns this value.
- Do not change step order, step definitions, provider behavior, OAuth execution, retry semantics, or account history semantics.
- Do not add parallel/concurrent execution; multiple quantity still means sequential auto-run rounds controlled by the existing auto-run controller.
- Do not change custom email pool allocation rules beyond preserving their existing count-lock behavior.

## Decisions

1. Keep quantity selection in the sidepanel runtime boundary.

   The backend already accepts `totalRuns`; changing `background/auto-run-controller.js` would increase risk without solving the UI problem. The implementation should make `sidepanel/sidepanel.js` own normalization and launch payload generation, while leaving background round execution as the source of truth once launched.

   Alternative considered: add a new background message that reads the sidepanel input itself. This would couple background code to UI state and conflict with the existing runtime message architecture.

2. Normalize values through a small sidepanel helper.

   Add or refine a helper that accepts raw input and returns a positive integer, clamps invalid/empty/fractional values, and writes the normalized value back to the input at appropriate moments such as blur/change and before launch. This keeps DOM event behavior and `getRunCountValue()` aligned.

   Alternative considered: rely only on `<input type="number" min="1">`. Browser number inputs still permit transient empty/invalid values, and the screenshot suggests the native spinner/control state is part of the failure mode.

3. Respect locked pool counts before manual input.

   `getLockedRunCountFromEmailPool()` remains higher priority than manual input. When locked, the input should display the pool size and be disabled outside active auto-run state; when unlocked, it should be editable and its value should drive launch.

   Alternative considered: allow manual override even for pool-backed providers. That would break the one-round-per-configured-email behavior documented in current sidepanel logic.

4. Treat multi-quantity as sequential rounds.

   The selected quantity maps directly to `totalRuns` in the existing `START_AUTO_RUN` or equivalent message. The UI label should show `currentRun/totalRuns`, and existing interval/retry behavior should remain unchanged.

   Alternative considered: use quantity to start concurrent tasks. The current extension state, tab registry, email/current phone runtime fields, and provider flows are all single-active-flow oriented, so concurrency would be a separate design.

## Risks / Trade-offs

- [Risk] Native number input styling or CSS may make the control look disabled even when enabled. -> Verify enabled/disabled state and pointer behavior in sidepanel CSS and with an in-browser check if code is implemented.
- [Risk] Normalizing on every `input` event could fight the user's typing while they are editing. -> Prefer permissive typing during `input`, then normalize on `change`/`blur` and immediately before launch.
- [Risk] Pool locking can overwrite a user's manual value after provider changes. -> Keep lock behavior explicit in helper names and update UI only when provider/pool inputs change.
- [Risk] A very large quantity could create long unattended runs. -> Clamp to a reasonable upper bound if an existing project constant or UX pattern exists; otherwise keep current risk prompts and document the chosen cap during implementation.
- [Risk] Chinese UI copy or docs could suffer encoding corruption. -> After implementation, inspect touched Chinese UI/log/docs files for mojibake before finalizing.
