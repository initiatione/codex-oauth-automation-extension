## Why

The current phone-number reuse path calls HeroSMS `reactivate`, which can charge again even when the same phone number can be manually reused once on the OpenAI add-phone page without opening a new SMS activation. Step 6 cookie cleanup also waits longer than needed for the current local flow and should be shortened to reduce idle time before OAuth registration continues.

## What Changes

- Reduce the Step 6 pre-registration cookie cleanup wait to 3 seconds.
- Add a persisted sidepanel switch for a free phone-number reuse mode that is hot-effective during automation.
- After the first newly acquired phone activation successfully receives its first SMS code, mark the number as the free reusable phone candidate and keep its record across run resets and single-account task completion.
- After the first phone OAuth verification succeeds, do not cancel that activation as part of the free reuse record lifecycle; keep the phone number available for the next registration attempt.
- On the next registration that reaches phone verification, fill the saved phone number into the add-phone page, do not click submit, stop automatic mode immediately, and log that manual free phone reuse has started and the user should refresh SMS manually.
- Provide sidepanel visibility for the saved free reusable phone number and a manual clear action; the record must not be cleared automatically by normal task count completion.
- Keep HeroSMS `reactivate` behavior separate from this free reuse mode so the free path does not call paid API reactivation.

## Capabilities

### New Capabilities
- `step6-cookie-cleanup-timing`: Configured Step 6 cookie cleanup timing, including the shortened fixed wait.
- `free-phone-reuse-mode`: User-controlled free phone-number reuse workflow for manual SMS reuse without HeroSMS `reactivate`.

### Modified Capabilities

None.

## Impact

- Affects the OAuth registration feature chain around Step 6 cookie cleanup and Step 9 phone verification.
- Affects the HeroSMS phone verification provider path, specifically the distinction between new activation, same-activation SMS polling, and cross-run manual free reuse.
- Affects persisted configuration and runtime state: defaults, normalization, session reset preservation, sidepanel rendering, autosave, and manual clear behavior.
- Affects content-script phone page helpers because the free reuse path must fill the saved number without submitting it.
- Affects logs and automatic-mode stop behavior so the user gets an immediate manual handoff at the phone page.
- No external dependency or provider is introduced.
- No project structure change is expected unless implementation extracts focused phone-reuse helpers; if new files are added, `项目文件结构说明.md` should be updated.
- The feature chain changes, so `项目完整链路说明.md` should be updated if implementation lands.
- `项目开发规范（AI协作）.md` likely does not need changes unless implementation introduces a new architectural boundary.
