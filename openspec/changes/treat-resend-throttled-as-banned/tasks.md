## 1. Settings And Sidepanel

- [x] 1.1 Add a persisted `phoneResendThrottledAsBannedEnabled` setting with default disabled, boolean normalization, import/export participation, reset handling, and background state propagation.
- [x] 1.2 Add a sidepanel switch near the HeroSMS phone verification settings with Chinese copy that clearly says this is a "大概率封号" heuristic and may mistakenly replace a recoverable number.
- [x] 1.3 Ensure the switch is hot-effective for subsequent Step 9 SMS wait decisions without extension reload or browser restart.

## 2. Step 9 Resend-Throttled Policy

- [x] 2.1 Route page-side `resend_throttled` detections through a helper that checks `phoneResendThrottledAsBannedEnabled`.
- [x] 2.2 When the switch is enabled, treat Chinese and English resend-throttled page text as an immediate number replacement signal throughout the SMS wait and after resend clicks.
- [x] 2.3 When the switch is disabled, preserve the existing conservative resend-throttle behavior and avoid applying the high-probability banned-number policy solely because of throttled page text.
- [x] 2.4 Preserve replacement limits, free/manual/automatic phone reuse behavior, and valid-code activation cancellation protection.
- [x] 2.5 Log a clear warning that the replacement is based on a high-probability throttled/banned signal when the policy fires.

## 3. Tests

- [x] 3.1 Add sidepanel/settings tests for the new switch default, HTML exposure, payload collection, and state restore.
- [x] 3.2 Add phone verification flow tests showing enabled policy replaces immediately on Chinese resend-throttled text during the first SMS wait.
- [x] 3.3 Add phone verification flow tests showing enabled policy replaces immediately on English resend-throttled text after resend.
- [x] 3.4 Add a phone verification flow test showing disabled policy does not apply the high-probability banned-number replacement branch solely from resend-throttled text.
- [x] 3.5 Run focused sidepanel/settings and phone verification flow tests.
- [x] 3.6 Run `npm test`.

## 4. Documentation And Quality

- [x] 4.1 Update `项目完整链路说明.md` with the risk switch, default-off behavior, warning semantics, and Step 9 replacement behavior.
- [x] 4.2 Update `项目文件结构说明.md` only if implementation adds files or materially changes file responsibilities.
- [x] 4.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 4.4 Check touched Chinese logs, sidepanel copy, docs, and tests for mojibake.
