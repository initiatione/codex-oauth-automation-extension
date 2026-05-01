## 1. Step 6 Timing

- [x] 1.1 Locate the Step 6 cookie-cleanup stabilization wait in `background/steps/clear-login-cookies.js` or its caller.
- [x] 1.2 Change the normal Step 6 post-cleanup wait to 3 seconds without adding any wait to Plus mode where Step 6 is hidden.
- [x] 1.3 Add or update focused Step 6 tests to assert the 3-second wait behavior.

## 2. Settings And State

- [x] 2.1 Add a persisted boolean setting for free phone reuse mode with normalization, default value, import/export, and restore behavior.
- [x] 2.2 Add a separate saved free reusable phone record distinct from `reusablePhoneActivation`.
- [x] 2.3 Preserve the saved free reusable phone record across normal `resetState()` and single-account task completion.
- [x] 2.4 Add a background message or state update path for manually clearing the saved free reusable phone record.

## 3. Phone Verification Flow

- [x] 3.1 Track whether the current activation came from a new HeroSMS number versus HeroSMS `reactivate` or free reuse handoff.
- [x] 3.2 When free phone reuse mode is enabled, persist the first new activation after `getStatus` or `getStatusV2` returns a valid SMS code.
- [x] 3.3 Keep successful free-reuse source activations from being cancelled with `setStatus(8)` as part of the free reuse record lifecycle.
- [x] 3.4 Before any HeroSMS `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` call on a later add-phone page, check for an enabled saved free reusable phone.
- [x] 3.5 If a saved free reusable phone is available, run the fill-only handoff, stop automatic mode, clear in-flight activation state as appropriate, and log the manual SMS refresh instruction.
- [x] 3.6 Ensure the existing HeroSMS new activation, polling, resend, replacement, completion, cancellation, and optional paid reactivation paths still run when free reuse is disabled or no free record exists.

## 4. Content Script Fill-Only Handoff

- [x] 4.1 Add a content-script message for filling the phone country and number without submitting the add-phone form.
- [x] 4.2 Reuse existing country matching and phone normalization logic from `content/phone-auth.js`.
- [x] 4.3 Return a structured result that confirms the number was filled and exposes page URL/error text for logs and tests.

## 5. Sidepanel UI

- [x] 5.1 Add a sidepanel switch for free phone reuse mode near the HeroSMS phone settings and wire it into autosave for hot effect.
- [x] 5.2 Display the saved free reusable phone number, country, and recorded time when present.
- [x] 5.3 Add a manual clear button for the saved free reusable phone record.
- [x] 5.4 Update copy so free reuse is distinct from HeroSMS paid `reactivate` reuse and verify touched Chinese text has no mojibake.

## 6. Tests

- [x] 6.1 Add phone-flow tests proving the first new activation is recorded only after a valid SMS code arrives.
- [x] 6.2 Add tests proving `reactivate` activations do not overwrite the free reusable phone candidate.
- [x] 6.3 Add tests proving the next add-phone page fills the saved phone, does not call HeroSMS paid acquisition/reactivation APIs, does not click submit, and stops automation.
- [x] 6.4 Add tests proving manual clear removes the saved free reusable phone record.
- [x] 6.5 Add settings lifecycle tests for persistence, import/export, sidepanel render, and hot-effect update handling.
- [x] 6.6 Run `npm test`.

## 7. Documentation

- [x] 7.1 Update `项目完整链路说明.md` for the 3-second Step 6 wait and the free phone reuse manual handoff chain.
- [x] 7.2 Update `项目文件结构说明.md` if implementation adds, deletes, or renames files.
- [x] 7.3 Update `项目开发规范（AI协作）.md` only if implementation introduces a new development boundary or architectural rule.
- [x] 7.4 Check all touched Chinese docs, sidepanel copy, logs, errors, and comments for mojibake.
