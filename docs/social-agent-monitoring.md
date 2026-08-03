# SATA Social Agent Monitoring

Monitoring is manual until X API access is enabled. The agent may draft observations and reply suggestions, but it must not publish or delete posts without human approval.

## Current Pinned Post

- Queue ID: `pinned-proof-overview`
- Status: published and pinned
- Published: `2026-08-03T12:04:00Z`
- URL: pending exact post URL from X
- Initial observed views: `4`

## Monitoring Cadence

- 15 minutes after posting.
- 1 hour after posting.
- 24 hours after posting.
- Daily while pinned.

## Metrics To Record

- Views.
- Replies.
- Reposts.
- Likes.
- Bookmarks.
- Quote-posts, if visible.
- Any repeated misunderstanding that should be answered by a future post.

## Escalation Topics

Ask for human review before responding to:

- Redemption, backing, or price-floor claims.
- Liquidity lock or LP custody claims.
- Security accusations.
- Impersonation or fake links.
- Treasury movement questions.
- Legal, tax, or investment interpretations.

## Reply Defaults

Use the transparency page as the source of truth:

`https://sata-project-reserve.github.io/sata/transparency`

Keep replies factual. Do not speculate on market price, do not invite coordinated buying, and do not argue with hostile accounts.
