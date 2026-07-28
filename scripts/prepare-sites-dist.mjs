import { cpSync, existsSync, rmSync } from 'node:fs';

if (!existsSync('out')) {
  throw new Error('Expected Next static export directory "out" after next build.');
}

rmSync('dist', { recursive: true, force: true });
cpSync('out', 'dist', { recursive: true });
console.log('Prepared Sites static output in dist');
