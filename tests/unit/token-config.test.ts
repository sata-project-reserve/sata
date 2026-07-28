import { describe, expect, it } from 'vitest';
import { SATA_DEFAULTS } from '@/lib/solana/constants';
import { buildMetadataJson } from '@/lib/metadata/metadata';
import { validateTokenConfig } from '@/lib/validation/token-config';

describe('token config and metadata', () => {
  it('validates default SATA config', () => {
    const config = validateTokenConfig({
      name: SATA_DEFAULTS.name,
      symbol: SATA_DEFAULTS.symbol,
      description: SATA_DEFAULTS.description,
      decimals: SATA_DEFAULTS.decimals,
      supply: SATA_DEFAULTS.supply,
      imageUri: 'https://example.com/sata.png',
      website: 'https://example.com',
      xUrl: 'https://x.com/sata',
      telegramUrl: 'https://t.me/sata',
      metadataUri: 'https://example.com/sata.json'
    });
    expect(config.rawSupply).toBe(1_000_000_000_000_000_000n);
  });

  it('rejects malformed and duplicate urls', () => {
    expect(() =>
      validateTokenConfig({
        name: 'SATA',
        symbol: 'SATA',
        description: SATA_DEFAULTS.description,
        decimals: 9,
        supply: '1',
        imageUri: 'http://example.com/image.png',
        website: '',
        xUrl: '',
        telegramUrl: '',
        metadataUri: ''
      })
    ).toThrow(/HTTPS/);
  });

  it('builds metadata without return promises', () => {
    const config = validateTokenConfig({
      name: 'SATA',
      symbol: 'SATA',
      description: SATA_DEFAULTS.description,
      decimals: 9,
      supply: '1',
      imageUri: 'https://example.com/sata.webp',
      website: 'https://example.com',
      xUrl: '',
      telegramUrl: '',
      metadataUri: ''
    });
    expect(buildMetadataJson(config, 'devnet')).toMatchObject({
      name: 'SATA',
      symbol: 'SATA',
      image: 'https://example.com/sata.webp'
    });
  });
});
