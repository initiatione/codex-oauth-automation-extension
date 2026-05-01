## 1. Content Script Detection

- [x] 1.1 Add a dedicated banned-number resend error prefix or structured result in `content/phone-auth.js`.
- [x] 1.2 Add a classifier for "无法向此电话号码发送短信" and equivalent concise English resend-time SMS rejection text.
- [x] 1.3 Check for the banned-number message before resend polling, immediately after clicking resend, and at resend timeout.
- [x] 1.4 Ensure ordinary successful resend and resend-throttled behavior still return their existing result/error shapes.

## 2. Background Step 9 Replacement

- [x] 2.1 Add a background classifier for the banned-number resend error from the content script.
- [x] 2.2 Route banned-number resend failures from `resendPhoneVerificationCode` or `waitForPhoneCodeOrRotateNumber` into the existing Step 9 replacement loop.
- [x] 2.3 Use a distinct replacement reason such as `resend_phone_banned`.
- [x] 2.4 Cancel/release the current owned HeroSMS activation, clear current activation state, return to add-phone when needed, and request a fresh number.
- [x] 2.5 Preserve the existing replacement limit and include the banned-number reason in the exhausted-limit error.
- [x] 2.6 Verify the free phone reuse manual handoff still stops before paid HeroSMS API calls and does not trigger the banned-number replacement path.

## 3. Logging And Documentation

- [x] 3.1 Add a warning log that states OpenAI could not send SMS to the current phone and that Step 9 is switching numbers.
- [x] 3.2 Update `项目完整链路说明.md` to document the resend-time banned-number detection and in-step replacement behavior.
- [x] 3.3 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or their responsibilities change materially.
- [x] 3.4 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 3.5 Check touched Chinese docs, logs, errors, and sidepanel/content copy for mojibake.

## 4. Tests

- [x] 4.1 Add content-script tests proving the Chinese banned-number message after resend is reported as a banned-number failure.
- [x] 4.2 Add content-script tests proving normal resend success and resend-throttled detection still work.
- [x] 4.3 Add background phone-flow tests proving a banned-number resend failure cancels/clears the current activation and requests/submits a new number within Step 9.
- [x] 4.4 Add background phone-flow tests proving replacement-limit exhaustion reports the banned-number reason.
- [x] 4.5 Add a regression test proving free phone reuse handoff does not call paid acquisition/reactivation/cancellation APIs.
- [x] 4.6 Run focused phone verification tests.
- [x] 4.7 Run `npm test`.
