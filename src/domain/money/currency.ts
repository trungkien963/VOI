export type CurrencyCode =
  | 'VND'
  | 'USD'
  | 'TWD'
  | 'EUR'
  | 'JPY'
  | 'KRW'
  | 'SGD'
  | 'THB'
  | 'GBP'
  | 'AUD'
  | 'CAD'
  | 'CNY'
  | 'HKD'
  | 'MYR'
  | 'PHP'
  | 'CHF'
  | 'INR'
  | 'NZD'
  | 'IDR'
  | 'AED';

export type NumberFormatStyle = 'dot_comma' | 'comma_dot';

let activeNumberFormatStyle: NumberFormatStyle = 'dot_comma';
let hasExplicitGlobalStyle = false;

export function setGlobalNumberFormatStyle(style: NumberFormatStyle, explicit = true): void {
  activeNumberFormatStyle = style;
  hasExplicitGlobalStyle = explicit;
}

export function getGlobalNumberFormatStyle(): NumberFormatStyle {
  return activeNumberFormatStyle;
}

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  nameVi: string;
  nameEn: string;
  decimals: 0 | 2;
  defaultRateToVnd: number;
}

export const CURRENCY_METADATA: Record<CurrencyCode, CurrencyMetadata> = {
  VND: {
    code: 'VND',
    symbol: 'đ',
    nameVi: 'Việt Nam Đồng',
    nameEn: 'Vietnamese Dong',
    decimals: 0,
    defaultRateToVnd: 1,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    nameVi: 'Đô la Mỹ',
    nameEn: 'US Dollar',
    decimals: 2,
    defaultRateToVnd: 25400,
  },
  TWD: {
    code: 'TWD',
    symbol: 'NT$',
    nameVi: 'Đài tệ',
    nameEn: 'New Taiwan Dollar',
    decimals: 0,
    defaultRateToVnd: 790,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    nameVi: 'Đồng Euro',
    nameEn: 'Euro',
    decimals: 2,
    defaultRateToVnd: 27500,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    nameVi: 'Yên Nhật',
    nameEn: 'Japanese Yen',
    decimals: 0,
    defaultRateToVnd: 170,
  },
  KRW: {
    code: 'KRW',
    symbol: '₩',
    nameVi: 'Won Hàn Quốc',
    nameEn: 'South Korean Won',
    decimals: 0,
    defaultRateToVnd: 19,
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    nameVi: 'Đô la Singapore',
    nameEn: 'Singapore Dollar',
    decimals: 2,
    defaultRateToVnd: 19000,
  },
  THB: {
    code: 'THB',
    symbol: '฿',
    nameVi: 'Baht Thái',
    nameEn: 'Thai Baht',
    decimals: 2,
    defaultRateToVnd: 750,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    nameVi: 'Bảng Anh',
    nameEn: 'British Pound',
    decimals: 2,
    defaultRateToVnd: 32500,
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    nameVi: 'Đô la Úc',
    nameEn: 'Australian Dollar',
    decimals: 2,
    defaultRateToVnd: 16800,
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    nameVi: 'Đô la Canada',
    nameEn: 'Canadian Dollar',
    decimals: 2,
    defaultRateToVnd: 18500,
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    nameVi: 'Nhân dân tệ',
    nameEn: 'Chinese Yuan',
    decimals: 2,
    defaultRateToVnd: 3550,
  },
  HKD: {
    code: 'HKD',
    symbol: 'HK$',
    nameVi: 'Đô la Hồng Kông',
    nameEn: 'Hong Kong Dollar',
    decimals: 2,
    defaultRateToVnd: 3260,
  },
  MYR: {
    code: 'MYR',
    symbol: 'RM',
    nameVi: 'Ringgit Malaysia',
    nameEn: 'Malaysian Ringgit',
    decimals: 2,
    defaultRateToVnd: 5750,
  },
  PHP: {
    code: 'PHP',
    symbol: '₱',
    nameVi: 'Peso Philippines',
    nameEn: 'Philippine Peso',
    decimals: 2,
    defaultRateToVnd: 440,
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    nameVi: 'Franc Thuỵ Sĩ',
    nameEn: 'Swiss Franc',
    decimals: 2,
    defaultRateToVnd: 28900,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    nameVi: 'Rupee Ấn Độ',
    nameEn: 'Indian Rupee',
    decimals: 2,
    defaultRateToVnd: 305,
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    nameVi: 'Đô la New Zealand',
    nameEn: 'New Zealand Dollar',
    decimals: 2,
    defaultRateToVnd: 15200,
  },
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    nameVi: 'Rupiah Indonesia',
    nameEn: 'Indonesian Rupiah',
    decimals: 0,
    defaultRateToVnd: 1.6,
  },
  AED: {
    code: 'AED',
    symbol: 'AED',
    nameVi: 'Dirham UAE',
    nameEn: 'UAE Dirham',
    decimals: 2,
    defaultRateToVnd: 6915,
  },
};

