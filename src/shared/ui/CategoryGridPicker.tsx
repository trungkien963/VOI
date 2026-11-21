import { useState, type ReactElement } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
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
  const [pendingDeleteCat, setPendingDeleteCat] = useState<Category | null>(null);
  const [recentlyDeletedCat, setRecentlyDeletedCat] = useState<Category | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

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

  const showTempNotice = (msg: string): void => {
    setStatusToast(msg);
  };

  const handleConfirmRemoveCategory = async (): Promise<void> => {
    if (!pendingDeleteCat) return;
    const targetCat = pendingDeleteCat;
    if (targetCat.parent_id === null && parentCategories.length <= 1) {
      setPendingDeleteCat(null);
      return;
    }
    const displayName = getCategoryDisplayName(targetCat, t);
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      ...targetCat,
      archived_at: nowIso,
      updated_at: nowIso,
    });
    setPendingDeleteCat(null);
    setRecentlyDeletedCat(targetCat);
    showTempNotice(isVi ? `Đã xoá danh mục "${displayName}"` : `Removed category "${displayName}"`);

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

  const handleUndoRemoveCategory = async (): Promise<void> => {
    if (!recentlyDeletedCat) return;
    const nowIso = new Date().toISOString();
    await localDb.categories.put({
      ...recentlyDeletedCat,
      archived_at: null,
      updated_at: nowIso,
    });
    const displayName = getCategoryDisplayName(recentlyDeletedCat, t);
    onSelectCategory(recentlyDeletedCat.id);
    setRecentlyDeletedCat(null);
    showTempNotice(
      isVi ? `Đã khôi phục danh mục "${displayName}"` : `Restored category "${displayName}"`,
    );
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
    setRecentlyDeletedCat(null);
    showTempNotice(isVi ? `Đã thêm mục con "${clean}" ✨` : `Added subcategory "${clean}" ✨`);
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
    setRecentlyDeletedCat(null);
    showTempNotice(isVi ? `Đã tạo danh mục "${clean}" ✨` : `Created category "${clean}" ✨`);
    onSelectCategory(newCat.id);
  };

  return (
    <div className="space-y-2">
      {/* Status Notification / Undo Banner */}
      {statusToast && (
        <div
          data-testid="category-status-toast"
          className="flex items-center justify-between gap-2 rounded-xl border border-[#191919]/15 bg-[#191919] px-3 py-1.5 text-xs font-bold text-[#FAFAFA]"
        >
          <span className="truncate">{statusToast}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {recentlyDeletedCat && (
              <button
                type="button"
                data-testid="category-undo-delete-btn"
                onClick={() => void handleUndoRemoveCategory()}
                className="inline-flex items-center gap-1 rounded-full bg-[#FAFAFA] px-2 py-0.5 text-[10px] font-black text-[#191919]"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>{isVi ? 'Hoàn tác' : 'Undo'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStatusToast(null);
                setRecentlyDeletedCat(null);
              }}
              aria-label={isVi ? 'Đóng thông báo' : 'Dismiss'}
              className="rounded-full p-0.5 text-[#FAFAFA]/75 hover:text-[#FAFAFA]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before Deleting Category / Subcategory */}
      {pendingDeleteCat && (
        <div
          data-testid="category-delete-confirm-banner"
          className="space-y-2 rounded-2xl border-2 border-[#D93829] bg-[#FEF2F2] p-3 text-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D93829]" />
            <div className="min-w-0 flex-1">
              <p className="font-black text-[#191919]">
                {isVi
                  ? `Xác nhận xoá ${pendingDeleteCat.parent_id ? 'mục con' : 'danh mục'} "${getCategoryDisplayName(pendingDeleteCat, t)}"?`
                  : `Remove ${pendingDeleteCat.parent_id ? 'subcategory' : 'category'} "${getCategoryDisplayName(pendingDeleteCat, t)}"?`}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#191919]/75">
                {isVi
                  ? 'Các giao dịch cũ thuộc mục này vẫn được giữ nguyên trong Sổ cái.'
                  : 'Past transactions in this category will remain intact in your Ledger.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="category-delete-cancel-btn"
              onClick={() => setPendingDeleteCat(null)}
              className="rounded-xl border border-[#191919]/20 bg-white px-3 py-1.5 text-xs font-extrabold text-[#191919]"
            >
              {isVi ? 'Huỷ' : 'Cancel'}
            </button>
            <button
              type="button"
              data-testid="category-delete-confirm-btn"
              onClick={() => void handleConfirmRemoveCategory()}
              className="rounded-xl bg-[#D93829] px-3 py-1.5 text-xs font-extrabold text-white shadow-2xs"
            >
              {isVi ? 'Xác nhận xoá' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      )}

      <div
        role="listbox"
        aria-label={t.quickAddModal.categoryAria}
        className="grid grid-cols-4 gap-1.5 py-0.5"
      >
        {displayedParents.map((cat) => {
          const isParentActive = cat.id === activeParentId;
          const displayName = getCategoryDisplayName(cat, t);
          const canDeleteParent = parentCategories.length > 1 && isManageMode;

          return (
            <div key={cat.id} className="relative">
              <button
                type="button"
                role="option"
                aria-selected={isParentActive}
                onClick={() => {
                  if (isManageMode && parentCategories.length > 1) {
                    setPendingDeleteCat(cat);
                    return;
                  }
                  onSelectCategory(cat.id);
                }}
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

              {canDeleteParent && (
                <button
                  type="button"
                  data-testid={`remove-category-${cat.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteCat(cat);
                  }}
                  aria-label={isVi ? `Xoá danh mục ${displayName}` : `Remove ${displayName}`}
                  title={isVi ? `Xoá ${displayName}` : `Remove ${displayName}`}
                  className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#191919]/20 bg-[#D93829] text-white shadow-xs transition hover:scale-110"
                >
                  <X className="h-3 w-3 stroke-[2.8]" />
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
              onClick={() => {
                setIsAddingParent((v) => !v);
                setIsAddingSub(false);
                setIsManageMode(false);
              }}
              data-testid="quick-add-parent-category-btn"
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition ${
                isAddingParent
                  ? 'border-2 border-[#191919] bg-[var(--bg-subtle)] text-[var(--ink-primary)]'
                  : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
              }`}
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
              onClick={() => {
                setIsManageMode((v) => !v);
                setPendingDeleteCat(null);
                setIsAddingParent(false);
              }}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition ${
                isManageMode
                  ? 'border-2 border-[#D93829] bg-[#FEE2E2] text-[#D93829]'
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
                  setPendingDeleteCat(null);
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

      {/* Friendly Inline Card for Creating a New Parent Category */}
      {isAddingParent && (
        <div className="space-y-2.5 rounded-2xl border-2 border-[#191919] bg-[var(--bg-subtle)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[var(--ink-primary)]">
              {isVi ? 'Tạo danh mục mới' : 'Create new category'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingParent(false);
                setNewParentName('');
              }}
              className="rounded-full p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-card)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <CategoryIcon iconName={newParentIcon} colorHex={newParentColor} size="md" />
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                value={newParentName}
                onChange={(e) =>
                  setNewParentName(e.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH))
                }
                placeholder={isVi ? 'Tên danh mục (VD: Thú cưng)...' : 'Category name...'}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 pr-12 text-xs font-bold text-[var(--ink-primary)] focus:border-[#191919] focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] font-bold text-[var(--ink-muted)] tabular-nums">
                {newParentName.length}/{MAX_CATEGORY_NAME_LENGTH}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateParentCategory()}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#191919] px-3 py-2 text-xs font-extrabold text-[#FAFAFA]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isVi ? 'Lưu' : 'Add'}</span>
            </button>
          </div>

          {/* Color Swatches */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
              {isVi ? 'Màu:' : 'Color:'}
            </span>
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

          {/* Visual Icon Row (No raw English names!) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-bold text-[var(--ink-secondary)]">
              {isVi ? 'Icon:' : 'Icon:'}
            </span>
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
                      ? 'bg-[#191919] ring-1 ring-[#191919]'
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

      {/* Subcategories Horizontal Bar */}
      {activeParent && (
        <div className="space-y-1.5">
          <div
            data-testid="subcategory-pills"
            className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-2 py-1.5"
          >
            {subCategories.map((sub) => {
              const isSubSelected = sub.id === selectedCategoryId;
              const subName = getCategoryDisplayName(sub, t);
              return (
                <div key={sub.id} className="inline-flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isManageMode) {
                        setPendingDeleteCat(sub);
                        return;
                      }
                      onSelectCategory(sub.id);
                    }}
                    style={
                      isSubSelected
                        ? { backgroundColor: '#191919', borderColor: '#191919', color: '#FAFAFA' }
                        : {
                            backgroundColor: `${sub.color_hex}18`,
                            borderColor: `${sub.color_hex}4D`,
                          }
                    }
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
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
                  {isManageMode && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteCat(sub)}
                      aria-label={isVi ? `Xoá mục con ${subName}` : `Remove ${subName}`}
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-[#D93829] text-white shadow-2xs"
                    >
                      <X className="h-2.5 w-2.5 stroke-[2.8]" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              data-testid="quick-add-subcategory-btn"
              onClick={() => {
                setIsAddingSub((v) => !v);
                setIsAddingParent(false);
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                isAddingSub
                  ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                  : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
              }`}
            >
              <Plus className="h-3 w-3" />
              <span>{isVi ? '+ Mục con' : '+ Sub'}</span>
            </button>
          </div>

          {/* Clean, Visual Subcategory Creator Card (Replaces the cramped raw "utensils v" pill!) */}
          {isAddingSub && (
            <div className="space-y-2 rounded-2xl border border-[#191919] bg-[var(--bg-subtle)] p-2.5">
              <div className="flex items-center gap-2">
                <CategoryIcon iconName={newSubIcon} colorHex={activeParent.color_hex} size="sm" />
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    maxLength={MAX_CATEGORY_NAME_LENGTH}
                    value={newSubName}
                    onChange={(e) =>
                      setNewSubName(e.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH))
                    }
                    placeholder={
                      isVi
                        ? `Thêm mục con vào "${getCategoryDisplayName(activeParent, t)}"...`
                        : `New subcategory in "${getCategoryDisplayName(activeParent, t)}"...`
                    }
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-1.5 pr-11 text-xs font-bold text-[var(--ink-primary)] focus:border-[#191919] focus:outline-none"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[9px] font-bold text-[var(--ink-muted)] tabular-nums">
                    {newSubName.length}/{MAX_CATEGORY_NAME_LENGTH}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateSubcategory()}
                  aria-label={isVi ? 'Lưu mục con' : 'Save subcategory'}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#191919] px-2.5 py-1.5 text-xs font-extrabold text-[#FAFAFA]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isVi ? 'Lưu' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSub(false);
                    setNewSubName('');
                  }}
                  className="rounded-lg p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-card)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="shrink-0 text-[10px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Chọn icon:' : 'Pick icon:'}
                </span>
                {CATEGORY_ICON_CHOICES.map((ic) => {
                  const activeIc = newSubIcon === ic;
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewSubIcon(ic)}
                      className={`shrink-0 rounded-xl p-1 transition ${
                        activeIc
                          ? 'bg-[#191919] ring-1 ring-[#191919]'
                          : 'bg-[var(--bg-card)] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <CategoryIcon iconName={ic} colorHex={activeParent.color_hex} size="xs" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
