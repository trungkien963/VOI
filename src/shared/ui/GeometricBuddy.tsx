import type { ReactElement } from 'react';
import type { BuddyAccessory, BuddyMood, GeometricShape } from '../../domain/types/entities';

export interface GeometricBuddyProps {
  shape: GeometricShape;
  colorHex?: string;
  mood?: BuddyMood;
  accessory?: BuddyAccessory;
  size?: number;
  label?: string;
  className?: string;
}

const SEMANTIC_SHAPE_META: Record<
  GeometricShape,
  { colorHex: string; defaultAccessory: BuddyAccessory; labelVi: string }
> = {
  triangle: {
    colorHex: '#FF6B35',
    defaultAccessory: 'glasses',
    labelVi: 'Chi tiêu (Cost)',
  },
  square: {
    colorHex: '#10B981',
    defaultAccessory: 'spiky-hair',
    labelVi: 'Thu nhập (Earn)',
  },
  circle: {
    colorHex: '#8B5CF6',
    defaultAccessory: 'curly-hair',
    labelVi: 'Vay & Cho vay (Borrow/Lend)',
  },
  diamond: {
    colorHex: '#0D9488',
    defaultAccessory: 'cap',
    labelVi: 'Chuyển khoản (Transfer)',
  },
  arch: {
    colorHex: '#FFB703',
    defaultAccessory: 'headphones',
    labelVi: 'Tiết kiệm (Savings)',
  },
  hexagon: {
    colorHex: '#3B82F6',
    defaultAccessory: 'bag-handle',
    labelVi: 'Ngân hàng & Định kỳ (Bank)',
  },
  pentagon: {
    colorHex: '#F472B6',
    defaultAccessory: 'cheering',
    labelVi: 'Thẻ tín dụng (Credit)',
  },
  rainbow: {
    colorHex: '#FB7185',
    defaultAccessory: 'pencil',
    labelVi: 'Thưởng & Quà (Rewards)',
  },
};

function renderEditorialFace(
  mood: BuddyMood,
  accessory: BuddyAccessory,
  ink = '#18181B',
): ReactElement {
  if (accessory === 'glasses') {
    return (
      <g>
        <circle cx="24.5" cy="27.5" r="4.3" fill="none" stroke={ink} strokeWidth="1.6" />
        <circle cx="35.5" cy="27.5" r="4.3" fill="none" stroke={ink} strokeWidth="1.6" />
        <line x1="28.8" y1="27.5" x2="31.2" y2="27.5" stroke={ink} strokeWidth="1.6" />
        <circle cx="24.8" cy="27.8" r="1.4" fill={ink} />
        <circle cx="35.2" cy="27.8" r="1.4" fill={ink} />
        <path
          d="M27.5 34c1.2 1.8 3.8 1.8 5 0"
          stroke={ink}
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }

  switch (mood) {
    case 'chill':
      return (
        <g stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M22.5 26.5c1.2 2 3.3 2 4.5 0" />
          <path d="M33 26.5c1.2 2 3.3 2 4.5 0" />
          <path d="M23 32c3.2 3.4 10.8 3.4 14 0" />
        </g>
      );
    case 'wink':
      return (
        <g>
          <ellipse
            cx="25"
            cy="26.5"
            rx="2.3"
            ry="3.8"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="1.5"
          />
          <ellipse cx="25.3" cy="26.8" rx="1.2" ry="2.1" fill={ink} />
          <path
            d="M32.8 26.8c1.4-1.8 3.6-1.8 5 0"
            stroke={ink}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M25.5 32.5c1.8 3.6 7.2 3.6 9 0"
            stroke={ink}
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    case 'excited':
    case 'happy':
    case 'calm':
    default:
      return (
        <g>
          <path
            d="M23 20.5c1-1 2.8-1 3.8 0M33.2 20.5c1-1 2.8-1 3.8 0"
            stroke={ink}
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse
            cx="25.5"
            cy="26"
            rx="2.3"
            ry="4"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="1.5"
          />
          <ellipse cx="25.8" cy="26.4" rx="1.2" ry="2.2" fill={ink} />
          <ellipse
            cx="34.5"
            cy="26"
            rx="2.3"
            ry="4"
            fill="#FFFFFF"
            stroke={ink}
            strokeWidth="1.5"
          />
          <ellipse cx="34.2" cy="26.4" rx="1.2" ry="2.2" fill={ink} />
          <path
            d="M25.5 32c1.2 4.5 7.8 4.5 9 0"
            stroke={ink}
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M24.2 31.6l2 0.8M35.8 31.6l-2 0.8"
            stroke={ink}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      );
  }
}

function renderAccessoryAndLimbs(accessory: BuddyAccessory, ink = '#18181B'): ReactElement | null {
  switch (accessory) {
    case 'curly-hair':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M27 9c-1-4 3-5.5 4.2-2 1 2.8-2.5 3.5-1.5 0.5 0.8-2.5 4.2-2.5 4.3 1" />
          <path d="M10 31c-3.5 1-4.5 6-3 11m0 0l2-1.5m-2 1.5l-1.5-2" />
          <path d="M50 31c3.5 1 4.5 6 3 11m0 0l-2-1.5m2 1.5l1.5-2" />
        </g>
      );
    case 'spiky-hair':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M26 10c-0.5-3.2 1-5.2 2.5-6M30 10c0-3.5 1.5-5.5 3-6.2M34 10c0.5-2.8 2-4.2 3.5-4.8" />
          <path d="M12 29c-4.5 1.5-5 7 0 9.5" />
          <path d="M48 29c4.5 1.5 5 7 0 9.5" />
        </g>
      );
    case 'cheering':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M28.5 9c0-3.5 3.5-3.5 3 0" />
          <path d="M16 26c-4-4-6-10-5.5-15m0 0l-2 2m2-2l2 2" />
          <path d="M44 26c4-4 6-10 5.5-15m0 0l-2 2m2-2l2 2" />
        </g>
      );
    case 'cap':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M21 12c1.5-4.5 9.5-6 13-2" fill="#FFFFFF" />
          <path d="M16 13.5l19-2.5" />
        </g>
      );
    case 'headphones':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M14 26v-5c0-8 7-13 16-13s16 5 16 13v5" />
          <rect x="10.5" y="23" width="4" height="8" rx="2" fill="#FFFFFF" stroke={ink} />
          <rect x="45.5" y="23" width="4" height="8" rx="2" fill="#FFFFFF" stroke={ink} />
        </g>
      );
    case 'bag-handle':
      return (
        <g stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M25 10c0-4.5 10-4.5 10 0" />
        </g>
      );
    case 'pencil':
      return (
        <g stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M46 16l-3 18 2.5 1 3-18-2.5-1Z" fill="#FFFFFF" />
          <path d="M12 14v4M10 16h4" />
        </g>
      );
    case 'glasses':
      return (
        <g stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="16" y="37" width="8" height="9" rx="1.5" fill="none" />
          <path d="M14 39c2 1 3 2 4 3" />
        </g>
      );
    case 'none':
    default:
      return null;
  }
}