export const ALL_DATABASE_CURRENCIES: ReadonlyArray<CurrencyCode> = Object.keys(
  CURRENCY_METADATA,
) as CurrencyCode[];

export const ALL_CURRENCIES: ReadonlyArray<CurrencyCode> = ALL_DATABASE_CURRENCIES;

export const DEFAULT_ENABLED_CURRENCIES: ReadonlyArray<CurrencyCode> = ['VND', 'USD', 'TWD'];

export function getCurrencyMetadata(currency: string): CurrencyMetadata {
  const upper = currency.toUpperCase() as CurrencyCode;
  return CURRENCY_METADATA[upper] ?? CURRENCY_METADATA.VND;
}

export function getCurrencyDecimals(currency: string): 0 | 2 {
  return getCurrencyMetadata(currency).decimals;
}

/**
 * Formats a raw numeric input string live with thousand separators according to the user's
 * chosen separator style (`dot_comma` -> `1.000.000` or `comma_dot` -> `1,000,000`).
 * Preserves shorthand suffixes (like `850k`, `1tr2`) untouched if letters are present.
 */
export function formatNumberInputLive(
  rawText: string,
  style: NumberFormatStyle = activeNumberFormatStyle,
): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  if (/[a-zA-Zđ₫]/.test(trimmed)) return rawText;

  const isNegative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');
  const thousandSep = style === 'comma_dot' ? ',' : '.';
  const decimalSep = style === 'comma_dot' ? '.' : ',';

  // Keep only digits and decimal/thousand separators
  const cleaned = unsigned.replace(/[^\d.,]/g, '');
  if (!cleaned) return isNegative ? '-' : '';

  // If the user explicitly typed a decimal separator at the end (or for a 1-2 digit fraction after non-3-digit group)
  const lastDecimalIdx = cleaned.lastIndexOf(decimalSep);
  let intDigits = cleaned.replace(/[.,]/g, '');
  let decimalTail = '';

  if (lastDecimalIdx !== -1) {
    const afterSep = cleaned.slice(lastDecimalIdx + 1);
    const beforeSep = cleaned.slice(0, lastDecimalIdx);
    // Treat as decimal tail only if it wasn't an existing 3-digit thousand group when style uses the same char
    if (afterSep.length <= 2 && !beforeSep.includes(decimalSep)) {
      intDigits = beforeSep.replace(/[.,]/g, '');
      decimalTail = `${decimalSep}${afterSep.replace(/[.,]/g, '')}`;
    }
  }

  if (!intDigits) {
    return `${isNegative ? '-' : ''}0${decimalTail}`;
  }

  // Strip leading zeros (except single "0")
  const normalizedInt = intDigits.replace(/^0+(?=\d)/, '');
  const groupedInt = normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return `${isNegative ? '-' : ''}${groupedInt}${decimalTail}`;
}

/**
 * Formats an integer amount with the user's chosen thousand separator (`1.000.000` or `1,000,000`).
 */
