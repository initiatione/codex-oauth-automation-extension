## Context

Step 9's phone verification flow already recognizes OpenAI resend errors through `content/phone-auth.js` and maps them in `background/phone-verification-flow.js` to replacement reasons such as `resend_phone_banned` and `resend_throttled`. That works when the error text is visible before or immediately after clicking "Resend text message".

The observed failure happens when the resend click succeeds, the content helper returns `resent: true`, and OpenAI renders the red error text moments later. At that point the background flow is already inside HeroSMS status polling for the next SMS window, so it does not read the auth page again until the SMS timeout expires.

## Goals / Non-Goals

**Goals:**

- Probe the phone-verification page during SMS wait windows before and after any resend request.
- Detect banned-number and resend-throttle text as soon as it appears after the resend click returns.
- Immediately replace the number through the existing Step 9 replacement loop when page-side resend rejection is detected.
- Reuse existing error prefixes, replacement reasons, logs, and cancellation/preservation rules.
- Keep HeroSMS polling behavior unchanged when no OpenAI page-side resend error is visible.

**Non-Goals:**

- Do not add a sidepanel switch or change SMS provider configuration.
- Do not change HeroSMS API status parsing, pricing, acquisition, or reactivation semantics.
- Do not change valid-code preservation rules for free phone reuse.
- Do not replace the existing immediate resend-click error detection; this change adds detection after the click has already returned.
- Do not redesign the Step 9 OAuth consent or localhost callback path.

## Decisions

1. Add a lightweight content-side read-only probe for phone resend errors.
   - Rationale: the source of truth for red page text is the auth page DOM, and `content/phone-auth.js` already centralizes the matching patterns.
   - Alternative considered: duplicate text patterns entirely in the background layer. That would drift from the content-side detection already used by `RESEND_PHONE_VERIFICATION_CODE`.

2. Call the probe from the background SMS wait loop for the entire phone code wait.
   - Rationale: OpenAI can show "cannot send SMS" either immediately after the phone number is submitted, after the first resend, or later while the page remains on phone verification. Checking alongside HeroSMS status polling allows immediate replacement without waiting for the full SMS timeout.
   - Alternative considered: extend the post-click wait in `resendPhoneVerificationCode`. A longer fixed delay still misses errors that appear later and slows normal resends.

3. Reuse existing replacement reasons.
   - Rationale: `resend_phone_banned` and `resend_throttled` already map to the desired replace-number path and logs.
   - Alternative considered: introduce new reasons such as `late_resend_phone_banned`. That would complicate downstream handling without changing behavior.

4. Keep checks bounded and non-blocking.
   - Rationale: page probing should not starve HeroSMS polling or create long content-script waits. If the page probe fails due to transient navigation/content-script recovery, the SMS polling loop should continue unless a clear resend error is returned.
   - Alternative considered: block each HeroSMS poll until a long page probe timeout. That would make SMS polling less predictable.

5. Preserve valid-code lifecycle rules.
   - Rationale: this change targets post-resend failures before a valid SMS arrives. If a valid code has already been received, the existing free reuse preservation rules must continue to prevent `setStatus(6)` or `setStatus(8)` where appropriate.

## Risks / Trade-offs

- [Risk] Extra content-script probes add message traffic during SMS polling. -> Mitigation: probe at the same coarse cadence as existing polling or a bounded interval, not in a tight loop.
- [Risk] A transient content-script error could be mistaken for a phone failure. -> Mitigation: only replace on explicit `PHONE_RESEND_BANNED_NUMBER` or `PHONE_RESEND_THROTTLED` signals; log and ignore transient probe failures.
- [Risk] OpenAI copy may change again. -> Mitigation: keep Chinese and English patterns centralized in `content/phone-auth.js` and cover both inline messages and page snapshots.
- [Risk] The replacement path may cancel an activation that already received a valid code. -> Mitigation: keep existing `phoneCodeReceived` cancellation guard and add/keep regression tests.
- [Risk] Chinese logs/docs can become mojibake. -> Mitigation: scan touched Chinese text after implementation.
