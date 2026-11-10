import type { Table } from 'dexie';
import type { OutboxOperation, SyncOutboxItem } from '../../domain/types/entities';
import { localDb, type FnAppLocalDB } from '../dexie-schema';

export interface IdentifiableEntity {
  id: string;
  updated_at?: string;
}

/**
 * Generic abstract repository encapsulating Local-First CRUD and atomic Outbox enqueueing.
 * Concrete repositories inherit from BaseRepository to avoid repeating Dexie transaction boilerplate.
 */
export abstract class BaseRepository<TEntity extends IdentifiableEntity> {
  protected readonly db: FnAppLocalDB;
  protected abstract readonly tableName: string;
  protected abstract readonly table: Table<TEntity, string>;

  constructor(db: FnAppLocalDB = localDb) {
    this.db = db;
  }

  public async findById(id: string): Promise<TEntity | undefined> {
    return this.table.get(id);
  }

  public async listAll(): Promise<TEntity[]> {
    return this.table.toArray();
  }

  public async count(): Promise<number> {
    return this.table.count();
  }

  /**
   * Atomically writes the entity to IndexedDB and appends a mutation record to `sync_outbox`.
   */
  public async upsertAtomic(
    entity: TEntity,
    operation: OutboxOperation = 'upsert',
  ): Promise<TEntity> {
    const nowIso = new Date().toISOString();
    const updatedEntity: TEntity = {
      ...entity,
      updated_at: nowIso,
    };

    const outboxItem: SyncOutboxItem = {
      client_mutation_id: `${this.tableName}:${entity.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      entity_table: this.tableName,
      operation,
      entity_id: entity.id,
      payload: updatedEntity as unknown as Record<string, unknown>,
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending',
      last_error: null,
    };

    await this.db.transaction('rw', [this.table, this.db.sync_outbox], async () => {
      await this.table.put(updatedEntity);
      await this.db.sync_outbox.add(outboxItem);
    });

    return updatedEntity;
  }

  public async deleteAtomic(id: string): Promise<void> {
    const outboxItem: SyncOutboxItem = {
      client_mutation_id: `${this.tableName}:${id}:del:${Date.now()}`,
      entity_table: this.tableName,
      operation: 'delete',
      entity_id: id,
      payload: { id },
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending',
      last_error: null,
    };

    await this.db.transaction('rw', [this.table, this.db.sync_outbox], async () => {
      await this.table.delete(id);
      await this.db.sync_outbox.add(outboxItem);
    });
  }
}