export function formatGroupedInteger(
  value: number,
  style: NumberFormatStyle = activeNumberFormatStyle,
): string {
  const thousandSep = style === 'comma_dot' ? ',' : '.';
  const absInt = Math.round(Math.abs(value));
  const grouped = String(absInt).replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return value < 0 ? `-${grouped}` : grouped;
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

  // Pattern 3: Grouped thousands for 0-decimal currencies like VND, TWD, JPY, KRW ("850.000" or "1,500,000")
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    const digitsOnly = clean.replace(/[.,]/g, '');
    const parsedInt = Number(digitsOnly);
    return Number.isNaN(parsedInt) ? 0 : sign * Math.round(parsedInt);
  }

  // Pattern 4: Decimal currencies (USD, EUR, SGD, THB, etc.)
  // Disambiguate thousand separators vs decimal separator:
  // - If string ends with `[.,]\d{1,2}`, treat that last separator as the decimal point and strip earlier separators.
  // - If string matches grouped thousands (`^\d{1,3}([.,]\d{3})+$`), strip all separators as integer major units.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(clean)) {
    const majorInt = Number(clean.replace(/[.,]/g, ''));
    return Number.isNaN(majorInt) ? 0 : sign * toMinorUnits(majorInt, currency);
  }
  const decMatch = clean.match(/^([\d.,]+)[.,](\d{1,2})$/);
  if (decMatch) {
    const intPart = (decMatch[1] ?? '0').replace(/[.,]/g, '');
    const fracPart = decMatch[2] ?? '0';
    const majorVal = Number(`${intPart}.${fracPart}`);
    return Number.isNaN(majorVal) ? 0 : sign * toMinorUnits(majorVal, currency);
  }

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
  numberFormat?: NumberFormatStyle;
}

function formatNumberWithStyle(
  absMajor: number,
  decimals: 0 | 2,
  style: NumberFormatStyle,
): string {
  const thousandSep = style === 'comma_dot' ? ',' : '.';
  const decimalSep = style === 'comma_dot' ? '.' : ',';
  const fixed = absMajor.toFixed(decimals);
  const [intPart = '0', fracPart] = fixed.split('.');
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return decimals > 0 && fracPart !== undefined
    ? `${groupedInt}${decimalSep}${fracPart}`
    : groupedInt;
}

/**
 * Formats integer minor units according to ISO 4217, Vietnamese GenZ conventions,
 * and the user's selected `numberFormat` (`dot_comma` -> `1.000.000,00` or `comma_dot` -> `1,000,000.00`).
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

  const style =
    options.numberFormat ??
    (hasExplicitGlobalStyle
      ? activeNumberFormatStyle
      : meta.decimals > 0
        ? 'comma_dot'
        : activeNumberFormatStyle);
  const sign = amountMinor < 0 ? '-' : options.showPlusSign && amountMinor > 0 ? '+' : '';
  const absMajor = Math.abs(fromMinorUnits(amountMinor, meta.code));

  if (options.compact) {
    if (meta.code === 'VND') {
      if (absMajor >= 1_000_000) {
        const tr = Number((absMajor / 1_000_000).toFixed(1)).toLocaleString(
          style === 'comma_dot' ? 'en-US' : 'vi-VN',
        );
        return `${sign}${tr}tr`;
      }
      if (absMajor >= 1_000) {
        const k = formatGroupedInteger(Math.round(absMajor / 1_000), style);
        return `${sign}${k}k`;
      }
      return `${sign}${Math.round(absMajor)}đ`;
    }
    if (absMajor >= 1_000) {
      return `${sign}${meta.symbol}${(absMajor / 1_000).toFixed(1)}k`;
    }
  }

  const formatted = formatNumberWithStyle(absMajor, meta.decimals, style);
  if (meta.code === 'VND') {
    return `${sign}${formatted}đ`;
  }
  return `${sign}${meta.symbol}${formatted}`;
}
