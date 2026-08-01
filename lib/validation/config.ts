import { z } from 'zod';
import {
  assertMainnetUnlocked,
  mainnetGateFailures,
  type MainnetGateState
} from './mainnet-gates';

export const appModeSchema = z.enum(['readonly', 'devnet', 'mainnet']);

export const envSchema = z.object({
  NEXT_PUBLIC_APP_MODE: appModeSchema.default('devnet'),
  NEXT_PUBLIC_SOLANA_CLUSTER: z.enum(['devnet', 'testnet', 'mainnet-beta']).default('devnet'),
  NEXT_PUBLIC_DEVNET_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  NEXT_PUBLIC_TESTNET_RPC_URL: z.string().url().default('https://api.testnet.solana.com'),
  NEXT_PUBLIC_MAINNET_RPC_URL: z.string().optional().default(''),
  MAINNET_ENABLED: z.enum(['true', 'false']).default('false'),
  MAINNET_UNIT_TESTS_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_INTEGRATION_TESTS_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_BUILD_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_LINT_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_TYPECHECK_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_DEVNET_E2E_LAUNCH_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_ON_CHAIN_VERIFICATION_PASSED: z.enum(['true', 'false']).default('false'),
  MAINNET_AUTHORITY_REVOCATION_ACKNOWLEDGED: z.enum(['true', 'false']).default('false'),
  MAINNET_NO_LIQUIDITY_VALUE_ACKNOWLEDGED: z.enum(['true', 'false']).default('false'),
  MAINNET_SPENDING_CAP_CONFIRMED: z.enum(['true', 'false']).default('false'),
  MAINNET_CONFIRMATION_PHRASE: z.string().default(''),
  NEXT_PUBLIC_LIQUIDITY_PLANNER_ENABLED: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_RAYDIUM_POOL_CREATION_ENABLED: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_DEFAULT_MAX_SOL_BUDGET: z.string().default('0.25'),
  NEXT_PUBLIC_DEFAULT_MIN_SOL_RESERVE: z.string().default('0.05'),
  NEXT_PUBLIC_DEFAULT_LIQUIDITY_SATA: z.string().default('100000000'),
  NEXT_PUBLIC_DEFAULT_LIQUIDITY_SOL: z.string().default('1'),
  NEXT_PUBLIC_SATA_IMAGE_URI: z.string().url().optional().or(z.literal('')).default(''),
  NEXT_PUBLIC_SATA_METADATA_URI: z.string().url().optional().or(z.literal('')).default(''),
  GMGN_API_BASE_URL: z.string().url().optional().or(z.literal('')).default(''),
  GMGN_API_KEY: z.string().optional().default('')
});

export type AppConfig = z.infer<typeof envSchema> & {
  mainnetUnlocked: boolean;
  mainnetGateFailures: string[];
  liquidityPlannerEnabled: boolean;
  raydiumPoolCreationEnabled: boolean;
};

export function parseAppConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.parse(env);
  const gateState = buildMainnetGateState(parsed);
  const failures = mainnetGateFailures(gateState);
  if (parsed.NEXT_PUBLIC_APP_MODE === 'mainnet') {
    if (parsed.MAINNET_ENABLED !== 'true') {
      throw new Error('Mainnet mode is locked because MAINNET_ENABLED is not true.');
    }
    if (!parsed.NEXT_PUBLIC_MAINNET_RPC_URL) {
      throw new Error('Mainnet mode requires NEXT_PUBLIC_MAINNET_RPC_URL.');
    }
    requireHttpsAssetUrl(parsed.NEXT_PUBLIC_SATA_IMAGE_URI, 'NEXT_PUBLIC_SATA_IMAGE_URI');
    requireHttpsAssetUrl(parsed.NEXT_PUBLIC_SATA_METADATA_URI, 'NEXT_PUBLIC_SATA_METADATA_URI');
    assertMainnetUnlocked(gateState);
  }

  const mainnetUnlocked =
    parsed.NEXT_PUBLIC_APP_MODE === 'mainnet' &&
    parsed.MAINNET_ENABLED === 'true' &&
    failures.length === 0;

  return {
    ...parsed,
    mainnetUnlocked,
    mainnetGateFailures: failures,
    liquidityPlannerEnabled: parsed.NEXT_PUBLIC_LIQUIDITY_PLANNER_ENABLED === 'true',
    raydiumPoolCreationEnabled:
      parsed.NEXT_PUBLIC_RAYDIUM_POOL_CREATION_ENABLED === 'true' &&
      parsed.NEXT_PUBLIC_APP_MODE === 'mainnet' &&
      mainnetUnlocked
  };
}

function requireHttpsAssetUrl(value: string, name: string): void {
  if (!value) {
    throw new Error(`Mainnet mode requires ${name}.`);
  }
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`Mainnet mode requires ${name} to use HTTPS.`);
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    throw new Error(`Mainnet mode requires ${name} to be hosted publicly, not localhost.`);
  }
}

export function sanitizeRpcHost(rpcUrl: string): string {
  try {
    const url = new URL(rpcUrl);
    return url.host;
  } catch {
    return 'invalid-rpc-url';
  }
}

function buildMainnetGateState(parsed: z.output<typeof envSchema>): MainnetGateState {
  return {
    unitTests: parsed.MAINNET_UNIT_TESTS_PASSED === 'true',
    integrationTests: parsed.MAINNET_INTEGRATION_TESTS_PASSED === 'true',
    build: parsed.MAINNET_BUILD_PASSED === 'true',
    lint: parsed.MAINNET_LINT_PASSED === 'true',
    typecheck: parsed.MAINNET_TYPECHECK_PASSED === 'true',
    devnetE2eLaunch: parsed.MAINNET_DEVNET_E2E_LAUNCH_PASSED === 'true',
    onChainVerification: parsed.MAINNET_ON_CHAIN_VERIFICATION_PASSED === 'true',
    authorityRevocationAcknowledged:
      parsed.MAINNET_AUTHORITY_REVOCATION_ACKNOWLEDGED === 'true',
    noLiquidityValueAcknowledged:
      parsed.MAINNET_NO_LIQUIDITY_VALUE_ACKNOWLEDGED === 'true',
    spendingCapConfirmed: parsed.MAINNET_SPENDING_CAP_CONFIRMED === 'true',
    confirmationPhrase: parsed.MAINNET_CONFIRMATION_PHRASE
  };
}
