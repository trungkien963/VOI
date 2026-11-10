export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'JPY' | 'KRW' | 'SGD' | 'THB';

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  decimals: 0 | 2;
  defaultRateToVnd: number;
}

export const CURRENCY_METADATA: Record<CurrencyCode, CurrencyMetadata> = {
  VND: { code: 'VND', symbol: 'đ', decimals: 0, defaultRateToVnd: 1 },
  USD: { code: 'USD', symbol: '$', decimals: 2, defaultRateToVnd: 25400 },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, defaultRateToVnd: 27500 },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, defaultRateToVnd: 170 },
  KRW: { code: 'KRW', symbol: '₩', decimals: 0, defaultRateToVnd: 19 },
  SGD: { code: 'SGD', symbol: 'S$', decimals: 2, defaultRateToVnd: 19000 },
  THB: { code: 'THB', symbol: '฿', decimals: 2, defaultRateToVnd: 750 },
};

export function getCurrencyMetadata(currency: string): CurrencyMetadata {
  const upper = currency.toUpperCase() as CurrencyCode;
  return CURRENCY_METADATA[upper] ?? CURRENCY_METADATA.VND;
}

export function getCurrencyDecimals(currency: string): 0 | 2 {
  return getCurrencyMetadata(currency).decimals;
}

/**
 * Converts a major currency unit (e.g. 12.50 USD or 45000 VND) into integer minor units.
 */
export function toMinorUnits(majorAmount: number, currency = 'VND'): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = 10 ** decimals;
  return Math.round(majorAmount * factor);
}

/**
 * Parses flexible user money strings (e.g. "850k", "4.5tr", "1tr2", "850.000", "1,500,000", "45000")
 * directly into integer minor units for `currency`.
 */
export function parseFlexibleMoneyInput(rawText: string, currency = 'VND'): number {
  const trimmed = rawText.trim().toLowerCase();
  if (!trimmed) return 0;

  const sign = trimmed.startsWith('-') ? -1 : 1;
  const clean = trimmed.replace(/^[+-]\s*/, '').replace(/\s+/g, '');

  // Pattern 1: "1tr2", "4m5", "45k5"
  const splitMatch = clean.match(/^(\d+)(tr|trieu|triệu|m|củ|cu|k|ng|nghin|nghìn)(\d+)$/i);
  if (splitMatch) {
    const whole = Number(splitMatch[1]);
    const unit = (splitMatch[2] ?? '').toLowerCase();
    const fracStr = splitMatch[3] ?? '0';
    const frac = Number(fracStr) / 10 ** fracStr.length;
    const mult = /^(tr|trieu|triệu|m|củ|cu)$/.test(unit) ? 1_000_000 : 1_000;
    return sign * toMinorUnits((whole + frac) * mult, currency);
  }

  // Pattern 2: "850k", "4.5tr", "4,5m"
  const suffixMatch = clean.match(
    /^(\d+(?:[.,]\d+)?)(tr|trieu|triệu|m|củ|cu|k|ng|nghin|nghìn|đ|d|vnd)?$/i,
  );
  if (suffixMatch && suffixMatch[2]) {
    const numVal = Number((suffixMatch[1] ?? '0').replace(',', '.'));
    const unit = suffixMatch[2].toLowerCase();
    const mult = /^(tr|trieu|triệu|m|củ|cu)$/.test(unit)
      ? 1_000_000
      : /^(k|ng|nghin|nghìn)$/.test(unit)
        ? 1_000
        : 1;
    if (!Number.isNaN(numVal)) {
      return sign * toMinorUnits(numVal * mult, currency);
    }
  }

  // Pattern 3: Grouped thousands for 0-decimal currencies like VND ("850.000" or "1,500,000")
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    const digitsOnly = clean.replace(/[.,]/g, '');
    const parsedInt = Number(digitsOnly);
    return Number.isNaN(parsedInt) ? 0 : sign * Math.round(parsedInt);
  }

  // Pattern 4: Decimal currencies (USD, EUR, SGD, THB)
  const normalizedDecimal = clean.replace(/,/g, '');
  const majorVal = Number(normalizedDecimal);
  return Number.isNaN(majorVal) ? 0 : sign * toMinorUnits(majorVal, currency);
}

