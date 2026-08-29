# Executive Approval Runbook

This runbook defines how SATA agents prepare work for the Executive Chairman.

## Authority Model

Jean Bilong is the Executive Chairman. The chairman approves final transactions, treasury actions, liquidity actions, paid promotion, token compensation, partnerships, and project proposals.

Agents act as operating staff. They may research, draft, verify, monitor, prepare options, and maintain records. They may not approve their own work or move project assets.

## Approval Queue

The source of truth is:

`public/executive-approval-queue.json`

Run:

`npm run ops:plan`

to view items awaiting chairman review.

Run:

`npm run ops:notify`

to message the Executive Chairman about new items awaiting review. The default free
notifier uses ntfy and requires:

- `EXECUTIVE_APPROVAL_CHANNEL=ntfy`;
- `NTFY_SERVER=https://ntfy.sh`;
- `NTFY_TOPIC`.

Install the ntfy app on the chairman's phone and subscribe to the same topic. Topics
are created automatically and act like bearer secrets, so use a hard-to-guess value
and do not publish it.

Run `npm run ops:notify:test` first to validate notifier routing without sending a
message or marking approval items as actually notified.

Email fallback is available with:

- `EXECUTIVE_APPROVAL_CHANNEL=email`;
- `EXECUTIVE_APPROVAL_EMAIL`;
- `SMTP_HOST`;
- `SMTP_PORT`;
- `SMTP_USER`;
- `SMTP_PASS`;
- optional `SMTP_FROM`.

For Gmail, use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`, and a Google app
password. For iCloud, use `smtp.mail.me.com`, port `587`, and an Apple app-specific
password.

WhatsApp fallback is available with Twilio:

- `EXECUTIVE_APPROVAL_CHANNEL=whatsapp`;
- `EXECUTIVE_APPROVAL_WHATSAPP`;
- `TWILIO_ACCOUNT_SID`;
- `TWILIO_AUTH_TOKEN`;
- `TWILIO_WHATSAPP_FROM`.

For quick testing, use the Twilio WhatsApp sandbox sender:

`TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`

The chairman must first join the sandbox from WhatsApp using the join code shown
in Twilio Console. Sandbox/free-form WhatsApp messages work inside the 24-hour
customer-service window after the chairman messages the sandbox. For production
or out-of-session notifications, set `TWILIO_WHATSAPP_CONTENT_SID` to an approved
WhatsApp template that accepts the approval digest as variable `{{1}}`.

SMS fallback is still available with:

- `EXECUTIVE_APPROVAL_CHANNEL=sms`;
- `EXECUTIVE_APPROVAL_PHONE`;
- `TEXTBELT_API_KEY`;
- optional `TEXTBELT_SENDER`.

Notification delivery state is written to:

`artifacts/executive-approval-notifications.json`

so repeated notifier runs do not send duplicate texts for the same approval item.

After the chairman replies in Codex or another approved control channel, record the decision:

`npm run ops:approve -- <item-id> --confirm-chairman-approval "I am Executive Chairman and approve <item-id>"`

or:

`npm run ops:reject -- <item-id> --confirm-chairman-rejection "I am Executive Chairman and reject <item-id>"`

Run:

`npm run ops:check`

to validate the queue.

## Item Lifecycle

- `draft`: agent is still preparing the proposal.
- `ready-for-chairman-review`: complete enough for chairman review.
- `approved-by-chairman`: chairman approved the item.
- `rejected`: chairman rejected the item.
- `executed`: the approved action has been completed and evidence is recorded.
- `superseded`: a newer proposal replaced this item.

## Required Proposal Fields

Each item must include:

- title;
- category;
- status;
- rationale;
- proposed action;
- execution mode;
- risk controls;
- public disclosure language;
- evidence array.

Sensitive categories must require chairman approval.

## Sensitive Categories

Chairman approval is always required for:

- treasury action;
- liquidity action;
- token compensation;
- paid promotion;
- promoter offer;
- partnership;
- legal;
- security;
- wallet custody.

## Execution Rules

Agents may execute only non-custodial approved tasks. Examples:

- post an already approved X post;
- update public docs after approval;
- add evidence links to the queue;
- generate a transaction preview.

Agents may not:

- sign transactions;
- move BTC, SOL, SATA, or LP tokens;
- hold seed phrases or private keys;
- approve grants or compensation;
- promise price, redemption, or market support.

## Promoter Proposals

Every paid or token-compensated promoter proposal must include explicit public disclosure:

`Sponsored/Paid Partnership`

or:

`token-compensated`

The proposal must reject fake engagement, bots, pump language, price claims, guaranteed results, and undisclosed promotion.

## Treasury Target Language

Allowed:

`SATA has a long-term treasury milestone of 1,000,000,000 sats. The reserve is a transparency metric, not a redemption promise or guaranteed price floor.`

Not allowed:

`1 SATA will equal 1 sat.`

`The reserve guarantees a price floor.`

`Buy before the reserve grows.`
