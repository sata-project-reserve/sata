import { z } from 'zod';
import { parseHumanAmountToBaseUnits } from './amounts';

export const tokenConfigSchema = z.object({
  name: z.string().trim().min(1).max(32),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Symbol should use uppercase letters and numbers.'),
  description: z.string().trim().min(20).max(500),
  decimals: z.coerce.number().int().min(0).max(9),
  supply: z.string().trim().min(1),
  imageUri: z.string().trim().optional().default(''),
  website: z.string().trim().optional().default(''),
  xUrl: z.string().trim().optional().default(''),
  telegramUrl: z.string().trim().optional().default(''),
  metadataUri: z.string().trim().optional().default('')
});

export type TokenConfigInput = {
  name: string;
  symbol: string;
  description: string;
  decimals: number;
  supply: string;
  imageUri: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  metadataUri: string;
};

export type ValidatedTokenConfig = z.output<typeof tokenConfigSchema> & {
  rawSupply: bigint;
  humanSupply: string;
};

function validateOptionalUrl(value: string, label: string): void {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const isLocalDevnetUrl =
    url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !isLocalDevnetUrl) {
    throw new Error(`${label} must use HTTPS, except localhost devnet-only metadata assets.`);
  }
}

export function validateTokenConfig(input: TokenConfigInput): ValidatedTokenConfig {
  const parsed = tokenConfigSchema.parse(input);
  const amount = parseHumanAmountToBaseUnits(parsed.supply, parsed.decimals);

  validateOptionalUrl(parsed.imageUri, 'Image URI');
  validateOptionalUrl(parsed.website, 'Website');
  validateOptionalUrl(parsed.xUrl, 'X/social URL');
  validateOptionalUrl(parsed.telegramUrl, 'Telegram URL');
  validateOptionalUrl(parsed.metadataUri, 'Metadata URI');

  const suspiciousDuplicates = [parsed.website, parsed.xUrl, parsed.telegramUrl].filter(Boolean);
  if (new Set(suspiciousDuplicates).size !== suspiciousDuplicates.length) {
    throw new Error('Website, X/social URL, and Telegram URL should not be duplicates.');
  }

  if (/(guaranteed\s+(profit|return)|risk[- ]?free|100x|\bmoon\b|\bprofit\s+guaranteed\b)/i.test(parsed.description)) {
    throw new Error('Description contains promotional or return-implying language.');
  }

  return {
    ...parsed,
    rawSupply: amount.raw,
    humanSupply: amount.human
  };
}
