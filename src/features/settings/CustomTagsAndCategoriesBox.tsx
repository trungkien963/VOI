import { useState, type ReactElement } from 'react';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '../../db/dexie-schema';
import { useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';

export function CustomTagsAndCategoriesBox(): ReactElement {
  const { locale } = useTranslation();
  const isVi = locale === 'vi';

  const tags = useLiveQuery(() => localDb.tags.toArray(), [], []);
  const customCategories = useLiveQuery(
    async () => {
      const all = await localDb.categories.toArray();
      return all.filter((c) => !c.is_system && c.archived_at === null);
    },
    [],
    [],
  );

  const [newTagName, setNewTagName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddTag = async (): Promise<void> => {
    const clean = newTagName.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    await localDb.tags.put({
      id: `tag-${clean}-${Date.now()}`,
      user_id: 'local-user',
      name: clean,
      color_hex: '#3B82F6',
      created_at: nowIso,
    });
    setNewTagName('');
  };

  const handleAddCategory = async (): Promise<void> => {
    const name = newCategoryName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      id: `cat-custom-${Date.now()}`,
      user_id: 'local-user',
      parent_id: null,
      name,
      slug: slug || `custom-${Date.now()}`,
      kind: 'expense',
      icon_name: 'triangle',
      color_hex: '#FF6B35',
      keywords: [name.toLowerCase()],
      is_system: false,
      is_essential: false,
      sort_order: 900,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
    setNewCategoryName('');
  };

  return (
    <div
      data-testid="custom-tags-categories-box"
      className="space-y-3 border-t border-[var(--border-hairline)] pt-4"
    >
      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
        {isVi ? 'Quản lý Danh mục & Tag tùy chỉnh' : 'Custom Categories & Tags'}
      </h3>

      {/* Add Custom Tag */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder={isVi ? 'Thêm tag mới (VD: dalat, đám-cưới)' : 'New tag (e.g. trip, wedding)'}
          aria-label="New tag name"
          data-testid="new-tag-input"
          className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium"
        />
        <Button
          variant="outline"
          size="xs"
          onClick={() => void handleAddTag()}
          data-testid="add-tag-btn"
        >
          <TagIcon className="h-3.5 w-3.5" />
          <span>{isVi ? '+ Tag' : '+ Tag'}</span>
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-primary)]"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Add Custom Expense Category */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder={
            isVi ? 'Thêm danh mục chi mới (VD: Thú cưng)' : 'New expense category (e.g. Pets)'
          }
          aria-label="New category name"
          data-testid="new-category-input"
          className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium"
        />
        <Button
          variant="outline"
          size="xs"
          onClick={() => void handleAddCategory()}
          data-testid="add-category-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isVi ? '+ Danh mục' : '+ Category'}</span>
        </Button>
      </div>

      {customCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customCategories.map((cat) => (
            <span
              key={cat.id}
              className="rounded-full bg-[#FF6B35]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#FF6B35]"
            >
              {cat.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
