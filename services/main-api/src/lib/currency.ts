// Asset prices are stored in USD. When a buyer checks out in another currency
// (e.g. MYR), we convert from USD at the current exchange rate.
//
// We use frankfurter.app: a free, no-key, no-auth exchange-rate API.
// Rates barely change minute-to-minute, so we cache each rate in memory for
// CACHE_TTL_MS to avoid hammering the API (and to stay up if it's briefly down).

const BASE_CURRENCY = 'USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cache key = target currency. Value = the rate (1 USD -> N target) + when we fetched it.
interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const rateCache = new Map<string, CachedRate>();

async function getUsdRate(targetCurrency: string): Promise<number> {
  const cached = rateCache.get(targetCurrency);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  const url = `https://api.frankfurter.app/latest?from=${BASE_CURRENCY}&to=${targetCurrency}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Exchange rate request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[targetCurrency];
  if (typeof rate !== 'number') {
    throw new Error(`No exchange rate returned for ${BASE_CURRENCY} -> ${targetCurrency}`);
  }

  rateCache.set(targetCurrency, { rate, fetchedAt: Date.now() });
  return rate;
}

/**
 * Convert a USD amount into the target currency.
 * Returns the original amount unchanged when the target is USD.
 * Result is rounded to 2 decimal places (smallest unit of money).
 */
export async function convertFromUsd(
  amountUsd: number,
  targetCurrency: string,
): Promise<number> {
  if (targetCurrency === BASE_CURRENCY) {
    return amountUsd;
  }

  const rate = await getUsdRate(targetCurrency);
  return Math.round(amountUsd * rate * 100) / 100;
}
