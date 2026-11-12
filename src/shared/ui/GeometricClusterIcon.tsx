import type { ReactElement } from 'react';
import type { BuddyMood } from '../../domain/types/entities';
import { VoiFlowIcon } from './VoiFlowIcon';

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

function mapClusterMoodToBuddyMood(mood: ClusterMascotMood): BuddyMood {
  switch (mood) {
    case 'payday':
    case 'surplus':
      return 'excited';
    case 'warning':
      return 'surprised';
    case 'danger':
      return 'worried';
    case 'happy':
    default:
      return 'happy';
  }
}

/**
 * Borderless flat overlapping geometric clusters with delicate 1.5px line-art props
 * upgraded with the VOI Option-1 Scalloped Mascot family (`lineup` and `lend-borrow`).
 */
export function GeometricClusterIcon({
  variant,
  mood = 'happy',
  size = 88,
  label,
  className = '',
}: GeometricClusterIconProps): ReactElement {
  const buddyMood = mapClusterMoodToBuddyMood(mood);

  if (variant === 'stay-together') {
    return (
      <VoiFlowIcon
        variant="lineup"
        mood={buddyMood}
        size={size}
        label={label}
        className={className}
      />
    );
  }

  if (variant === 'handshake-debt') {
    return (
      <VoiFlowIcon
        variant="lend-borrow"
        mood={buddyMood}
        size={size}
        label={label}
        className={className}
      />
    );
  }

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
      {variant === 'calendar-check' && (
        <g>
          <circle cx="76" cy="38" r="12" stroke="#191919" strokeWidth="1.2" />
          <circle cx="76" cy="35" r="2.5" stroke="#191919" strokeWidth="1.2" />
          <path d="M71 43c1.5-2.5 8.5-2.5 10 0" stroke="#191919" strokeWidth="1.2" />

          <path d="M14 58c0-16 12.5-28 28-28s28 12 28 28v36H14V58Z" fill="#F2D147" />
          <circle cx="35" cy="52" r="2" fill="#191919" />
          <circle cx="46" cy="52" r="2" fill="#191919" />
          <path
            d="M38 57c1.8 2 5.2 2 7 0"
            stroke="#191919"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          <rect x="48" y="52" width="34" height="42" rx="6" fill="#FF7A1A" />
          <circle cx="60" cy="66" r="2" fill="#191919" />
          <circle cx="70" cy="66" r="2" fill="#191919" />
          <path
            d="M62 71c1.5 1.8 4.5 1.8 6 0"
            stroke="#191919"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          <polygon points="38,68 54,75 49,94 29,94 24,75" fill="#5E89ED" />
          <path d="M34 69c0-3.5 8-3.5 8 0" stroke="#191919" strokeWidth="1.4" />
          <circle cx="35" cy="83" r="1.6" fill="#FAFAFA" />
          <circle cx="43" cy="83" r="1.6" fill="#FAFAFA" />

          <circle cx="90" cy="80" r="15" fill="#52C470" />
          <circle cx="90" cy="80" r="10.5" stroke="#FAFAFA" strokeWidth="1.4" />
          <path
            d="M85.5 80l3.2 3.2 6.5-6.5"
            stroke="#FAFAFA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {variant === 'wallet-stack' && (
        <g>
          <circle cx="90" cy="48" r="12" stroke="#191919" strokeWidth="1.2" />
          <path d="M90 42v6l4 3" stroke="#191919" strokeWidth="1.2" strokeLinecap="round" />

          <rect x="26" y="24" width="46" height="56" rx="7" fill="#52C470" />
          <path d="M26 38v-6c0-6 6-10 23-10s23 4 23 10v6" stroke="#191919" strokeWidth="1.5" />
          <rect
            x="23"
            y="34"
            width="4"
            height="9"
            rx="2"
            fill="#FAFAFA"
            stroke="#191919"
            strokeWidth="1.4"
          />
          <rect
            x="70"
            y="34"
            width="4"
            height="9"
            rx="2"
            fill="#FAFAFA"
            stroke="#191919"
            strokeWidth="1.4"
          />
          <circle cx="44" cy="44" r="2" fill="#191919" />
          <circle cx="56" cy="44" r="2" fill="#191919" />
          <path
            d="M47 49c1.5 1.8 4.5 1.8 6 0"
            stroke="#191919"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          <rect x="46" y="60" width="38" height="32" rx="4" fill="#5E89ED" />
          <rect x="46" y="60" width="38" height="8" rx="2" fill="#F2D147" />
          <path
            d="M54 76h22M54 83h22M61 72v15M69 72v15"
            stroke="#FAFAFA"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          <path d="M28 54l18 38H10l18-38Z" fill="#FF7A1A" />
          <circle cx="24" cy="78" r="1.8" fill="#191919" />
          <circle cx="32" cy="78" r="1.8" fill="#191919" />
        </g>
      )}

      {variant === 'chart-recap' && (
        <g>
          <path d="M52 44c0-13.3 10.7-24 24-24s24 10.7 24 24v46H52V44Z" fill="#FF7A1A" />
          <circle cx="70" cy="46" r="2" fill="#191919" />
          <circle cx="82" cy="46" r="2" fill="#191919" />

          <path d="M34 52l22 40H12l22-40Z" fill="#EF6EA5" />
          <circle cx="30" cy="76" r="1.8" fill="#191919" />
          <circle cx="38" cy="76" r="1.8" fill="#191919" />

          <rect x="52" y="58" width="32" height="34" rx="5" fill="#5E89ED" />
          <path
            d="M59 70l3 3 6-6M59 82l3 3 6-6"
            stroke="#FAFAFA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
}
