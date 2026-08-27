import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const QUEUE_PATH = join('public', 'executive-approval-queue.json');
const NOTIFICATION_LOG_PATH = join('artifacts', 'executive-approval-notifications.json');
const [, , command = 'plan', ...args] = process.argv;

loadLocalEnv();
const queue = JSON.parse(await readFile(QUEUE_PATH, 'utf8'));

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'notify':
    await notifyChairman({ testMode: false });
    break;
  case 'notify-test':
    await notifyChairman({ testMode: true });
    break;
  case 'approve':
    await decideItem('approved-by-chairman', args[0]);
    break;
  case 'reject':
    await decideItem('rejected', args[0]);
    break;
  default:
    throw new Error(
      `Unknown executive approval command: ${command}. Use plan, notify, notify-test, approve <id>, or reject <id>.`
    );
}

function printPlan() {
  const counts = {};
  for (const item of queue.items ?? []) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  const reviewItems = (queue.items ?? []).filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  console.log(
    JSON.stringify(
      {
        project: queue.project,
        mode: queue.mode,
        executiveChairman: queue.executiveChairman,
        counts,
        chairmanReview: reviewItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          execution: item.execution,
          proposedAction: item.proposedAction
        })),
        operatingBoundary:
          'Agents prepare and validate work. The Executive Chairman approves final transactions, proposals, promotions, partnerships, and public commitments.'
      },
      null,
      2
    )
  );
}

async function notifyChairman({ testMode }) {
  const phone = process.env.EXECUTIVE_APPROVAL_PHONE;
  const textbeltKey = process.env.TEXTBELT_API_KEY;
  const sender = process.env.TEXTBELT_SENDER ?? queue.project ?? 'SATA';

  if (!phone) {
    throw new Error('EXECUTIVE_APPROVAL_PHONE is required for notifications.');
  }
  if (!textbeltKey) {
    throw new Error('TEXTBELT_API_KEY is required for notifications.');
  }

  const reviewItems = (queue.items ?? []).filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const log = await readNotificationLog();
  const sent = new Set(log.sentItemIds ?? []);
  const unsentItems = reviewItems.filter((item) => !sent.has(item.id));

  if (unsentItems.length === 0) {
    console.log('No new chairman review items to notify.');
    return;
  }

  const body = formatNotificationDigest(unsentItems);
  const response = await sendTextbeltSms({
    phone,
    body,
    key: testMode ? toTextbeltTestKey(textbeltKey) : textbeltKey,
    sender
  });
  if (!response.success) {
    throw new Error(`Textbelt failed: ${response.error ?? 'unknown error'}`);
  }

  const notifiedAtUtc = new Date().toISOString();
  for (const item of unsentItems) {
    if (!testMode) sent.add(item.id);
    log.events = [
      ...(log.events ?? []),
      {
        itemId: item.id,
        textId: response.textId ?? null,
        notifiedAtUtc,
        testMode
      }
    ];
  }
  log.sentItemIds = [...sent].sort();
  await writeNotificationLog(log);
  console.log(
    `${testMode ? 'Test notification checked' : 'Notified chairman'} for ${
      unsentItems.length
    } approval item(s).`
  );
}

function toTextbeltTestKey(key) {
  return key.endsWith('_test') ? key : `${key}_test`;
}

async function decideItem(status, itemId) {
  if (!itemId) {
    throw new Error(`Missing item id. Use: ${command} <id>`);
  }

  const item = (queue.items ?? []).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Approval item not found: ${itemId}`);
  }
  if (item.status !== 'ready-for-chairman-review') {
    throw new Error(
      `${itemId} is ${item.status}; only ready-for-chairman-review items can be approved or rejected.`
    );
  }

  item.status = status;
  if (status === 'approved-by-chairman') {
    item.approvedBy = 'executive-chairman';
    item.approvedAtUtc = new Date().toISOString();
  }
  if (status === 'rejected') {
    item.rejectedBy = 'executive-chairman';
    item.rejectedAtUtc = new Date().toISOString();
  }
  queue.updatedAtUtc = new Date().toISOString();

  await writeFile(QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`);
  console.log(`${itemId} marked ${status}.`);
}

function formatNotificationDigest(items) {
  const itemList = items
    .map((item, index) => `${index + 1}. ${item.id}: ${item.title}`)
    .join('\n');
  return [
    `SATA approval needed (${items.length}):`,
    itemList,
    'Reply in Codex: yes <id> or no <id>.',
    'Reply STOP to opt out.'
  ].join('\n');
}

async function sendTextbeltSms({ phone, body, key, sender }) {
  const payload = new URLSearchParams({
    phone,
    message: body,
    key,
    sender
  });

  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload
  });

  if (!response.ok) {
    throw new Error(`Textbelt HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function readNotificationLog() {
  try {
    return JSON.parse(await readFile(NOTIFICATION_LOG_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { sentItemIds: [], events: [] };
    throw error;
  }
}

async function writeNotificationLog(log) {
  await mkdir('artifacts', { recursive: true });
  await writeFile(NOTIFICATION_LOG_PATH, `${JSON.stringify(log, null, 2)}\n`);
}

function loadLocalEnv() {
  for (const envPath of ['.env.local', '.env']) {
    try {
      const contents = readFileSync(envPath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const rawValue = trimmed.slice(separator + 1).trim();
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
