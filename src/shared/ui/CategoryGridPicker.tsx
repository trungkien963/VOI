import type { ReactElement } from 'react';
import type { Category } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../i18n';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryGridPickerProps {
  categories: ReadonlyArray<Category>;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryGridPicker({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryGridPickerProps): ReactElement {
  const { t } = useTranslation();

  const parentCategories = categories.filter((c) => c.parent_id === null).slice(0, 8);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const activeParentId = selectedCategory?.parent_id ?? selectedCategory?.id ?? null;
  const subCategories = activeParentId
    ? categories.filter((c) => c.parent_id === activeParentId)
    : [];

  return (
    <div className="space-y-1.5">
      <div
        role="listbox"
        aria-label={t.quickAddModal.categoryAria}
        className="grid grid-cols-4 gap-1.5 py-0.5"
      >
        {parentCategories.map((cat) => {
          const isParentActive = cat.id === activeParentId;
          const isChildSelectedHere =
            isParentActive && selectedCategory !== null && selectedCategory.parent_id === cat.id;
          const displayName = getCategoryDisplayName(cat, t);

          return (
            <button
              key={cat.id}
              type="button"
              role="option"
              aria-selected={isParentActive}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition ${
                isParentActive
                  ? 'border-2 border-[#18181B] bg-[var(--bg-subtle)] shadow-2xs'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'
              }`}
            >
              <CategoryIcon slug={cat.slug} colorHex={cat.color_hex} size="sm" />
              <span className="w-full truncate text-[10px] font-semibold text-[var(--ink-primary)]">
                {displayName}
              </span>
              {isChildSelectedHere && selectedCategory && (
                <span className="max-w-full truncate rounded-full bg-[#18181B] px-1.5 text-[8px] font-bold text-white">
                  {getCategoryDisplayName(selectedCategory, t)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {subCategories.length > 0 && (
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
                    ? 'border-[#18181B] bg-[#18181B] font-bold text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-card)] font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <CategoryIcon slug={sub.slug} colorHex={sub.color_hex} size="xs" />
                <span>{subName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
