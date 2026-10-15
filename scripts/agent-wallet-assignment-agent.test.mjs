import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PublicKey } from '@solana/web3.js';
import { isSolanaPublicKey } from './agent-wallet-assignment-agent.mjs';

const script = resolve('scripts/agent-wallet-assignment-agent.mjs');
const validator = resolve('scripts/validate-agent-wallet-assignment-request.mjs');
const paths = [
  'use_case/agent-wallet-assignment-request.json',
  'use_case/on-chain-agent-settlement-policy.json',
  'use_case/on-chain-agent-settlement-queue.json',
  'public/executive-approval-queue.json'
];
// Deterministic public points only; no signing material is generated.
const addresses = [];
for (let i = 1; addresses.length < 3; i++) {
  const bytes = new Uint8Array(32).fill(i);
  if (PublicKey.isOnCurve(bytes)) addresses.push(new PublicKey(bytes).toBase58());
}
function fixture(approved, run) {
  const dir = mkdtempSync(join(tmpdir(), 'sata-wallet-test-'));
  try {
    for (const path of paths) {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (approved && path.startsWith('public/')) {
        const item = data.items.find(
          (entry) => entry.id === 'agent-wallet-assignment-20261013-first-settlement'
        );
        item.status = 'approved-by-chairman';
        item.approvedBy = 'executive-chairman';
      }
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), JSON.stringify(data));
    }
    for (const path of ['package.json', 'scripts/agent-wallet-assignment-agent.mjs']) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), readFileSync(path));
    }
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function apply(dir, recipient = addresses[1]) {
  return spawnSync(
    process.execPath,
    [
      script,
      'apply',
      '--primary-codex-address',
      addresses[0],
      '--implementation-agent-address',
      recipient,
      '--fee-rent-payer',
      addresses[2],
      '--confirm-chairman-approval',
      'I am Executive Chairman and approve wallet assignment agent-wallet-assignment-20261013-first-settlement'
    ],
    { cwd: dir, encoding: 'utf8' }
  );
}
test('invalid decoded keys and system program are rejected', () => {
  assert.equal(isSolanaPublicKey('z'.repeat(44)), false);
  assert.equal(isSolanaPublicKey('11111111111111111111111111111111'), false);
  assert.equal(isSolanaPublicKey(addresses[0]), true);
});
test('unapproved apply leaves every state file unchanged', () =>
  fixture(false, (dir) => {
    const before = paths.map((path) => readFileSync(join(dir, path), 'utf8'));
    assert.notEqual(apply(dir).status, 0);
    assert.deepEqual(
      paths.map((path) => readFileSync(join(dir, path), 'utf8')),
      before
    );
  }));
test('same recipient is rejected', () =>
  fixture(true, (dir) => {
    assert.match(apply(dir, addresses[0]).stderr, /must be different/);
  }));
test('concurrent assignment and interrupted writes block retry', () =>
  fixture(true, (dir) => {
    const lock = join(dir, 'use_case/.wallet-assignment.lock');
    writeFileSync(lock, '');
    assert.match(apply(dir).stderr, /EEXIST/);
    rmSync(lock);
    writeFileSync(join(dir, 'use_case/.wallet-assignment-recovery.json'), '{}');
    assert.match(apply(dir).stderr, /requires recovery review/);
  }));
test('approved assignment persists addresses and rejects replay', () =>
  fixture(true, (dir) => {
    const result = apply(dir);
    assert.equal(result.status, 0, result.stderr);
    const queue = JSON.parse(readFileSync(join(dir, paths[2]), 'utf8'));
    assert.equal(queue.proposals[0].recipientPublicKey, addresses[1]);
    assert.equal(queue.liveExecutionEnabled, false);
    assert.deepEqual(queue.executedTransactions, []);
    const validation = spawnSync(process.execPath, [validator], { cwd: dir, encoding: 'utf8' });
    assert.equal(validation.status, 0, validation.stderr);
    queue.proposals[0].recipientPublicKey = addresses[0];
    writeFileSync(join(dir, paths[2]), JSON.stringify(queue));
    assert.notEqual(spawnSync(process.execPath, [validator], { cwd: dir }).status, 0);
    assert.match(apply(dir).stderr, /already applied/);
  }));
