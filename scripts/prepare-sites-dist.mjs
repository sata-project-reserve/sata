import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const imageSvg = readFileSync(join('public', 'mainnet', 'sata-image.svg'), 'utf8');
const hostingJson = readFileSync(join('.openai', 'hosting.json'), 'utf8');

rmSync('dist', { recursive: true, force: true });
mkdirSync(join('dist', 'server'), { recursive: true });
mkdirSync(join('dist', '.openai'), { recursive: true });

const server = `
const imageSvg = ${JSON.stringify(imageSvg)};

function buildMetadata(origin) {
  const image = origin + '/mainnet/sata-image.svg';
  return {
    name: 'SATA',
    symbol: 'SATA',
    description: 'SATA is a community-driven experimental token on Solana. It provides no promise of profit, return, utility or appreciation.',
    image,
    attributes: [
      { trait_type: 'network', value: 'mainnet-beta' },
      { trait_type: 'project_type', value: 'community experimental token' }
    ],
    properties: {
      category: 'image',
      files: [{ uri: image, type: 'image/svg+xml' }]
    }
  };
}

function withCors(headers) {
  return {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300',
    ...headers
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/mainnet/sata-image.svg') {
      return new Response(imageSvg, {
        headers: withCors({ 'content-type': 'image/svg+xml; charset=utf-8' })
      });
    }
    if (url.pathname === '/mainnet/sata-metadata.json') {
      return new Response(JSON.stringify(buildMetadata(url.origin), null, 2) + '\\n', {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/') {
      return new Response(
        '<!doctype html><title>SATA Token Assets</title><h1>SATA Token Assets</h1><ul><li><a href="/mainnet/sata-image.svg">sata-image.svg</a></li><li><a href="/mainnet/sata-metadata.json">sata-metadata.json</a></li></ul>',
        { headers: withCors({ 'content-type': 'text/html; charset=utf-8' }) }
      );
    }
    return new Response('Not found\\n', {
      status: 404,
      headers: withCors({ 'content-type': 'text/plain; charset=utf-8' })
    });
  }
};
`;

writeFileSync(join('dist', 'server', 'index.js'), server.trimStart(), 'utf8');
writeFileSync(join('dist', '.openai', 'hosting.json'), hostingJson, 'utf8');
console.log('Prepared Sites server output in dist');
