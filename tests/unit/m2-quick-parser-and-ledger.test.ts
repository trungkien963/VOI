import { describe, expect, it } from 'vitest';
import { FnAppLocalDB } from '../../src/db/dexie-schema';
import { MerchantAliasRepository } from '../../src/db/repositories/merchant-alias-repository';
import { TagRepository } from '../../src/db/repositories/tag-repository';
import { parseQuickInput, type TransferRouteHint } from '../../src/domain/quick-parser/parser';
import type { TransactionType } from '../../src/domain/types/entities';

interface ParserCase {
  input: string;
  thousandsMode?: boolean;
  expectedAmount: number | null;
  expectedCurrency?: string;
  expectedType: TransactionType;
  expectedSlug?: string | null;
  expectedRoute?: TransferRouteHint | null;
  expectedCounterparty?: string | null;
  expectedTags?: string[];
}

const FIFTY_SIX_PARSER_CASES: ReadonlyArray<ParserCase> = [
  // --- 1. Colloquial Vietnamese & Standard Amount Formats (14 cases) ---
  { input: 'cf 45k', expectedAmount: 45_000, expectedType: 'expense', expectedSlug: 'coffee-tea' },
  {
    input: 'cafe 45K',
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },
  {
    input: 'ăn sáng 45 nghìn',
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'bánh mì 35 ngàn',
    expectedAmount: 35_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'tiền nhà 3tr',
    expectedAmount: 3_000_000,
    expectedType: 'expense',
    expectedSlug: 'rent',
  },
  { input: 'mua ghế 1 triệu', expectedAmount: 1_000_000, expectedType: 'expense' },
  {
    input: 'mừng cưới 1 củ',
    expectedAmount: 1_000_000,
    expectedType: 'expense',
    expectedSlug: 'family-giving',
  },
  {
    input: 'điện nước 1tr2',
    expectedAmount: 1_200_000,
    expectedType: 'expense',
    expectedSlug: 'utilities',
  },
  {
    input: 'mua giày 1tr250',
    expectedAmount: 1_250_000,
    expectedType: 'expense',
    expectedSlug: 'fashion-beauty',
  },
  {
    input: 'đổ xăng 2 lít',
    expectedAmount: 200_000,
    expectedType: 'expense',
    expectedSlug: 'fuel-parking',
  },
  {
    input: 'nhậu 2,5 lít',
    expectedAmount: 250_000,
    expectedType: 'expense',
    expectedSlug: 'hangout-dating',
  },
  {
    input: 'cơm trưa 45.000',
    thousandsMode: false,
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'cơm tối 45,000',
    thousandsMode: false,
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'trà sữa 55.000đ',
    expectedAmount: 55_000,
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },

  // --- 2. Thousands Input Mode On vs Off (5 cases) ---
  {
    input: 'cafe 45',
    thousandsMode: true,
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },
  {
    input: 'gửi xe 1,5',
    thousandsMode: true,
    expectedAmount: 1_500,
    expectedType: 'expense',
    expectedSlug: 'fuel-parking',
  },
  {
    input: 'gửi xe 1.5',
    thousandsMode: true,
    expectedAmount: 1_500,
    expectedType: 'expense',
    expectedSlug: 'fuel-parking',
  },
  {
    input: 'cafe 45',
    thousandsMode: false,
    expectedAmount: 45,
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },
  { input: 'chỉ ghi chú không có số', expectedAmount: null, expectedType: 'expense' },

  // --- 3. Foreign Currencies (ISO 4217 Minor Units) (7 cases) ---
  {
    input: 'chatgpt 20 usd',
    expectedAmount: 2_000,
    expectedCurrency: 'USD',
    expectedType: 'expense',
    expectedSlug: 'education-work',
  },
  {
    input: 'netflix $12.50',
    expectedAmount: 1_250,
    expectedCurrency: 'USD',
    expectedType: 'expense',
    expectedSlug: 'subscriptions-media',
  },
  {
    input: 'coffee 12$',
    expectedAmount: 1_200,
    expectedCurrency: 'USD',
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },
  { input: 'bánh ngọt €5', expectedAmount: 500, expectedCurrency: 'EUR', expectedType: 'expense' },
  {
    input: 'museum 15 eur',
    expectedAmount: 1_500,
    expectedCurrency: 'EUR',
    expectedType: 'expense',
  },
  {
    input: 'ramen 1500 jpy',
    expectedAmount: 1_500,
    expectedCurrency: 'JPY',
    expectedType: 'expense',
  },
  {
    input: 'grab 20 sgd',
    expectedAmount: 2_000,
    expectedCurrency: 'SGD',
    expectedType: 'expense',
    expectedSlug: 'ride-hailing',
  },

  // --- 4. Disambiguation with Multiple Numbers (Section 6.2) (8 cases) ---
  {
    input: 'phở 24 45k',
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'phở 24 45',
    thousandsMode: true,
    expectedAmount: 45_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'mua áo quận 1 250k',
    expectedAmount: 250_000,
    expectedType: 'expense',
    expectedSlug: 'fashion-beauty',
  },
  {
    input: 'mua áo quận 1 250',
    thousandsMode: true,
    expectedAmount: 250_000,
    expectedType: 'expense',
    expectedSlug: 'fashion-beauty',
  },
  {
    input: 'ốc 30k 2 người',
    expectedAmount: 30_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'bún đậu ngõ 12 35',
    thousandsMode: true,
    expectedAmount: 35_000,
    expectedType: 'expense',
    expectedSlug: 'eating-out',
  },
  {
    input: 'cafe tầng 3 50',
    thousandsMode: true,
    expectedAmount: 50_000,
    expectedType: 'expense',
    expectedSlug: 'coffee-tea',
  },
  {
    input: 'nạp 4g 70k',
    expectedAmount: 70_000,
    expectedType: 'expense',
    expectedSlug: 'utilities',
  },

  // --- 5. Income vs False-Positive Package Delivery Guards (7 cases) ---
  {
    input: '+500k thưởng nóng',
    expectedAmount: 500_000,
    expectedType: 'income',
    expectedSlug: 'bonus',
  },
  {
    input: 'lương tháng 11 18tr',
    expectedAmount: 18_000_000,
    expectedType: 'income',
    expectedSlug: 'salary',
  },
  {
    input: 'nhận lương 15tr5',
    expectedAmount: 15_500_000,
    expectedType: 'income',
    expectedSlug: 'salary',
  },
  {
    input: 'hoàn tiền shopee 50k',
    expectedAmount: 50_000,
    expectedType: 'income',
    expectedSlug: 'gifts-cashback',
  },
  {
    input: 'cashback thẻ 120k',
    expectedAmount: 120_000,
    expectedType: 'income',
    expectedSlug: 'gifts-cashback',
  },
  // False-positive guard: "nhận đồ / nhận hàng" is EXPENSE, not income!
  {
    input: 'nhận đồ shopee 50k',
    expectedAmount: 50_000,
    expectedType: 'expense',
    expectedSlug: 'shopping',
  },
  {
    input: 'nhận hàng lazada 120k',
    expectedAmount: 120_000,
    expectedType: 'expense',
    expectedSlug: 'shopping',
  },

  // --- 6. Transfers vs Expense False-Positive Guards (7 cases) ---
  {
    input: 'rút tiền 500k',
    expectedAmount: 500_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_cash',
  },
  {
    input: 'rút atm 2tr',
    expectedAmount: 2_000_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_cash',
  },
  {
    input: 'nạp ví 500k',
    expectedAmount: 500_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_ewallet',
  },
  {
    input: 'nạp momo 300k',
    expectedAmount: 300_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_ewallet',
  },
  // False-positive guard: "nạp đt / nạp điện thoại" is EXPENSE (utilities), NOT transfer!
  {
    input: 'nạp đt 100k',
    expectedAmount: 100_000,
    expectedType: 'expense',
    expectedSlug: 'utilities',
  },
  {
    input: 'nạp điện thoại 50k',
    expectedAmount: 50_000,
    expectedType: 'expense',
    expectedSlug: 'utilities',
  },
  {
    input: 'gửi tiết kiệm 5tr',
    expectedAmount: 5_000_000,
    expectedType: 'transfer',
    expectedRoute: 'to_savings',
  },

  // --- 7. Credit Card Payment vs Expense vs Debt Flows (8 cases) ---
  {
    input: 'trả thẻ 3tr',
    expectedAmount: 3_000_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_credit_card',
  },
  {
    input: 'thanh toán thẻ 4tr5',
    expectedAmount: 4_500_000,
    expectedType: 'transfer',
    expectedRoute: 'bank_to_credit_card',
  },
  {
    input: 'trả tiền nhà 3tr',
    expectedAmount: 3_000_000,
    expectedType: 'expense',
    expectedSlug: 'rent',
  },
  {
    input: 'trả tiền điện 600k',
    expectedAmount: 600_000,
    expectedType: 'expense',
    expectedSlug: 'utilities',
  },
  {
    input: 'trả Minh 300k',
    expectedAmount: 300_000,
    expectedType: 'debt_repay',
    expectedCounterparty: 'Minh',
  },
  {
    input: 'cho Hùng mượn 500k',
    expectedAmount: 500_000,
    expectedType: 'debt_lend',
    expectedCounterparty: 'Hùng',
  },
  {
    input: 'mượn Lan 2tr',
    expectedAmount: 2_000_000,
    expectedType: 'debt_borrow',
    expectedCounterparty: 'Lan',
  },
  {
    input: 'Tuấn trả nợ 400k #dalat #team',
    expectedAmount: 400_000,
    expectedType: 'debt_collect',
    expectedCounterparty: 'Tuấn',
    expectedTags: ['dalat', 'team'],
  },
];

