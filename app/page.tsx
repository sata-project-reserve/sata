import { Dashboard } from '@/components/Dashboard';
import { parseAppConfig, sanitizeRpcHost } from '@/lib/validation/config';

export default function Home() {
  const config = parseAppConfig(process.env);
  const rpcUrl =
    config.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta'
      ? config.NEXT_PUBLIC_MAINNET_RPC_URL
      : config.NEXT_PUBLIC_SOLANA_CLUSTER === 'testnet'
        ? config.NEXT_PUBLIC_TESTNET_RPC_URL
        : config.NEXT_PUBLIC_DEVNET_RPC_URL;

  return (
    <Dashboard
      appMode={config.NEXT_PUBLIC_APP_MODE}
      cluster={config.NEXT_PUBLIC_SOLANA_CLUSTER}
      rpcUrl={rpcUrl}
      rpcHost={sanitizeRpcHost(rpcUrl)}
      mainnetUnlocked={config.mainnetUnlocked}
      mainnetGateFailures={config.mainnetGateFailures}
      liquidityPlannerEnabled={config.liquidityPlannerEnabled}
      raydiumPoolCreationEnabled={config.raydiumPoolCreationEnabled}
      defaultImageUri={config.NEXT_PUBLIC_SATA_IMAGE_URI}
      defaultMetadataUri={config.NEXT_PUBLIC_SATA_METADATA_URI}
      defaultBudgetSol={config.NEXT_PUBLIC_DEFAULT_MAX_SOL_BUDGET}
      defaultReserveSol={config.NEXT_PUBLIC_DEFAULT_MIN_SOL_RESERVE}
      defaultLiquiditySata={config.NEXT_PUBLIC_DEFAULT_LIQUIDITY_SATA}
      defaultLiquiditySol={config.NEXT_PUBLIC_DEFAULT_LIQUIDITY_SOL}
    />
  );
}
