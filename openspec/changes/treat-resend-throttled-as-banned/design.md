## Context

Step 9 already polls HeroSMS while the OpenAI phone-verification page is active and probes the page for resend-related errors. The current code can detect both "无法向此电话号码发送短信" and "尝试重新发送的次数过多。请稍后重试。", but the latter is semantically a throttle signal and can be a false positive: it may mean OpenAI rate-limited resend attempts rather than that the number is permanently banned.

The requested behavior is therefore best modeled as a user-controlled risk policy. Users who prefer throughput can opt in and let Step 9 replace the current number immediately when the throttle text appears; users who want conservative reuse can leave the switch off.

## Goals / Non-Goals

**Goals:**
- Add a separate persisted sidepanel switch for treating resend throttling as a likely banned/unusable number.
- Make the switch hot-effective for subsequent Step 9 SMS wait decisions.
- Display copy that warns about possible false positives.
- Reuse the existing page probe, replacement loop, replacement limit, and activation cleanup/protection behavior.
- Keep free/manual/automatic phone reuse behavior intact.

**Non-Goals:**
- Do not change HeroSMS API semantics or add a new SMS provider abstraction.
- Do not remove existing resend-throttle detection.
- Do not force the risky replacement policy on by default.
- Do not change how explicit banned-number text is handled.

## Decisions

### Add a dedicated persisted setting

Use a new boolean setting such as `phoneResendThrottledAsBannedEnabled`, default disabled. It belongs beside the existing HeroSMS phone-verification settings because it changes the Step 9 SMS wait policy.

Alternative considered: always treat throttling as banned. This is faster but hides the false-positive risk from users.

### Keep page detection centralized

The content script should continue returning a structured resend error reason for both explicit banned-number and resend-throttled page text. The background flow will decide whether a throttled reason should trigger immediate replacement based on the persisted setting.

Alternative considered: make the content script suppress throttled errors when the setting is off. That would push user configuration into page probing and make tests/diagnostics harder to reason about.

### Preserve replacement and lifecycle rules

When the risky policy is enabled, a throttled page error should use the same Step 9 number replacement loop and replacement limit as the explicit banned-number path. If the current activation has already received a valid SMS code, existing cancellation protection must still prevent `setStatus(8)`.

### Warn in UI copy

The sidepanel switch title/copy should mention that this is a high-probability heuristic and may discard a number that could recover later.

## Risks / Trade-offs

- [Risk] The throttle text may represent temporary rate limiting rather than a truly banned number. -> Mitigation: default the switch to off and show explicit risk copy in the sidepanel.
- [Risk] Users may enable the switch and consume more numbers on transient throttles. -> Mitigation: preserve the replacement limit and log the reason clearly.
- [Risk] More Chinese text can introduce mojibake. -> Mitigation: run focused tests, full `npm test`, and scan touched Chinese copy/docs.
