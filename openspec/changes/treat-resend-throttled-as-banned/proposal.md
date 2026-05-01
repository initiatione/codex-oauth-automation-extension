## Why

OpenAI sometimes shows "尝试重新发送的次数过多。请稍后重试。" on the phone-verification page for a number that is unlikely to recover during the current registration attempt. Operators want the extension to optionally treat this as a high-probability banned or unusable number and replace it immediately, while keeping the risk visible because the signal can be a false positive.

## What Changes

- Add a persisted sidepanel switch for treating resend-throttled messages as high-probability banned-phone signals.
- Show warning copy on the switch so users know this can discard a number that might recover later.
- When enabled, Step 9 shall replace the current number immediately when the phone-verification page shows the Chinese or English resend-throttled message during SMS waiting or after a resend attempt.
- When disabled, keep the current throttling behavior and do not broaden it beyond existing explicit resend-throttle handling.
- Preserve existing banned-number replacement, automatic/free phone reuse, valid-code activation protection, and replacement-limit behavior.

## Capabilities

### New Capabilities
- `resend-throttled-banned-risk-toggle`: Covers the user-facing setting, persistence, hot-effect behavior, and risk disclosure for treating resend throttling as a likely banned-number signal.

### Modified Capabilities
- `phone-resend-error-detection-during-sms-wait`: Adds the configurable policy that lets Step 9 classify "too many resend attempts" page text as a high-probability banned/unusable number and replace it immediately.

## Impact

- Affected steps: Step 9 phone verification and SMS wait/replacement loop.
- Affected UI/configuration: sidepanel HeroSMS phone-verification settings, persisted defaults, normalization, settings save/import/export, and hot state restore.
- Affected content script/background interactions: page-side resend error probe and background classification of `resend_throttled`.
- Affected docs/tests: update `项目完整链路说明.md`; update structure/development docs only if implementation adds files or changes boundaries; add focused sidepanel and phone verification tests.
