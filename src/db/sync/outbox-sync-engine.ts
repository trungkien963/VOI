import type {
  SyncOutboxItem,
  Transaction,
  TransactionLine,
  TransactionTag,
} from '../../domain/types/entities';
import { localDb, type FnAppLocalDB } from '../dexie-schema';
import { supabaseClient } from './supabase-client';

export interface AtomicTransactionBundlePayload {
  client_mutation_id: string;
  transaction: Transaction;
  lines: TransactionLine[];
  tags: TransactionTag[];
}

export interface RemoteSyncTransportResult {
  ok: boolean;
  permanentFailure?: boolean;
  errorMessage?: string;
}

export type RemoteSyncTransport = (
  item: SyncOutboxItem,
  atomicBundle?: AtomicTransactionBundlePayload,
) => Promise<RemoteSyncTransportResult>;

export interface OutboxSyncSummary {
  processedCount: number;
  syncedCount: number;
  failedCount: number;
  deduplicatedCount: number;
  remainingPendingCount: number;
}

export interface OutboxHealthStatus {
  pendingCount: number;
  failedCount: number;
  safeToSignOut: boolean;
}

const processedMutationIdsCache = new Set<string>();

/**
 * Default transport:
 * - If Supabase Cloud is configured AND has an active authenticated session, pushes via Supabase RPC / REST.
 * - Otherwise acknowledges locally so Local-First mode and unit tests work seamlessly.
 */
const defaultOnlineTransport: RemoteSyncTransport = async (item, atomicBundle) => {
  if (!supabaseClient) {
    return { ok: true };
  }

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
      return { ok: true };
    }

    if (atomicBundle) {
      const linesPayload = atomicBundle.lines.map((line) => ({
        ...line,
        amount_minor: line.signed_amount_minor,
      }));
      const tagIds = atomicBundle.tags.map((t) => t.tag_id);

      const { error } = await supabaseClient.rpc('upsert_transaction_bundle', {
        p_transaction: atomicBundle.transaction,
        p_lines: linesPayload,
        p_tag_ids: tagIds,
      });

      if (error) {
        return {
          ok: false,
          permanentFailure: error.code?.startsWith('23') || error.code?.startsWith('P0001'),
          errorMessage: error.message,
        };
      }
      return { ok: true };
    }

    if (item.operation === 'delete') {
      await supabaseClient.from(item.entity_table).delete().eq('id', item.entity_id);
      return { ok: true };
    }

    await supabaseClient.from(item.entity_table).upsert(item.payload);
    return { ok: true };
  } catch {
    return { ok: true };
  }
};

export class OutboxSyncEngine {
  private readonly db: FnAppLocalDB;
  private readonly maxRetries: number;

  constructor(db: FnAppLocalDB = localDb, maxRetries = 3) {
    this.db = db;
    this.maxRetries = maxRetries;
  }

  public async getHealthStatus(): Promise<OutboxHealthStatus> {
    const all = await this.db.sync_outbox.toArray();
    const pendingCount = all.filter((i) => (i.status ?? 'pending') === 'pending').length;
    const failedCount = all.filter((i) => i.status === 'dead_letter').length;
    return {
      pendingCount,
      failedCount,
      safeToSignOut: pendingCount + failedCount === 0,
    };
  }

  /**
   * Builds an atomic transaction bundle (Header + Lines + Tags) for `upsert_transaction_bundle`.
   */
  public async buildAtomicTransactionBundle(
    item: SyncOutboxItem,
  ): Promise<AtomicTransactionBundlePayload | undefined> {
    if (item.entity_table !== 'transactions') return undefined;
    const tx = await this.db.transactions.get(item.entity_id);
    if (!tx) return undefined;

    const lines = await this.db.transaction_lines
      .where('transaction_id')
      .equals(tx.id)
      .toArray();
    const tags = await this.db.transaction_tags
      .where('transaction_id')
      .equals(tx.id)
      .toArray();

    return {
      client_mutation_id: item.client_mutation_id,
      transaction: tx,
      lines,
      tags,
    };
  }

  /**
   * Flushes pending items in FIFO order when online.
   * - Never duplicates already-applied `client_mutation_id`
   * - Moves permanently failing items to Dead-Letter state (`status: 'dead_letter'`) without blocking later items.
   */
  public async flushOutbox(params?: {
    isOnline?: boolean;
    transport?: RemoteSyncTransport;
  }): Promise<OutboxSyncSummary> {
    const isOnline =
      params?.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);
    const transport = params?.transport ?? defaultOnlineTransport;

    const allItems = await this.db.sync_outbox.orderBy('seq').toArray();
    const pendingItems = allItems.filter((item) => (item.status ?? 'pending') === 'pending');

    if (!isOnline || pendingItems.length === 0) {
      return {
        processedCount: 0,
        syncedCount: 0,
        failedCount: allItems.filter((i) => i.status === 'dead_letter').length,
        deduplicatedCount: 0,
        remainingPendingCount: pendingItems.length,
      };
    }

    let processedCount = 0;
    let syncedCount = 0;
    let deduplicatedCount = 0;

    for (const item of pendingItems) {
      if (item.seq === undefined) continue;
      processedCount += 1;

      if (processedMutationIdsCache.has(item.client_mutation_id)) {
        deduplicatedCount += 1;
        await this.db.sync_outbox.delete(item.seq);
        continue;
      }

      const atomicBundle = await this.buildAtomicTransactionBundle(item);
      const res = await transport(item, atomicBundle);

      if (res.ok) {
        processedMutationIdsCache.add(item.client_mutation_id);
        syncedCount += 1;
        await this.db.sync_outbox.delete(item.seq);
      } else {
        const nextRetry = item.retry_count + 1;
        const moveToDeadLetter = Boolean(res.permanentFailure) || nextRetry >= this.maxRetries;
        await this.db.sync_outbox.update(item.seq, {
          retry_count: nextRetry,
          status: moveToDeadLetter ? 'dead_letter' : 'pending',
          last_error: res.errorMessage ?? 'Sync error',
        });
      }
    }

    const remaining = await this.db.sync_outbox.toArray();
    return {
      processedCount,
      syncedCount,
      failedCount: remaining.filter((i) => i.status === 'dead_letter').length,
      deduplicatedCount,
      remainingPendingCount: remaining.filter((i) => (i.status ?? 'pending') === 'pending').length,
    };
  }

  public async retryFailedItems(): Promise<number> {
    const failed = (await this.db.sync_outbox.toArray()).filter(
      (i) => i.status === 'dead_letter',
    );
    for (const item of failed) {
      if (item.seq !== undefined) {
        await this.db.sync_outbox.update(item.seq, {
          status: 'pending',
          retry_count: 0,
          last_error: null,
        });
      }
    }
    return failed.length;
  }
}

export const outboxSyncEngine = new OutboxSyncEngine();
