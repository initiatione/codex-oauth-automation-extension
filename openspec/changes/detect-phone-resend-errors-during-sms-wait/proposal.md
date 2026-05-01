## Why

After Step 9 clicks "Resend text message", OpenAI can render resend failure text asynchronously. The current flow only checks the phone-verification page during the resend click call; if the red error appears after that call returns, the extension keeps polling HeroSMS for the full SMS wait window instead of replacing the rejected number immediately.

## What Changes

- Continuously probe the phone-verification page for resend failure text while waiting for HeroSMS SMS status throughout the phone code wait, including before and after a resend request.
- Treat "无法向此电话号码发送短信" and equivalent English text as `resend_phone_banned`, replacing the current number immediately.
- Treat "尝试重新发送的次数过多。请稍后重试。" and equivalent English throttling text as `resend_throttled`, replacing the current number immediately.
- Keep existing behavior for numbers without page-side resend errors: continue polling HeroSMS until a code arrives or the configured SMS wait windows expire.
- Preserve valid-code HeroSMS lifecycle protection: numbers that already received a valid SMS code must still avoid cancellation/completion according to the free reuse preservation rules.

## Capabilities

### New Capabilities

- `phone-resend-error-detection-during-sms-wait`: Detect phone resend rejection/throttle messages that appear at any point while Step 9 is waiting for SMS.

### Modified Capabilities

None.

## Impact

- Affects Step 9 phone verification in `background/phone-verification-flow.js`, especially `waitForPhoneCodeOrRotateNumber` and resend-window handling.
- Affects content-side phone auth helpers in `content/phone-auth.js` if a read-only page probe message/helper is needed.
- Affects tests for phone auth resend errors and phone verification replacement behavior.
- Affects Step 9 feature chain documentation in `项目完整链路说明.md`.
- Does not change sidepanel configuration or add a new switch.
- No project structure changes are expected unless implementation extracts a small helper. `项目文件结构说明.md` only needs an update if files are added, deleted, renamed, or responsibilities materially change.
- `项目开发规范（AI协作）.md` is not expected to change because no new development boundary is introduced.
