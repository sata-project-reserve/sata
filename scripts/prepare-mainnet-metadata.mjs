import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join('artifacts', 'mainnet-metadata');
const IMAGE_FILENAME = 'sata-image.svg';
const METADATA_TEMPLATE_FILENAME = 'sata-metadata.template.json';
const HASHES_FILENAME = 'sha256sums.json';
const README_FILENAME = 'README.md';
const IMAGE_PLACEHOLDER_URL = 'https://YOUR-PERSISTENT-HOST.example/sata-image.svg';
const METADATA_PLACEHOLDER_URL = 'https://YOUR-PERSISTENT-HOST.example/sata-metadata.json';

mkdirSync(OUT_DIR, { recursive: true });

const image = readFileSync(join('public', 'sata-default.svg'), 'utf8')
  .replace(
    'A simple circular SATA mark for devnet token metadata testing.',
    'A simple circular SATA mark for token metadata.'
  );

const metadata = {
  name: 'SATA',
  symbol: 'SATA',
  description:
    'SATA is a community-driven experimental token on Solana. It provides no promise of profit, return, utility or appreciation.',
  image: IMAGE_PLACEHOLDER_URL,
  attributes: [
    {
      trait_type: 'network',
      value: 'mainnet-beta'
    },
    {
      trait_type: 'project_type',
      value: 'community experimental token'
    }
  ],
  properties: {
    category: 'image',
    files: [
      {
        uri: IMAGE_PLACEHOLDER_URL,
        type: 'image/svg+xml'
      }
    ]
  }
};

const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
const readme = `# SATA Mainnet Metadata Asset Pack

Generated files:

- \`${IMAGE_FILENAME}\`: SATA image asset.
- \`${METADATA_TEMPLATE_FILENAME}\`: metadata JSON template.
- \`${HASHES_FILENAME}\`: SHA-256 hashes for review after upload.

Mainnet steps:

1. Upload \`${IMAGE_FILENAME}\` to a persistent public HTTPS host.
2. Replace every \`${IMAGE_PLACEHOLDER_URL}\` value in \`${METADATA_TEMPLATE_FILENAME}\` with the final image URL.
3. Save the edited file as \`sata-metadata.json\` on the same reviewed host or another persistent HTTPS host.
4. Set \`NEXT_PUBLIC_SATA_IMAGE_URI\` to the final image URL.
5. Set \`NEXT_PUBLIC_SATA_METADATA_URI\` to the final metadata JSON URL, for example \`${METADATA_PLACEHOLDER_URL}\`.
6. Do not use localhost, temporary links, private buckets, expiring signed URLs, or unreviewed upload services for mainnet.

The metadata intentionally makes no promise of profit, return, utility, or appreciation.
`;

const files = {
  [IMAGE_FILENAME]: image,
  [METADATA_TEMPLATE_FILENAME]: metadataText,
  [README_FILENAME]: readme
};

for (const [filename, content] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, filename), content, 'utf8');
}

const hashes = Object.fromEntries(
  Object.entries(files).map(([filename, content]) => [
    filename,
    createHash('sha256').update(content).digest('hex')
  ])
);
writeFileSync(join(OUT_DIR, HASHES_FILENAME), `${JSON.stringify(hashes, null, 2)}\n`, 'utf8');

console.log(`Prepared SATA mainnet metadata asset pack in ${OUT_DIR}`);
console.log(`Image placeholder URL: ${IMAGE_PLACEHOLDER_URL}`);
console.log(`Metadata placeholder URL: ${METADATA_PLACEHOLDER_URL}`);
