import { useId, type ReactElement } from 'react';

export type VoiLogoVariant =
  'default' | 'dark' | 'tinted' | 'clear' | 'cobalt' | 'sky' | 'cream' | 'blue' | 'black' | 'white';

export interface VoiLogoProps {
  /**
   * - 'default' / 'cobalt' / 'blue': Liquid Glass Light (#FFFFFF->#E7EAF3 tile + #9A80FF->#4320D9 glass elephant).
   * - 'dark' / 'sky' / 'black': Liquid Glass Dark (#2A2B33->#0B0B10 tile + #9A80FF->#4320D9 glass elephant).
   * - 'tinted' / 'cream': Liquid Glass Gold Tinted (#1C1C22->#0B0B10 tile + #FFD27A->#C98A1E glass elephant).
   * - 'clear' / 'white': Liquid Glass Clear frosted translucent style.
   */
  variant?: VoiLogoVariant;
  size?: number;
  className?: string;
  label?: string;
}

interface GlassPalette {
  tileStart: string;
  tileEnd: string;
  tileOpacityStart?: number;
  tileOpacityEnd?: number;
  tileDiagonal?: boolean;
  elephantStart: string;
  elephantEnd: string;
  elephantOpacity?: number;
  eyeRing: string;
}

const VARIANT_PALETTE: Record<'default' | 'dark' | 'tinted' | 'clear', GlassPalette> = {
  default: {
    tileStart: '#FFFFFF',
    tileEnd: '#E7EAF3',
    elephantStart: '#9A80FF',
    elephantEnd: '#4320D9',
    eyeRing: '#4320D9',
  },
  dark: {
    tileStart: '#2A2B33',
    tileEnd: '#0B0B10',
    elephantStart: '#9A80FF',
    elephantEnd: '#4320D9',
    eyeRing: '#4320D9',
  },
  tinted: {
    tileStart: '#1C1C22',
    tileEnd: '#0B0B10',
    elephantStart: '#FFD27A',
    elephantEnd: '#C98A1E',
    eyeRing: '#C98A1E',
  },
  clear: {
    tileStart: '#FFFFFF',
    tileEnd: '#FFFFFF',
    tileOpacityStart: 0.38,
    tileOpacityEnd: 0.12,
    tileDiagonal: true,
    elephantStart: '#FFFFFF',
    elephantEnd: '#E9ECFF',
    elephantOpacity: 0.55,
    eyeRing: '#E9ECFF',
  },
};

function resolveGlassVariant(variant: VoiLogoVariant): 'default' | 'dark' | 'tinted' | 'clear' {
  switch (variant) {
    case 'dark':
    case 'sky':
    case 'black':
      return 'dark';
    case 'tinted':
    case 'cream':
      return 'tinted';
    case 'clear':
    case 'white':
      return 'clear';
    default:
      return 'default';
  }
}

const ELEPHANT_FILL_D =
  'M0 0 H400 V400 H276 V273 C220 273 178 262 162 230 L134 268 Q112 298 92 266 L0 140 Z';
const ELEPHANT_RIM_D = 'M0 140 L92 266 Q112 298 134 268 L162 230 C178 262 220 273 276 273 V400';

export function VoiLogo({
  variant = 'default',
  size = 40,
  className = '',
  label,
}: VoiLogoProps): ReactElement {
  const uid = useId().replace(/:/g, '');
  const palette = VARIANT_PALETTE[resolveGlassVariant(variant)];

  const tileClipId = `voi-tile-${uid}`;
  const tileGradId = `voi-g-${uid}`;
  const elephantGradId = `voi-e-${uid}`;
  const specGradId = `voi-s-${uid}`;
  const elephantClipId = `voi-c-${uid}`;
  const shadowFilterId = `voi-sh-${uid}`;
  const blurFilterId = `voi-bl-${uid}`;
  const rimGradId = `voi-rim-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 select-none ${className}`.trim()}
    >
      <defs>
        <clipPath id={tileClipId}>
          <rect width="400" height="400" rx="90" />
        </clipPath>
        <linearGradient id={tileGradId} x1="0" y1="0" x2={palette.tileDiagonal ? '1' : '0'} y2="1">
          <stop offset="0" stopColor={palette.tileStart} stopOpacity={palette.tileOpacityStart} />
          <stop offset="1" stopColor={palette.tileEnd} stopOpacity={palette.tileOpacityEnd} />
        </linearGradient>
        <linearGradient id={elephantGradId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={palette.elephantStart} />
          <stop offset="1" stopColor={palette.elephantEnd} />
        </linearGradient>
        <radialGradient id={specGradId} cx="0.3" cy="0.05" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id={elephantClipId}>
          <path d={ELEPHANT_FILL_D} />
        </clipPath>
        <filter id={shadowFilterId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.28" />
        </filter>
        <filter id={blurFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id={rimGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${tileClipId})`}>
        <rect width="400" height="400" fill={`url(#${tileGradId})`} />
        <g filter={`url(#${shadowFilterId})`}>
          <path
            d={ELEPHANT_FILL_D}
            fill={`url(#${elephantGradId})`}
            fillOpacity={palette.elephantOpacity ?? 1}
          />
        </g>
        <g clipPath={`url(#${elephantClipId})`}>
          <rect width="400" height="400" fill={`url(#${specGradId})`} />
          <path
            d={ELEPHANT_RIM_D}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="10"
            filter={`url(#${blurFilterId})`}
          />
          <path
            d={ELEPHANT_RIM_D}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.85"
            strokeWidth="2.5"
          />
        </g>
        <circle cx="280" cy="127" r="17" fill="#FFFFFF" fillOpacity="0.95" />
        <circle cx="275" cy="121" r="5" fill="#FFFFFF" />
        <circle
          cx="280"
          cy="127"
          r="17"
          fill="none"
          stroke={palette.eyeRing}
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <rect
          x="1.5"
          y="1.5"
          width="397"
          height="397"
          rx="88.5"
          fill="none"
          stroke={`url(#${rimGradId})`}
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}