describe('Milestone 2: Quick Input Parser (>= 55 cases), Adaptive Learning & Tags', () => {
  it.each(FIFTY_SIX_PARSER_CASES)(
    'parses "$input" (thousandsMode=$thousandsMode) -> amount=$expectedAmount, type=$expectedType',
    (tc) => {
      const res = parseQuickInput(tc.input, {
        thousandsInputMode: tc.thousandsMode ?? true,
      });

      expect(res.amountMinor).toBe(tc.expectedAmount);
      expect(res.type).toBe(tc.expectedType);
      if (tc.expectedCurrency) {
        expect(res.currency).toBe(tc.expectedCurrency);
      }
      if (tc.expectedSlug !== undefined) {
        expect(res.categorySlug).toBe(tc.expectedSlug);
      }
      if (tc.expectedRoute !== undefined) {
        expect(res.transferRoute).toBe(tc.expectedRoute);
      }
      if (tc.expectedCounterparty !== undefined) {
        expect(res.counterpartyName).toBe(tc.expectedCounterparty);
      }
      if (tc.expectedTags) {
        expect(res.tags).toEqual(tc.expectedTags);
      }
    },
  );

  it('learns user category & account preferences via MerchantAliasRepository and links #tags via TagRepository', async () => {
    const db = new FnAppLocalDB('test_fn_app_m2');
    await db.delete();
    await db.open();

    const aliasRepo = new MerchantAliasRepository(db);
    const tagRepo = new TagRepository(db);

    // User teaches "bánh tráng trộn" -> hangout-dating category & MoMo account
    await aliasRepo.learnAliasAtomic({
      rawKeyword: 'bánh tráng trộn',
      categoryId: '10000000-0000-4000-8000-000000000501', // hangout-dating
      accountId: 'acc-default-momo',
    });

    const learned = await aliasRepo.listTopAliases();
    expect(learned).toHaveLength(1);

    const parsed = parseQuickInput('bánh tráng trộn 35k #anvat #saigon', {
      learnedAliases: learned,
    });
    expect(parsed.amountMinor).toBe(35_000);
    expect(parsed.categoryId).toBe('10000000-0000-4000-8000-000000000501');
    expect(parsed.suggestedAccountId).toBe('acc-default-momo');
    expect(parsed.tags).toEqual(['anvat', 'saigon']);

    // Persist tags to a transaction and read back map
    await tagRepo.attachTagsToTransactionAtomic('tx-btt-1', parsed.tags);
    const tagMap = await tagRepo.getTagsByTransactionIdMap();
    expect(tagMap['tx-btt-1']).toEqual(['anvat', 'saigon']);

    await db.close();
  });
});
