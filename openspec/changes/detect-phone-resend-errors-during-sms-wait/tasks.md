## 1. Content-Side Error Probe

- [x] 1.1 Add or expose a read-only phone resend error probe in `content/phone-auth.js` that reuses existing banned-number and throttling text detection.
- [x] 1.2 Add a `signup-page` message handler for the probe so background code can ask the auth page whether resend rejection/throttle text is currently visible.
- [x] 1.3 Ensure the probe returns explicit structured results for `resend_phone_banned`, `resend_throttled`, and no-error states.
- [x] 1.4 Keep existing `RESEND_PHONE_VERIFICATION_CODE` behavior and immediate post-click detection intact.

## 2. Background SMS Wait Integration

- [x] 2.1 Inspect `waitForPhoneCodeOrRotateNumber` and identify the safest point to probe page-side resend errors during all HeroSMS `STATUS_WAIT_CODE` polling.
- [x] 2.2 Call the page probe during SMS wait windows before and after a resend request has been made.
- [x] 2.3 Convert explicit banned-number probe results into the existing `replaceNumber` flow with reason `resend_phone_banned`.
- [x] 2.4 Convert explicit throttled probe results into the existing `replaceNumber` flow with reason `resend_throttled`.
- [x] 2.5 Ignore transient content-script probe failures unless they contain an explicit resend error signal.

## 3. Lifecycle And Replacement Safety

- [x] 3.1 Ensure numbers without valid codes can still be cancelled/released when replaced because of late resend page errors.
- [x] 3.2 Ensure activations that already have `phoneCodeReceived` remain protected from cancellation according to existing rules.
- [x] 3.3 Ensure late resend error replacement does not invoke paid same-number reactivation unless the normal replacement/acquisition path later chooses it under existing settings.
- [x] 3.4 Add clear logs when late page-side resend errors are detected during SMS wait.

## 4. Tests

- [x] 4.1 Add content helper tests for the read-only resend error probe covering Chinese banned-number text.
- [x] 4.2 Add content helper tests for the read-only resend error probe covering Chinese/English throttling text.
- [x] 4.3 Add phone verification flow tests where the first SMS wait sees `resend_phone_banned`, causing immediate replacement before any resend.
- [x] 4.4 Add phone verification flow tests where resend click succeeds, HeroSMS remains `STATUS_WAIT_CODE`, and a later page probe reports `resend_phone_banned` or `resend_throttled`, causing immediate replacement.
- [x] 4.5 Add or keep regression coverage showing normal HeroSMS polling continues when the page probe reports no error or transient probe failure.
- [x] 4.6 Run focused phone auth and phone verification tests.
- [x] 4.7 Run `npm test`.

## 5. Documentation And Quality

- [x] 5.1 Update `项目完整链路说明.md` to state that Step 9 watches phone resend rejection/throttle text throughout SMS waiting, before and after resend.
- [x] 5.2 Update `项目文件结构说明.md` only if files are added, deleted, renamed, or responsibilities materially change.
- [x] 5.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary.
- [x] 5.4 Check touched Chinese logs, errors, docs, and tests for mojibake.
