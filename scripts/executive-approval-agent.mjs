import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';
import tls from 'node:tls';
import {
  assertChairmanDecisionConfirmation,
  buildExecutiveApprovalPlan,
} from './lib/executive-approval-plan.mjs';

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
    await decideItem('approved-by-chairman', args);
    break;
  case 'reject':
    await decideItem('rejected', args);
    break;
  default:
    throw new Error(
      `Unknown executive approval command: ${command}. Use plan, notify, notify-test, approve <id>, or reject <id>.`
    );
}

function printPlan() {
  console.log(JSON.stringify(buildExecutiveApprovalPlan(queue), null, 2));
}

async function notifyChairman({ testMode }) {
  const channel = process.env.EXECUTIVE_APPROVAL_CHANNEL ?? 'ntfy';

  const reviewItems = (queue.items ?? []).filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const log = await readNotificationLog();
  const sent = new Set(log.sentItemIds ?? []);
  const unsentItems = testMode
    ? reviewItems
    : reviewItems.filter((item) => !sent.has(item.id));

  if (unsentItems.length === 0) {
    console.log('No new chairman review items to notify.');
    return;
  }

  const body = formatNotificationDigest(unsentItems);
  const response = await sendNotification({ channel, body, testMode });
  if (!response.success) {
    throw new Error(`${response.provider} failed: ${response.error ?? 'unknown error'}`);
  }

  const notifiedAtUtc = new Date().toISOString();
  for (const item of unsentItems) {
    if (!testMode) sent.add(item.id);
    log.events = [
      ...(log.events ?? []),
      {
        itemId: item.id,
        notificationId: response.notificationId ?? null,
        provider: response.provider,
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

async function decideItem(status, args) {
  const [itemId, ...optionArgs] = args;
  if (!itemId) {
    throw new Error(`Missing item id. Use: ${command} <id>`);
  }
  const options = parseDecisionOptions(optionArgs);

  const item = (queue.items ?? []).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Approval item not found: ${itemId}`);
  }
  if (item.status !== 'ready-for-chairman-review') {
    throw new Error(
      `${itemId} is ${item.status}; only ready-for-chairman-review items can be approved or rejected.`
    );
  }
  requireChairmanConfirmation({ status, itemId, options });

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

function parseDecisionOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error('Decision options must be provided as --key value pairs.');
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    options[key.slice(2)] = collected.join(' ');
  }
  return options;
}

function requireChairmanConfirmation({ status, itemId, options }) {
  assertChairmanDecisionConfirmation({ status, itemId, options });
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

async function sendNotification({ channel, body, testMode }) {
  switch (channel) {
    case 'ntfy':
      return sendNtfy({ body, testMode });
    case 'email':
    case 'smtp':
      return sendSmtpEmail({ body, testMode });
    case 'whatsapp':
    case 'twilio-whatsapp':
      return sendTwilioWhatsApp({ body, testMode });
    case 'sms':
    case 'textbelt':
      return sendTextbeltSms({ body, testMode });
    default:
      throw new Error(
        `Unsupported EXECUTIVE_APPROVAL_CHANNEL: ${channel}. Use ntfy, email, whatsapp, or sms.`
      );
  }
}

async function sendNtfy({ body, testMode }) {
  const server = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/+$/, '');
  const topic = process.env.NTFY_TOPIC;
  const token = process.env.NTFY_TOKEN;

  if (!topic) throw new Error('NTFY_TOPIC is required for ntfy notifications.');

  if (testMode) {
    return {
      success: true,
      provider: 'ntfy',
      notificationId: 'test-mode'
    };
  }

  const headers = {
    Title: 'SATA approval needed',
    Priority: 'high',
    Tags: 'warning'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers,
    body
  });
  const result = await response.json().catch(() => ({}));
  return {
    success: response.ok,
    provider: 'ntfy',
    notificationId: result.id ?? null,
    error: result.error ?? result.message ?? null
  };
}

async function sendSmtpEmail({ body, testMode }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = /^true$/i.test(process.env.SMTP_SECURE ?? 'false') || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  const to = process.env.EXECUTIVE_APPROVAL_EMAIL;

  if (!host) throw new Error('SMTP_HOST is required for email notifications.');
  if (!user) throw new Error('SMTP_USER is required for email notifications.');
  if (!pass) throw new Error('SMTP_PASS is required for email notifications.');
  if (!from) throw new Error('SMTP_FROM or SMTP_USER is required for email notifications.');
  if (!to) throw new Error('EXECUTIVE_APPROVAL_EMAIL is required for email notifications.');

  if (testMode) {
    return {
      success: true,
      provider: 'smtp-email',
      notificationId: 'test-mode'
    };
  }

  const client = new SmtpClient({ host, port, secure });
  await client.connect();
  try {
    await client.ehlo();
    if (!secure) {
      await client.startTls();
      await client.ehlo();
    }
    await client.authLogin(user, pass);
    await client.sendMail({
      from,
      to,
      subject: 'SATA approval needed',
      body
    });
  } finally {
    await client.quit().catch(() => {});
  }

  return {
    success: true,
    provider: 'smtp-email',
    notificationId: new Date().toISOString()
  };
}

async function sendTwilioWhatsApp({ body, testMode }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = normalizeWhatsApp(process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886');
  const to = normalizeWhatsApp(process.env.EXECUTIVE_APPROVAL_WHATSAPP);
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;

  if (!accountSid) throw new Error('TWILIO_ACCOUNT_SID is required for WhatsApp notifications.');
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN is required for WhatsApp notifications.');
  if (!to) throw new Error('EXECUTIVE_APPROVAL_WHATSAPP is required for WhatsApp notifications.');

  if (testMode) {
    return {
      success: true,
      provider: 'twilio-whatsapp',
      notificationId: 'test-mode'
    };
  }

  const payload = new URLSearchParams({
    From: from,
    To: to
  });
  if (contentSid) {
    payload.set('ContentSid', contentSid);
    payload.set('ContentVariables', JSON.stringify({ 1: body }));
  } else {
    payload.set('Body', body);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload
    }
  );
  const result = await response.json();
  return {
    success: response.ok,
    provider: 'twilio-whatsapp',
    notificationId: result.sid ?? null,
    error: result.message ?? result.error_message ?? null
  };
}

function normalizeWhatsApp(value) {
  if (!value) return null;
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

async function sendTextbeltSms({ body, testMode }) {
  const phone = process.env.EXECUTIVE_APPROVAL_PHONE;
  const textbeltKey = process.env.TEXTBELT_API_KEY;
  const sender = process.env.TEXTBELT_SENDER ?? queue.project ?? 'SATA';

  if (!phone) throw new Error('EXECUTIVE_APPROVAL_PHONE is required for SMS notifications.');
  if (!textbeltKey) throw new Error('TEXTBELT_API_KEY is required for SMS notifications.');

  const payload = new URLSearchParams({
    phone,
    message: body,
    key: testMode ? toTextbeltTestKey(textbeltKey) : textbeltKey,
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
  const result = await response.json();
  return {
    success: result.success === true,
    provider: 'textbelt',
    notificationId: result.textId ?? null,
    error: result.error ?? null
  };
}

function toTextbeltTestKey(key) {
  return key.endsWith('_test') ? key : `${key}_test`;
}

class SmtpClient {
  constructor({ host, port, secure }) {
    this.host = host;
    this.port = port;
    this.secure = secure;
    this.buffer = '';
  }

  async connect() {
    this.socket = this.secure
      ? tls.connect({ host: this.host, port: this.port, servername: this.host })
      : net.connect({ host: this.host, port: this.port });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => {
      this.buffer += chunk;
      this.resolvePendingResponse?.();
    });
    await new Promise((resolve, reject) => {
      this.socket.once(this.secure ? 'secureConnect' : 'connect', resolve);
      this.socket.once('error', reject);
    });
    await this.readResponse([220]);
  }

  async ehlo() {
    await this.command(`EHLO ${process.env.COMPUTERNAME ?? 'localhost'}`, [250]);
  }

  async startTls() {
    await this.command('STARTTLS', [220]);
    this.socket.removeAllListeners('data');
    this.socket.removeAllListeners('error');
    this.buffer = '';
    this.socket = tls.connect({ socket: this.socket, servername: this.host });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => {
      this.buffer += chunk;
      this.resolvePendingResponse?.();
    });
    await new Promise((resolve, reject) => {
      this.socket.once('secureConnect', resolve);
      this.socket.once('error', reject);
    });
  }

  async authLogin(user, pass) {
    await this.command('AUTH LOGIN', [334]);
    await this.command(Buffer.from(user).toString('base64'), [334]);
    await this.command(Buffer.from(pass).toString('base64'), [235]);
  }

  async sendMail({ from, to, subject, body }) {
    await this.command(`MAIL FROM:<${from}>`, [250]);
    await this.command(`RCPT TO:<${to}>`, [250, 251]);
    await this.command('DATA', [354]);
    this.socket.write(`${formatEmail({ from, to, subject, body })}\r\n.\r\n`);
    await this.readResponse([250]);
  }

  async quit() {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write('QUIT\r\n');
    await this.readResponse([221]).catch(() => {});
    this.socket.end();
  }

  async command(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return this.readResponse(expectedCodes);
  }

  async readResponse(expectedCodes) {
    const response = parseSmtpResponse(this.buffer);
    if (response) {
      this.buffer = '';
      return assertSmtpResponse(response, expectedCodes);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.resolvePendingResponse = null;
        reject(new Error('SMTP response timed out.'));
      }, 30000);
      this.resolvePendingResponse = () => {
        const nextResponse = parseSmtpResponse(this.buffer);
        if (!nextResponse) return;
        clearTimeout(timeout);
        this.resolvePendingResponse = null;
        this.buffer = '';
        try {
          resolve(assertSmtpResponse(nextResponse, expectedCodes));
        } catch (error) {
          reject(error);
        }
      };
    });
  }
}

function parseSmtpResponse(buffer) {
  if (!buffer.includes('\n')) return null;
  const lines = buffer.split(/\r?\n/).filter(Boolean);
  const lastLine = lines.at(-1) ?? '';
  const match = /^(\d{3}) /.exec(lastLine);
  if (!match) return null;
  return {
    code: Number(match[1]),
    text: lines.join('\n')
  };
}

function assertSmtpResponse(response, expectedCodes) {
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP ${response.code}: ${response.text}`);
  }
  return response;
}

function formatEmail({ from, to, subject, body }) {
  const escapedBody = body.replace(/^\./gm, '..');
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@sata.local>`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    escapedBody
  ].join('\r\n');
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
