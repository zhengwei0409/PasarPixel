// Sellers set asset prices in their own currency (USD or MYR). When we need a
// price in a different currency (e.g. a buyer checking out in MYR, or showing a
// consistent total), we convert at the current exchange rate.
//
// We use frankfurter.app: a free, no-key, no-auth exchange-rate API.
// Rates barely change minute-to-minute, so we cache each rate in memory for
// CACHE_TTL_MS to avoid hammering the API (and to stay up if it's briefly down).

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cache key = "FROM-TO" (e.g. "USD-MYR"). Value = the rate + when we fetched it.
interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const rateCache = new Map<string, CachedRate>();

/**
 * Returns how many units of `to` equal 1 unit of `from` (e.g. getRate("USD","MYR") ≈ 4.7).
 * Cached per currency pair; returns 1 when from === to.
 */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const key = `${from}-${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Exchange rate request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (typeof rate !== 'number') {
    throw new Error(`No exchange rate returned for ${from} -> ${to}`);
  }

  rateCache.set(key, { rate, fetchedAt: Date.now() });
  return rate;
}

/**
 * Convert an amount from one currency to another.
 * Returns the amount unchanged when from === to.
 * Result is rounded to 2 decimal places (smallest unit of money).
 */
export async function convert(
  amount: number,
  from: string,
  to: string,
): Promise<number> {
  const rate = await getRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}
