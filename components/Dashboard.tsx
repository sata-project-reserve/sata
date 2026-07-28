'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ShieldCheck, Wallet, FileJson, Coins, LockKeyhole, ChartCandlestick } from 'lucide-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  LAMPORTS_PER_SOL_BIGINT,
  SATA_DEFAULTS,
  PROGRAM_IDS,
  SUPPORTED_SOLANA_CHAINS
} from '@/lib/solana/constants';
import { buildMetadataJson } from '@/lib/metadata/metadata';
import { buildLaunchManifest, buildLaunchReport } from '@/lib/manifest/manifest';
import { buildLiquidityPlan, buildPoolCreationPreview } from '@/lib/liquidity-planner/planner';
import { evaluateMarketReadiness } from '@/lib/market-readiness/checks';
import { buildGmgnTokenReference } from '@/lib/market-readiness/gmgn';
import { createConnection, inspectWallet } from '@/lib/solana/client';
import { buildRevokeAuthorityTransaction, fetchAuthorityState, type AuthorityState } from '@/lib/solana/authority';
import { planTokenLaunch, type TokenLaunchPlan } from '@/lib/solana/token-workflow';
import { verifyMintSupply, type VerificationResult } from '@/lib/solana/verification';
import { executeWalletTransaction, type StandardWalletHandle } from '@/lib/wallet/execute';
import { connectMetaMaskSolana } from '@/lib/wallet/metamask-solana';
import { validateTokenConfig, type TokenConfigInput } from '@/lib/validation/token-config';
import { parseHumanAmountToBaseUnits } from '@/lib/validation/amounts';
import { enforceSpendingControls, shouldWarnHighValueWallet } from '@/lib/security/spending';
import { validateTransactionPreview, type TransactionPreview } from '@/lib/security/transaction-preview';

type DashboardProps = {
  appMode: 'readonly' | 'devnet' | 'mainnet';
  cluster: 'devnet' | 'testnet' | 'mainnet-beta';
  rpcUrl: string;
  rpcHost: string;
  mainnetUnlocked: boolean;
  mainnetGateFailures: string[];
  liquidityPlannerEnabled: boolean;
  raydiumPoolCreationEnabled: boolean;
  defaultImageUri: string;
  defaultMetadataUri: string;
};

const steps = [
  'Connect and inspect',
  'Configure token',
  'Metadata asset',
  'Transaction preview',
  'Create token',
  'Authority management',
  'Verification report',
  'Liquidity planner',
  'Market readiness'
] as const;

const DEVNET_AIRDROP_AMOUNTS_LAMPORTS = [
  LAMPORTS_PER_SOL,
  Math.floor(LAMPORTS_PER_SOL / 2),
  Math.floor(LAMPORTS_PER_SOL / 10),
  Math.floor(LAMPORTS_PER_SOL / 20)
] as const;
const DEVNET_MINIMUM_TOP_UP_LAMPORTS = LAMPORTS_PER_SOL_BIGINT / 10n;
const SOLANA_DEVNET_FAUCET_URL = 'https://faucet.solana.com/';
const SOLANA_DEVNET_FAUCET_GUIDE_URL =
  'https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets';

