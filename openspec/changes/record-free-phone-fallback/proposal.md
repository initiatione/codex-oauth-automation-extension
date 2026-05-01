## Why

A valid HeroSMS phone can receive an SMS code and remain preserved on the platform, but the sidepanel may still show no saved free reusable phone because the local reusable-phone record is not visible early enough or is not broadcast to the UI. Operators also need a simple fallback to manually record a phone number from the HeroSMS purchases page when automatic recording misses the display window.

## What Changes

- Record `freeReusablePhoneActivation` immediately after Step 9 receives a valid HeroSMS verification code from a new number, before OAuth consent and Step 10 platform verification continue.
- Broadcast free reusable phone record updates to the sidepanel so the `白嫖号码` display updates hot without requiring a panel reload.
- Add a sidepanel fallback input beside `白嫖号码` that lets the user record a reusable phone by entering only the phone number.
- Route the manual phone-only record through the background message router and persist it as a local free reusable phone record.
- Keep automatic free reuse safe when a manual phone-only record has no HeroSMS activation ID: it may be used for manual fill-only reuse, but automatic activation must stop with a clear reason instead of buying a new number.

## Capabilities

### New Capabilities
- `free-phone-record-fallback`: Covers early local recording of valid free reusable phones, hot sidepanel updates, and phone-only manual fallback recording.

### Modified Capabilities
- `free-phone-reuse-mode`: Refines the existing free-phone reuse behavior so valid-code recording happens before later OAuth/Step 10 work and phone-only manual records are accepted for manual reuse.

## Impact

- Affected step: Step 9 phone verification, specifically the moment after HeroSMS returns a valid SMS code.
- Affected UI: sidepanel HeroSMS runtime area (`白嫖号码`) gains a phone-only record fallback input and save button.
- Affected background routing: adds a message path for manually setting `freeReusablePhoneActivation`.
- Affected storage/state: `freeReusablePhoneActivation` updates must be broadcast to the sidepanel when set or cleared.
- Affected docs: `项目完整链路说明.md` should describe early recording and phone-only fallback; no project structure or development-boundary docs are required unless implementation expands beyond existing modules.
