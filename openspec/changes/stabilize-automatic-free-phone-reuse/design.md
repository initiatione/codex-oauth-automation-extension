## Context

Step 9 already has two saved-phone paths:

- Manual free reuse: fill the saved phone and stop so the operator can refresh SMS manually.
- Automatic free reuse: call HeroSMS `setStatus(3)`, confirm the saved activation is ready, submit the saved phone, and then poll for the new SMS code.

The current automatic path is too brittle. It treats only exact `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, and `STATUS_WAIT_RESEND` strings as waiting states. In real HeroSMS responses, a waiting state can include a suffix, for example `STATUS_WAIT_RETRY:597243`. That suffix may be an old code or provider detail, not a fresh code to submit. Because the preparation logic sees that response as non-waiting, it clears the saved free phone and falls back to normal acquisition, which can buy a new number even though automatic free reuse was enabled.

## Goals / Non-Goals

**Goals:**

- Make automatic free reuse confirm the saved activation is actually in a waiting-for-SMS state before submitting the saved phone.
- Accept HeroSMS waiting statuses with optional suffixes as waiting states.
- Avoid submitting stale codes that appear after `STATUS_WAIT_RETRY:` or similar waiting-state suffixes.
- Retry `setStatus(3)` and status confirmation a bounded number of times when the platform still exposes an old code or is not ready yet.
- Stop the automatic flow with a concise, actionable log if a saved free phone cannot be prepared, instead of falling through to paid `reactivate` or new-number acquisition.
- Improve logs for this path so future debugging can read the lifecycle from the sidepanel log without platform screenshots.

**Non-Goals:**

- Do not change HeroSMS API semantics or add another SMS provider.
- Do not add a new sidepanel switch; this refines behavior under the existing automatic free reuse switch.
- Do not change manual free reuse behavior when automatic free reuse is disabled.
- Do not change the paid same-number reactivation path except to ensure automatic free reuse has priority and cannot accidentally fall into it after preparation failure.

## Decisions

### Treat waiting statuses as a status family

Use a shared helper that recognizes `STATUS_WAIT_CODE`, `STATUS_WAIT_RETRY`, and `STATUS_WAIT_RESEND` with either end-of-string or a colon suffix. This helper should be used by both automatic reuse preparation and normal SMS polling.

Alternative considered: special-case only `STATUS_WAIT_RETRY:*` in preparation. Rejected because HeroSMS may suffix other waiting states, and the same parsing bug can affect normal polling.

### Keep suffix data out of verification-code extraction

Only `STATUS_OK:*` should be considered a code-bearing status for v1 text responses. `STATUS_WAIT_RETRY:597243` is waiting-state metadata or stale code context and MUST NOT be submitted to OpenAI.

Alternative considered: parse any six digits from HeroSMS status text. Rejected because it would reintroduce stale-code submission and confuse the preparation phase.

### Retry preparation before giving up

Automatic reuse preparation should run a bounded sequence:

1. Call `setStatus(3)` for the saved activation.
2. Wait a short delay to let HeroSMS transition state.
3. Poll `getStatus` or `getStatusV2`.
4. If waiting state is confirmed, submit the saved phone.
5. If old `STATUS_OK:*` remains, wait and retry confirmation; if needed, call `setStatus(3)` again on the next preparation attempt.
6. If terminal/cancelled/API failure occurs or the retry budget is exhausted, stop safely.

Alternative considered: immediately retry `setStatus(3)` in a tight loop. Rejected because it can spam the platform and makes logs noisy.

### Do not buy a new number after automatic reuse preparation failure

When `freePhoneReuseAutoEnabled` is on and a saved free phone exists, the user intent is to reuse that saved phone. If preparation fails, the flow should stop and report why. It should not clear the record and proceed to `reactivate`, `getPrices`, `getNumber`, or `getNumberV2` in the same run.

Alternative considered: make fallback configurable. Rejected for this change because the observed failure mode is accidental spending; adding a setting would obscure the safety boundary.

### Make logs compact but diagnostic

Logs should be short and structured around milestones:

- preparing saved phone `<number>`
- reactivated saved phone, waiting before status check
- status check result `<status>`
- waiting state confirmed, submitting saved phone
- old code still visible, retrying preparation
- preparation failed, stopping without buying new number

Avoid long repeated paragraphs. Include the phone number and final reason where useful.

## Risks / Trade-offs

- [Risk] A suffixed waiting status may have ambiguous provider semantics. -> Mitigation: treat it only as waiting, never as a code, and keep polling for a later `STATUS_OK:*`.
- [Risk] Stopping instead of buying a new number can reduce throughput when the saved phone is genuinely unusable. -> Mitigation: this only applies when automatic free reuse is enabled with a saved phone; it protects the user's explicit free-reuse intent and avoids accidental paid acquisition.
- [Risk] Extra `setStatus(3)` retries may hit provider limits. -> Mitigation: use a small bounded retry count and a delay before status checks.
- [Risk] More Chinese log/doc text can introduce mojibake. -> Mitigation: run focused tests, full `npm test`, and scan touched Chinese files for mojibake.
