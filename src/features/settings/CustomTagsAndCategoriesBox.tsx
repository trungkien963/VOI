import { useState, type ReactElement } from 'react';
import { Check, Pencil, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '../../db/dexie-schema';
import { mergeSystemAndLiveCategories } from '../../domain/categories/default-categories';
import type { Category } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';

const PANTONE_CATEGORY_COLORS = [
  { hex: '#FF7A1A', name: 'Orange' },
  { hex: '#52C470', name: 'Green' },
  { hex: '#5E89ED', name: 'Blue' },
  { hex: '#EF6EA5', name: 'Pink' },
  { hex: '#F2D147', name: 'Yellow' },
  { hex: '#BF9BDE', name: 'Lilac' },
];

export function CustomTagsAndCategoriesBox(): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';

  const tags = useLiveQuery(() => localDb.tags.toArray(), [], []);
  const liveCategories = useLiveQuery(() => localDb.categories.toArray(), [], []);
  const allCategories = mergeSystemAndLiveCategories(liveCategories);

  const [activeKind, setActiveKind] = useState<'expense' | 'income'>('expense');
  const [newTagName, setNewTagName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#FF7A1A');

  const [addingSubForParentId, setAddingSubForParentId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const parentCategories = allCategories.filter(
    (c) =>
      c.kind === activeKind &&
      c.parent_id === null &&
      c.archived_at === null &&
      c.slug !== 'unknown-expense' &&
      c.slug !== 'unknown-income',
  );

  const handleAddTag = async (): Promise<void> => {
    const clean = newTagName.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    await localDb.tags.put({
      id: `tag-${clean}-${Date.now()}`,
      user_id: 'local-user',
      name: clean,
      color_hex: '#5E89ED',
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
      kind: activeKind,
      icon_name: activeKind === 'income' ? 'square' : 'triangle',
      color_hex: newCategoryColor,
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

  const handleAddSubcategory = async (parentCat: Category): Promise<void> => {
    const name = newSubName.trim();
    if (!name) return;
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `sub-${Date.now()}`;
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      id: `cat-sub-${Date.now()}`,
      user_id: 'local-user',
      parent_id: parentCat.id,
      name,
      slug,
      kind: parentCat.kind,
      icon_name: parentCat.icon_name,
      color_hex: parentCat.color_hex,
      keywords: [name.toLowerCase()],
      is_system: false,
      is_essential: parentCat.is_essential,
      sort_order: parentCat.sort_order + 5,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
    setNewSubName('');
    setAddingSubForParentId(null);
  };

  const handleSaveRename = async (cat: Category): Promise<void> => {
    const clean = editingCatName.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      ...cat,
      name: clean,
      keywords: Array.from(new Set([...cat.keywords, clean.toLowerCase()])),
      updated_at: nowIso,
    });
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleArchiveCategory = async (cat: Category): Promise<void> => {
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      ...cat,
      archived_at: nowIso,
      updated_at: nowIso,
    });
  };

  return (
    <div
      data-testid="custom-tags-categories-box"
      className="space-y-4 border-t border-[var(--border-hairline)] pt-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
          {isVi
            ? 'Tùy chỉnh Danh mục Cha, Mục Con & Tag'
            : 'Customize Categories, Subcategories & Tags'}
        </h3>

        <div className="inline-flex rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => setActiveKind('expense')}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition ${
              activeKind === 'expense'
                ? 'bg-[#191919] text-[#FAFAFA]'
                : 'text-[var(--ink-secondary)]'
            }`}
          >
            {isVi ? 'Chi tiêu' : 'Expense'}
          </button>
          <button
            type="button"
            onClick={() => setActiveKind('income')}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition ${
              activeKind === 'income'
                ? 'bg-[#52C470] text-[#191919]'
                : 'text-[var(--ink-secondary)]'
            }`}
          >
            {isVi ? 'Thu nhập' : 'Income'}
          </button>
        </div>
      </div>

      {/* Add Custom Parent Category + Pantone Color Picker */}
      <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={
              activeKind === 'expense'
                ? isVi
                  ? 'Thêm danh mục chi mới (VD: Thú cưng, Thể thao)'
                  : 'New expense category (e.g. Pets, Sports)'
                : isVi
                  ? 'Thêm danh mục thu mới (VD: Cho thuê nhà, Bán hàng)'
                  : 'New income category (e.g. Rental, Side Hustle)'
            }
            aria-label="New category name"
            data-testid="new-category-input"
            className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold"
          />
          <Button
            variant="ink"
            size="xs"
            onClick={() => void handleAddCategory()}
            data-testid="add-category-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isVi ? '+ Danh mục' : '+ Category'}</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
            {isVi ? 'Màu Pantone:' : 'Color:'}
          </span>
          {PANTONE_CATEGORY_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setNewCategoryColor(c.hex)}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
              className={`h-5 w-5 rounded-full transition ${
                newCategoryColor === c.hex ? 'scale-110 ring-2 ring-[#191919]' : 'opacity-75'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Full Parent Category & Subcategory Tree */}
      <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
        {parentCategories.map((parent) => {
          const subs = allCategories.filter(
            (c) => c.parent_id === parent.id && c.archived_at === null,
          );
          const isEditingThis = editingCatId === parent.id;
          const parentDisplayName =
            parent.user_id !== null ? parent.name : getCategoryDisplayName(parent, t);

          return (
            <div
              key={parent.id}
              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryIcon slug={parent.slug} colorHex={parent.color_hex} size="xs" />
                  {isEditingThis ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="w-32 rounded-lg border border-[#191919] bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveRename(parent)}
                        className="rounded-md bg-[#191919] p-1 text-[#FAFAFA]"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="p-1 text-[var(--ink-secondary)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                      {parentDisplayName}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubForParentId(
                        addingSubForParentId === parent.id ? null : parent.id,
                      );
                      setNewSubName('');
                    }}
                    className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] hover:bg-[#D7C3F8]"
                  >
                    {isVi ? '+ Mục con' : '+ Sub'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(parent.id);
                      setEditingCatName(parentDisplayName);
                    }}
                    aria-label={isVi ? 'Đổi tên' : 'Rename'}
                    className="rounded-full p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {!parent.is_system && (
                    <button
                      type="button"
                      onClick={() => void handleArchiveCategory(parent)}
                      aria-label={isVi ? 'Xóa danh mục' : 'Delete category'}
                      className="rounded-full p-1 text-[var(--ink-secondary)] hover:bg-[#F5C2D7] hover:text-[#D13B7B]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subcategories Pills */}
              {(subs.length > 0 || addingSubForParentId === parent.id) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-hairline)] pt-2">
                  {subs.map((sub) => {
                    const subDisplayName =
                      sub.user_id !== null ? sub.name : getCategoryDisplayName(sub, t);
                    return (
                      <span
                        key={sub.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--ink-primary)]"
                      >
                        <span>{subDisplayName}</span>
                        {!sub.is_system && (
                          <button
                            type="button"
                            onClick={() => void handleArchiveCategory(sub)}
                            className="ml-0.5 rounded-full text-[var(--ink-muted)] hover:text-[#D13B7B]"
                            aria-label={isVi ? 'Xóa mục con' : 'Remove subcategory'}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </span>
                    );
                  })}

                  {addingSubForParentId === parent.id && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#191919] bg-[var(--bg-subtle)] px-2 py-0.5">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder={isVi ? 'VD: Ăn vặt, Trà chiều...' : 'Subcategory name...'}
                        className="w-28 bg-transparent text-[10px] font-bold text-[var(--ink-primary)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddSubcategory(parent)}
                        className="rounded-full bg-[#191919] p-0.5 text-[#FAFAFA]"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Custom Tag */}
      <div className="flex gap-1.5 pt-1">
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
    </div>
  );
}
