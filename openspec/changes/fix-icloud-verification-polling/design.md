## Context

Step 4 and Step 8 share the background verification flow. For iCloud inbox mode, the background opens or focuses the iCloud Mail tab and sends `POLL_EMAIL` to `content/icloud-mail.js` through `sendToMailContentScriptResilient`.

The current iCloud content script waits for `.content-container`, sleeps, snapshots all visible thread signatures as old mail, and only refreshes on later attempts. If the verification mail is already visible when the tab finishes opening, it can be included in the old-mail snapshot and ignored until a resend is triggered.

Separately, the resilient mail sender derives each retry response timeout from the remaining overall timeout. After iCloud reload/reinject recovery consumes most of the budget, a retried `POLL_EMAIL` can be sent with roughly one second of response time. That is too short for iCloud Mail's frame and DOM to settle, so recovery can repeat without giving the page a practical chance to answer.

## Goals / Non-Goals

**Goals:**

- Let iCloud use a freshly arrived verification mail that is already visible when the mailbox opens.
- Keep the current old-mail snapshot behavior when the newest matching message is not confidently near the verification request time.
- Prevent iCloud mail recovery retries from using impractically short `POLL_EMAIL` response timeouts.
- Preserve non-iCloud provider behavior.
- Cover Step 4 and Step 8 because both can use the iCloud inbox provider path.

**Non-Goals:**

- Rework the full verification-flow retry model.
- Add a new sidepanel setting for iCloud polling.
- Replace DOM-based iCloud Mail reading with iCloud APIs.
- Change non-iCloud providers such as 2925, Hotmail, LuckMail, Gmail, QQ, 163, or Cloudflare Temp Email.

## Decisions

1. iCloud first pass happens before old-mail snapshot.

   On `POLL_EMAIL`, the iCloud content script will wait for the mailbox list, click refresh once, inspect the newest matching message, and only then decide whether to return a code or fall back to the existing snapshot-based loop.

   Alternative considered: Always allow fallback to the first matching message. This is too permissive because it can reuse stale historical codes.

2. Near-time detection uses the background request timestamp when available.

   The content script will use `payload.filterAfterTimestamp` as the preferred request-time baseline. A matching message is eligible for the fast path when its parsed timestamp is close to that baseline, with tolerance for iCloud display imprecision. If no reliable timestamp can be parsed, the fast path is skipped and the existing snapshot logic continues.

   Alternative considered: Use the moment the iCloud tab opens. That is less accurate because the verification request may have happened before the mailbox page became usable.

3. The first-pass read must use the same sender, subject, excluded-code, and body validation rules as normal polling.

   This avoids creating a looser path that can accept unrelated mail. The fast path changes when the mailbox is refreshed and when the old snapshot is taken, not what qualifies as a verification mail.

4. iCloud mail recovery gets a minimum response timeout floor.

   `sendToMailContentScriptResilient` will keep the existing remaining-budget behavior generally, but iCloud `POLL_EMAIL` retries after reload/reinject must not be dispatched with a response window below a practical floor. The floor should be long enough for the iCloud iframe to respond after reinjection while still bounded by the caller's overall timeout.

   Alternative considered: Increase all `POLL_EMAIL` timeouts. That would slow unrelated providers and could mask real failures.

## Risks / Trade-offs

- Timestamp parsing can be incomplete for localized iCloud labels such as "刚刚", "1 分钟前", or time-only labels. → Keep the fast path conservative: unparseable timestamps fall back to existing behavior.
- Refresh button detection may miss a changed iCloud UI label. → Keep the existing later polling loop as fallback, and test both refresh-label and inbox-click paths where practical.
- A timeout floor can make worst-case iCloud failure take slightly longer. → Apply it only to iCloud mail recovery / `POLL_EMAIL`, not to every provider.
- Opening a message during fast path changes selected mail in the mailbox UI. → This matches existing polling behavior, which already opens candidate messages to read the body.

## Migration Plan

- Implement the iCloud first-pass helper behind the existing `POLL_EMAIL` message path.
- Add timestamp parsing and near-time eligibility helpers in `content/icloud-mail.js`.
- Add an iCloud-specific response timeout floor in the mail resilient sender or its call options.
- Add focused tests before broad regression tests.
- Rollback is straightforward: remove the first-pass helper and the iCloud timeout floor to return to previous behavior.

## Open Questions

- The exact near-time window should be finalized during implementation. Suggested starting point: accept messages whose parsed timestamp is between `filterAfterTimestamp - 60 seconds` and `now + 2 minutes`.
- If iCloud list timestamps are too ambiguous in practice, a later enhancement may inspect the opened message header timestamp before accepting the fast-path code.
