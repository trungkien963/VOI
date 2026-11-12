import { DEFAULT_SYSTEM_CATEGORIES, SYSTEM_CATEGORY_IDS } from '../categories/default-categories';
import type { CurrencyCode } from '../money/currency';
import type { AccountType, Category, MerchantAlias, TransactionType } from '../types/entities';
import {
  extractAmountAndCurrency,
  extractTagsFromInput,
  normalizeVietnamese,
} from './amount-extractor';
import {
  EXPENSE_TARGET_GUARD_WORDS,
  EXTRA_CATEGORY_KEYWORD_MAP,
  hasWholePhrase,
} from './category-keywords';

export type TransferRouteHint =
  'bank_to_cash' | 'bank_to_ewallet' | 'bank_to_credit_card' | 'to_savings' | 'generic_transfer';

export interface QuickParseOptions {
  thousandsInputMode?: boolean;
  defaultCurrency?: CurrencyCode;
  learnedAliases?: ReadonlyArray<MerchantAlias>;
  categories?: ReadonlyArray<Category>;
  preferredKind?: 'expense' | 'income' | 'transfer';
}

export interface ParsedQuickInput {
  rawInput: string;
  type: TransactionType;
  amountMinor: number | null;
  currency: CurrencyCode;
  categoryId: string | null;
  categorySlug: string | null;
  categoryMatchedByKeyword?: boolean;
  counterpartyName: string | null;
  transferRoute: TransferRouteHint | null;
  suggestedAccountId: string | null;
  suggestedAccountType: AccountType;
  tags: string[];
  note: string;
}

function inferTypeAndCounterparty(
  rawTrimmed: string,
  cleanedNoAmount: string,
): {
  type: TransactionType;
  transferRoute: TransferRouteHint | null;
  counterpartyName: string | null;
} {
  const norm = normalizeVietnamese(cleanedNoAmount);
  const rawTokens = cleanedNoAmount.trim().split(/\s+/).filter(Boolean);
  const normTokens = rawTokens.map((t) => normalizeVietnamese(t));

  const mentionMatch = /@([\p{L}\p{N}_]+)/u.exec(cleanedNoAmount);
  const explicitMention = mentionMatch?.[1] ?? null;

  // 1. Transfer Routes (Section 6.2)
  if (/^(rut tien|rut atm|rut tien mat|withdraw)\b/.test(norm) || /\brut atm\b/.test(norm)) {
    return { type: 'transfer', transferRoute: 'bank_to_cash', counterpartyName: null };
  }

  const isPhoneOrGameTopup = /\bnap\s+(dien thoai|dt|the dt|the dien thoai|4g|5g|data|game)\b/.test(
    norm,
  );
  if (
    !isPhoneOrGameTopup &&
    (/\bnap\s+(vi|momo|zalopay|shopeepay|vnpay|viettelpay)\b/.test(norm) || /^nap$/.test(norm))
  ) {
    return { type: 'transfer', transferRoute: 'bank_to_ewallet', counterpartyName: null };
  }

  if (/\b(tra the|thanh toan the|tra sao ke|pay credit card)\b/.test(norm)) {
    return { type: 'transfer', transferRoute: 'bank_to_credit_card', counterpartyName: null };
  }

  if (
    /\b(gui tiet kiem|cat tiet kiem|chuyen tiet kiem)\b/.test(norm) ||
    /^(tiet kiem|cat)\b/.test(norm)
  ) {
    return { type: 'transfer', transferRoute: 'to_savings', counterpartyName: null };
  }

  // 2. Debt Flows via normalized token positions (preserving original-case counterparty token)
  const choIdx = normTokens.indexOf('cho');
  if (
    choIdx !== -1 &&
    rawTokens[choIdx + 1] &&
    (normTokens[choIdx + 2] === 'muon' || normTokens[choIdx + 2] === 'vay')
  ) {
    return { type: 'debt_lend', transferRoute: null, counterpartyName: rawTokens[choIdx + 1]! };
  }

  if (normTokens[0] === 'muon' || normTokens[0] === 'vay') {
    const nameIdx = normTokens[1] === 'tien' ? 2 : 1;
    const candidateRaw = rawTokens[nameIdx];
    const candidateNorm = normTokens[nameIdx];
    if (candidateRaw && candidateNorm && !['lai', 'phi', 'ngan'].includes(candidateNorm)) {
      return { type: 'debt_borrow', transferRoute: null, counterpartyName: candidateRaw };
    }
  }

  if (
    normTokens.length >= 2 &&
    normTokens[1] === 'tra' &&
    (normTokens.length === 2 || normTokens[2] === 'no' || normTokens[2] === 'tien')
  ) {
    const subjNorm = normTokens[0]!;
    if (!['minh', 'toi', 'em', 'anh', 'etik', 'app'].includes(subjNorm)) {
      return { type: 'debt_collect', transferRoute: null, counterpartyName: rawTokens[0]! };
    }
  }

  if (normTokens[0] === 'tra') {
    const targetStartIdx = normTokens[1] === 'no' ? 2 : 1;
    if (rawTokens[targetStartIdx]) {
      const targetNorm = normTokens.slice(targetStartIdx).join(' ');
      const isExpenseTarget = Array.from(EXPENSE_TARGET_GUARD_WORDS).some(
        (w) => targetNorm === w || targetNorm.startsWith(`${w} `),
      );
      if (!isExpenseTarget) {
        return {
          type: 'debt_repay',
          transferRoute: null,
          counterpartyName: rawTokens[targetStartIdx]!,
        };
      }
    }
  }

  // 3. Income Detection (with false-positive guard against "nhận đồ shopee", "nhận hàng")
  const startsWithPlus = rawTrimmed.startsWith('+');
  const hasExplicitIncomeKeyword =
    /\b(luong|nhan luong|thuong|nhan thuong|nhan tien|hoan tien|cashback|freelance|salary|bonus|duoc tang|duoc cho|lai tiet kiem)\b/.test(
      norm,
    );
  const isPackageDeliveryFalsePositive = /\bnhan\s+(do|hang|ship|buu pham|don)\b/.test(norm);

  if ((startsWithPlus || hasExplicitIncomeKeyword) && !isPackageDeliveryFalsePositive) {
    return { type: 'income', transferRoute: null, counterpartyName: explicitMention };
  }

  return { type: 'expense', transferRoute: null, counterpartyName: explicitMention };
}

