import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export type ButtonVariant = 'ink' | 'pop' | 'subtle' | 'outline' | 'ghost' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  ink: 'bg-[#141413] text-white hover:opacity-95 active:scale-[0.99]',
  pop: 'bg-[var(--accent-pop)] text-white shadow-xs hover:opacity-95 active:scale-[0.99]',
  subtle:
    'border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]',
  outline:
    'border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[#141413]',
  ghost: 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)]',
  success: 'border border-[#00B853]/30 bg-[#00B853]/10 text-[#00B853]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'px-3 py-1 text-xs font-semibold',
  sm: 'px-3.5 py-1.5 text-xs font-semibold',
  md: 'px-4 py-2.5 text-xs font-semibold',
  lg: 'px-5 py-3.5 text-sm font-semibold',
};

export function Button({
  variant = 'ink',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps): ReactElement {
  const widthCls = fullWidth ? 'w-full' : '';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${widthCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  children: ReactNode;
}

export function IconButton({
  active = false,
  label,
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps): ReactElement {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? 'border-[#141413] bg-[#141413] text-white'
          : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
