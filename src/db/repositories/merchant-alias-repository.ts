import type { Table } from 'dexie';
import { normalizeVietnamese } from '../../domain/quick-parser/amount-extractor';
import type { MerchantAlias } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';

export class MerchantAliasRepository extends BaseRepository<MerchantAlias> {
  protected readonly tableName = 'merchant_aliases';

  protected get table(): Table<MerchantAlias, string> {
    return this.db.merchant_aliases;
  }

  public async listTopAliases(): Promise<MerchantAlias[]> {
    const all = await this.db.merchant_aliases.toArray();
    return all.sort((a, b) => b.hit_count - a.hit_count);
  }

  /**
   * Section 6.2 Adaptive Learning: Records or increments a user's preferred
   * category & account mapping for a normalized note keyword.
   */
  public async learnAliasAtomic(params: {
    rawKeyword: string;
    categoryId: string | null;
    accountId: string | null;
    userId?: string;
  }): Promise<MerchantAlias | null> {
    const normalized = normalizeVietnamese(params.rawKeyword);
    if (!normalized || normalized.length < 2) return null;

    const userId = params.userId ?? 'local-user';
    const nowIso = new Date().toISOString();

    const existing = await this.db.merchant_aliases
      .where('pattern_normalized')
      .equals(normalized)
      .first();

    const alias: MerchantAlias = existing
      ? {
          ...existing,
          category_id: params.categoryId ?? existing.category_id,
          default_account_id: params.accountId ?? existing.default_account_id,
          hit_count: existing.hit_count + 1,
          last_used_at: nowIso,
        }
      : {
          id: `alias-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: userId,
          pattern_normalized: normalized,
          category_id: params.categoryId,
          default_account_id: params.accountId,
          hit_count: 1,
          last_used_at: nowIso,
        };

    await this.upsertAtomic(alias);
    return alias;
  }
}

export const merchantAliasRepository = new MerchantAliasRepository();
