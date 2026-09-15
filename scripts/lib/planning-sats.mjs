const SATS_PER_BTC = 100_000_000n;
const DECIMAL_SCALE = 1_000_000n;

export function planningUsdToSatsFloor({ usd, btcUsd }) {
  const usdScaled = parseNonNegativeDecimal(usd);
  const btcUsdScaled = parseNonNegativeDecimal(btcUsd);
  if (usdScaled <= 0n || btcUsdScaled <= 0n) return 0n;
  return (usdScaled * SATS_PER_BTC) / btcUsdScaled;
}

export function planningUsdToReserveSatsFloor({
  usd,
  btcUsd,
  reserveAllocationPercent
}) {
  const usdScaled = parseNonNegativeDecimal(usd);
  const btcUsdScaled = parseNonNegativeDecimal(btcUsd);
  const reservePercentScaled = parseNonNegativeDecimal(reserveAllocationPercent);
  if (usdScaled <= 0n || btcUsdScaled <= 0n || reservePercentScaled <= 0n) return 0n;
  return (
    (usdScaled * reservePercentScaled * SATS_PER_BTC) /
    (DECIMAL_SCALE * 100n * btcUsdScaled)
  );
}

function parseNonNegativeDecimal(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return 0n;

  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(6, '0').slice(0, 6));
}
