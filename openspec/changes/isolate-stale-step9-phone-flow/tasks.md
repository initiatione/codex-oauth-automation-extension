## 1. Tests First

- [x] 1.1 Add a focused phone-verification test proving a stale Step 9 SMS polling flow stops before the next HeroSMS `getStatus` call after the auto-run/session token changes.
- [x] 1.2 Add a focused phone-verification test proving stale automatic free-reuse preparation does not call `setStatus(3)` and does not clear or retire `freeReusablePhoneActivation`.
- [x] 1.3 Add a Step 9/auto-run boundary test proving a fresh round or retry invalidates outstanding Step 9 phone-flow ownership before Step 1 proceeds.
- [x] 1.4 Add a regression test proving a current, non-stale Step 9 phone flow still receives a valid code, preserves the free-reuse lifecycle, and resumes OAuth consent readiness.

## 2. Flow Ownership Guard

- [x] 2.1 Design the runtime token shape and guard API for Step 9 phone-flow ownership without adding persistent user configuration.
- [x] 2.2 Add token creation/invalidation plumbing in the background assembly/runtime layer while keeping large business logic out of `background.js`.
- [x] 2.3 Pass the token/guard from `background/steps/confirm-oauth.js` into `waitForStep8Ready` and `background/phone-verification-flow.js`.
- [x] 2.4 Invalidate existing Step 9 phone-flow tokens when a new Step 9 execution starts, when OAuth URL ownership changes, when auto-run resets for a fresh attempt, and when the user stops automation.

## 3. Side-Effect Boundaries

- [x] 3.1 Guard HeroSMS status polling, acquisition, price lookup, paid reactivation, SMS retry, completion, and cancellation calls against stale ownership.
- [x] 3.2 Guard auth-page phone fill/submit, phone-code submit, return-to-add-phone, and number replacement branches against stale ownership.
- [x] 3.3 Guard free reusable phone record mutation so stale flows cannot clear, retire, overwrite, or increment saved free-reuse records.
- [x] 3.4 Emit a short Chinese diagnostic log when stale Step 9 phone work is stopped, and avoid duplicate noisy logs from the same stale flow.

## 4. Verification And Docs

- [x] 4.1 Run focused tests for `phone-verification-flow` and Step 9/auto-run boundary coverage.
- [x] 4.2 Run `openspec validate isolate-stale-step9-phone-flow --strict`.
- [x] 4.3 Run full regression with `npm test`.
- [x] 4.4 Update `项目完整链路说明.md` and `项目文件结构说明.md` if a new runtime helper/module or documented flow boundary is introduced.
- [x] 4.5 Check touched Chinese logs/docs for mojibake.
