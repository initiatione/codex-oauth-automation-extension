## Context

Step 9 phone verification is handled by `background/phone-verification-flow.js` and page interaction is handled by `content/phone-auth.js`. The current flow already has separate paths for SMS timeout, resend throttling, invalid code, add-phone rejection, and in-step number replacement. The new page condition is different from throttling: after clicking "重新发送短信", OpenAI can show "无法向此电话号码发送短信", which means the current number is rejected and should be abandoned immediately.

The implementation should stay inside the existing Step 9 phone-verification modules. It should not add a sidepanel setting because the requested behavior is a correctness fix, not a user-selectable mode.

## Goals / Non-Goals

**Goals:**

- Detect the resend-time "无法向此电话号码发送短信" message on the phone verification page.
- Surface the condition from the content script in a way the background flow can classify reliably.
- Reuse the existing Step 9 number replacement loop so OAuth continues from the current phone page instead of restarting Step 7.
- Cancel or release the current HeroSMS activation through the existing cancellation helper when the flow owns that activation.
- Keep logs explicit enough to distinguish banned-number replacement from SMS timeout, resend throttling, and manual free reuse handoff.
- Add focused tests for content-script detection and background replacement behavior.

**Non-Goals:**

- Do not change the HeroSMS API contract or add another SMS provider.
- Do not add a new sidepanel configuration switch.
- Do not change free phone reuse manual handoff semantics.
- Do not broaden this to every possible OpenAI phone error unless the message clearly means the current number cannot receive SMS.

## Decisions

1. Add a dedicated banned-number classifier in `content/phone-auth.js`.
   - Rationale: the error is visible in the auth page DOM, and content script helpers already collect resend throttle and inline verification messages.
   - Alternative considered: infer the condition from SMS polling timeout in background. That would be slower and would miss the explicit page signal.

2. Use a distinct error prefix or structured result for "phone resend banned" instead of reusing the resend-throttled prefix.
   - Rationale: throttling means retry later; banned number means replace immediately. Mixing them would make logs and replacement policy ambiguous.
   - Alternative considered: extend the existing throttle regex. This would incorrectly mark a bad number as platform rate limiting.

3. Route the banned-number condition into the existing Step 9 replacement loop.
   - Rationale: `background/phone-verification-flow.js` already tracks `usedNumberReplacementAttempts`, clears current activation state, cancels owned activations, returns to add-phone, and requests a new number.
   - Alternative considered: throw a Step 7 restart error. That would be more disruptive and repeats work the current Step 9 loop can already handle.

4. Keep free reusable phone handoff as a stopping path.
   - Rationale: free reuse intentionally fills a saved number and stops automation before submitting or clicking resend. If the user is in manual mode, automatic banned-number replacement must not run behind their back.
   - Alternative considered: allow auto replacement after manual handoff. That would conflict with the manual SMS refresh workflow and could cause paid API calls the user is trying to avoid.

## Risks / Trade-offs

- [Risk] OpenAI changes the Chinese wording or shows the same state in English. -> Mitigation: implement the classifier as a small pattern list that includes the observed Chinese text and adjacent English phrasing such as "can't send SMS/text to this phone number" if present in page text.
- [Risk] The error appears slightly after the resend click. -> Mitigation: after clicking resend, wait briefly and re-check inline/page text before returning success.
- [Risk] Replacing immediately could consume another paid number. -> Mitigation: only trigger on the explicit banned-number message, not on ordinary delayed SMS delivery.
- [Risk] Logs become confusing across timeout, throttle, and banned paths. -> Mitigation: use a distinct reason such as `resend_phone_banned` and add a dedicated warning log before replacement.
- [Risk] Chinese copy or docs become mojibake. -> Mitigation: run a touched-file mojibake scan for visible Chinese text after implementation.
