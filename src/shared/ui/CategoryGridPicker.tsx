import { useState, type ReactElement } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
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
const MAX_CATEGORY_NAME_LENGTH = 22;

const CATEGORY_ICON_CHOICES: ReadonlyArray<string> = [
  'utensils',
  'coffee',
  'shopping-bag',
  'car',
  'home',
  'heart-pulse',
  'plane',
  'gift',
  'paw',
  'dumbbell',
  'gamepad',
  'scissors',
  'baby',
  'book',
  'laptop',
  'trending-up',
];

const CATEGORY_COLOR_CHOICES: ReadonlyArray<string> = [
  '#FF7A1A',
  '#52C470',
  '#5E89ED',
  '#EF6EA5',
  '#F2D147',
  '#BF9BDE',
  '#0D9488',
  '#E11D48',
];

export function CategoryGridPicker({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryGridPickerProps): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';

  const [isExpanded, setIsExpanded] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('sparkles');
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');
  const [newParentIcon, setNewParentIcon] = useState('paw');
  const [newParentColor, setNewParentColor] = useState('#FF7A1A');

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

  const handleRemoveCategory = async (targetCat: Category): Promise<void> => {
    if (targetCat.parent_id === null && parentCategories.length <= 1) return;
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      ...targetCat,
      archived_at: nowIso,
      updated_at: nowIso,
    });
    if (selectedCategoryId === targetCat.id || activeParentId === targetCat.id) {
      const nextFallback =
        targetCat.parent_id !== null
          ? activeParent?.id
          : parentCategories.find((c) => c.id !== targetCat.id)?.id;
      if (nextFallback) {
        onSelectCategory(nextFallback);
      }
    }
  };

  const handleCreateSubcategory = async (): Promise<void> => {
    const clean = newSubName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
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
      icon_name: newSubIcon || activeParent.icon_name,
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
    const clean = newParentName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const id = `cat-custom-${Date.now()}`;
    const slug =
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || id;
    const kind = activeParent?.kind ?? 'expense';
    const colorHex =
      newParentColor ||
      CATEGORY_COLOR_CHOICES[parentCategories.length % CATEGORY_COLOR_CHOICES.length] ||
      '#FF7A1A';

    const newCat: Category = {
      id,
      user_id: 'local-user',
      parent_id: null,
      name: clean,
      slug,
      kind,
      icon_name: newParentIcon || 'paw',
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
          const canDeleteParent = parentCategories.length > 1 && (!cat.is_system || isManageMode);

          return (
            <div key={cat.id} className="relative">
              <button
                type="button"
                role="option"
                aria-selected={isParentActive}
                onClick={() => onSelectCategory(cat.id)}
                style={{
                  backgroundColor: isParentActive ? `${cat.color_hex}2E` : `${cat.color_hex}14`,
                  borderColor: isParentActive ? '#191919' : `${cat.color_hex}4D`,
                }}
                className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition ${
                  isParentActive ? 'border-2 shadow-2xs' : 'hover:opacity-95'
                }`}
              >
                <CategoryIcon
                  slug={cat.slug}
                  iconName={cat.icon_name}
                  colorHex={cat.color_hex}
                  size="sm"
                />
                <span className="line-clamp-2 flex min-h-[24px] w-full items-center justify-center text-[10px] leading-tight font-extrabold break-words text-[var(--ink-primary)]">
                  {displayName}
                </span>
              </button>

              {canDeleteParent && (isManageMode || !cat.is_system) && (
                <button
                  type="button"
                  data-testid={`remove-category-${cat.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRemoveCategory(cat);
                  }}
                  aria-label={isVi ? `Xoá danh mục ${displayName}` : `Remove ${displayName}`}
                  title={isVi ? `Xoá ${displayName}` : `Remove ${displayName}`}
                  className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#191919]/20 bg-[#FFFFFF] text-[#D93829] shadow-2xs transition hover:bg-[#D93829] hover:text-white"
                >
                  <X className="h-3 w-3 stroke-[2.6]" />
                </button>
              )}
            </div>
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
            <span className="inline-flex min-h-[24px] items-center gap-0.5 text-[10px] font-extrabold text-[var(--ink-primary)]">
              <span>{isVi ? 'Khác' : 'More'}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </span>
          </button>
        )}

        {/* Quick + Category Tile, Manage/Delete Toggle & Collapse Tile (Visible when expanded or when <= 3 categories) */}
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
              <span className="line-clamp-2 flex min-h-[24px] w-full items-center justify-center text-[10px] leading-tight font-bold">
                {isVi ? '+ Danh mục' : '+ Category'}
              </span>
            </button>

            <button
              type="button"
              data-testid="category-grid-manage-btn"
              onClick={() => setIsManageMode((v) => !v)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition ${
                isManageMode
                  ? 'border-[#D93829] bg-[#FEE2E2] text-[#D93829]'
                  : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)]">
                <Trash2 className="h-4 w-4" />
              </span>
              <span className="line-clamp-2 flex min-h-[24px] w-full items-center justify-center text-[10px] leading-tight font-bold">
                {isManageMode ? (isVi ? 'Xong xoá' : 'Done') : isVi ? 'Xoá mục' : 'Remove'}
              </span>
            </button>

            {canCollapse && (
              <button
                type="button"
                data-testid="category-grid-collapse-btn"
                onClick={() => {
                  setIsExpanded(false);
                  setIsAddingParent(false);
                  setIsManageMode(false);
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-1.5 py-2 text-center text-[var(--ink-secondary)] transition hover:border-[#191919] hover:text-[var(--ink-primary)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)]">
                  <ChevronUp className="h-4 w-4" />
                </span>
                <span className="line-clamp-2 flex min-h-[24px] w-full items-center justify-center text-[10px] leading-tight font-extrabold">
                  {isVi ? 'Thu gọn' : 'Less'}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {isAddingParent && (
        <div className="space-y-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-2.5">
          <div className="flex items-center gap-1.5">
            <CategoryIcon iconName={newParentIcon} colorHex={newParentColor} size="sm" />
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                value={newParentName}
                onChange={(e) =>
                  setNewParentName(e.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH))
                }
                placeholder={
                  isVi ? 'Tên danh mục mới (tối đa 22 ký tự)...' : 'New category (max 22 chars)...'
                }
                className="w-full rounded-lg bg-[var(--bg-card)] px-2.5 py-1.5 pr-11 text-xs font-semibold text-[var(--ink-primary)] focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] font-bold text-[var(--ink-muted)] tabular-nums">
                {newParentName.length}/{MAX_CATEGORY_NAME_LENGTH}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateParentCategory()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#191919] px-2.5 py-1.5 text-[11px] font-bold text-[#FAFAFA]"
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

          {/* Color & Icon Picker for New Category */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1">
              {CATEGORY_COLOR_CHOICES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Color ${hex}`}
                  onClick={() => setNewParentColor(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-5 w-5 rounded-full transition ${
                    newParentColor === hex ? 'scale-110 ring-2 ring-[#191919]' : 'opacity-75'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {CATEGORY_ICON_CHOICES.map((iconKey) => {
              const activeIcon = newParentIcon === iconKey;
              return (
                <button
                  key={iconKey}
                  type="button"
                  data-testid={`pick-cat-icon-${iconKey}`}
                  aria-label={`Icon ${iconKey}`}
                  onClick={() => setNewParentIcon(iconKey)}
                  className={`shrink-0 rounded-xl p-1 transition ${
                    activeIcon
                      ? 'bg-[#191919] text-white ring-1 ring-[#191919]'
                      : 'bg-[var(--bg-card)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <CategoryIcon iconName={iconKey} colorHex={newParentColor} size="xs" />
                </button>
              );
            })}
          </div>
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
              <div key={sub.id} className="inline-flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onSelectCategory(sub.id)}
                  style={
                    isSubSelected
                      ? { backgroundColor: '#191919', borderColor: '#191919', color: '#FAFAFA' }
                      : {
                          backgroundColor: `${sub.color_hex}18`,
                          borderColor: `${sub.color_hex}4D`,
                        }
                  }
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition ${
                    isSubSelected
                      ? 'font-bold text-[#FAFAFA]'
                      : 'font-bold text-[var(--ink-primary)] hover:opacity-90'
                  }`}
                >
                  <CategoryIcon
                    slug={sub.slug}
                    iconName={sub.icon_name}
                    colorHex={sub.color_hex}
                    size="xs"
                  />
                  <span>{subName}</span>
                </button>
                {(isManageMode || !sub.is_system) && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveCategory(sub)}
                    aria-label={isVi ? `Xoá mục con ${subName}` : `Remove ${subName}`}
                    className="-ml-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#191919]/20 bg-white text-[#D93829] shadow-2xs hover:bg-[#D93829] hover:text-white"
                  >
                    <X className="h-2.5 w-2.5 stroke-[2.6]" />
                  </button>
                )}
              </div>
            );
          })}

          {isAddingSub ? (
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#191919] bg-[var(--bg-card)] px-2 py-0.5">
              <select
                aria-label={isVi ? 'Icon mục con' : 'Subcategory icon'}
                value={newSubIcon}
                onChange={(e) => setNewSubIcon(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-[var(--ink-primary)] focus:outline-none"
              >
                {CATEGORY_ICON_CHOICES.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
              <input
                type="text"
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH))}
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
