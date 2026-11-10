import type { ReactElement } from 'react';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (nextValue: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>): ReactElement {
  const paddingCls = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-2 text-xs';
  const isFullWidth = className.includes('w-full');

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`${
        isFullWidth ? 'grid w-full' : 'inline-flex items-center'
      } rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] p-1 ${className}`.trim()}
      style={
        isFullWidth
          ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {options.map((opt) => {
        const isSelected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.id)}
            className={` truncate whitespace-nowrap rounded-full font-bold transition ${paddingCls} ${
              isSelected
                ? 'bg-[#141413] text-white'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
