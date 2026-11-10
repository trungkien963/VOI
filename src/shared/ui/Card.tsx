import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6',
};

function CardRoot({
  as: Component = 'section',
  padding = 'md',
  className = '',
  children,
  ...rest
}: CardProps): ReactElement {
  return (
    <Component className={`clean-card ${PADDING_CLASSES[padding]} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  bordered?: boolean;
}

function CardHeader({
  children,
  bordered = false,
  className = '',
  ...rest
}: CardSectionProps): ReactElement {
  const borderCls = bordered ? 'border-b border-[var(--border-hairline)] pb-3.5' : '';
  return (
    <div
      className={`flex items-center justify-between gap-3 ${borderCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardBody({ children, className = '', ...rest }: CardSectionProps): ReactElement {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({
  children,
  bordered = false,
  className = '',
  ...rest
}: CardSectionProps): ReactElement {
  const borderCls = bordered ? 'border-t border-[var(--border-hairline)] pt-3.5 mt-3.5' : 'mt-4';
  return (
    <div className={`${borderCls} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
