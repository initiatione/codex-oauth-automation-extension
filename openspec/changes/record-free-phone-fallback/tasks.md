## 1. Early Free Phone Recording

- [x] 1.1 Ensure Step 9 records `freeReusablePhoneActivation` immediately after a new HeroSMS activation receives a valid SMS code.
- [x] 1.2 Ensure saved free reusable phone records are broadcast to sidepanel listeners when set or cleared.
- [x] 1.3 Add concise logs for automatic and manual free reusable phone recording.

## 2. Phone-Only Manual Fallback

- [x] 2.1 Add a sidepanel `白嫖号码` fallback input and record button that only require a phone number.
- [x] 2.2 Add a background message route for saving a phone-only free reusable phone record.
- [x] 2.3 Persist phone-only fallback records with current HeroSMS country defaults and source `free-manual-reuse`.
- [x] 2.4 Keep phone-only records eligible for manual fill-only reuse.
- [x] 2.5 Stop automatic free reuse preparation with a clear reason when a saved record has no activation id, without buying a new number.

## 3. Tests

- [x] 3.1 Add or update phone verification tests proving valid-code recording happens before later Step 9/Step 10 completion work.
- [x] 3.2 Add tests proving free reusable phone record updates are broadcast when saved.
- [x] 3.3 Add sidepanel tests for the phone-only record input and runtime message.
- [x] 3.4 Add message router tests for `SET_FREE_REUSABLE_PHONE`.
- [x] 3.5 Add phone verification tests proving phone-only records can be used for manual fill-only handoff without HeroSMS paid APIs.
- [x] 3.6 Add phone verification tests proving phone-only records do not fall through to paid acquisition when automatic free reuse is enabled.
- [x] 3.7 Run focused tests for phone verification, sidepanel phone settings, and message router.
- [x] 3.8 Run `npm test`.

## 4. Documentation And Quality

- [x] 4.1 Update `项目完整链路说明.md` with early record timing, sidepanel hot update, and phone-only fallback behavior.
- [x] 4.2 Update other root docs only if project structure or development boundaries change.
- [x] 4.3 Check touched Chinese UI/log/docs/tests for mojibake.
- [x] 4.4 Run `openspec validate record-free-phone-fallback --strict`.
