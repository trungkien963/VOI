import type { ReactElement } from 'react';

export type VoiLogoVariant = 'cobalt' | 'sky' | 'cream';

export interface VoiLogoProps {
  /**
   * - 'cobalt' (logo-2): Deep Cobalt background (#1E4FD3) + Sky Elephant (#5B8DEF) + Cream Ear/Eye (#F1EED5). Best for Primary App Icon & Header on light backgrounds.
   * - 'sky' (logo-1): Sky Blue background (#5282E9) + Deep Cobalt Elephant (#1E4FD3) + Cream Ear/Eye (#F1EED5).
   * - 'cream' (logo-3): Warm Cream background (#F1EED5) + Deep Cobalt Elephant (#1E4FD3) + Sky Ear (#5282E9) + White Eye (#FFFFFF). Best on dark surfaces or subtle hero cards.
   */
  variant?: VoiLogoVariant;
  size?: number;
  className?: string;
  label?: string;
}

const VARIANT_PALETTE: Record<
  VoiLogoVariant,
  { bg: string; body: string; circle: string; eye: string; border?: string }
> = {
  cobalt: {
    bg: '#1E4FD3',
    body: '#5B8DEF',
    circle: '#F1EED5',
    eye: '#F1EED5',
  },
  sky: {
    bg: '#5282E9',
    body: '#1E4FD3',
    circle: '#F1EED5',
    eye: '#F1EED5',
  },
  cream: {
    bg: '#F1EED5',
    body: '#1E4FD3',
    circle: '#5282E9',
    eye: '#FFFFFF',
    border: '#E2DEC3',
  },
};

export function VoiLogo({
  variant = 'cobalt',
  size = 40,
  className = '',
  label,
}: VoiLogoProps): ReactElement {
  const palette = VARIANT_PALETTE[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 select-none ${className}`.trim()}
    >
      <rect
        width="512"
        height="512"
        rx="115"
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth={palette.border ? '10' : undefined}
      />
      {/* Khối Voi chính: Vòi chữ V vươn lên + Thân Voi vững chãi */}
      <path
        d="M 420 170 L 420 340 L 160 340 L 100 220 L 135 220 L 170 290 L 230 170 Z"
        fill={palette.body}
      />
      {/* Tai Voi / Đồng tiền tích lũy chữ O */}
      <circle cx="326" cy="255" r="68" fill={palette.circle} />
      {/* Mắt Voi (Elephant Memory — r=11 rõ nét ở mọi kích thước) */}
      <circle cx="236" cy="200" r="11" fill={palette.eye} />
    </svg>
  );
}
