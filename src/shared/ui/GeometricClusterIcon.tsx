import type { ReactElement } from 'react';

export type ClusterIconVariant =
  'stay-together' | 'calendar-check' | 'wallet-stack' | 'handshake-debt' | 'chart-recap';

export type ClusterMascotMood = 'happy' | 'surplus' | 'warning' | 'danger' | 'payday';

export interface GeometricClusterIconProps {
  variant: ClusterIconVariant;
  mood?: ClusterMascotMood;
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Borderless flat overlapping geometric clusters with delicate 1.5px line-art props
 * modeled directly after the top-right and bottom-right clusters in the user's reference image.
 */
export function GeometricClusterIcon({
  variant,
  mood = 'happy',
  size = 88,
  label,
  className = '',
}: GeometricClusterIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 select-none ${className}`}
    >
      {variant === 'stay-together' && (
        <g>
          <path d="M18 22v7M14.5 25.5h7" stroke="#18181B" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="104" cy="24" r="3" stroke="#18181B" strokeWidth="1.5" />

          {/* Back Cobalt Geometric Shape (Earn/Bank) */}
          <path d="M16 48l22-30 14 10-12 18 18-24 14 10-20 30H16Z" fill="#3B82F6" />
          <circle cx="34" cy="36" r="5" fill="#FFFFFF" />
          <circle cx="35" cy="36" r="2.2" fill="#18181B" />
          <circle cx="43" cy="43" r="5" fill="#FFFFFF" />
          <circle cx="42" cy="43" r="2.2" fill="#18181B" />

          {/* Back Dark Ink Pill Buddy */}
          <rect x="74" y="12" width="28" height="44" rx="14" fill="#18181B" />
          <path
            d="M80 31c1.5 2.2 4.5 2.2 6 0M90 31c1.5 2.2 4.5 2.2 6 0"
            stroke="#3B82F6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <line
            x1="84"
            y1="38"
            x2="92"
            y2="38"
            stroke="#3B82F6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Bottom-left Mint Green Circle Buddy (Earn) with horizontal visor eyes */}
          <circle cx="44" cy="78" r="25" fill="#10B981" />
          <rect x="20" y="72" width="24" height="7.5" rx="3.5" fill="#FFFFFF" />
          <circle cx="31" cy="75.8" r="2.8" fill="#18181B" />
          <circle cx="39" cy="75.8" r="2.8" fill="#18181B" />

          {/* Center Coral Orange Chill Circle/Triangle Buddy (Cost) */}
          <circle cx="66" cy="56" r="27" fill="#FF6B35" />
          {mood === 'surplus' ? (
            <>
              {/* Cool Sunglasses & Big Smile for Fund Surplus */}
              <rect x="52" y="45" width="12" height="8" rx="2.5" fill="#18181B" />
              <rect x="68" y="45" width="12" height="8" rx="2.5" fill="#18181B" />
              <line x1="64" y1="48" x2="68" y2="48" stroke="#18181B" strokeWidth="2.2" />
              <path
                d="M55 58c4.5 6 17.5 6 22 0"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Gold Sparkle Star */}
              <path
                d="M106 42l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
                fill="#FFB703"
                stroke="#18181B"
                strokeWidth="1"
              />
            </>
          ) : mood === 'warning' ? (
            <>
              {/* Concerned Brows + Sweat Drop for >= 80% Cap Warning */}
              <path
                d="M55 46l8 2M77 46l-8 2"
                stroke="#18181B"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="59" cy="51" r="2.3" fill="#18181B" />
              <circle cx="73" cy="51" r="2.3" fill="#18181B" />
              <path
                d="M58 60c3-2.5 13-2.5 16 0"
                stroke="#18181B"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M87 43c0 3.2-2.2 5.2-3.5 5.2S80 46.2 80 43c0-2.4 3.5-6.2 3.5-6.2S87 40.6 87 43Z"
                fill="#38BDF8"
                stroke="#18181B"
                strokeWidth="1.2"
              />
            </>
          ) : mood === 'danger' ? (
            <>
              {/* Alert Wide Eyes + Wavy Mouth for Exceeded Cap */}
              <circle cx="59" cy="50" r="4.2" fill="#FFFFFF" />
              <circle cx="59" cy="50" r="2" fill="#18181B" />
              <circle cx="73" cy="50" r="4.2" fill="#FFFFFF" />
              <circle cx="73" cy="50" r="2" fill="#18181B" />
              <path
                d="M56 61c3-3.5 7 3.5 10 0s7 3.5 10 0"
                stroke="#18181B"
                strokeWidth="2.3"
                strokeLinecap="round"
              />
            </>
          ) : mood === 'payday' ? (
            <>
              {/* Starry Excited Eyes + Happy Grin for Payday */}
              <path
                d="M56 49c1.8-3 5.2-3 7 0M69 49c1.8-3 5.2-3 7 0"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M54 56c5 6.5 19 6.5 24 0Z" fill="#18181B" />
              <circle cx="105" cy="44" r="6.5" fill="#FFB703" stroke="#18181B" strokeWidth="1.3" />
            </>
          ) : (
            <>
              <path
                d="M57 49c1.5 2.4 4.5 2.4 6 0M69 49c1.5 2.4 4.5 2.4 6 0"
                stroke="#18181B"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M54 55c5 5.5 19 5.5 24 0"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Bottom-right Flamingo Pink Rainbow Arc Buddy */}
          <path d="M68 102c4-22 20-35 42-35v18c-12 0-20 6-23 17H68Z" fill="#F472B6" />
          <circle cx="96" cy="84" r="5.5" fill="#FFFFFF" />
          <circle cx="96" cy="84" r="2.4" fill="#18181B" />
          <path
            d="M84 85c3.5 4.5 11.5 4.5 15 0"
            stroke="#18181B"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      )}

      {variant === 'calendar-check' && (
        <g>
          <circle cx="76" cy="38" r="12" stroke="#18181B" strokeWidth="1.2" />
          <circle cx="76" cy="35" r="2.5" stroke="#18181B" strokeWidth="1.2" />
          <path d="M71 43c1.5-2.5 8.5-2.5 10 0" stroke="#18181B" strokeWidth="1.2" />

          <path d="M14 58c0-16 12.5-28 28-28s28 12 28 28v36H14V58Z" fill="#FFB703" />
          <circle cx="35" cy="52" r="2" fill="#18181B" />
          <circle cx="46" cy="52" r="2" fill="#18181B" />
          <path
            d="M38 57c1.8 2 5.2 2 7 0"
            stroke="#18181B"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          <rect x="48" y="52" width="34" height="42" rx="6" fill="#FF6B35" />
          <circle cx="60" cy="66" r="2" fill="#18181B" />
          <circle cx="70" cy="66" r="2" fill="#18181B" />
          <path
            d="M62 71c1.5 1.8 4.5 1.8 6 0"
            stroke="#18181B"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          <polygon points="38,68 54,75 49,94 29,94 24,75" fill="#3B82F6" />
          <path d="M34 69c0-3.5 8-3.5 8 0" stroke="#18181B" strokeWidth="1.4" />
          <circle cx="35" cy="83" r="1.6" fill="#FFFFFF" />
          <circle cx="43" cy="83" r="1.6" fill="#FFFFFF" />

          <circle cx="90" cy="80" r="15" fill="#10B981" />
          <circle cx="90" cy="80" r="10.5" stroke="#FFFFFF" strokeWidth="1.4" />
          <path
            d="M85.5 80l3.2 3.2 6.5-6.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {variant === 'wallet-stack' && (
        <g>
          <circle cx="90" cy="48" r="12" stroke="#18181B" strokeWidth="1.2" />
          <path d="M90 42v6l4 3" stroke="#18181B" strokeWidth="1.2" strokeLinecap="round" />

          <rect x="26" y="24" width="46" height="56" rx="7" fill="#10B981" />
          <path d="M26 38v-6c0-6 6-10 23-10s23 4 23 10v6" stroke="#18181B" strokeWidth="1.5" />
          <rect
            x="23"
            y="34"
            width="4"
            height="9"
            rx="2"
            fill="#FFFFFF"
            stroke="#18181B"
            strokeWidth="1.4"
          />
          <rect
            x="70"
            y="34"
            width="4"
            height="9"
            rx="2"
            fill="#FFFFFF"
            stroke="#18181B"
            strokeWidth="1.4"
          />
          <circle cx="44" cy="44" r="2" fill="#18181B" />
          <circle cx="56" cy="44" r="2" fill="#18181B" />
          <path
            d="M47 49c1.5 1.8 4.5 1.8 6 0"
            stroke="#18181B"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          <rect x="46" y="60" width="38" height="32" rx="4" fill="#3B82F6" />
          <rect x="46" y="60" width="38" height="8" rx="2" fill="#FFB703" />
          <path
            d="M54 76h22M54 83h22M61 72v15M69 72v15"
            stroke="#FFFFFF"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          <path d="M28 54l18 38H10l18-38Z" fill="#FF6B35" />
          <circle cx="24" cy="78" r="1.8" fill="#18181B" />
          <circle cx="32" cy="78" r="1.8" fill="#18181B" />
        </g>
      )}

      {variant === 'handshake-debt' && (
        <g>
          <circle cx="26" cy="38" r="11" stroke="#18181B" strokeWidth="1.2" />
          <text x="23" y="42" fontSize="12" fontWeight="bold" fill="#18181B">
            ?
          </text>

          <rect x="42" y="28" width="48" height="58" rx="7" fill="#FFB703" />
          <circle cx="60" cy="48" r="2" fill="#18181B" />
          <circle cx="72" cy="48" r="2" fill="#18181B" />
          <path
            d="M63 54c1.5 1.8 4.5 1.8 6 0"
            stroke="#18181B"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          <circle cx="30" cy="74" r="17" fill="#8B5CF6" />
          <circle cx="26" cy="72" r="1.8" fill="#FFFFFF" />
          <circle cx="34" cy="72" r="1.8" fill="#FFFFFF" />

          <rect x="64" y="66" width="40" height="24" rx="5" fill="#10B981" />
          <circle cx="76" cy="78" r="2.2" fill="#FFFFFF" />
          <circle cx="84" cy="78" r="2.2" fill="#FFFFFF" />
          <circle cx="92" cy="78" r="2.2" fill="#FFFFFF" />
        </g>
      )}

      {variant === 'chart-recap' && (
        <g>
          <path d="M52 44c0-13.3 10.7-24 24-24s24 10.7 24 24v46H52V44Z" fill="#FF6B35" />
          <circle cx="70" cy="46" r="2" fill="#18181B" />
          <circle cx="82" cy="46" r="2" fill="#18181B" />

          <path d="M34 52l22 40H12l22-40Z" fill="#F472B6" />
          <circle cx="30" cy="76" r="1.8" fill="#18181B" />
          <circle cx="38" cy="76" r="1.8" fill="#18181B" />

          <rect x="52" y="58" width="32" height="34" rx="5" fill="#3B82F6" />
          <path
            d="M59 70l3 3 6-6M59 82l3 3 6-6"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
}
