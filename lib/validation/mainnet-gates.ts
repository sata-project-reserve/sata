export type MainnetGateState = {
  unitTests: boolean;
  integrationTests: boolean;
  build: boolean;
  lint: boolean;
  typecheck: boolean;
  devnetE2eLaunch: boolean;
  onChainVerification: boolean;
  authorityRevocationAcknowledged: boolean;
  noLiquidityValueAcknowledged: boolean;
  spendingCapConfirmed: boolean;
  confirmationPhrase: string;
};

export const MAINNET_CONFIRMATION_PHRASE = 'LAUNCH SATA ON MAINNET';

export function mainnetGateFailures(state: MainnetGateState): string[] {
  const failures: string[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (key === 'confirmationPhrase') continue;
    if (value !== true) failures.push(key);
  }
  if (state.confirmationPhrase !== MAINNET_CONFIRMATION_PHRASE) {
    failures.push('confirmationPhrase');
  }
  return failures;
}

export function assertMainnetUnlocked(state: MainnetGateState): void {
  const failures = mainnetGateFailures(state);
  if (failures.length > 0) {
    throw new Error(`Mainnet is locked. Failing gates: ${failures.join(', ')}`);
  }
}
