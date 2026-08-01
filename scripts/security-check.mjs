import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set([
  'node_modules',
  '.next',
  'out',
  'dist',
  'coverage',
  'playwright-report',
  'test-results'
]);
const ignoredFiles = new Set(['package-lock.json']);
const findings = [];

const secretPatterns = [
  {
    name: 'seed phrase wording',
    pattern: /\b(seed phrase|secret recovery phrase|private key)\s*[:=]\s*["']?[^"'\n]+/i
  },
  { name: 'base58 private-key-like array', pattern: /\[[\d,\s]{120,}\]/ },
  {
    name: 'hard-coded api key',
    pattern: /(api[_-]?key|secret|private[_-]?key)\s*[:=]\s*["'][^"']{12,}/i
  },
  { name: 'unsafe mainnet default', pattern: /MAINNET_ENABLED\s*=\s*true/ }
];

const approvedProgramIds = [
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  'ComputeBudget111111111111111111111111111111',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  'LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE',
  '3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1cXekxH',
  'So11111111111111111111111111111111111111112',
  'solana:mainnet',
  'solana:devnet',
  'solana:testnet'
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (ignoredFiles.has(entry)) continue;
    if (!/\.(ts|tsx|js|mjs|json|md|example|gitignore)$/.test(entry)) continue;
    scanFile(full);
  }
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  const normalizedRel = rel.replaceAll('\\', '/');
  for (const { name, pattern } of secretPatterns) {
    if (
      pattern.test(text) &&
      normalizedRel !== 'docs/security-model.md' &&
      normalizedRel !== 'docs/threat-model.md' &&
      normalizedRel !== 'docs/mainnet-readiness-checklist.md'
    ) {
      findings.push(`${rel}: matched ${name}`);
    }
  }
  const scansExecutableSource = /^(app|components|lib|scripts|docs)[\\/]/.test(rel);
  if (!scansExecutableSource) return;
  for (const line of text.split(/\r?\n/)) {
    if (!/\bprogram\b|program[_-]?id/i.test(line)) continue;
    const programMatches = [...line.matchAll(/["'`]([1-9A-HJ-NP-Za-km-z]{32,44})["'`]/g)].map(
      (match) => match[1]
    );
    for (const match of programMatches) {
      if (match.length >= 32 && !approvedProgramIds.includes(match)) {
        findings.push(`${rel}: unapproved program-id-like string ${match}`);
      }
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error('Security check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Security check passed: no obvious secret files, unsafe mainnet defaults, or unapproved program IDs found.'
);
