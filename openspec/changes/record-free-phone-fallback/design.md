## Context

Step 9 already records a free reusable HeroSMS phone after a newly acquired activation receives a valid SMS code while free phone reuse mode is enabled. The observed failure is that the platform-side activation can be preserved correctly, but the sidepanel may still show `白嫖号码 未记录` because local recording is not visible early enough or the state update is not broadcast to the UI.

The sidepanel also needs a low-friction operator fallback: when HeroSMS shows a usable phone on its purchases page, the operator should be able to paste only that phone number into the extension and save it as the local free reusable phone record. This fallback is intentionally local; it does not call HeroSMS APIs.

## Goals / Non-Goals

**Goals:**

- Persist the free reusable phone record immediately after HeroSMS returns a valid code for a new activation, before OAuth consent continuation and Step 10 platform verification.
- Broadcast free reusable phone state changes so the sidepanel updates hot.
- Provide a phone-only sidepanel fallback that saves a local `freeReusablePhoneActivation` record.
- Keep manual phone-only records safe: allow manual fill-only reuse, but do not allow automatic free reuse to fall into paid acquisition when the record lacks an activation id.
- Cover the change with focused tests before full regression.

**Non-Goals:**

- Do not change HeroSMS API semantics or query HeroSMS purchases pages.
- Do not require the operator to enter activation id, code, cost, timestamp, or provider metadata for the fallback.
- Do not make phone-only fallback records eligible for automatic `setStatus(3)` preparation unless an activation id is later available.
- Do not add new persisted settings or change the meaning of the existing free reuse switches.

## Decisions

### Record at code receipt time

The free reusable phone record is created as soon as Step 9 receives a valid code from `getStatus` or `getStatusV2` and marks the activation as code-received. This is earlier than OAuth consent completion or Step 10, so later page transitions and platform verification cannot hide the local record.

Alternative considered: record after Step 10 succeeds. Rejected because the user needs the phone preserved and visible as soon as the platform proves it can receive SMS.

### Broadcast state from the phone-verification helper

`persistFreeReusableActivation` updates session state and emits `DATA_UPDATED` when `broadcastDataUpdate` is available. This keeps sidepanel rendering hot without requiring a reload or waiting for another unrelated state update.

Alternative considered: have sidepanel poll state after every Step 9 log. Rejected because it is noisy and weaker than broadcasting the exact state change.

### Phone-only fallback is manual-first

The sidepanel fallback accepts only a phone number and saves a local free reusable phone record using the current HeroSMS country defaults. Records without activation id are valid for manual fill-only reuse. Automatic free reuse preparation requires activation id; when missing, it stops with a clear reason and does not buy a new number.

Alternative considered: synthesize a fake activation id from the phone number. Rejected because it could cause invalid HeroSMS API calls and accidental paid fallback.

## Risks / Trade-offs

- [Risk] Phone-only records cannot automatically call HeroSMS `setStatus(3)`. -> Mitigation: manual fill-only reuse remains available, and automatic mode stops clearly instead of buying a new number.
- [Risk] Sidepanel area becomes denser with another input. -> Mitigation: keep it inline, compact, and scoped to the existing `白嫖号码` row.
- [Risk] Chinese UI/log text could be corrupted. -> Mitigation: run focused tests, full `npm test`, and mojibake scan on touched files.
