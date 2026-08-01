export type LiquidityDisclosureInput = {
  totalLockedLpRaw: bigint;
  ownerUnlockedLpRaw: bigint;
  lockProgramVerified: boolean;
};

export type LiquidityDisclosure = {
  status:
    | 'LOCKED_BY_RAYDIUM_BURN_AND_EARN'
    | 'PARTIALLY_LOCKED_OWNER_LP_REMAINS'
    | 'LOCK_REPORTED_NOT_FULLY_VERIFIED'
    | 'UNLOCKED_OWNER_LP_PRESENT'
    | 'LP_LOCK_NOT_VERIFIED';
  removable: boolean;
  detail: string;
};

export function classifyLiquidityDisclosure(input: LiquidityDisclosureInput): LiquidityDisclosure {
  if (input.totalLockedLpRaw > 0n && input.ownerUnlockedLpRaw === 0n && input.lockProgramVerified) {
    return {
      status: 'LOCKED_BY_RAYDIUM_BURN_AND_EARN',
      removable: false,
      detail: 'Raydium Burn & Earn lock verified and no owner unlocked LP balance was detected.'
    };
  }

  if (input.totalLockedLpRaw > 0n && input.ownerUnlockedLpRaw > 0n && input.lockProgramVerified) {
    return {
      status: 'PARTIALLY_LOCKED_OWNER_LP_REMAINS',
      removable: true,
      detail:
        'Raydium Burn & Earn lock verified, but the owner still holds unlocked LP tokens that remain removable unless separately locked or burned.'
    };
  }

  if (input.totalLockedLpRaw > 0n) {
    return {
      status: 'LOCK_REPORTED_NOT_FULLY_VERIFIED',
      removable: input.ownerUnlockedLpRaw > 0n,
      detail:
        'A locked LP balance was detected, but one or more Raydium lock verification checks failed.'
    };
  }

  return {
    status: input.ownerUnlockedLpRaw > 0n ? 'UNLOCKED_OWNER_LP_PRESENT' : 'LP_LOCK_NOT_VERIFIED',
    removable: input.ownerUnlockedLpRaw > 0n,
    detail:
      input.ownerUnlockedLpRaw > 0n
        ? 'Owner LP tokens are present and removable.'
        : 'No Raydium Burn & Earn lock was verified in the scanned transaction window.'
  };
}

export function publicationCadenceLabel(hours: number): string {
  if (!Number.isInteger(hours) || hours <= 0 || hours > 24) {
    throw new Error('Publication cadence must be a positive whole number of hours, up to 24.');
  }
  return hours === 24 ? 'daily' : `every ${hours} hours`;
}

export function assertNoSensitiveReportFields(report: unknown): void {
  const forbidden = [
    'seed',
    'seedphrase',
    'secretrecoveryphrase',
    'privatekey',
    'secretkey',
    'keypair',
    'signedtransactionbytes',
    'rawtransactionbytes'
  ];
  walkReport(report, [], (path) => {
    const normalized = path.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = forbidden.find((term) => normalized.includes(term));
    if (hit) {
      throw new Error(`Transparency report contains a forbidden sensitive field: ${path}`);
    }
  });
}

function walkReport(value: unknown, path: string[], visitKey: (path: string) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkReport(item, [...path, String(index)], visitKey);
    });
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const next = [...path, key];
    visitKey(next.join('.'));
    walkReport(child, next, visitKey);
  });
}