function renderStandingFeet(fill: string): ReactElement {
  return (
    <g fill={fill}>
      <rect x="23.5" y="45" width="3.8" height="8.5" rx="1.5" />
      <rect x="20.5" y="51" width="7" height="3.2" rx="1.6" />
      <rect x="32.7" y="45" width="3.8" height="8.5" rx="1.5" />
      <rect x="32.5" y="51" width="7" height="3.2" rx="1.6" />
    </g>
  );
}

/**
 * Borderless flat geometric character with standing feet, expressive oval eyes,
 * and 1.6px editorial line-art accessories modeled directly after the reference sheet.
 */
export function GeometricBuddy({
  shape,
  colorHex,
  mood = 'happy',
  accessory,
  size = 44,
  label,
  className = '',
}: GeometricBuddyProps): ReactElement {
  const meta = SEMANTIC_SHAPE_META[shape] ?? SEMANTIC_SHAPE_META.triangle;
  const fill = colorHex ?? meta.colorHex;
  const resolvedAccessory = accessory ?? meta.defaultAccessory;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 select-none ${className}`}
    >
      {shape !== 'rainbow' && renderStandingFeet(fill)}

      {shape === 'triangle' && (
        <path
          d="M27.6 10.2c1.1-2 3.7-2 4.8 0l17.4 32.6c1 1.9-.3 4.2-2.4 4.2H12.6c-2.1 0-3.4-2.3-2.4-4.2l17.4-32.6Z"
          fill={fill}
        />
      )}

      {shape === 'square' && <rect x="12" y="11" width="36" height="36" rx="6" fill={fill} />}

      {shape === 'circle' && <circle cx="30" cy="29" r="19" fill={fill} />}

      {shape === 'diamond' && (
        <path
          d="M27.7 8.7c1.3-1.3 3.3-1.3 4.6 0l17 17c1.3 1.3 1.3 3.3 0 4.6l-17 17c-1.3 1.3-3.3 1.3-4.6 0l-17-17c-1.3-1.3-1.3-3.3 0-4.6l17-17Z"
          fill={fill}
        />
      )}

      {shape === 'arch' && (
        <path
          d="M13 28c0-9.9 7.6-18 17-18s17 8.1 17 18v16c0 1.7-1.3 3-3 3H16c-1.7 0-3-1.3-3-3V28Z"
          fill={fill}
        />
      )}

      {shape === 'hexagon' && <polygon points="30,9 48,19 48,39 30,49 12,39 12,19" fill={fill} />}

      {shape === 'pentagon' && <polygon points="30,9 49,23 42,46 18,46 11,23" fill={fill} />}

      {shape === 'rainbow' && (
        <path d="M10 46c2-18 16-30 38-30v14c-12 0-21 6-23 16H10Z" fill={fill} />
      )}

      {renderAccessoryAndLimbs(resolvedAccessory)}
      {renderEditorialFace(mood, resolvedAccessory)}
    </svg>
  );
}
