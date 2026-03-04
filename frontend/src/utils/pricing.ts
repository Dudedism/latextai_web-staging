/**
 * Regional pricing utilities.
 *
 * Pricing tiers:
 *   standard     — 1 credit = $0.005 USD
 *   emerging_inr — 1 credit = ₹0.15 (15 paisa)
 *   emerging_usd — 1 credit = $0.00175 (~65% off)
 */

export interface PricingInfo {
  tier: string;
  currency: string;
  currencySymbol: string;
  creditsToMinorUnit: number;
}

const TIER_CONFIG: Record<string, PricingInfo> = {
  standard: { tier: 'standard', currency: 'usd', currencySymbol: '$', creditsToMinorUnit: 0.5 },
  emerging_inr: { tier: 'emerging_inr', currency: 'inr', currencySymbol: '₹', creditsToMinorUnit: 15 },
  emerging_usd: { tier: 'emerging_usd', currency: 'usd', currencySymbol: '$', creditsToMinorUnit: 0.175 },
};

export function getPricingConfig(tier: string): PricingInfo {
  return TIER_CONFIG[tier] || TIER_CONFIG.standard;
}

/**
 * Format a credit amount as a display money string.
 * E.g. formatCredits(499, 'standard') → "$2.50"
 *      formatCredits(499, 'emerging_inr') → "₹75"
 */
export function formatCredits(credits: number, tier: string = 'standard'): string {
  const config = getPricingConfig(tier);
  const minorUnits = credits * config.creditsToMinorUnit;
  const amount = minorUnits / 100;

  if (config.currency === 'inr') {
    // INR: show whole rupees (no decimals for clean amounts)
    return `${config.currencySymbol}${Math.round(amount)}`;
  }
  return `${config.currencySymbol}${amount.toFixed(2)}`;
}

/**
 * Format credits using a pricing object from the API (e.g. from payment-details).
 */
export function formatCreditsWithPricing(
  credits: number,
  pricing?: { currency_symbol?: string; credits_to_minor_unit?: number; currency?: string }
): string {
  if (!pricing) return `$${(credits * 0.5 / 100).toFixed(2)}`;

  const minorUnits = credits * (pricing.credits_to_minor_unit ?? 1);
  const amount = minorUnits / 100;
  const symbol = pricing.currency_symbol ?? '$';

  if (pricing.currency === 'inr') {
    return `${symbol}${Math.round(amount)}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Get the credit rate description text.
 * E.g. "1 credit = $0.005" or "1 credit = ₹0.15"
 */
export function getCreditRateText(tier: string = 'standard'): string {
  const config = getPricingConfig(tier);
  if (config.currency === 'inr') {
    return '1 credit = ₹0.15';
  }
  if (config.tier === 'emerging_usd') {
    return '1 credit = $0.00175';
  }
  return '1 credit = $0.005';
}
