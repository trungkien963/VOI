import type { Table } from 'dexie';
import {
  computeReconcileAdjustment,
  type ReconcileResult,
} from '../../domain/ledger/reconcile-calculator';
import { getLedgerStrategy } from '../../domain/ledger/strategies';
import { convertMinorToBase } from '../../domain/money/currency';
import type { GeometricShape, Pocket } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';
import { transactionRepository } from './transaction-repository';

export interface CreatePocketInput {
  id?: string;
  userId?: string;
  accountId: string;
  name: string;
  currency: string;
  isDefault?: boolean;
  openingBalanceMinor?: number;
  colorHex?: string;
  iconName?: GeometricShape;
}

export class PocketRepository extends BaseRepository<Pocket> {
  protected readonly tableName = 'pockets';

  protected get table(): Table<Pocket, string> {
    return this.db.pockets;
  }

  public async listByAccount(accountId: string): Promise<Pocket[]> {
    const all = await this.db.pockets.where('account_id').equals(accountId).toArray();
    return all.filter((p) => p.archived_at === null);
  }

  public async listActivePockets(): Promise<Pocket[]> {
    const all = await this.db.pockets.toArray();
    return all.filter((p) => p.archived_at === null);
  }

  public async getDefaultPocket(accountId: string): Promise<Pocket | undefined> {
    const pockets = await this.listByAccount(accountId);
    return pockets.find((p) => p.is_default) ?? pockets[0];
  }

  /**
   * Creates a currency pocket for an account and, if `openingBalanceMinor !== 0`,
   * atomically records an `opening_balance` transaction in the ledger.
   */
  public async createPocketWithOpeningBalance(input: CreatePocketInput): Promise<Pocket> {
    const nowIso = new Date().toISOString();
    const pocketId = input.id ?? `pocket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userId = input.userId ?? 'local-user';
    const openingMinor = input.openingBalanceMinor ?? 0;

    const pocket: Pocket = {
      id: pocketId,
      user_id: userId,
      account_id: input.accountId,
      name: input.name,
      currency: input.currency,
      type: 'spendable',
      target_amount_minor: null,
      target_date: null,
      cached_balance_minor: openingMinor,
      color_hex: input.colorHex ?? '#3B82F6',
      icon_name: input.iconName ?? 'hexagon',
      is_default: input.isDefault ?? false,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.db.transaction(
      'rw',
      [
        this.db.pockets,
        this.db.accounts,
        this.db.transactions,
        this.db.transaction_lines,
        this.db.sync_outbox,
      ],
      async () => {
        await this.db.pockets.put(pocket);
        await this.db.sync_outbox.add({
          client_mutation_id: `pockets:${pocket.id}:${Date.now()}`,
          entity_table: 'pockets',
          operation: 'upsert',
          entity_id: pocket.id,
          payload: pocket as unknown as Record<string, unknown>,
          created_at: Date.now(),
          retry_count: 0,
          status: 'pending',
          last_error: null,
        });

        if (openingMinor !== 0) {
          const obBundle = getLedgerStrategy('opening_balance').buildBundle({
            transactionId: `tx-ob-${pocket.id}`,
            userId,
            type: 'opening_balance',
            amountMinor: openingMinor,
            currency: input.currency,
            sourceAccountId: input.accountId,
            sourcePocketId: pocket.id,
            note: `Opening balance (${input.currency})`,
            occurredAt: nowIso,
          });
          await this.db.transactions.put(obBundle.transaction);
          await this.db.transaction_lines.bulkPut(obBundle.lines);
        }

        const acc = await this.db.accounts.get(input.accountId);
        if (acc && openingMinor !== 0) {
          const baseDelta = convertMinorToBase(openingMinor, input.currency, 'VND');
          await this.db.accounts.update(input.accountId, {
            cached_balance_minor: acc.cached_balance_minor + baseDelta,
            updated_at: nowIso,
          });
        }
      },
    );

    return pocket;
  }

  /**
   * Section 5.4: Reconciles a pocket's actual balance with its cached app balance.
   */
  public async reconcilePocketBalanceAtomic(
    pocketId: string,
    actualBalanceMinor: number,
    occurredAt?: string,
  ): Promise<ReconcileResult> {
    const pocket = await this.db.pockets.get(pocketId);
    if (!pocket) {
      throw new Error(`Pocket ${pocketId} not found`);
    }

    const res = computeReconcileAdjustment({
      transactionId: `tx-reconcile-${pocketId}-${Date.now()}`,
      userId: pocket.user_id,
      accountId: pocket.account_id,
      pocketId: pocket.id,
      currency: (pocket.currency ?? 'VND') as 'VND' | 'USD' | 'EUR' | 'JPY' | 'SGD',
      appBalanceMinor: pocket.cached_balance_minor,
      actualBalanceMinor,
      occurredAt,
    });

    if (res.bundle) {
      await transactionRepository.saveBundlesAtomic([res.bundle]);
    }

    return res;
  }
}

export const pocketRepository = new PocketRepository();
