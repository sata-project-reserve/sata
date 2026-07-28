import type { ValidatedTokenConfig } from '@/lib/validation/token-config';

export type TokenMetadataJson = {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes: Array<{ trait_type: string; value: string }>;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    category?: string;
  };
};

export function buildMetadataJson(config: ValidatedTokenConfig, network: string): TokenMetadataJson {
  const metadata: TokenMetadataJson = {
    name: config.name,
    symbol: config.symbol,
    description: config.description,
    attributes: [
      { trait_type: 'network', value: network },
      { trait_type: 'project_type', value: 'community experimental token' }
    ]
  };

  if (config.imageUri) {
    metadata.image = config.imageUri;
    metadata.properties = {
      category: 'image',
      files: [{ uri: config.imageUri, type: inferImageMimeType(config.imageUri) }]
    };
  }

  if (config.website) {
    metadata.external_url = config.website;
  }

  return metadata;
}

export function validateMetadataUri(uri: string): void {
  if (!uri) {
    throw new Error('Metadata URI is required before token metadata can be created.');
  }
  const parsed = new URL(uri);
  if (parsed.protocol !== 'https:') {
    throw new Error('Metadata URI must use HTTPS.');
  }
}

function inferImageMimeType(uri: string): string {
  const path = new URL(uri).pathname.toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/*';
}
