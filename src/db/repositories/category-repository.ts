import type { Table } from 'dexie';
import type { Category, CategoryKind } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';

export class CategoryRepository extends BaseRepository<Category> {
  protected readonly tableName = 'categories';

  protected get table(): Table<Category, string> {
    return this.db.categories;
  }

  public async listByKind(kind: CategoryKind): Promise<Category[]> {
    const items = await this.db.categories.where('kind').equals(kind).toArray();
    return items.filter((c) => c.archived_at === null).sort((a, b) => a.sort_order - b.sort_order);
  }

  public async findBySlug(slug: string): Promise<Category | undefined> {
    return this.db.categories.where('slug').equals(slug).first();
  }
}

export const categoryRepository = new CategoryRepository();
