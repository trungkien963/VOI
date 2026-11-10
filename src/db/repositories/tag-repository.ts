import type { Table } from 'dexie';
import type { Tag, TransactionTag } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';

export class TagRepository extends BaseRepository<Tag> {
  protected readonly tableName = 'tags';

  protected get table(): Table<Tag, string> {
    return this.db.tags;
  }

  /**
   * Ensures all `#tag` names exist in `tags` and links them to `transactionId` in `transaction_tags`.
   */
  public async attachTagsToTransactionAtomic(
    transactionId: string,
    tagNames: ReadonlyArray<string>,
    userId = 'local-user',
  ): Promise<Tag[]> {
    const normalizedNames = Array.from(
      new Set(tagNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    );
    if (normalizedNames.length === 0) return [];

    const nowIso = new Date().toISOString();
    const attachedTags: Tag[] = [];

    await this.db.transaction(
      'rw',
      [this.db.tags, this.db.transaction_tags, this.db.sync_outbox],
      async () => {
        const existingLinks = await this.db.transaction_tags
          .where('transaction_id')
          .equals(transactionId)
          .toArray();
        for (const link of existingLinks) {
          await this.db.transaction_tags.delete([link.transaction_id, link.tag_id]);
        }

        for (const name of normalizedNames) {
          let tag = await this.db.tags.where('name').equals(name).first();
          if (!tag) {
            tag = {
              id: `tag-${name}-${Date.now()}`,
              user_id: userId,
              name,
              color_hex: '#FF6B35',
              created_at: nowIso,
            };
            await this.db.tags.put(tag);
          }
          attachedTags.push(tag);

          const txTag: TransactionTag = {
            transaction_id: transactionId,
            tag_id: tag.id,
            user_id: userId,
          };
          await this.db.transaction_tags.put(txTag);
        }
      },
    );

    return attachedTags;
  }

  public async getTagsByTransactionIdMap(): Promise<Record<string, string[]>> {
    const [allTags, allLinks] = await Promise.all([
      this.db.tags.toArray(),
      this.db.transaction_tags.toArray(),
    ]);
    const tagById = new Map(allTags.map((t) => [t.id, t.name]));
    const result: Record<string, string[]> = {};
    for (const link of allLinks) {
      const name = tagById.get(link.tag_id);
      if (!name) continue;
      const list = result[link.transaction_id] ?? [];
      list.push(name);
      result[link.transaction_id] = list;
    }
    return result;
  }
}

export const tagRepository = new TagRepository();
