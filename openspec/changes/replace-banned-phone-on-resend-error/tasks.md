## 1. Content Script Detection

- [ ] 1.1 Add a dedicated banned-number resend error prefix or structured result in `content/phone-auth.js`.
- [ ] 1.2 Add a classifier for "无法向此电话号码发送短信" and equivalent concise English resend-time SMS rejection text.
- [ ] 1.3 Check for the banned-number message before resend polling, immediately after clicking resend, and at resend timeout.
- [ ] 1.4 Ensure ordinary successful resend and resend-throttled behavior still return their existing result/error shapes.

## 2. Background Step 9 Replacement

- [ ] 2.1 Add a background classifier for the banned-number resend error from the content script.
- [ ] 2.2 Route banned-number resend failures from `resendPhoneVerificationCode` or `waitForPhoneCodeOrRotateNumber` into the existing Step 9 replacement loop.
- [ ] 2.3 Use a distinct replacement reason such as `resend_phone_banned`.
- [ ] 2.4 Cancel/release the current owned HeroSMS activation, clear current activation state, return to add-phone when needed, and request a fresh number.
- [ ] 2.5 Preserve the existing replacement limit and include the banned-number reason in the exhausted-limit error.
- [ ] 2.6 Verify the free phone reuse manual handoff still stops before paid HeroSMS API calls and does not trigger the banned-number replacement path.

## 3. Logging And Documentation

- [ ] 3.1 Add a warning log that states OpenAI could not send SMS to the current phone and that Step 9 is switching numbers.
- [ ] 3.2 Update `项目完整链路说明.md` to document the resend-time banned-number detection and in-step replacement behavior.
- [ ] 3.3 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or their responsibilities change materially.
- [ ] 3.4 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [ ] 3.5 Check touched Chinese docs, logs, errors, and sidepanel/content copy for mojibake.

## 4. Tests

- [ ] 4.1 Add content-script tests proving the Chinese banned-number message after resend is reported as a banned-number failure.
- [ ] 4.2 Add content-script tests proving normal resend success and resend-throttled detection still work.
- [ ] 4.3 Add background phone-flow tests proving a banned-number resend failure cancels/clears the current activation and requests/submits a new number within Step 9.
- [ ] 4.4 Add background phone-flow tests proving replacement-limit exhaustion reports the banned-number reason.
- [ ] 4.5 Add a regression test proving free phone reuse handoff does not call paid acquisition/reactivation/cancellation APIs.
- [ ] 4.6 Run focused phone verification tests.
- [ ] 4.7 Run `npm test`.
