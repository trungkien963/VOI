import type { Table } from 'dexie';
import { getLedgerStrategy } from '../../domain/ledger/strategies';
import { convertMinorToBase } from '../../domain/money/currency';
import type { Account, AccountType, GeometricShape, Pocket } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';

export interface CreateAccountInput {
  id?: string;
  userId?: string;
  name: string;
  type: AccountType;
  currency?: string;
  openingBalanceMinor?: number;
  colorHex?: string;
  iconName?: GeometricShape;
  creditLimitMinor?: number | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
}

const ACCOUNT_DEFAULT_VISUALS: Record<AccountType, { shape: GeometricShape; colorHex: string }> = {
  bank: { shape: 'hexagon', colorHex: '#3B82F6' },
  cash: { shape: 'arch', colorHex: '#FFB703' },
  e_wallet: { shape: 'pentagon', colorHex: '#F472B6' },
  savings: { shape: 'square', colorHex: '#10B981' },
  credit_card: { shape: 'circle', colorHex: '#8B5CF6' },
};

export class AccountRepository extends BaseRepository<Account> {
  protected readonly tableName = 'accounts';

  protected get table(): Table<Account, string> {
    return this.db.accounts;
  }

  public async listActiveAccounts(): Promise<Account[]> {
    const all = await this.db.accounts.toArray();
    return all.filter((a) => a.archived_at === null).sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Atomically creates an Account, its default currency Pocket, and an `opening_balance`
   * ledger entry if `openingBalanceMinor !== 0` (supports negative opening debt on credit cards).
   */
  public async createAccountWithOpeningBalance(
    input: CreateAccountInput,
  ): Promise<{ account: Account; defaultPocket: Pocket }> {
    const nowIso = new Date().toISOString();
    const accountId = input.id ?? `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userId = input.userId ?? 'local-user';
    const currency = input.currency ?? 'VND';
    const openingMinor = input.openingBalanceMinor ?? 0;
    const visuals = ACCOUNT_DEFAULT_VISUALS[input.type];
    const existingCount = await this.db.accounts.count();

    const account: Account = {
      id: accountId,
      user_id: userId,
      name: input.name,
      type: input.type,
      currency,
      institution_name: null,
      color_hex: input.colorHex ?? visuals.colorHex,
      icon_name: input.iconName ?? visuals.shape,
      include_in_net_worth: true,
      is_default_spend: existingCount === 0,
      cached_balance_minor: convertMinorToBase(openingMinor, currency, 'VND'),
      credit_limit_minor: input.creditLimitMinor ?? null,
      statement_day: input.statementDay ?? null,
      payment_due_day: input.paymentDueDay ?? null,
      grace_period_days: null,
      apr_bps: null,
      sort_order: (existingCount + 1) * 10,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const defaultPocket: Pocket = {
      id: `pocket-${accountId}-${currency.toLowerCase()}`,
      user_id: userId,
      account_id: accountId,
      name: `${input.name} (${currency})`,
      currency,
      type: 'spendable',
      target_amount_minor: null,
      target_date: null,
      cached_balance_minor: openingMinor,
      color_hex: account.color_hex,
      icon_name: account.icon_name,
      is_default: true,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.db.transaction(
      'rw',
      [
        this.db.accounts,
        this.db.pockets,
        this.db.transactions,
        this.db.transaction_lines,
        this.db.sync_outbox,
      ],
      async () => {
        await this.db.accounts.put(account);
        await this.db.pockets.put(defaultPocket);

        await this.db.sync_outbox.add({
          client_mutation_id: `accounts:${account.id}:${Date.now()}`,
          entity_table: 'accounts',
          operation: 'upsert',
          entity_id: account.id,
          payload: account as unknown as Record<string, unknown>,
          created_at: Date.now(),
          retry_count: 0,
          status: 'pending',
          last_error: null,
        });

        if (openingMinor !== 0) {
          const obBundle = getLedgerStrategy('opening_balance').buildBundle({
            transactionId: `tx-ob-${account.id}`,
            userId,
            type: 'opening_balance',
            amountMinor: openingMinor,
            currency,
            sourceAccountId: account.id,
            sourcePocketId: defaultPocket.id,
            note: `Opening balance — ${account.name}`,
            occurredAt: nowIso,
          });
          await this.db.transactions.put(obBundle.transaction);
          await this.db.transaction_lines.bulkPut(obBundle.lines);
          await this.db.sync_outbox.add({
            client_mutation_id: `tx_bundle:${obBundle.transaction.id}:${Date.now()}`,
            entity_table: 'transactions',
            operation: 'upsert_tx_bundle',
            entity_id: obBundle.transaction.id,
            payload: obBundle as unknown as Record<string, unknown>,
            created_at: Date.now(),
            retry_count: 0,
            status: 'pending',
            last_error: null,
          });
        }
      },
    );

    return { account, defaultPocket };
  }

  public async archiveAccountAtomic(accountId: string): Promise<void> {
    const existing = await this.findById(accountId);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    await this.upsertAtomic({ ...existing, archived_at: nowIso, updated_at: nowIso });

    const pockets = await this.db.pockets.where('account_id').equals(accountId).toArray();
    for (const p of pockets) {
      await this.db.pockets.put({
        ...p,
        archived_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  public async restoreAccountAtomic(accountId: string): Promise<void> {
    const existing = await this.findById(accountId);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    await this.upsertAtomic({ ...existing, archived_at: null, updated_at: nowIso });

    const pockets = await this.db.pockets.where('account_id').equals(accountId).toArray();
    for (const p of pockets) {
      await this.db.pockets.put({
        ...p,
        archived_at: null,
        updated_at: nowIso,
      });
    }
  }

  public async updateAccountAtomic(input: {
    id: string;
    name: string;
    type: AccountType;
    creditLimitMinor?: number | null;
  }): Promise<Account | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const visuals = ACCOUNT_DEFAULT_VISUALS[input.type];
    const nowIso = new Date().toISOString();
    const updated: Account = {
      ...existing,
      name: input.name.trim(),
      type: input.type,
      color_hex: visuals.colorHex,
      icon_name: visuals.shape,
      credit_limit_minor:
        input.creditLimitMinor !== undefined ? input.creditLimitMinor : existing.credit_limit_minor,
      updated_at: nowIso,
    };
    await this.upsertAtomic(updated);

    const pockets = await this.db.pockets.where('account_id').equals(input.id).toArray();
    for (const p of pockets) {
      if (p.is_default) {
        await this.db.pockets.put({
          ...p,
          name: `${updated.name} (${p.currency ?? 'VND'})`,
          color_hex: updated.color_hex,
          icon_name: updated.icon_name,
          updated_at: nowIso,
        });
      }
    }
    return updated;
  }
}

export const accountRepository = new AccountRepository();
