import { useState, type ReactElement } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { localDb } from '../../db/dexie-schema';
import type { Category } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../i18n';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryGridPickerProps {
  categories: ReadonlyArray<Category>;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
}

const COLLAPSED_VISIBLE_SLOTS = 3;

export function CategoryGridPicker({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryGridPickerProps): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');

  const parentCategories = categories.filter((c) => c.parent_id === null && !c.archived_at);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const activeParentId = selectedCategory?.parent_id ?? selectedCategory?.id ?? null;
  const activeParent =
    parentCategories.find((c) => c.id === activeParentId) ?? parentCategories[0] ?? null;
  const subCategories = activeParentId
    ? categories.filter((c) => c.parent_id === activeParentId && !c.archived_at)
    : [];

  const canCollapse = parentCategories.length > COLLAPSED_VISIBLE_SLOTS;
  const hiddenCount = Math.max(0, parentCategories.length - COLLAPSED_VISIBLE_SLOTS);

  // When collapsed, show top 3 categories, ensuring the currently active parent category is always visible in the row
  const displayedParents: ReadonlyArray<Category> = (() => {
    if (!canCollapse || isExpanded) {
      return parentCategories;
    }
    const topSlice = parentCategories.slice(0, COLLAPSED_VISIBLE_SLOTS);
    if (activeParent && !topSlice.some((c) => c.id === activeParent.id)) {
      return [...topSlice.slice(0, COLLAPSED_VISIBLE_SLOTS - 1), activeParent];
    }
    return topSlice;
  })();

  const handleCreateSubcategory = async (): Promise<void> => {
    const clean = newSubName.trim();
    if (!clean || !activeParent) return;
    const nowIso = new Date().toISOString();
    const id = `cat-sub-${Date.now()}`;
    const slug =
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || id;
    const newSub: Category = {
      id,
      user_id: 'local-user',
      parent_id: activeParent.id,
      name: clean,
      slug,
      kind: activeParent.kind,
      icon_name: activeParent.icon_name,
      color_hex: activeParent.color_hex,
      keywords: [clean.toLowerCase()],
      is_essential: activeParent.is_essential,
      is_system: false,
      sort_order: activeParent.sort_order + subCategories.length + 1,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    await localDb.categories.put(newSub);
    setNewSubName('');
    setIsAddingSub(false);
    onSelectCategory(newSub.id);
  };

  const handleCreateParentCategory = async (): Promise<void> => {
    const clean = newParentName.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const id = `cat-custom-${Date.now()}`;
    const slug =
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || id;
    const kind = activeParent?.kind ?? 'expense';
    const pantoneColors = ['#FF7A1A', '#52C470', '#5E89ED', '#EF6EA5', '#F2D147', '#BF9BDE'];
    const colorHex = pantoneColors[parentCategories.length % pantoneColors.length] ?? '#FF7A1A';

    const newCat: Category = {
      id,
      user_id: 'local-user',
      parent_id: null,
      name: clean,
      slug,
      kind,
      icon_name: 'circle',
      color_hex: colorHex,
      keywords: [clean.toLowerCase()],
      is_essential: false,
      is_system: false,
      sort_order: (parentCategories.length + 1) * 10,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    await localDb.categories.put(newCat);
    setNewParentName('');
    setIsAddingParent(false);
    onSelectCategory(newCat.id);
  };

  return (
    <div className="space-y-1.5">
      <div
        role="listbox"
        aria-label={t.quickAddModal.categoryAria}
        className="grid grid-cols-4 gap-1.5 py-0.5"
      >
        {displayedParents.map((cat) => {
          const isParentActive = cat.id === activeParentId;
          const displayName = getCategoryDisplayName(cat, t);

          return (
            <button
              key={cat.id}
              type="button"
              role="option"
              aria-selected={isParentActive}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition ${
                isParentActive
                  ? 'border-2 border-[#191919] bg-[var(--bg-subtle)] shadow-2xs'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'
              }`}
            >
              <CategoryIcon slug={cat.slug} colorHex={cat.color_hex} size="sm" />
              <span className="w-full truncate text-[10px] font-bold text-[var(--ink-primary)]">
                {displayName}
              </span>
            </button>
          );
        })}

        {/* Slot 4 (when collapsed): Expand All Categories Tile */}
        {canCollapse && !isExpanded && (
          <button
            type="button"
            data-testid="category-grid-expand-btn"
            onClick={() => setIsExpanded(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/70 px-1.5 py-2 text-center text-[var(--ink-primary)] transition hover:border-[#191919] hover:bg-[var(--bg-subtle)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)] text-[11px] font-black text-[#191919] shadow-2xs">
              +{hiddenCount}
            </span>
            <span className="inline-flex items-center gap-0.5 truncate text-[10px] font-extrabold text-[var(--ink-primary)]">
              <span>{isVi ? 'Khác' : 'More'}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </span>
          </button>
        )}

        {/* Quick + Category Tile & Collapse Tile (Visible when expanded or when <= 3 categories) */}
        {(!canCollapse || isExpanded) && (
          <>
            <button
              type="button"
              onClick={() => setIsAddingParent((v) => !v)}
              data-testid="quick-add-parent-category-btn"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-1.5 py-2 text-center text-[var(--ink-secondary)] transition hover:border-[#191919] hover:text-[var(--ink-primary)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)]">
                <Plus className="h-4 w-4" />
              </span>
              <span className="w-full truncate text-[10px] font-bold">
                {isVi ? '+ Danh mục' : '+ Category'}
              </span>
            </button>

            {canCollapse && (
              <button
                type="button"
                data-testid="category-grid-collapse-btn"
                onClick={() => {
                  setIsExpanded(false);
                  setIsAddingParent(false);
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-1.5 py-2 text-center text-[var(--ink-secondary)] transition hover:border-[#191919] hover:text-[var(--ink-primary)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)]">
                  <ChevronUp className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-[10px] font-extrabold">
                  {isVi ? 'Thu gọn' : 'Less'}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {isAddingParent && (
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-1.5">
          <input
            type="text"
            value={newParentName}
            onChange={(e) => setNewParentName(e.target.value)}
            placeholder={isVi ? 'Tên danh mục mới (VD: Thú cưng)...' : 'New category name...'}
            className="min-w-0 flex-1 rounded-lg bg-[var(--bg-card)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCreateParentCategory()}
            className="inline-flex items-center gap-1 rounded-lg bg-[#191919] px-2.5 py-1 text-[11px] font-bold text-[#FAFAFA]"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isVi ? 'Lưu' : 'Add'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingParent(false);
              setNewParentName('');
            }}
            className="rounded-lg p-1 text-[var(--ink-secondary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeParent && (
        <div
          data-testid="subcategory-pills"
          className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-2 py-1.5"
        >
          {subCategories.map((sub) => {
            const isSubSelected = sub.id === selectedCategoryId;
            const subName = getCategoryDisplayName(sub, t);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectCategory(sub.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition ${
                  isSubSelected
                    ? 'border-[#191919] bg-[#191919] font-bold text-[#FAFAFA]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-card)] font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <CategoryIcon slug={sub.slug} colorHex={sub.color_hex} size="xs" />
                <span>{subName}</span>
              </button>
            );
          })}

          {isAddingSub ? (
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#191919] bg-[var(--bg-card)] px-2 py-0.5">
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder={isVi ? 'Tên mục con...' : 'Subcategory...'}
                className="w-24 bg-transparent text-[10px] font-bold text-[var(--ink-primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCreateSubcategory()}
                className="rounded-full bg-[#191919] p-0.5 text-[#FAFAFA]"
                aria-label={isVi ? 'Lưu mục con' : 'Save subcategory'}
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingSub(false);
                  setNewSubName('');
                }}
                className="p-0.5 text-[var(--ink-secondary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="quick-add-subcategory-btn"
              onClick={() => setIsAddingSub(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink-secondary)] transition hover:border-[#191919] hover:text-[var(--ink-primary)]"
            >
              <Plus className="h-3 w-3" />
              <span>{isVi ? '+ Mục con' : '+ Sub'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
