import type { Table } from 'dexie';
import { computeDebtSummaryFromTransactions } from '../../domain/ledger/debt-calculator';
import {
  buildTransferWithFeeBundles,
  getLedgerStrategy,
  type LedgerBundleResult,
  type LedgerEntryInput,
} from '../../domain/ledger/strategies';
import { convertMinorToBase } from '../../domain/money/currency';
import type { DebtItem, Transaction, TransactionLine } from '../../domain/types/entities';
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
        this.db.debt_items,
        this.db.sync_outbox,
      ],
      async () => {
        const affectedDebtIds = new Set<string>();

        for (const bundle of bundles) {
          await this.db.transactions.put(bundle.transaction);
          await this.db.transaction_lines.bulkPut(bundle.lines);

          if (bundle.transaction.debt_id) {
            affectedDebtIds.add(bundle.transaction.debt_id);
          }

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

        if (affectedDebtIds.size > 0) {
          await this.reconcileAffectedDebtsInTx(affectedDebtIds, nowIso);
        }
      },
    );
  }

  /**
   * Atomically updates an existing transaction by reversing its previous lines
   * and applying the newly built bundle lines (including Transfer + Fee clusters).
   */
  public async updateTransactionAtomic(input: LedgerEntryInput): Promise<LedgerBundleResult> {
    await this.softDeleteTransactionAtomic(input.transactionId);
    const bundles =
      input.type === 'transfer' && (input.transferFeeMinor ?? 0) > 0
        ? buildTransferWithFeeBundles(input)
        : [getLedgerStrategy(input.type).buildBundle(input)];
    await this.saveBundlesAtomic(bundles);
    return bundles[0]!;
  }

  /**
   * Section 4.1: Soft-deletes a transaction (and any companion `group_id` or `-fee` cluster rows),
   * synchronizes `deleted_at` across all its `transaction_lines`, reverses Pocket and Account
   * cached balances, and reconciles any linked `debt_items` atomically.
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
        this.db.debt_items,
        this.db.sync_outbox,
      ],
      async () => {
        const primaryTx = await this.db.transactions.get(transactionId);
        if (!primaryTx) return;

        // Collect the primary transaction plus any companion group_id or -fee rows
        const clusterTxs: Transaction[] = [primaryTx];
        if (primaryTx.group_id) {
          const groupPeers = await this.db.transactions
            .where('group_id')
            .equals(primaryTx.group_id)
            .toArray();
          for (const peer of groupPeers) {
            if (peer.id !== primaryTx.id) {
              clusterTxs.push(peer);
            }
          }
        }
        const companionFeeTx = await this.db.transactions.get(`${transactionId}-fee`);
        if (companionFeeTx && !clusterTxs.some((t) => t.id === companionFeeTx.id)) {
          clusterTxs.push(companionFeeTx);
        }

        const affectedDebtIds = new Set<string>();

        for (const tx of clusterTxs) {
          if (tx.debt_id) {
            affectedDebtIds.add(tx.debt_id);
          }
          if (tx.voided_at) continue;

          const lines = await this.db.transaction_lines
            .where('transaction_id')
            .equals(tx.id)
            .toArray();

          await this.db.transactions.update(tx.id, {
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
            client_mutation_id: `void_tx:${tx.id}:${Date.now()}`,
            entity_table: 'transactions',
            operation: 'void_tx',
            entity_id: tx.id,
            payload: { id: tx.id, voided_at: nowIso },
            created_at: Date.now(),
            retry_count: 0,
            status: 'pending',
            last_error: null,
          });
        }

        if (affectedDebtIds.size > 0) {
          await this.reconcileAffectedDebtsInTx(affectedDebtIds, nowIso);
        }
      },
    );
  }

  /**
   * Restores a soft-deleted transaction (1-tap Undo), including any companion `group_id` or `-fee`
   * cluster rows, re-applies its line balances, and restores/reconciles any linked `debt_items`.
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
        this.db.debt_items,
        this.db.sync_outbox,
      ],
      async () => {
        const primaryTx = await this.db.transactions.get(transactionId);
        if (!primaryTx) return;

        const clusterTxs: Transaction[] = [primaryTx];
        if (primaryTx.group_id) {
          const groupPeers = await this.db.transactions
            .where('group_id')
            .equals(primaryTx.group_id)
            .toArray();
          for (const peer of groupPeers) {
            if (peer.id !== primaryTx.id) {
              clusterTxs.push(peer);
            }
          }
        }
        const companionFeeTx = await this.db.transactions.get(`${transactionId}-fee`);
        if (companionFeeTx && !clusterTxs.some((t) => t.id === companionFeeTx.id)) {
          clusterTxs.push(companionFeeTx);
        }

        const affectedDebtIds = new Set<string>();

        for (const tx of clusterTxs) {
          if (tx.debt_id) {
            affectedDebtIds.add(tx.debt_id);
          }
          if (!tx.voided_at) continue;

          const lines = await this.db.transaction_lines
            .where('transaction_id')
            .equals(tx.id)
            .toArray();

          await this.db.transactions.update(tx.id, {
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
        }

        if (affectedDebtIds.size > 0) {
          await this.reconcileAffectedDebtsInTx(affectedDebtIds, nowIso);
        }
      },
    );
  }

  /**
   * Synchronizes `debt_items` whenever a linked transaction (`debt_lend`, `debt_borrow`,
   * `debt_collect`, `debt_repay`) is created, updated, voided, or restored.
   * - If a non-opening-balance debt's origin transaction is voided (no active lend/borrow tx remains),
   *   the debt is marked `'cancelled'` (`remaining_minor: 0`, `deleted_at: nowIso`) so Net Worth
   *   and Debt Book never retain phantom IOUs.
   * - If the origin transaction is restored (or a repayment is voided/restored), the debt's
   *   `principal_minor`, `remaining_minor`, and `'open' | 'settled'` status are recomputed.
   */
  private async reconcileAffectedDebtsInTx(
    debtIds: ReadonlySet<string>,
    nowIso: string,
  ): Promise<void> {
    for (const debtId of debtIds) {
      const debt = await this.db.debt_items.get(debtId);
      if (!debt) continue;

      const linkedTxs = await this.db.transactions.where('debt_id').equals(debtId).toArray();
      const activeOriginTxs = linkedTxs.filter(
        (t) =>
          t.voided_at === null &&
          t.status !== 'void' &&
          (t.type === 'debt_lend' || t.type === 'debt_borrow'),
      );

      if (debt.origin !== 'opening_balance' && activeOriginTxs.length === 0) {
        const cancelledDebt: DebtItem = {
          ...debt,
          remaining_minor: 0,
          status: 'cancelled',
          settled_at: null,
          deleted_at: nowIso,
          updated_at: nowIso,
        };
        await this.db.debt_items.put(cancelledDebt);
        continue;
      }

      // Reactivate if previously cancelled when its origin tx was voided and is now restored
      const effectiveDebtForCalc: DebtItem =
        debt.status === 'cancelled' ? { ...debt, status: 'open', deleted_at: null } : debt;

      const summary = computeDebtSummaryFromTransactions(effectiveDebtForCalc, linkedTxs);
      const updatedDebt: DebtItem = {
        ...effectiveDebtForCalc,
        principal_minor: summary.principalMinor,
        remaining_minor: summary.remainingMinor,
        status: summary.status,
        settled_at: summary.status === 'settled' ? (debt.settled_at ?? nowIso) : null,
        deleted_at: null,
        updated_at: nowIso,
      };
      await this.db.debt_items.put(updatedDebt);
    }
  }
}

export const transactionRepository = new TransactionRepository();
