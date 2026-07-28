export type GmgnStatus =
  | 'not_yet_indexed'
  | 'indexed_but_no_route'
  | 'buy_route_available'
  | 'sell_route_available'
  | 'fully_tradable'
  | 'third_party_service_unavailable';

export type GmgnCheckResult = {
  status: GmgnStatus;
  tokenPageReference: string;
  checkedAt: string;
  buyRoute: boolean;
  sellRoute: boolean;
  detail: string;
};

export function buildGmgnTokenReference(mintAddress: string): string {
  return `https://gmgn.ai/sol/token/${mintAddress}`;
}

export async function checkGmgnStatus(params: {
  mintAddress: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<GmgnCheckResult> {
  const checkedAt = new Date().toISOString();
  const tokenPageReference = buildGmgnTokenReference(params.mintAddress);
  if (!params.apiBaseUrl) {
    return {
      status: 'not_yet_indexed',
      tokenPageReference,
      checkedAt,
      buyRoute: false,
      sellRoute: false,
      detail: 'No public GMGN API base URL configured; token-page reference only.'
    };
  }

  const fetcher = params.fetchImpl ?? fetch;
  try {
    const response = await fetcher(
      `${params.apiBaseUrl.replace(/\/$/, '')}/sol/tokens/${params.mintAddress}`,
      { headers: { accept: 'application/json' } }
    );
    if (!response.ok) {
      return {
        status: response.status === 404 ? 'not_yet_indexed' : 'third_party_service_unavailable',
        tokenPageReference,
        checkedAt,
        buyRoute: false,
        sellRoute: false,
        detail: `GMGN status HTTP ${response.status}`
      };
    }
    const body = (await response.json()) as { buyRoute?: boolean; sellRoute?: boolean };
    const buyRoute = body.buyRoute === true;
    const sellRoute = body.sellRoute === true;
    return {
      status: deriveGmgnStatus(buyRoute, sellRoute),
      tokenPageReference,
      checkedAt,
      buyRoute,
      sellRoute,
      detail: 'GMGN response parsed; route fields treated as optional and untrusted until cross-checked.'
    };
  } catch {
    return {
      status: 'third_party_service_unavailable',
      tokenPageReference,
      checkedAt,
      buyRoute: false,
      sellRoute: false,
      detail: 'GMGN check failed without exposing credentials.'
    };
  }
}

function deriveGmgnStatus(buyRoute: boolean, sellRoute: boolean): GmgnStatus {
  if (buyRoute && sellRoute) return 'fully_tradable';
  if (buyRoute) return 'buy_route_available';
  if (sellRoute) return 'sell_route_available';
  return 'indexed_but_no_route';
}
