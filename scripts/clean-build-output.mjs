import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const root = process.cwd();
const generatedDirs = ['out', 'dist'];

for (const dir of generatedDirs) {
  const target = resolve(root, dir);
  const relation = relative(root, target);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) {
    throw new Error(`Refusing to remove path outside workspace: ${target}`);
  }
  await rm(target, {
    force: true,
    maxRetries: 5,
    recursive: true,
    retryDelay: 200
  });
}