export function Dashboard(props: DashboardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [connectedAddress, setConnectedAddress] = useState('');
  const [balanceSol, setBalanceSol] = useState('0');
  const [budgetSol, setBudgetSol] = useState('0.25');
  const [reserveSol, setReserveSol] = useState('0.05');
  const [tokenInput, setTokenInput] = useState<TokenConfigInput>({
    name: SATA_DEFAULTS.name,
    symbol: SATA_DEFAULTS.symbol,
    description: SATA_DEFAULTS.description,
    decimals: SATA_DEFAULTS.decimals,
    supply: SATA_DEFAULTS.supply,
    imageUri: props.defaultImageUri || SATA_DEFAULTS.imageUri,
    website: SATA_DEFAULTS.website,
    xUrl: SATA_DEFAULTS.xUrl,
    telegramUrl: SATA_DEFAULTS.telegramUrl,
    metadataUri: props.defaultMetadataUri || SATA_DEFAULTS.metadataUri
  });
  const [typedMint, setTypedMint] = useState('');
  const [poolPhrase, setPoolPhrase] = useState('');
  const [walletHandle, setWalletHandle] = useState<StandardWalletHandle | null>(null);
  const [launchPlan, setLaunchPlan] = useState<TokenLaunchPlan | null>(null);
  const [activeTxIndex, setActiveTxIndex] = useState(0);
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [authorityState, setAuthorityState] = useState<AuthorityState | null>(null);
  const [authorityPreview, setAuthorityPreview] = useState<TransactionPreview | null>(null);
  const [authorityKind, setAuthorityKind] = useState<'mint' | 'freeze' | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (args[0] === 'Sender: Failed to send batch') return;
      if (
        typeof args[0] === 'string' &&
        args[0].startsWith('Server responded with 429. Retrying after')
      ) {
        return;
      }
      originalConsoleError(...args);
    };
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  const validation = useMemo(() => {
    try {
      return { ok: true as const, config: validateTokenConfig(tokenInput), error: '' };
    } catch (error) {
      return { ok: false as const, config: null, error: (error as Error).message };
    }
  }, [tokenInput]);

  const metadata = validation.ok
    ? buildMetadataJson(validation.config, props.cluster)
    : null;
  const usesDevnetPlaceholderUrls = [
    tokenInput.imageUri,
    tokenInput.metadataUri
  ].some((url) => url.includes('127.0.0.1') || url.includes('localhost'));
  const blocksMainnetPlaceholder = props.cluster === 'mainnet-beta' && usesDevnetPlaceholderUrls;

  const preview: TransactionPreview | null =
    validation.ok && connectedAddress
      ? {
          purpose: 'Create SATA mint, owner ATA, fixed supply, and metadata through separate owner-approved transactions',
          network: props.cluster,
          feePayer: connectedAddress,
          programIds: [
            PROGRAM_IDS.system,
            PROGRAM_IDS.splToken,
            PROGRAM_IDS.associatedToken,
            PROGRAM_IDS.metaplexTokenMetadata
          ],
          newAccounts: ['mint account', 'owner associated token account', 'metadata PDA'],
          tokenAmount: validation.config.rawSupply.toString(),
          mintAuthority: connectedAddress,
          freezeAuthority: connectedAddress,
          metadataUpdateAuthority: connectedAddress,
          estimatedNetworkFeeLamports: 15000n,
          estimatedRentLamports: 3500000n,
          maxSpendLamports: 4000000n,
          reversible: false,
          permanent: false,
          warnings: ['Creation is split into explicit transactions; retries must verify on-chain state first.']
        }
      : null;

  const spendingState = useMemo(() => {
    try {
      const balance = parseHumanAmountToBaseUnits(balanceSol, 9).raw;
      const budget = parseHumanAmountToBaseUnits(budgetSol, 9).raw;
      const reserve = parseHumanAmountToBaseUnits(reserveSol, 9).raw;
      enforceSpendingControls({
        balanceLamports: balance,
        estimatedLamports: preview?.maxSpendLamports ?? 0n,
        cumulativeLamports: 0n,
        maxBudgetLamports: budget,
        reserveLamports: reserve
      });
      return {
        ok: true,
        message: shouldWarnHighValueWallet(balance, preview?.maxSpendLamports ?? 1n)
          ? 'Wallet balance is substantially higher than needed; consider a dedicated launch wallet.'
          : 'Spending controls pass for the current estimate.'
      };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }, [balanceSol, budgetSol, reserveSol, preview]);

  const liquidity = useMemo(() => {
    if (!validation.ok) return null;
    try {
      const sataAmount = validation.config.rawSupply / 10n;
      const solAmount = parseHumanAmountToBaseUnits('1', 9).raw;
      const plan = buildLiquidityPlan({
        sataMint: typedMint || 'pending-mint-address',
        quoteMint: PROGRAM_IDS.wsolMint,
        sataRawAmount: sataAmount,
        solLamports: solAmount,
        totalSataRawSupply: validation.config.rawSupply,
        feeConfigIndex: 0,
        poolOpenTimeUnix: 0n,
        maxSolBudgetLamports: parseHumanAmountToBaseUnits(budgetSol, 9).raw,
        minSolReserveLamports: parseHumanAmountToBaseUnits(reserveSol, 9).raw,
        maxAcceptablePriceImpactBps: 100n
      });
      return buildPoolCreationPreview(plan, props.raydiumPoolCreationEnabled);
    } catch {
      return null;
    }
  }, [budgetSol, props.raydiumPoolCreationEnabled, reserveSol, typedMint, validation]);

  const defaultReadinessChecks = evaluateMarketReadiness({
    mintExists: false,
    expectedTokenProgram: PROGRAM_IDS.splToken,
    actualTokenProgram: 'not checked',
    metadataResolved: false,
    supplyMatchesManifest: false,
    mintAuthorityMatchesManifest: false,
    freezeAuthorityMatchesManifest: false,
    poolExists: false,
    sataReserveRaw: 0n,
    wsolReserveLamports: 0n,
    poolOpen: false,
    poolProgramId: PROGRAM_IDS.raydiumCpmmMainnet,
    buyQuoteAvailable: false,
    sellQuoteAvailable: false,
    simulatedBuySucceeded: false,
    simulatedSellSucceeded: false,
    ordinarySellRestrictionAbsent: false,
    liquidityNotRemoved: false,
    independentMarketDataFound: false,
    manifestContainsPoolAndMint: false
  }).map((check) => ({ name: check.id, ok: check.ok, detail: check.detail }));

  const manifestVerificationChecks =
    verificationChecks.length > 0 ? verificationChecks : defaultReadinessChecks;
  const tokenCreatedVerified =
    launchPlan !== null &&
    launchPlan.transactions.every((item) => signatures[item.label]) &&
    verificationChecks.length > 0 &&
    verificationChecks.every((check) => check.ok);

  const manifest = validation.ok
    ? buildLaunchManifest({
        status: tokenCreatedVerified ? 'TOKEN_CREATED' : 'VERIFICATION_INCOMPLETE',
        network: props.cluster,
        rpcHost: props.rpcHost,
        ownerPublicAddress: connectedAddress || 'not connected',
        mintAddress: launchPlan?.mint.publicKey.toBase58(),
        metadataAddress: launchPlan?.metadata.toBase58(),
        associatedTokenAccount: launchPlan?.ata.toBase58(),
        name: validation.config.name,
        symbol: validation.config.symbol,
        decimals: validation.config.decimals,
        humanSupply: validation.config.humanSupply,
        rawSupply: validation.config.rawSupply.toString(),
        mintAuthorityStatus: 'owner until explicitly revoked',
        freezeAuthorityStatus: 'owner until explicitly revoked',
        transactionSignatures: signatures,
        explorerLinks: {},
        applicationCommitHash: 'not-a-git-repository',
        dependencyVersions: {
          next: '16.2.10',
          react: '19.2.7',
          solanaWeb3: '1.98.4',
          splToken: '0.4.15',
          raydiumSdk: '0.2.59-alpha'
        },
        verificationChecks: manifestVerificationChecks,
        gmgn: {
          indexingStatus: 'not checked',
          buyRouteStatus: 'not checked',
          sellRouteStatus: 'not checked',
        tokenPageReference: typedMint ? buildGmgnTokenReference(typedMint) : 'pending mint'
        }
      })
    : null;

  async function connectWallet() {
    setBusy(true);
    setStatusMessage('Opening MetaMask Connect for Solana...');
    try {
      const chain = SUPPORTED_SOLANA_CHAINS[props.cluster];
      const connection = createConnection(props.rpcUrl);
      const wallet = await connectMetaMaskSolana(chain, props.rpcUrl);
      const inspection = await inspectWallet(connection, wallet.address, props.cluster, props.rpcUrl);
      setWalletHandle({
        wallet: wallet.wallet,
        account: wallet.account,
        chain
      });
      setConnectedAddress(inspection.address);
      setBalanceSol((Number(inspection.balanceLamports) / 1_000_000_000).toString());
      setStatusMessage('MetaMask Solana account connected and inspected.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshConnectedBalance() {
    if (!connectedAddress) return;
    setBusy(true);
    setStatusMessage('Refreshing connected Solana account balance...');
    try {
      const connection = createConnection(props.rpcUrl);
      const balanceLamports = await fetchAndSetBalance(
        connection,
        new PublicKey(connectedAddress),
        setBalanceSol
      );
      setStatusMessage(`Balance refreshed: ${formatLamportsAsSol(balanceLamports)} SOL.`);
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestDevnetFunding() {
    if (!connectedAddress || props.cluster !== 'devnet') return;
    setBusy(true);
    try {
      const connection = createConnection(props.rpcUrl);
      const owner = new PublicKey(connectedAddress);
      const reserveLamports = parseHumanAmountToBaseUnits(reserveSol, 9).raw;
      const requiredLamports = reserveLamports + DEVNET_MINIMUM_TOP_UP_LAMPORTS;
      const balanceLamports = await requestBestEffortDevnetAirdrop({
        connection,
        owner,
        requiredLamports,
        onStatus: setStatusMessage,
        onBalanceSol: setBalanceSol
      });
      setStatusMessage(`Devnet funding check passed. Current balance: ${formatLamportsAsSol(balanceLamports)} SOL.`);
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyConnectedAddress() {
    if (!connectedAddress) return;
    try {
      await navigator.clipboard.writeText(connectedAddress);
      setStatusMessage('Connected Solana address copied. Use it only for public address funding, never for secrets.');
    } catch {
      setStatusMessage(`Copy failed. Select this public address manually: ${connectedAddress}`);
    }
  }

  async function prepareLaunchPlan() {
    if (!validation.ok || !connectedAddress) return;
    setBusy(true);
    setStatusMessage('Preparing token launch transactions...');
    try {
      const connection = createConnection(props.rpcUrl);
      const plan = await planTokenLaunch({
        connection,
        owner: new PublicKey(connectedAddress),
        tokenConfig: validation.config,
        metadataUri: validation.config.metadataUri,
        network: props.cluster
      });
      setLaunchPlan(plan);
      setActiveTxIndex(0);
      setSignatures({});
      setVerificationChecks([]);
      setTypedMint(plan.mint.publicKey.toBase58());
      setStatusMessage('Launch plan prepared. Review each transaction before requesting MetaMask approval.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approveCurrentLaunchTransaction() {
    if (!walletHandle || !launchPlan) return;
    const item = launchPlan.transactions[activeTxIndex];
    if (!item) return;
    setBusy(true);
    setStatusMessage(`Requesting MetaMask approval for ${item.label}...`);
    try {
      const connection = createConnection(props.rpcUrl);
      const owner = new PublicKey(connectedAddress);
      await ensureFreshTransactionBudget({
        connection,
        owner,
        preview: item.preview,
        reserveSol,
        cluster: props.cluster,
        onStatus: setStatusMessage,
        onBalanceSol: setBalanceSol
      });
      const latest = await connection.getLatestBlockhash('confirmed');
      refreshLaunchTxForSigning(launchPlan, item, owner, latest.blockhash);
      const signature = await executeWalletTransaction(walletHandle, item.transaction);
      await confirmLaunchTransactionOrDetectProgress({
        connection,
        plan: launchPlan,
        item,
        signature,
        latestBlockhash: latest,
        expectedSupply: validation.ok ? validation.config.rawSupply : 0n
      });
      const nextSignatures = { ...signatures, [item.label]: signature };
      setSignatures(nextSignatures);
      const completion = await detectLaunchCompletion(connection, launchPlan, validation.ok ? validation.config.rawSupply : 0n);
      const firstIncompleteIndex = launchPlan.transactions.findIndex((transactionItem) => !completion[transactionItem.label]);
      const nextIndex =
        firstIncompleteIndex === -1
          ? launchPlan.transactions.length
          : Math.max(activeTxIndex + 1, firstIncompleteIndex);
      setActiveTxIndex(nextIndex);
      if (nextIndex >= launchPlan.transactions.length) {
        setStatusMessage(`${item.label} confirmed. Running on-chain verification...`);
        await runPostLaunchVerification(connection, launchPlan, nextSignatures);
      } else {
        setStatusMessage(`${item.label} confirmed. Next owner approval: ${launchPlan.transactions[nextIndex]?.label}.`);
      }
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function prepareAuthorityRevocation(kind: 'mint' | 'freeze') {
    if (!connectedAddress || !typedMint) return;
    setBusy(true);
    setStatusMessage(`Preparing ${kind} authority revocation...`);
    try {
      const connection = createConnection(props.rpcUrl);
      const mint = new PublicKey(typedMint);
      const current = await fetchAuthorityState(connection, mint);
      const { preview } = buildRevokeAuthorityTransaction({
        owner: new PublicKey(connectedAddress),
        mint,
        authorityType: kind,
        typedMintAddress: typedMint,
        network: props.cluster
      });
      setAuthorityState(current);
      setAuthorityPreview(preview);
      setAuthorityKind(kind);
      setStatusMessage('Authority preview prepared. Review it before requesting MetaMask approval.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approveAuthorityRevocation() {
    if (!walletHandle || !authorityKind || !typedMint || !connectedAddress) return;
    setBusy(true);
    setStatusMessage(`Requesting MetaMask approval for ${authorityKind} authority revocation...`);
    try {
      const connection = createConnection(props.rpcUrl);
      const mint = new PublicKey(typedMint);
      const latest = await connection.getLatestBlockhash('confirmed');
      const { transaction } = buildRevokeAuthorityTransaction({
        owner: new PublicKey(connectedAddress),
        mint,
        authorityType: authorityKind,
        typedMintAddress: typedMint,
        network: props.cluster
      });
      transaction.recentBlockhash = latest.blockhash;
      const signature = await executeWalletTransaction(walletHandle, transaction);
      await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
      const current = await fetchAuthorityState(connection, mint);
      setAuthorityState(current);
      setSignatures((existing) => ({ ...existing, [`revoke-${authorityKind}-authority`]: signature }));
      setStatusMessage(`${authorityKind} authority revocation confirmed: ${signature}`);
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function fillSataDevnetDefaults() {
    setTokenInput({
      name: SATA_DEFAULTS.name,
      symbol: SATA_DEFAULTS.symbol,
      description: SATA_DEFAULTS.description,
      decimals: SATA_DEFAULTS.decimals,
      supply: SATA_DEFAULTS.supply,
      imageUri: SATA_DEFAULTS.imageUri,
      website: SATA_DEFAULTS.website,
      xUrl: SATA_DEFAULTS.xUrl,
      telegramUrl: SATA_DEFAULTS.telegramUrl,
      metadataUri: SATA_DEFAULTS.metadataUri
    });
  }

  async function runPostLaunchVerification(
    connection: ReturnType<typeof createConnection>,
    plan: TokenLaunchPlan,
    completedSignatures: Record<string, string>
  ) {
    if (!validation.ok || !connectedAddress) return;
    const checks = await verifyMintSupply({
      connection,
      mint: plan.mint.publicKey.toBase58(),
      ata: plan.ata.toBase58(),
      expectedDecimals: validation.config.decimals,
      expectedSupply: validation.config.rawSupply,
      expectedOwner: connectedAddress
    });
    const metadataInfo = await connection.getAccountInfo(plan.metadata, 'confirmed');
    const allChecks = [
      ...checks,
      {
        name: 'metadata-account',
        ok: metadataInfo !== null,
        detail: metadataInfo ? plan.metadata.toBase58() : 'metadata account not found'
      },
      {
        name: 'all-token-creation-signatures',
        ok: plan.transactions.every((item) => completedSignatures[item.label]),
        detail: Object.keys(completedSignatures).join(', ')
      }
    ];
    setVerificationChecks(allChecks);
    setStatusMessage(
      allChecks.every((check) => check.ok)
        ? 'Token creation verified on-chain. Manifest and report are ready in Verification report.'
        : 'Verification finished with failures. Review the Verification report before retrying anything.'
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <h1>SATA Token Launcher</h1>
            <span>Owner-operated Solana launch dashboard</span>
          </div>
          <div className="chip-row">
            <span className="chip">Mode: {props.appMode}</span>
            <span className="chip">Cluster: {props.cluster}</span>
            <span className="chip">RPC: {props.rpcHost}</span>
            <span className="chip">Mainnet: {props.mainnetUnlocked ? 'unlocked' : 'locked'}</span>
            <span className="chip">Mainnet blockers: {props.mainnetGateFailures.length}</span>
          </div>
        </div>
      </header>
      <main className="main">
        <nav className="steps" aria-label="Launch steps">
          {steps.map((step, index) => (
            <button
              className={`step-button ${index === activeStep ? 'active' : ''}`}
              key={step}
              type="button"
              onClick={() => setActiveStep(index)}
            >
              <span>{step}</span>
              <span>{index + 1}</span>
            </button>
          ))}
        </nav>

        <section className="panel">
          {activeStep === 0 && (
            <>
              <h2><Wallet size={20} /> Connect and inspect</h2>
              <div className="notice safe">
                Signing must occur inside MetaMask. This app never asks for a seed phrase, private
                key, or exported wallet credential.
              </div>
              <div className="grid">
                <label>
                  Connected Solana public address
                  <input
                    value={connectedAddress}
                    onChange={(event) => setConnectedAddress(event.target.value)}
                    placeholder="Connect MetaMask or paste a devnet address for local planning"
                  />
                </label>
                <label>
                  SOL balance for spending checks
                  <input value={balanceSol} onChange={(event) => setBalanceSol(event.target.value)} />
                </label>
                <label>
                  Maximum SOL budget
                  <input value={budgetSol} onChange={(event) => setBudgetSol(event.target.value)} />
                </label>
                <label>
                  Minimum SOL reserve
                  <input value={reserveSol} onChange={(event) => setReserveSol(event.target.value)} />
                </label>
              </div>
              <div className={`notice ${spendingState.ok ? 'safe' : 'danger'}`}>
                {spendingState.message}
              </div>
              <button disabled={busy || props.appMode === 'readonly'} type="button" onClick={() => void connectWallet()}>
                Connect MetaMask Solana
              </button>
              {statusMessage && <div className="notice">{statusMessage}</div>}
            </>
          )}

          {activeStep === 1 && (
            <>
              <h2><Coins size={20} /> Configure token</h2>
              <button className="secondary" type="button" onClick={fillSataDevnetDefaults}>
                Fill SATA devnet defaults
              </button>
              <TokenForm value={tokenInput} onChange={setTokenInput} />
              <div className={`notice ${validation.ok ? 'safe' : 'danger'}`}>
                {validation.ok
                  ? `Base-unit supply: ${validation.config.rawSupply.toString()}`
                  : validation.error}
              </div>
              {usesDevnetPlaceholderUrls && (
                <div className="notice">
                  The default SATA image and metadata are served locally for devnet testing.
                  Replace both local URLs with persistent HTTPS assets before mainnet.
                </div>
              )}
            </>
          )}

          {activeStep === 2 && (
            <>
              <h2><FileJson size={20} /> Metadata asset</h2>
              <div className="notice">
                Use an already hosted HTTPS metadata URI, or generate this JSON locally and upload
                the image and JSON to a persistent public host before mainnet launch.
              </div>
              <pre className="preview">{JSON.stringify(metadata, null, 2)}</pre>
            </>
          )}

          {activeStep === 3 && (
            <>
              <h2><ShieldCheck size={20} /> Transaction preview</h2>
              {preview ? (
                <>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => validateTransactionPreview(preview)}
                  >
                    Validate preview
                  </button>
                  <pre className="preview">{stringifyBigint(preview)}</pre>
                </>
              ) : (
                <div className="notice danger">Connect an owner address and provide valid token inputs.</div>
              )}
            </>
          )}

          {activeStep === 4 && (
            <>
              <h2>Create token</h2>
              <div className="notice">
                Transaction execution is owner-operated. The app prepares the transaction set and
                stops before each MetaMask signature request.
              </div>
              <div className="notice safe">
                If MetaMask shows a disabled Confirm button, wait for the request to finish loading,
                scroll the wallet panel to the bottom, and confirm that this same account has enough
                devnet SOL for rent plus fees. Canceling is safe; retrying will refresh the blockhash.
              </div>
              <ul>
                <li>Create mint with configured decimals.</li>
                <li>Create owner associated token account.</li>
                <li>Mint exactly the configured fixed supply.</li>
                <li>Create and verify Metaplex metadata.</li>
                <li>Detect partial state before retries.</li>
              </ul>
              {props.cluster === 'devnet' && connectedAddress && (
                <div className="notice safe">
                  <strong>Devnet SOL helper</strong>
                  <span>
                    Public address to fund: <code>{connectedAddress}</code>
                  </span>
                  <span>
                    Public faucet limits are normal on devnet. If the in-app request is rate-limited,
                    copy this public address into the Solana faucet and refresh the balance here.
                  </span>
                  <div className="inline-actions">
                    <button className="secondary" disabled={busy} type="button" onClick={() => void requestDevnetFunding()}>
                      Request devnet SOL
                    </button>
                    <button className="secondary" disabled={busy} type="button" onClick={() => void copyConnectedAddress()}>
                      Copy address
                    </button>
                    <a className="button-link" href={SOLANA_DEVNET_FAUCET_URL} target="_blank" rel="noreferrer">
                      Open Solana faucet
                    </a>
                    <a className="button-link" href={SOLANA_DEVNET_FAUCET_GUIDE_URL} target="_blank" rel="noreferrer">
                      Faucet options
                    </a>
                    <button className="secondary" disabled={busy} type="button" onClick={() => void refreshConnectedBalance()}>
                      Refresh balance
                    </button>
                  </div>
                </div>
              )}
              <button disabled={busy || !validation.ok || !connectedAddress || !validation.config.metadataUri || props.appMode === 'readonly' || blocksMainnetPlaceholder || (launchPlan !== null && activeTxIndex < launchPlan.transactions.length)} type="button" onClick={() => void prepareLaunchPlan()}>
                {launchPlan && activeTxIndex < launchPlan.transactions.length
                  ? 'Launch Plan Prepared'
                  : 'Prepare Launch Transactions'}
              </button>
              {launchPlan && (
                <>
                  <div className="operator-strip">
                    <div>
                      <strong>Owner-approved launch operator</strong>
                      <span>
                        {activeTxIndex >= launchPlan.transactions.length
                          ? 'All token-creation transactions submitted.'
                          : `Waiting on transaction ${activeTxIndex + 1} of ${launchPlan.transactions.length}: ${launchPlan.transactions[activeTxIndex]?.label}`}
                      </span>
                    </div>
                    <div>
                      <strong>{Object.keys(signatures).length}/{launchPlan.transactions.length}</strong>
                      <span>confirmed</span>
                    </div>
                  </div>
                  <div className="summary-grid">
                    <div className="metric"><span>Mint</span><strong>{launchPlan.mint.publicKey.toBase58()}</strong></div>
                    <div className="metric"><span>ATA</span><strong>{launchPlan.ata.toBase58()}</strong></div>
                    <div className="metric"><span>Next transaction</span><strong>{launchPlan.transactions[activeTxIndex]?.label ?? 'complete'}</strong></div>
                  </div>
                  <pre className="preview">{launchPlan.transactions[activeTxIndex] ? stringifyBigint(launchPlan.transactions[activeTxIndex]?.preview) : 'All launch transactions have been submitted.'}</pre>
                  <div className="notice">
                    This request creates only the account shown in the preview. MetaMask may display
                    "Estimated changes: Not available" for Solana devnet account creation; use the
                    program ID and fee details in both MetaMask and this preview before approving.
                  </div>
                  <button disabled={busy || !walletHandle || activeTxIndex >= launchPlan.transactions.length} type="button" onClick={() => void approveCurrentLaunchTransaction()}>
                    Request Next MetaMask Approval
                  </button>
                  {activeTxIndex >= launchPlan.transactions.length && (
                    <button className="secondary" type="button" onClick={() => setActiveStep(6)}>
                      Open Verification Report
                    </button>
                  )}
                </>
              )}
              {statusMessage && <div className="notice">{statusMessage}</div>}
            </>
          )}

          {activeStep === 5 && (
            <>
              <h2><LockKeyhole size={20} /> Authority management</h2>
              <div className="notice danger">
                Mint and freeze authority revocations are permanent and are never combined with
                unrelated transactions. They are not liquidity locking.
              </div>
              <label>
                Type mint address before any permanent authority transaction
                <input value={typedMint} onChange={(event) => setTypedMint(event.target.value)} />
              </label>
              <div className="grid">
                <button disabled={busy || !walletHandle || !typedMint} type="button" onClick={() => void prepareAuthorityRevocation('mint')}>Prepare mint-authority revocation</button>
                <button disabled={busy || !walletHandle || !typedMint} type="button" onClick={() => void prepareAuthorityRevocation('freeze')}>Prepare freeze-authority revocation</button>
              </div>
              {authorityState && (
                <div className="summary-grid">
                  <div className="metric"><span>Mint authority</span><strong>{authorityState.mintAuthority ?? 'revoked'}</strong></div>
                  <div className="metric"><span>Freeze authority</span><strong>{authorityState.freezeAuthority ?? 'revoked'}</strong></div>
                  <div className="metric"><span>Prepared action</span><strong>{authorityKind ?? 'none'}</strong></div>
                </div>
              )}
              {authorityPreview && <pre className="preview">{stringifyBigint(authorityPreview)}</pre>}
              <button disabled={busy || !walletHandle || !authorityPreview} type="button" onClick={() => void approveAuthorityRevocation()}>
                Request MetaMask Approval For Prepared Authority Action
              </button>
              {statusMessage && <div className="notice">{statusMessage}</div>}
            </>
          )}

          {activeStep === 6 && (
            <>
              <h2>Verification report</h2>
              <div className="summary-grid">
                <div className="metric"><span>Status</span><strong>{manifest?.status}</strong></div>
                <div className="metric"><span>Owner</span><strong>{connectedAddress || 'not connected'}</strong></div>
                <div className="metric"><span>GMGN</span><strong>not checked</strong></div>
              </div>
              <pre className="preview">{manifest ? stringifyBigint(manifest) : 'Invalid token config'}</pre>
              <pre className="preview">{manifest ? buildLaunchReport(manifest) : ''}</pre>
              {manifest && (
                <div className="grid">
                  <button type="button" onClick={() => downloadTextFile('launch-manifest.json', stringifyBigint(manifest))}>
                    Download launch-manifest.json
                  </button>
                  <button type="button" onClick={() => downloadTextFile('launch-report.md', buildLaunchReport(manifest))}>
                    Download launch-report.md
                  </button>
                </div>
              )}
            </>
          )}

          {activeStep === 7 && (
            <>
              <h2><ChartCandlestick size={20} /> Liquidity planner</h2>
              <div className="notice">
                Liquidity planning is {props.liquidityPlannerEnabled ? 'enabled' : 'disabled'}.
                Raydium pool creation is {props.raydiumPoolCreationEnabled ? 'enabled' : 'locked'}.
              </div>
              <label>
                Pool confirmation phrase
                <input value={poolPhrase} onChange={(event) => setPoolPhrase(event.target.value)} />
              </label>
              <pre className="preview">{liquidity ? stringifyBigint(liquidity) : 'No liquidity plan available.'}</pre>
              <button disabled={poolPhrase !== 'CREATE SATA SOL POOL' || !props.raydiumPoolCreationEnabled} type="button">
                Prepare Raydium CPMM pool transaction
              </button>
            </>
          )}

          {activeStep === 8 && (
            <>
              <h2>Market readiness and GMGN</h2>
              <h3>Mainnet launch blockers</h3>
              {props.mainnetGateFailures.length > 0 ? (
                <div className="notice danger">
                  Mainnet remains locked. Failing gates: {props.mainnetGateFailures.join(', ')}.
                </div>
              ) : (
                <div className="notice safe">
                  Mainnet environment gates are set. Every transaction still requires MetaMask
                  review and approval by the owner.
                </div>
              )}
              <div className="notice">
                GMGN is an independent third party. The app can check public or owner-authorized
                status endpoints, but cannot guarantee indexing or routing.
              </div>
              <pre className="preview">
                {stringifyBigint({
                  tokenPageReference: typedMint ? buildGmgnTokenReference(typedMint) : 'pending mint',
                  acceptanceCriteria: [
                    'mainnet mint exists',
                    'SATA/WSOL pool has nonzero reserves',
                    'buy quote available',
                    'sell quote available',
                    'simulated small buy and sell pass',
                    'GMGN buy and sell routes available before GMGN_FULLY_TRADABLE'
                  ]
                })}
              </pre>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function TokenForm({
  value,
  onChange
}: {
  value: TokenConfigInput;
  onChange: (next: TokenConfigInput) => void;
}) {
  function update<K extends keyof TokenConfigInput>(key: K, next: TokenConfigInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid">
      <label>Name<input value={value.name} onChange={(event) => update('name', event.target.value)} /></label>
      <label>Symbol<input value={value.symbol} onChange={(event) => update('symbol', event.target.value)} /></label>
      <label>Decimals<input value={String(value.decimals)} onChange={(event) => update('decimals', Number(event.target.value))} /></label>
      <label>Human-readable supply<input value={value.supply} onChange={(event) => update('supply', event.target.value)} /></label>
      <label>
        Image URI
        <input value={value.imageUri} onChange={(event) => update('imageUri', event.target.value)} />
        {value.imageUri.includes('sata-default.svg') && (
          <Image
            className="token-image-preview"
            src="/sata-default.svg"
            alt="SATA token preview"
            width={96}
            height={96}
          />
        )}
      </label>
      <label>Website<input value={value.website} onChange={(event) => update('website', event.target.value)} /></label>
      <label>X/social URL<input value={value.xUrl} onChange={(event) => update('xUrl', event.target.value)} /></label>
      <label>Telegram/community URL<input value={value.telegramUrl} onChange={(event) => update('telegramUrl', event.target.value)} /></label>
      <label>Metadata URI<input value={value.metadataUri} onChange={(event) => update('metadataUri', event.target.value)} /></label>
      <label>Description<textarea rows={5} value={value.description} onChange={(event) => update('description', event.target.value)} /></label>
    </div>
  );
}

function stringifyBigint(value: unknown): string {
  return JSON.stringify(value, (_key, data: unknown) => (typeof data === 'bigint' ? data.toString() : data), 2);
}

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function refreshLaunchTxForSigning(
  plan: TokenLaunchPlan,
  item: TokenLaunchPlan['transactions'][number],
  owner: PublicKey,
  blockhash: string
): void {
  item.transaction.recentBlockhash = blockhash;
  item.transaction.feePayer = owner;
  for (const signaturePair of item.transaction.signatures) {
    signaturePair.signature = null;
  }
  if (item.label === 'create-mint') {
    item.transaction.partialSign(plan.mint);
  }
}

async function confirmLaunchTransactionOrDetectProgress(params: {
  connection: ReturnType<typeof createConnection>;
  plan: TokenLaunchPlan;
  item: TokenLaunchPlan['transactions'][number];
  signature: string;
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
  expectedSupply: bigint;
}): Promise<void> {
  try {
    await params.connection.confirmTransaction(
      { signature: params.signature, ...params.latestBlockhash },
      'confirmed'
    );
    return;
  } catch (error) {
    const status = await params.connection.getSignatureStatus(params.signature, {
      searchTransactionHistory: true
    });
    if (
      status.value &&
      !status.value.err &&
      (status.value.confirmationStatus === 'confirmed' ||
        status.value.confirmationStatus === 'finalized')
    ) {
      return;
    }

    const completion = await detectLaunchCompletion(
      params.connection,
      params.plan,
      params.expectedSupply
    );
    if (completion[params.item.label]) return;

    throw new Error(
      `MetaMask returned signature ${params.signature}, but ${params.item.label} was not confirmed before the blockhash expired or the RPC rejected it: ${(error as Error).message}. The intended account is not complete on-chain. Click Request Next MetaMask Approval again; the app will reuse mint ${params.plan.mint.publicKey.toBase58()} with a fresh blockhash.`
    );
  }
}

async function detectLaunchCompletion(
  connection: ReturnType<typeof createConnection>,
  plan: TokenLaunchPlan,
  expectedSupply: bigint
): Promise<Record<string, boolean>> {
  const [mintInfo, metadataInfo] = await Promise.all([
    connection.getAccountInfo(plan.mint.publicKey, 'confirmed'),
    connection.getAccountInfo(plan.metadata, 'confirmed')
  ]);
  const mintCreated = mintInfo?.owner.toBase58() === PROGRAM_IDS.splToken;
  let supplyMintedToOwnerAta = false;
  try {
    const ataBalance = await connection.getTokenAccountBalance(plan.ata, 'confirmed');
    supplyMintedToOwnerAta = ataBalance.value.amount === expectedSupply.toString();
  } catch {
    supplyMintedToOwnerAta = false;
  }

  return {
    'create-mint': mintCreated,
    'create-ata-and-mint-supply': mintCreated && supplyMintedToOwnerAta,
    'create-metadata': metadataInfo !== null
  };
}

async function ensureFreshTransactionBudget(params: {
  connection: ReturnType<typeof createConnection>;
  owner: PublicKey;
  preview: TransactionPreview;
  reserveSol: string;
  cluster: 'devnet' | 'testnet' | 'mainnet-beta';
  onStatus: (message: string) => void;
  onBalanceSol: (balanceSol: string) => void;
}): Promise<void> {
  const reserveLamports = parseHumanAmountToBaseUnits(params.reserveSol, 9).raw;
  const requiredLamports = params.preview.maxSpendLamports + reserveLamports;
  let balanceLamports = await fetchAndSetBalance(params.connection, params.owner, params.onBalanceSol);

  if (balanceLamports < requiredLamports && params.cluster === 'devnet') {
    balanceLamports = await requestBestEffortDevnetAirdrop({
      connection: params.connection,
      owner: params.owner,
      requiredLamports,
      onStatus: params.onStatus,
      onBalanceSol: params.onBalanceSol
    });
  }

  if (balanceLamports < requiredLamports) {
    const networkLabel = params.cluster === 'devnet' ? 'devnet' : params.cluster;
    throw new Error(
      `Fresh ${networkLabel} balance is too low for this transaction plus reserve. Balance ${balanceLamports.toString()} lamports, required ${requiredLamports.toString()} lamports. Add SOL to the connected MetaMask Solana account and retry.`
    );
  }
}

async function requestBestEffortDevnetAirdrop(params: {
  connection: ReturnType<typeof createConnection>;
  owner: PublicKey;
  requiredLamports: bigint;
  onStatus: (message: string) => void;
  onBalanceSol: (balanceSol: string) => void;
}): Promise<bigint> {
  let balanceLamports = await fetchAndSetBalance(params.connection, params.owner, params.onBalanceSol);
  if (balanceLamports >= params.requiredLamports) return balanceLamports;

  let lastError = 'no faucet attempt was made';
  for (const amountLamports of DEVNET_AIRDROP_AMOUNTS_LAMPORTS) {
    const amountLabel = formatLamportsAsSol(BigInt(amountLamports));
    try {
      params.onStatus(
        `Devnet balance is low. Requesting ${amountLabel} devnet SOL before opening MetaMask...`
      );
      const latest = await params.connection.getLatestBlockhash('confirmed');
      const signature = await params.connection.requestAirdrop(params.owner, amountLamports);
      await params.connection.confirmTransaction({ signature, ...latest }, 'confirmed');
      balanceLamports = await fetchAndSetBalance(params.connection, params.owner, params.onBalanceSol);
      if (balanceLamports >= params.requiredLamports) return balanceLamports;
      params.onStatus(
        `Airdrop confirmed, but balance is still below the required reserve. Balance ${balanceLamports.toString()} lamports, required ${params.requiredLamports.toString()} lamports.`
      );
    } catch (error) {
      lastError = (error as Error).message || String(error);
      params.onStatus(
        `${amountLabel} devnet SOL airdrop failed: ${lastError}. Trying a smaller faucet request...`
      );
    }
  }

  throw new Error(
    `Devnet RPC faucet could not fund ${params.owner.toBase58()}: ${lastError}. Copy the public address, request devnet SOL from a faucet, click Refresh balance, then Request Next MetaMask Approval again.`
  );
}

async function fetchAndSetBalance(
  connection: ReturnType<typeof createConnection>,
  owner: PublicKey,
  onBalanceSol: (balanceSol: string) => void
): Promise<bigint> {
  const balanceLamports = BigInt(await connection.getBalance(owner, 'confirmed'));
  onBalanceSol(formatLamportsAsSol(balanceLamports));
  return balanceLamports;
}

function formatLamportsAsSol(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL_BIGINT;
  const fractional = (lamports % LAMPORTS_PER_SOL_BIGINT).toString().padStart(9, '0');
  return `${whole.toString()}.${fractional}`.replace(/\.?0+$/, '');
}