/**
 * Converts integer minor units back to major units (e.g. 1250 USD cents -> 12.5).
 */
export function fromMinorUnits(minorAmount: number, currency = 'VND'): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = 10 ** decimals;
  return minorAmount / factor;
}

/**
 * Returns default FX rate (1 major unit of `currency` -> major units of `baseCurrency`, default VND).
 */
export function getDefaultFxRateToBase(currency: string, baseCurrency = 'VND'): number {
  const srcMeta = getCurrencyMetadata(currency);
  const baseMeta = getCurrencyMetadata(baseCurrency);
  if (srcMeta.code === baseMeta.code) return 1;
  return srcMeta.defaultRateToVnd / baseMeta.defaultRateToVnd;
}

/**
 * Converts `amountMinor` in `currency` into integer minor units of `baseCurrency`
 * using `fxRateToBase` (major-to-major rate).
 * Example: 10000 USD cents ($100.00) at fxRateToBase = 25400 -> 2,540,000 VND.
 */
export function convertMinorToBase(
  amountMinor: number,
  currency: string,
  baseCurrency = 'VND',
  fxRateToBase?: number,
): number {
  if (currency.toUpperCase() === baseCurrency.toUpperCase()) {
    return Math.round(amountMinor);
  }
  const rate = fxRateToBase ?? getDefaultFxRateToBase(currency, baseCurrency);
  const majorInSource = fromMinorUnits(amountMinor, currency);
  const majorInBase = majorInSource * rate;
  return toMinorUnits(majorInBase, baseCurrency);
}

/**
 * Section 5.2: Infers the FX rate when transferring across currencies.
 * User enters both sent amount (`sourceMinor` in `sourceCurrency`) and received amount (`destMinor` in `destCurrency`).
 * Returns how many major units of `destCurrency` equal 1 major unit of `sourceCurrency`.
 */
export function computeImpliedFxRate(
  sourceMinor: number,
  sourceCurrency: string,
  destMinor: number,
  destCurrency: string,
): number {
  const srcMajor = Math.abs(fromMinorUnits(sourceMinor, sourceCurrency));
  const dstMajor = Math.abs(fromMinorUnits(destMinor, destCurrency));
  if (srcMajor <= 0) {
    throw new Error('INVALID_FX_SOURCE: Source amount must be positive');
  }
  return Number((dstMajor / srcMajor).toFixed(6));
}

export interface FormatMoneyOptions {
  hidden?: boolean;
  compact?: boolean;
  showPlusSign?: boolean;
}

/**
 * Formats integer minor units according to ISO 4217 and Vietnamese GenZ conventions.
 */
export function formatMoney(
  amountMinor: number,
  currency = 'VND',
  options: FormatMoneyOptions = {},
): string {
  const meta = getCurrencyMetadata(currency);
  if (options.hidden) {
    return meta.code === 'VND' ? '••••••đ' : `${meta.symbol}••••••`;
  }

  const sign = amountMinor < 0 ? '-' : options.showPlusSign && amountMinor > 0 ? '+' : '';
  const absMajor = Math.abs(fromMinorUnits(amountMinor, meta.code));

  if (options.compact) {
    if (meta.code === 'VND') {
      if (absMajor >= 1_000_000) {
        const tr = Number((absMajor / 1_000_000).toFixed(1)).toLocaleString('vi-VN');
        return `${sign}${tr}tr`;
      }
      if (absMajor >= 1_000) {
        const k = Math.round(absMajor / 1_000).toLocaleString('vi-VN');
        return `${sign}${k}k`;
      }
      return `${sign}${absMajor}đ`;
    }
    if (absMajor >= 1_000) {
      return `${sign}${meta.symbol}${(absMajor / 1_000).toFixed(1)}k`;
    }
  }

  if (meta.code === 'VND') {
    const formatted = new Intl.NumberFormat('vi-VN').format(Math.round(absMajor));
    return `${sign}${formatted}đ`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(absMajor);
  return `${sign}${meta.symbol}${formatted}`;
}
