import type { Table } from 'dexie';
import {
  buildTransferWithFeeBundles,
  getLedgerStrategy,
  type LedgerBundleResult,
  type LedgerEntryInput,
} from '../../domain/ledger/strategies';
import { convertMinorToBase } from '../../domain/money/currency';
import type { Transaction, TransactionLine } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';

export class TransactionRepository extends BaseRepository<Transaction> {
  protected readonly tableName = 'transactions';

  protected get table(): Table<Transaction, string> {
    return this.db.transactions;
  }

  public async listActiveTransactions(): Promise<Transaction[]> {
    const all = await this.db.transactions.toArray();
    return all
      .filter((t) => t.voided_at === null && t.status !== 'void')
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }

  public async listActiveLines(): Promise<TransactionLine[]> {
    const all = await this.db.transaction_lines.toArray();
    return all.filter((l) => !l.deleted_at);
  }

  /**
   * Atomically creates one or more LedgerBundles (e.g. a Transfer + its Fee Expense),
   * updates Pocket & Account cached balances, and appends to `sync_outbox`.
   */
  public async createFromInputAtomic(input: LedgerEntryInput): Promise<LedgerBundleResult[]> {
    const bundles =
      input.type === 'transfer' && (input.transferFeeMinor ?? 0) > 0
        ? buildTransferWithFeeBundles(input)
        : [getLedgerStrategy(input.type).buildBundle(input)];

    await this.saveBundlesAtomic(bundles);
    return bundles;
  }

  public async saveBundlesAtomic(bundles: ReadonlyArray<LedgerBundleResult>): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db.transaction(
      'rw',
      [
        this.db.transactions,
        this.db.transaction_lines,
        this.db.pockets,
        this.db.accounts,
        this.db.sync_outbox,
      ],
      async () => {
        for (const bundle of bundles) {
          await this.db.transactions.put(bundle.transaction);
          await this.db.transaction_lines.bulkPut(bundle.lines);

          for (const line of bundle.lines) {
            if (line.pocket_id) {
              const pocket = await this.db.pockets.get(line.pocket_id);
              if (pocket) {
                await this.db.pockets.update(pocket.id, {
                  cached_balance_minor: pocket.cached_balance_minor + line.signed_amount_minor,
                  updated_at: nowIso,
                });
              }
            }
            const account = await this.db.accounts.get(line.account_id);
            if (account) {
              const baseDelta =
                line.amount_base_minor ??
                convertMinorToBase(
                  line.signed_amount_minor,
                  line.currency ?? bundle.transaction.currency,
                  'VND',
                  line.fx_rate_to_base,
                );
              await this.db.accounts.update(account.id, {
                cached_balance_minor: account.cached_balance_minor + baseDelta,
                updated_at: nowIso,
              });
            }
          }

          await this.db.sync_outbox.add({
            client_mutation_id: `tx_bundle:${bundle.transaction.id}:${Date.now()}`,
            entity_table: 'transactions',
            operation: 'upsert_tx_bundle',
            entity_id: bundle.transaction.id,
            payload: bundle as unknown as Record<string, unknown>,
            created_at: Date.now(),
            retry_count: 0,
            status: 'pending',
            last_error: null,
          });
        }
      },
    );
  }

  /**
   * Atomically updates an existing transaction by reversing its previous lines
   * and applying the newly built bundle lines.
   */
  public async updateTransactionAtomic(input: LedgerEntryInput): Promise<LedgerBundleResult> {
    await this.softDeleteTransactionAtomic(input.transactionId);
    const rebuiltBundle = getLedgerStrategy(input.type).buildBundle(input);
    await this.saveBundlesAtomic([rebuiltBundle]);
    return rebuiltBundle;
  }

  /**
   * Section 4.1: Soft-deletes a transaction and synchronizes `deleted_at` across all its
   * `transaction_lines` while reversing Pocket and Account cached balances atomically.
   */
  public async softDeleteTransactionAtomic(transactionId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db.transaction(
      'rw',
      [
        this.db.transactions,
        this.db.transaction_lines,
        this.db.pockets,
        this.db.accounts,
        this.db.sync_outbox,
      ],
      async () => {
        const tx = await this.db.transactions.get(transactionId);
        if (!tx || tx.voided_at) return;

        const lines = await this.db.transaction_lines
          .where('transaction_id')
          .equals(transactionId)
          .toArray();

        await this.db.transactions.update(transactionId, {
          status: 'void',
          voided_at: nowIso,
          updated_at: nowIso,
        });

        for (const line of lines) {
          if (line.deleted_at) continue;
          await this.db.transaction_lines.update(line.id, { deleted_at: nowIso });

          if (line.pocket_id) {
            const pocket = await this.db.pockets.get(line.pocket_id);
            if (pocket) {
              await this.db.pockets.update(pocket.id, {
                cached_balance_minor: pocket.cached_balance_minor - line.signed_amount_minor,
                updated_at: nowIso,
              });
            }
          }
          const account = await this.db.accounts.get(line.account_id);
          if (account) {
            const baseDelta =
              line.amount_base_minor ??
              convertMinorToBase(
                line.signed_amount_minor,
                line.currency ?? tx.currency,
                'VND',
                line.fx_rate_to_base,
              );
            await this.db.accounts.update(account.id, {
              cached_balance_minor: account.cached_balance_minor - baseDelta,
              updated_at: nowIso,
            });
          }
        }

        await this.db.sync_outbox.add({
          client_mutation_id: `void_tx:${transactionId}:${Date.now()}`,
          entity_table: 'transactions',
          operation: 'void_tx',
          entity_id: transactionId,
          payload: { id: transactionId, voided_at: nowIso },
          created_at: Date.now(),
          retry_count: 0,
          status: 'pending',
          last_error: null,
        });
      },
    );
  }

  /**
   * Restores a soft-deleted transaction (1-tap Undo) and re-applies its line balances.
   */
  public async restoreTransactionAtomic(transactionId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db.transaction(
      'rw',
      [
        this.db.transactions,
        this.db.transaction_lines,
        this.db.pockets,
        this.db.accounts,
        this.db.sync_outbox,
      ],
      async () => {
        const tx = await this.db.transactions.get(transactionId);
        if (!tx || !tx.voided_at) return;

        const lines = await this.db.transaction_lines
          .where('transaction_id')
          .equals(transactionId)
          .toArray();

        await this.db.transactions.update(transactionId, {
          status: 'posted',
          voided_at: null,
          updated_at: nowIso,
        });

        for (const line of lines) {
          if (!line.deleted_at) continue;
          await this.db.transaction_lines.update(line.id, { deleted_at: null });

          if (line.pocket_id) {
            const pocket = await this.db.pockets.get(line.pocket_id);
            if (pocket) {
              await this.db.pockets.update(pocket.id, {
                cached_balance_minor: pocket.cached_balance_minor + line.signed_amount_minor,
                updated_at: nowIso,
              });
            }
          }
          const account = await this.db.accounts.get(line.account_id);
          if (account) {
            const baseDelta =
              line.amount_base_minor ??
              convertMinorToBase(
                line.signed_amount_minor,
                line.currency ?? tx.currency,
                'VND',
                line.fx_rate_to_base,
              );
            await this.db.accounts.update(account.id, {
              cached_balance_minor: account.cached_balance_minor + baseDelta,
              updated_at: nowIso,
            });
          }
        }
      },
    );
  }
}

export const transactionRepository = new TransactionRepository();