export function parseQuickInput(
  rawText: string,
  options: QuickParseOptions = {},
): ParsedQuickInput {
  const rawTrimmed = rawText.trim();
  const { tags, textWithoutTags } = extractTagsFromInput(rawTrimmed);
  const { amountMinor, currency, cleanedTextWithoutAmount } = extractAmountAndCurrency(
    textWithoutTags,
    options,
  );
  const inferred = inferTypeAndCounterparty(rawTrimmed, cleanedTextWithoutAmount);
  const type: TransactionType =
    options.preferredKind === 'income'
      ? 'income'
      : options.preferredKind === 'transfer'
        ? 'transfer'
        : inferred.type;
  const { transferRoute, counterpartyName } = inferred;
  const normNote = normalizeVietnamese(cleanedTextWithoutAmount.replace(/^\+/, ''));

  const categoryPool: ReadonlyArray<Category> =
    options.categories && options.categories.length > 0
      ? options.categories
      : DEFAULT_SYSTEM_CATEGORIES;

  if (options.learnedAliases && normNote.length > 0) {
    const matchedAlias = options.learnedAliases.find((alias) => {
      const aliasNorm = normalizeVietnamese(alias.pattern_normalized);
      return hasWholePhrase(normNote, aliasNorm) || hasWholePhrase(aliasNorm, normNote);
    });
    if (matchedAlias?.category_id) {
      const cat = categoryPool.find((c) => c.id === matchedAlias.category_id);
      if (!options.preferredKind || !cat || cat.kind === options.preferredKind) {
        return {
          rawInput: rawText,
          type,
          amountMinor,
          currency,
          categoryId: matchedAlias.category_id,
          categorySlug: cat?.slug ?? null,
          categoryMatchedByKeyword: true,
          counterpartyName,
          transferRoute,
          suggestedAccountId: matchedAlias.default_account_id ?? null,
          suggestedAccountType: 'bank',
          tags,
          note: cleanedTextWithoutAmount.replace(/^\+\s*/, '').trim() || rawTrimmed,
        };
      }
    }
  }

  let categoryId: string | null = null;
  let categorySlug: string | null = null;
  let categoryMatchedByKeyword = false;

  if (type === 'transfer') {
    categoryId =
      transferRoute === 'bank_to_credit_card'
        ? SYSTEM_CATEGORY_IDS.creditCardPayment
        : SYSTEM_CATEGORY_IDS.internalTransfer;
    categorySlug =
      transferRoute === 'bank_to_credit_card' ? 'credit-card-payment' : 'internal-transfer';
    categoryMatchedByKeyword = Boolean(transferRoute);
  } else if (type === 'expense' || type === 'income') {
    const targetKind = type === 'income' ? 'income' : 'expense';
    // Prioritize custom user categories/subcategories first
    for (const cat of categoryPool) {
      if (cat.is_system || cat.kind !== targetKind || cat.archived_at !== null) continue;
      const candidateKeywords = [
        ...cat.keywords.map((k) => normalizeVietnamese(k)),
        normalizeVietnamese(cat.name),
      ].filter(Boolean);
      if (candidateKeywords.some((kw) => hasWholePhrase(normNote, kw))) {
        categoryId = cat.id;
        categorySlug = cat.slug;
        categoryMatchedByKeyword = true;
        break;
      }
    }
    if (!categoryId) {
      for (const entry of EXTRA_CATEGORY_KEYWORD_MAP) {
        if (entry.keywords.some((kw) => hasWholePhrase(normNote, kw))) {
          const found = categoryPool.find(
            (c) => c.slug === entry.slug && c.kind === targetKind && c.archived_at === null,
          );
          if (found) {
            categoryId = found.id;
            categorySlug = found.slug;
            categoryMatchedByKeyword = true;
            break;
          }
        }
      }
    }
    if (!categoryId) {
      for (const cat of categoryPool) {
        if (cat.kind !== targetKind || cat.archived_at !== null) continue;
        if (cat.keywords.some((kw) => hasWholePhrase(normNote, kw))) {
          categoryId = cat.id;
          categorySlug = cat.slug;
          categoryMatchedByKeyword = true;
          break;
        }
      }
    }
    if (!categoryId) {
      categoryId = type === 'income' ? SYSTEM_CATEGORY_IDS.salary : SYSTEM_CATEGORY_IDS.foodDining;
      categorySlug = type === 'income' ? 'salary' : 'food-dining';
    }
  }

  let suggestedAccountType: AccountType = 'bank';
  if (categorySlug === 'fuel-parking' || categorySlug === 'groceries') {
    suggestedAccountType = 'cash';
  } else if (
    categorySlug === 'ride-hailing' ||
    categorySlug === 'food-delivery' ||
    categorySlug === 'coffee-tea'
  ) {
    suggestedAccountType = 'e_wallet';
  }

  return {
    rawInput: rawText,
    type,
    amountMinor,
    currency,
    categoryId,
    categorySlug,
    categoryMatchedByKeyword,
    counterpartyName,
    transferRoute,
    suggestedAccountId: null,
    suggestedAccountType,
    tags,
    note: cleanedTextWithoutAmount.replace(/^\+\s*/, '').trim() || rawTrimmed,
  };
}

const FOOD_CATEGORY_SLUGS = new Set([
  'food-dining',
  'eating-out',
  'coffee-tea',
  'groceries',
  'food-delivery',
]);

export function resolveEffectiveCategoryId(tx: {
  category_id: string | null;
  note: string | null;
}): string | null {
  if (!tx.note || !tx.note.trim()) {
    return tx.category_id;
  }
  if (!tx.category_id) {
    return parseQuickInput(tx.note).categoryId;
  }
  if (tx.category_id === SYSTEM_CATEGORY_IDS.foodDining) {
    const parsed = parseQuickInput(tx.note);
    if (parsed.categoryId && parsed.categorySlug && !FOOD_CATEGORY_SLUGS.has(parsed.categorySlug)) {
      return parsed.categoryId;
    }
  }
  return tx.category_id;
}
