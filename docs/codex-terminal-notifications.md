# Codex Terminal Notifications

Use ntfy topics to keep each Codex terminal separate when a terminal needs the
chairman's attention.

## Boundary

This repository cannot automatically inspect or control another already-running
Codex terminal. Each terminal must explicitly call the notifier command, or a
local wrapper around that terminal must call it when attention is needed.

## Create Topics

Run:

`npm run codex:notify:init -- 4`

This creates local private topics in:

`artifacts/codex-terminal-topics.json`

The `artifacts/` folder is gitignored. Treat topic names like secrets.

## Subscribe

In the ntfy phone app, subscribe to each topic you want to monitor. Use:

`https://ntfy.sh`

as the server unless the registry says otherwise.

## Send From A Codex Terminal

From `G:\SATA`, run:

`npm run codex:notify -- --label codex-terminal-1 --message "Blocked on approval for npm install"`

From any other folder, call the script by absolute path:

`node G:\SATA\scripts\codex-terminal-notifier.mjs send --label codex-terminal-1 --message "Needs approval"`

Each Codex terminal should use a different label/topic, for example:

- `codex-terminal-1`;
- `codex-terminal-2`;
- `codex-terminal-3`;
- `codex-terminal-4`.

## Direct Topic Send

If a terminal is outside `G:\SATA` and cannot read the local registry, pass the
topic directly:

`node G:\SATA\scripts\codex-terminal-notifier.mjs send --topic <topic> --message "Needs approval"`

## Approval Response

ntfy remains one-way unless a public webhook is added. Reply in the relevant
Codex terminal, or in the supervisor Codex thread, with the decision.

## Supervisor Approval Queue

Other Codex terminals can submit command approval requests into a local queue.
The supervisor processes the queue with a strict allowlist. Safe local commands
are executed from the supervisor session; unclear or risky commands are moved to
an attention folder and pushed to ntfy.

Submit from `G:\SATA`:

`npm run codex:approval:submit -- --label codex-terminal-1 --command "git commit -m \"message\"" --reason "Codex is waiting on option 2"`

Submit from another working directory:

`node G:\SATA\scripts\codex-approval-supervisor.mjs submit --label codex-terminal-2 --cwd G:\SATA --command "npm run lint" --reason "Codex is waiting on option 2"`

Process queued requests:

`npm run codex:approval:process`

Continuously watch and process queued requests:

`npm run codex:approval:watch -- --interval-ms 10000`

List queued, attention, and completed requests:

`npm run codex:approval:list`

Queue files are stored under:

`artifacts/codex-approval-requests/`

The supervisor allowlist covers local review/build commands such as:

- `git commit -m "..."`
- `git status`
- `git diff`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run ops:*check`
- `npm run ops:*plan`
- `node scripts/validate-*.mjs`

The supervisor does not auto-run destructive commands, wallet actions, token or
fund movement, public posting, unknown installs, credential changes, or unclear
shell commands. Those get escalated through ntfy.
