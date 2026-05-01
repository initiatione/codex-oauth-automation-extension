## Why

When the user clicks resend on the OpenAI phone-verification page and the page shows "无法向此电话号码发送短信", the current phone number is no longer usable for this OAuth flow. The automation should treat this as a banned-number signal and replace the number immediately instead of continuing to wait for SMS or forcing the user to restart manually.

## What Changes

- Detect the visible resend-time page error "无法向此电话号码发送短信" on `phone-verification` after clicking "重新发送短信".
- Report that condition from the phone content script as a structured banned-number error.
- In the background phone verification flow, treat the banned-number error as a recoverable number failure that cancels/releases the current activation when appropriate and requests a fresh phone number.
- Retry phone submission with the newly acquired number without restarting the whole OAuth chain from Step 7.
- Add logs that clearly state the current phone was rejected by OpenAI after resend and that the automation is switching numbers.
- Keep existing free phone reuse manual-handoff behavior separate: if automation is stopped for manual free reuse, this banned-number replacement path must not run.

## Capabilities

### New Capabilities
- `phone-resend-banned-number-replacement`: Detect OpenAI resend-time phone rejection and automatically replace the current HeroSMS phone number.

### Modified Capabilities

None.

## Impact

- Affects the Step 9 OAuth phone-verification feature chain, especially the resend SMS and replacement-number paths.
- Affects the HeroSMS provider flow around active activation cancellation/release, fresh number acquisition, polling, and retry limits.
- Affects `content/phone-auth.js` because page-level phone resend errors must be detected and returned to background code.
- Affects `background/phone-verification-flow.js` because the background flow must distinguish banned-number errors from ordinary SMS timeout and from user-facing manual handoff.
- Affects logs and tests for phone verification retry behavior.
- No new external dependency or provider is introduced.
- No project structure change is expected unless implementation extracts a focused helper; if files are added/deleted/renamed, update `项目文件结构说明.md`.
- The feature chain changes, so `项目完整链路说明.md` should be updated if implementation lands.
- `项目开发规范（AI协作）.md` likely does not need changes unless implementation introduces a new architectural boundary.
