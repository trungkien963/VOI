import { toMinorUnits, type CurrencyCode } from '../money/currency';

export interface AmountExtractionOptions {
  thousandsInputMode?: boolean;
  defaultCurrency?: CurrencyCode;
}

export interface ExtractedAmountResult {
  amountMinor: number | null;
  currency: CurrencyCode;
  matchedToken: string | null;
  cleanedTextWithoutAmount: string;
}

/**
 * Strips Vietnamese diacritics and normalizes whitespace to lowercase ASCII.
 */
export function normalizeVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts `#tag` tokens (supporting Vietnamese/ASCII word characters) and returns cleaned text.
 */
export function extractTagsFromInput(rawText: string): {
  tags: string[];
  textWithoutTags: string;
} {
  const tags: string[] = [];
  const textWithoutTags = rawText
    .replace(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu, (_full, tagVal: string) => {
      const normalizedTag = tagVal.toLowerCase();
      if (!tags.includes(normalizedTag)) {
        tags.push(normalizedTag);
      }
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  return { tags, textWithoutTags };
}

const ADDRESS_OR_BRAND_PREFIXES = new Set([
  'quan',
  'q',
  'phuong',
  'p',
  'ngo',
  'hem',
  'so',
  'duong',
  'tang',
  'lau',
  'ban',
  'phong',
  'lan',
  'nguoi',
  'cai',
  'ly',
  'to',
  'suat',
  'phan',
  'pho',
  'thang',
  'ngay',
  'nam',
  'size',
  'khu',
]);

const QUANTITY_OR_TIME_SUFFIXES = new Set([
  'nguoi',
  'cai',
  'chiec',
  'ly',
  'coc',
  'to',
  'bat',
  'phan',
  'suat',
  'lon',
  'chai',
  'goi',
  'hop',
  'kg',
  'gram',
  'g',
  'km',
  'gio',
  'phut',
  'ngay',
  'thang',
  'tuoi',
  '%',
]);

function parseDecimalNumber(numStr: string): number {
  return Number(numStr.replace(',', '.'));
}

/**
 * Section 6.2: Disambiguated Amount & Currency Extractor.
 * Priority 1: Foreign currency symbols/codes ($12, 12 usd, €5, 5 eur, ¥1500, 20 sgd).
 * Priority 2: Vietnamese colloquial/explicit suffixes (1tr250, 1tr2, 45k, 45 nghìn/ngàn, 1 triệu/củ, 2 lít, 45.000đ).
 * Priority 3: Grouped thousands (45.000 or 45,000 or 1.250.000).
 * Priority 4: Bare numbers (45, 1.5, 1,5) guarded against address/quantity context ("phở 24 45", "quận 1").
 */
export function extractAmountAndCurrency(
  textWithoutTags: string,
  options: AmountExtractionOptions = {},
): ExtractedAmountResult {
  const thousandsMode = options.thousandsInputMode ?? true;
  const defaultCurrency = options.defaultCurrency ?? 'VND';

  // 1. Foreign currency prefix/suffix: $12, 12$, 12 usd, €5, 5 eur, ¥1500, 1500 jpy, 20 sgd
  const fxRegex =
    /(?:^|\s)(?:\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:\$(?=\s|$)|usd\b)|€\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€(?=\s|$)|eur\b)|¥\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:¥(?=\s|$)|jpy\b)|(\d+(?:[.,]\d+)?)\s*sgd\b)/i;
  const fxMatch = fxRegex.exec(textWithoutTags);
  if (fxMatch) {
    const rawMatched = fxMatch[0].trim();
    let currency: CurrencyCode = 'USD';
    let numRaw = fxMatch[1] ?? fxMatch[2] ?? '';
    if (fxMatch[3] || fxMatch[4]) {
      currency = 'EUR';
      numRaw = fxMatch[3] ?? fxMatch[4] ?? '';
    } else if (fxMatch[5] || fxMatch[6]) {
      currency = 'JPY';
      numRaw = fxMatch[5] ?? fxMatch[6] ?? '';
    } else if (fxMatch[7]) {
      currency = 'SGD';
      numRaw = fxMatch[7];
    }
    const major = parseDecimalNumber(numRaw);
    const cleaned = textWithoutTags.replace(rawMatched, ' ').replace(/\s+/g, ' ').trim();
    return {
      amountMinor: toMinorUnits(major, currency),
      currency,
      matchedToken: rawMatched,
      cleanedTextWithoutAmount: cleaned,
    };
  }

  // 2. Compound million shorthand: "1tr2", "1tr250", "2tr5"
  const compoundTrRegex = /(?:^|\s)[+]?(\d+)\s*(?:tr|trieu|triệu|cu|củ)\s*(\d{1,3})\b/i;
  const compoundTrMatch = compoundTrRegex.exec(textWithoutTags);
  if (compoundTrMatch) {
    const rawMatched = compoundTrMatch[0].trim();
    const millions = Number(compoundTrMatch[1]);
    const fracStr = compoundTrMatch[2]!;
    const fracMultiplier = fracStr.length === 1 ? 100_000 : fracStr.length === 2 ? 10_000 : 1_000;
    const totalVnd = millions * 1_000_000 + Number(fracStr) * fracMultiplier;
    const cleaned = textWithoutTags.replace(rawMatched, ' ').replace(/\s+/g, ' ').trim();
    return {
      amountMinor: totalVnd,
      currency: 'VND',
      matchedToken: rawMatched,
      cleanedTextWithoutAmount: cleaned,
    };
  }

  // 3. Explicit Vietnamese currency suffix: k, nghìn, ngàn, tr, triệu, củ, lít, đ, vnd
  const vnSuffixRegex =
    /(?:^|\s)[+]?(\d+(?:[.,]\d+)?)\s*(k|nghin|nghìn|ngan|ngàn|tr|trieu|triệu|cu|củ|lit|lít|đ|d|vnd)(?=\s|$)/i;
  const vnSuffixMatch = vnSuffixRegex.exec(textWithoutTags);
  if (vnSuffixMatch) {
    const rawMatched = vnSuffixMatch[0].trim();
    const rawNum = vnSuffixMatch[1]!;
    const suffixNorm = normalizeVietnamese(vnSuffixMatch[2]!);

    // Check if rawNum is grouped thousands like "45.000" followed by "đ"/"vnd"
    const isGroupedThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(rawNum);
    const numValue = isGroupedThousands
      ? Number(rawNum.replace(/[.,]/g, ''))
      : parseDecimalNumber(rawNum);

    let multiplier = 1;
    if (suffixNorm === 'k' || suffixNorm === 'nghin' || suffixNorm === 'ngan') {
      multiplier = 1_000;
    } else if (suffixNorm === 'tr' || suffixNorm === 'trieu' || suffixNorm === 'cu') {
      multiplier = 1_000_000;
    } else if (suffixNorm === 'lit') {
      multiplier = 100_000;
    }

    const cleaned = textWithoutTags.replace(rawMatched, ' ').replace(/\s+/g, ' ').trim();
    return {
      amountMinor: Math.round(numValue * multiplier),
      currency: 'VND',
      matchedToken: rawMatched,
      cleanedTextWithoutAmount: cleaned,
    };
  }

  // 4. Grouped 3-digit thousands without suffix: "45.000", "45,000", "1.250.000"
  const groupedRegex = /(?:^|\s)[+]?(\d{1,3}(?:[.,]\d{3})+)(?=\s|$)/;
  const groupedMatch = groupedRegex.exec(textWithoutTags);
  if (groupedMatch) {
    const rawMatched = groupedMatch[0].trim();
    const numericVal = Number(groupedMatch[1]!.replace(/[.,]/g, ''));
    const cleaned = textWithoutTags.replace(rawMatched, ' ').replace(/\s+/g, ' ').trim();
    return {
      amountMinor: numericVal,
      currency: defaultCurrency,
      matchedToken: rawMatched,
      cleanedTextWithoutAmount: cleaned,
    };
  }

  // 5. Bare numbers with Disambiguation Guard ("phở 24 45", "mua áo quận 1 250")
  const tokens = textWithoutTags.split(/\s+/).filter(Boolean);
  const candidateIndices: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!.replace(/^\+/, '');
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(tok)) continue;

    const prevNorm =
      i > 0 ? normalizeVietnamese(tokens[i - 1]!.replace(/[^\p{L}\p{N}]/gu, '')) : '';
    const nextNorm =
      i + 1 < tokens.length
        ? normalizeVietnamese(tokens[i + 1]!.replace(/[^\p{L}\p{N}%]/gu, ''))
        : '';

    // Exclude numbers preceded by address/brand/ordinal words or followed by quantity units
    if (ADDRESS_OR_BRAND_PREFIXES.has(prevNorm) || QUANTITY_OR_TIME_SUFFIXES.has(nextNorm)) {
      continue;
    }
    candidateIndices.push(i);
  }

  if (candidateIndices.length > 0) {
    // Prefer the last valid number token (or first if it's at index 0)
    const chosenIdx = candidateIndices[candidateIndices.length - 1]!;
    const rawTok = tokens[chosenIdx]!;
    const val = parseDecimalNumber(rawTok.replace(/^\+/, ''));
    const amountMinor =
      defaultCurrency === 'VND' && thousandsMode
        ? Math.round(val * 1_000)
        : toMinorUnits(val, defaultCurrency);

    const remainingTokens = tokens.filter((_, idx) => idx !== chosenIdx);
    return {
      amountMinor,
      currency: defaultCurrency,
      matchedToken: rawTok,
      cleanedTextWithoutAmount: remainingTokens.join(' ').trim(),
    };
  }

  return {
    amountMinor: null,
    currency: defaultCurrency,
    matchedToken: null,
    cleanedTextWithoutAmount: textWithoutTags,
  };
}
