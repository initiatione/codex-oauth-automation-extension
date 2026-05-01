## Context

The existing free phone reuse mode records the first newly acquired HeroSMS activation that receives a valid SMS code and preserves it by skipping HeroSMS `setStatus(6)`. On a later add-phone page, `handoffFreeReusablePhone` fills that saved phone number and stops automation so the operator can manually refresh SMS on HeroSMS.

The desired behavior keeps the same preserved activation but automates the manual work. HeroSMS `setStatus(3)` is already used by `requestAdditionalPhoneSms` to request another SMS on an existing activation. The new flow should reuse that lifecycle operation before OpenAI phone submission, then continue through the existing Step 9 polling, resend-error detection, code submission, and OAuth consent handling.

## Goals / Non-Goals

**Goals:**
- Add a separate persisted sidepanel switch for automatic free phone reuse, hot-effective at Step 9 decision points.
- Preserve manual free reuse when the automatic switch is off.
- Make automatic free reuse work for any later registration round until the saved phone reaches `maxUses`, normally three.
- Keep free reuse higher priority than paid HeroSMS same-number reactivation.
- Reuse existing HeroSMS polling, page-side resend error detection, cancellation protection, and Step 9 continuation logic.

**Non-Goals:**
- Do not change HeroSMS paid reactivation semantics.
- Do not remove manual free reuse.
- Do not introduce a new SMS provider abstraction.
- Do not retroactively cancel preserved code-received activations when clearing local free reuse records.

## Decisions

### Add a separate automatic free reuse setting

Use a new persisted boolean such as `freePhoneReuseAutoEnabled`, defaulting to disabled. The existing `freePhoneReuseEnabled` remains responsible for recording and preserving a valid phone. The new switch controls whether a saved phone is used manually or automatically.

Alternative considered: reuse the existing free phone reuse switch for both recording and automation. That would surprise current users because the existing behavior stops for manual SMS refresh.

### Replace manual handoff only when auto mode is enabled

Keep `handoffFreeReusablePhone` or split it into manual and automatic helpers. At add-phone time:

```text
freePhoneReuseEnabled && saved free record
  ├─ auto enabled: prepare saved activation -> submit saved phone -> poll code
  └─ auto disabled: fill only -> stop automation
```

This keeps the current manual path intact and minimizes risk to users who rely on it.

### Prepare the saved activation before OpenAI submit

Automatic reuse should call HeroSMS `setStatus(3)` on the saved activation id before clicking OpenAI "continue". After that, it should poll the same activation with its stored status action and require a waiting status before submitting the saved phone. This prevents OpenAI from sending a new SMS while HeroSMS is still in a stale, completed, cancelled, or otherwise non-waiting state.

Stale `STATUS_OK` values during the preparation phase must not be treated as a valid code for the new registration. The code only becomes valid after the saved phone has been submitted for the current OpenAI flow.

### Reuse the existing Step 9 SMS wait machinery after submit

Once the saved phone is submitted and the page reaches phone-verification, the flow should set the saved activation as the current activation and call the existing `waitForPhoneCodeOrRotateNumber`. This retains:
- wait windows, poll intervals, and resend limits
- page-side banned-number and resend-throttle detection
- replacement limit handling
- `getStatus` / `getStatusV2` compatibility
- existing code submission and OAuth continuation

### Clear saved free records on automatic reuse failure

If automatic free reuse fails because the saved phone cannot enter waiting state, OpenAI rejects it, resend errors indicate ban/throttle, HeroSMS returns cancellation, or the phone reaches `maxUses`, clear the saved free reusable phone. Then Step 9 should fall back to the existing acquisition path: paid reactivation if enabled and available, otherwise a new number.

The preserved activation should not be cancelled via `setStatus(8)` after a code has already been received; clearing the local record is enough for exhausted or failed free reuse.

### Increment successful use count only after phone verification success

Increment the saved free phone's `successfulUses` after the automatic reuse completes phone verification successfully, not when `setStatus(3)` succeeds and not when the phone number is merely submitted. Reaching `maxUses` clears the saved record before future add-phone pages.

## Risks / Trade-offs

- [Risk] HeroSMS may return a stale `STATUS_OK` from the previous registration after `setStatus(3)`. → Mitigation: preparation must require waiting status before OpenAI submit and must not consume pre-submit codes.
- [Risk] Some channels may only allow two uses even when `maxUses` is three. → Mitigation: existing banned-number/throttle/used-number detection clears the saved record early and falls back to normal acquisition.
- [Risk] The new automatic switch can be confusing next to free reuse and paid reactivation. → Mitigation: sidepanel copy should make the hierarchy explicit: record/preserve phone, auto reuse saved phone, paid platform reactivation.
- [Risk] More Chinese log and UI text increases mojibake exposure. → Mitigation: run focused tests, full `npm test`, and scan touched Chinese copy/docs for encoding corruption.

## Migration Plan

1. Add the new persisted setting with default disabled so existing users keep manual behavior.
2. Add sidepanel UI and state hydration/persistence/import-export support.
3. Add automatic free reuse preparation and Step 9 integration.
4. Add tests for manual mode compatibility, automatic success, failure fallback, priority over paid reactivation, max-use retirement, and hot-effective settings.
5. Update `项目完整链路说明.md` and only update structure/development docs if implementation changes file responsibilities.
