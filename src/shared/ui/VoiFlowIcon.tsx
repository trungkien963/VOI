import type { ReactElement } from 'react';
import type { BuddyMood } from '../../domain/types/entities';

export type VoiFlowIconVariant =
  'income' | 'expense' | 'transfer' | 'lend-borrow' | 'lend' | 'borrow' | 'lineup';

export interface VoiFlowIconProps {
  variant: VoiFlowIconVariant;
  mood?: BuddyMood;
  size?: number;
  label?: string;
  className?: string;
}

const WING_PATH =
  'M28 -14 C40 -26 52 -32 60 -30 A8 8 0 0 1 66 -16 A8 8 0 0 1 64 -2 A8 8 0 0 1 56 10 C46 12 36 8 28 6 Z';

const INCOME_BODY_PATH =
  'M0.0 -40.0 A7.8 7.8 0 0 1 13.6 -37.6 A8.4 8.4 0 0 1 26.6 -29.9 A6.8 6.8 0 0 1 34.3 -20.5 A6.3 6.3 0 0 1 38.7 -10.1 A6.6 6.6 0 0 1 40.0 1.7 A8.0 8.0 0 0 1 36.8 15.7 A6.6 6.6 0 0 1 30.7 25.7 A6.9 6.9 0 0 1 21.4 33.8 A8.2 8.2 0 0 1 7.8 39.2 A6.9 6.9 0 0 1 -4.5 39.7 A7.7 7.7 0 0 1 -17.7 35.9 A8.3 8.3 0 0 1 -29.5 27.0 A8.6 8.6 0 0 1 -37.5 14.0 A7.4 7.4 0 0 1 -40.0 1.0 A6.8 6.8 0 0 1 -38.4 -11.1 A7.2 7.2 0 0 1 -32.9 -22.8 A7.2 7.2 0 0 1 -23.9 -32.1 A7.6 7.6 0 0 1 -11.9 -38.2 A6.7 6.7 0 0 1 0.0 -40.0Z';

const INCOME_FLOWER_PATH =
  'M0.0 -66.0 A2.8 2.8 0 0 1 4.7 -64.2 A2.7 2.7 0 0 1 6.9 -60.0 A3.4 3.4 0 0 1 5.1 -54.2 A2.9 2.9 0 0 1 0.4 -52.0 A3.1 3.1 0 0 1 -4.8 -53.9 A2.7 2.7 0 0 1 -7.0 -58.3 A3.4 3.4 0 0 1 -4.8 -64.1 A2.9 2.9 0 0 1 0.0 -66.0Z';

const EXPENSE_BODY_PATH =
  'M-16.0 -32.0 A6.3 6.3 0 0 1 -4.8 -32.0 A8.3 8.3 0 0 1 10.1 -32.0 A8.0 8.0 0 0 1 24.3 -30.2 A7.5 7.5 0 0 1 34.0 -20.8 A7.3 7.3 0 0 1 36.0 -7.9 A7.3 7.3 0 0 1 36.0 5.1 A7.3 7.3 0 0 1 35.1 18.1 A7.5 7.5 0 0 1 26.9 28.8 A7.0 7.0 0 0 1 14.9 32.0 A6.2 6.2 0 0 1 3.8 32.0 A7.5 7.5 0 0 1 -9.7 32.0 A6.0 6.0 0 0 1 -20.3 31.5 A7.9 7.9 0 0 1 -32.2 23.8 A8.0 8.0 0 0 1 -36.0 10.1 A7.7 7.7 0 0 1 -36.0 -3.7 A6.2 6.2 0 0 1 -35.8 -14.7 A7.7 7.7 0 0 1 -29.3 -26.9 A8.0 8.0 0 0 1 -16.0 -32.0Z';

const TRANSFER_BODY_PATH =
  'M-24.0 -36.0 A7.0 7.0 0 0 1 -20.8 -48.0 A7.4 7.4 0 0 1 -11.3 -57.2 A6.4 6.4 0 0 1 -0.3 -60.0 A6.9 6.9 0 0 1 11.6 -57.0 A6.2 6.2 0 0 1 19.8 -49.5 A5.9 5.9 0 0 1 23.7 -39.7 A7.9 7.9 0 0 1 24.0 -25.6 A7.4 7.4 0 0 1 24.0 -12.5 A8.1 8.1 0 0 1 24.0 2.0 A8.4 8.4 0 0 1 24.0 17.0 A6.6 6.6 0 0 1 24.0 28.9 A6.3 6.3 0 0 1 23.7 40.1 A6.9 6.9 0 0 1 18.5 51.3 A7.7 7.7 0 0 1 7.1 58.9 A6.6 6.6 0 0 1 -4.6 59.6 A7.2 7.2 0 0 1 -16.1 53.8 A6.6 6.6 0 0 1 -22.7 43.9 A7.7 7.7 0 0 1 -24.0 30.3 A7.8 7.8 0 0 1 -24.0 16.4 A7.0 7.0 0 0 1 -24.0 3.8 A8.0 8.0 0 0 1 -24.0 -10.5 A7.0 7.0 0 0 1 -24.0 -23.0 A7.3 7.3 0 0 1 -24.0 -36.0Z';

const LEND_CHERRY_PATH =
  'M-22.0 -14.0 A5.4 5.4 0 0 1 -12.5 -12.1 A6.4 6.4 0 0 1 -3.5 -5.2 A5.6 5.6 0 0 1 1.2 3.7 A6.2 6.2 0 0 1 1.5 14.8 A5.7 5.7 0 0 1 -2.6 24.1 A5.4 5.4 0 0 1 -9.6 30.6 A4.6 4.6 0 0 1 -17.3 33.5 A4.9 4.9 0 0 1 -26.1 33.7 A6.5 6.5 0 0 1 -36.8 28.9 A5.5 5.5 0 0 1 -43.1 21.5 A4.8 4.8 0 0 1 -45.8 13.3 A6.1 6.1 0 0 1 -44.8 2.5 A5.6 5.6 0 0 1 -39.7 -6.2 A6.3 6.3 0 0 1 -30.4 -12.5 A4.8 4.8 0 0 1 -22.0 -14.0Z';

const BORROW_CHERRY_PATH =
  'M26.0 -10.0 A5.7 5.7 0 0 1 35.9 -7.8 A5.0 5.0 0 0 1 43.3 -2.7 A6.0 6.0 0 0 1 48.8 6.5 A5.9 5.9 0 0 1 49.8 16.9 A5.2 5.2 0 0 1 46.9 25.8 A5.8 5.8 0 0 1 39.9 33.5 A4.8 4.8 0 0 1 32.1 37.2 A5.8 5.8 0 0 1 21.8 37.6 A5.0 5.0 0 0 1 13.5 34.5 A5.3 5.3 0 0 1 6.6 28.1 A5.5 5.5 0 0 1 2.6 19.2 A6.2 6.2 0 0 1 2.7 8.2 A6.2 6.2 0 0 1 7.8 -1.6 A5.2 5.2 0 0 1 15.0 -7.3 A6.3 6.3 0 0 1 26.0 -10.0Z';

function renderScallopedFace(
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
  mouthY: number,
  eyeR: number,
  defaultMouth: 'smile' | 'triangle' | 'o',
  mood?: BuddyMood,
): ReactElement {
  const centerX = (leftEyeX + rightEyeX) / 2;
  const ink = '#000180';

  if (mood === 'wink') {
    return (
      <g>
        <circle cx={leftEyeX} cy={eyeY} r={eyeR} fill={ink} />
        <path
          d={`M${rightEyeX - eyeR} ${eyeY} q${eyeR} ${-eyeR * 0.9} ${eyeR * 2} 0`}
          stroke={ink}
          strokeWidth={Math.max(1.8, eyeR * 0.65)}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M${centerX - 4.5} ${mouthY - 1} q4.5 5 9 0`}
          stroke={ink}
          strokeWidth="2.1"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (mood === 'excited') {
    return (
      <g>
        <circle cx={leftEyeX} cy={eyeY} r={eyeR * 1.08} fill={ink} />
        <circle cx={leftEyeX - 1} cy={eyeY - 1} r={eyeR * 0.35} fill="#FFFFFF" />
        <circle cx={rightEyeX} cy={eyeY} r={eyeR * 1.08} fill={ink} />
        <circle cx={rightEyeX - 1} cy={eyeY - 1} r={eyeR * 0.35} fill="#FFFFFF" />
        <path
          d={`M${centerX - 5} ${mouthY - 2} L${centerX + 5} ${mouthY - 2} L${centerX} ${mouthY + 4.5} Z`}
          fill="#006EE9"
          stroke="#006EE9"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (mood === 'surprised') {
    return (
      <g>
        <path
          d={`M${leftEyeX - 3} ${eyeY - eyeR - 3} q3 -2.5 6 0 M${rightEyeX - 3} ${eyeY - eyeR - 3} q3 -2.5 6 0`}
          stroke={ink}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={leftEyeX} cy={eyeY} r={eyeR * 1.12} fill={ink} />
        <circle cx={rightEyeX} cy={eyeY} r={eyeR * 1.12} fill={ink} />
        <circle
          cx={centerX}
          cy={mouthY + 1}
          r={eyeR * 0.85}
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
      </g>
    );
  }

  if (mood === 'worried') {
    return (
      <g>
        <path
          d={`M${leftEyeX - 3.5} ${eyeY - eyeR - 1.5} l6 -2 M${rightEyeX + 3.5} ${eyeY - eyeR - 1.5} l-6 -2`}
          stroke={ink}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={leftEyeX} cy={eyeY} r={eyeR} fill={ink} />
        <circle cx={rightEyeX} cy={eyeY} r={eyeR} fill={ink} />
        <path
          d={`M${centerX - 4} ${mouthY + 2.5} q4 -4 8 0`}
          stroke={ink}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M${rightEyeX + 8} ${eyeY - 10} c0 3.2 -2.2 5 -3.2 5 s-3.2 -1.8 -3.2 -5 c0 -2.2 3.2 -5.5 3.2 -5.5 s3.2 3.3 3.2 5.5 Z`}
          fill="#83E7FF"
          stroke={ink}
          strokeWidth="1.2"
        />
      </g>
    );
  }

  return (
    <g>
      <circle cx={leftEyeX} cy={eyeY} r={eyeR} fill={ink} />
      <circle cx={rightEyeX} cy={eyeY} r={eyeR} fill={ink} />
      {defaultMouth === 'smile' && (
        <path
          d={`M${centerX - 3.5} ${mouthY} q3.5 4 7 0`}
          stroke={ink}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {defaultMouth === 'triangle' && (
        <path
          d={`M${centerX - 4.5} ${mouthY - 3} L${centerX + 4.5} ${mouthY - 3} L${centerX} ${mouthY + 3} Z`}
          fill="#006EE9"
          stroke="#006EE9"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {defaultMouth === 'o' && (
        <circle cx={centerX} cy={mouthY} r={2.2} fill="none" stroke={ink} strokeWidth="1.8" />
      )}
    </g>
  );
}

/**
 * Renders the 7 official VOI Option-1 Scalloped Mascot Flow Icons (`public/brand/Icons/voi-option1-*.svg`)
 * with crisp white sticker rim & subtle drop-shadow so they pop vividly on any surface,
 * plus full multi-mood expression support.
 */
export function VoiFlowIcon({
  variant,
  mood,
  size = 36,
  label,
  className = '',
}: VoiFlowIconProps): ReactElement {
  const popFilterClass = 'drop-shadow-[0_3px_6px_rgba(0,1,128,0.14)]';

  if (variant === 'income') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-54 -74 108 138"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          d="M-12 32 L-15 52 L-24 55 M12 32 L15 52 L24 55"
          stroke="#72B636"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M0 -38 V-52" stroke="#72B636" strokeWidth="3.5" strokeLinecap="round" />
        <path
          fill="#E7A0FE"
          stroke="#FFFFFF"
          strokeWidth="3"
          paintOrder="stroke fill"
          d={INCOME_FLOWER_PATH}
        />
        <circle cx="0" cy="-59" r="2.8" fill="#006EE9" />
        <path
          fill="#C2FC8B"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={INCOME_BODY_PATH}
        />
        <circle cx="-20" cy="7" r="6" fill="#E7A0FE" />
        <circle cx="20" cy="7" r="6" fill="#E7A0FE" />
        {renderScallopedFace(-7, 7, -4, 5, 3.5, 'smile', mood)}
      </svg>
    );
  }

  if (variant === 'expense') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-72 -42 144 98"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          d="M-12 26 L-14 46 L-22 48 M12 26 L14 46 L22 48"
          stroke="#9B4DCA"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g
          fill="#E28EFF"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          <path d={WING_PATH} />
          <path d={WING_PATH} transform="scale(-1 1)" />
        </g>
        <path
          fill="#E28EFF"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={EXPENSE_BODY_PATH}
        />
        <circle cx="-21" cy="6" r="5.5" fill="#B84CE0" opacity="0.55" />
        <circle cx="21" cy="6" r="5.5" fill="#B84CE0" opacity="0.55" />
        {renderScallopedFace(-9, 9, -6, 5, 3.5, 'triangle', mood)}
      </svg>
    );
  }

  if (variant === 'transfer') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-68 -74 116 154"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          fill="#26A6D1"
          opacity="0.6"
          d="M-46.0 62.0 A2.3 2.3 0 0 1 -42.2 63.8 A2.7 2.7 0 0 1 -41.2 68.5 A2.4 2.4 0 0 1 -44.3 71.7 A2.7 2.7 0 0 1 -49.0 71.0 A2.5 2.5 0 0 1 -51.0 67.1 A2.3 2.3 0 0 1 -49.4 63.3 A2.0 2.0 0 0 1 -46.0 62.0Z"
        />
        <path
          fill="#26A6D1"
          opacity="0.4"
          d="M-58.0 54.0 A2.4 2.4 0 0 1 -54.6 56.5 A2.1 2.1 0 0 1 -55.7 60.1 A2.4 2.4 0 0 1 -60.1 60.3 A2.4 2.4 0 0 1 -61.2 56.2 A2.2 2.2 0 0 1 -58.0 54.0Z"
        />
        <path
          d="M-12 54 L-24 63 L-26 73 M2 56 L12 67 L22 69"
          stroke="#26A6D1"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="rotate(12)">
          <path
            fill="#6CE0FF"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinejoin="round"
            paintOrder="stroke fill"
            d={TRANSFER_BODY_PATH}
          />
          <path d="M-22 -14 q-20 -4 -40 7 l4 8 q16 -8 36 -7 Z" fill="#E28EFF" />
          <rect x="-27" y="-19" width="54" height="10" rx="5" fill="#E28EFF" />
          <circle cx="-12" cy="-28" r="4" fill="#E28EFF" />
          {renderScallopedFace(-4, 10, -36, -27, 3.5, 'o', mood)}
        </g>
      </svg>
    );
  }

  if (variant === 'lend') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-54 -66 84 124"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          d="M-28 32 L-30 48 L-37 50 M-16 32 L-14 48 L-7 50"
          stroke="#D9475C"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M-22 -12 Q-18 -34 -8 -48"
          stroke="#72B636"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M-8 -48 C0 -60 18 -60 24 -50 C16 -42 0 -42 -8 -48 Z" fill="#B8F77E" />
        <path
          fill="#FF5C74"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={LEND_CHERRY_PATH}
        />
        <ellipse
          cx="-31"
          cy="-1"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.4"
          transform="rotate(-30 -31 -1)"
        />
        <circle cx="-36" cy="20" r="4" fill="#FFA3C5" />
        <circle cx="-8" cy="20" r="4" fill="#FFA3C5" />
        {renderScallopedFace(-28, -16, 12, 19, 3.2, 'smile', mood)}
      </svg>
    );
  }

  if (variant === 'borrow') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-4 -52 60 112"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          d="M20 36 L18 50 L11 52 M32 36 L34 50 L41 52"
          stroke="#D9658B"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26 -8 Q22 -30 14 -44"
          stroke="#72B636"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          fill="#FF94BC"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={BORROW_CHERRY_PATH}
        />
        <ellipse
          cx="17"
          cy="3"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.5"
          transform="rotate(-30 17 3)"
        />
        <circle cx="12" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        <circle cx="40" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        {renderScallopedFace(20, 32, 16, 24, 3.2, 'o', mood)}
      </svg>
    );
  }

  if (variant === 'lend-borrow') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-52 -70 108 128"
        width={size}
        height={size}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={`shrink-0 select-none ${popFilterClass} ${className}`}
      >
        <path
          d="M-28 32 L-30 48 L-37 50 M-16 32 L-14 48 L-7 50"
          stroke="#D9475C"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 36 L18 50 L11 52 M32 36 L34 50 L41 52"
          stroke="#D9658B"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 -52 Q-8 -30 -22 -12 M6 -52 Q20 -24 26 -8"
          stroke="#72B636"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M6 -52 C14 -64 32 -64 38 -54 C30 -46 14 -46 6 -52 Z" fill="#B8F77E" />
        <path
          fill="#FF94BC"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={BORROW_CHERRY_PATH}
        />
        <ellipse
          cx="17"
          cy="3"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.5"
          transform="rotate(-30 17 3)"
        />
        <circle cx="12" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        <circle cx="40" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        {renderScallopedFace(20, 32, 16, 24, 3.2, 'o', mood)}

        <path
          fill="#FF5C74"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          d={LEND_CHERRY_PATH}
        />
        <ellipse
          cx="-31"
          cy="-1"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.4"
          transform="rotate(-30 -31 -1)"
        />
        <circle cx="-36" cy="20" r="4" fill="#FFA3C5" />
        <circle cx="-8" cy="20" r="4" fill="#FFA3C5" />
        {renderScallopedFace(-28, -16, 12, 19, 3.2, 'smile', mood)}
      </svg>
    );
  }

  // variant === 'lineup'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 -78 600 156"
      width={size * 3.2}
      height={size}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 select-none ${popFilterClass} ${className}`}
    >
      <g transform="translate(95 0)">
        <path
          d="M-12 32 L-15 52 L-24 55 M12 32 L15 52 L24 55"
          stroke="#72B636"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M0 -38 V-52" stroke="#72B636" strokeWidth="3.5" strokeLinecap="round" />
        <path
          fill="#E7A0FE"
          stroke="#FFFFFF"
          strokeWidth="3"
          paintOrder="stroke fill"
          d={INCOME_FLOWER_PATH}
        />
        <circle cx="0" cy="-59" r="2.8" fill="#006EE9" />
        <path
          fill="#C2FC8B"
          stroke="#FFFFFF"
          strokeWidth="5"
          paintOrder="stroke fill"
          d={INCOME_BODY_PATH}
        />
        <circle cx="-20" cy="7" r="6" fill="#E7A0FE" />
        <circle cx="20" cy="7" r="6" fill="#E7A0FE" />
        {renderScallopedFace(-7, 7, -4, 5, 3.5, 'smile', mood)}
      </g>
      <g transform="translate(250 4)">
        <path
          d="M-12 26 L-14 46 L-22 48 M12 26 L14 46 L22 48"
          stroke="#9B4DCA"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g fill="#E28EFF" stroke="#FFFFFF" strokeWidth="4.5" paintOrder="stroke fill">
          <path d={WING_PATH} />
          <path d={WING_PATH} transform="scale(-1 1)" />
        </g>
        <path
          fill="#E28EFF"
          stroke="#FFFFFF"
          strokeWidth="5"
          paintOrder="stroke fill"
          d={EXPENSE_BODY_PATH}
        />
        <circle cx="-21" cy="6" r="5.5" fill="#B84CE0" opacity="0.55" />
        <circle cx="21" cy="6" r="5.5" fill="#B84CE0" opacity="0.55" />
        {renderScallopedFace(-9, 9, -6, 5, 3.5, 'triangle', mood)}
      </g>
      <g transform="translate(410 -6)">
        <path
          fill="#26A6D1"
          opacity="0.55"
          d="M-46.0 62.0 A2.3 2.3 0 0 1 -42.2 63.8 A2.7 2.7 0 0 1 -41.2 68.5 A2.4 2.4 0 0 1 -44.3 71.7 A2.7 2.7 0 0 1 -49.0 71.0 A2.5 2.5 0 0 1 -51.0 67.1 A2.3 2.3 0 0 1 -49.4 63.3 A2.0 2.0 0 0 1 -46.0 62.0Z"
        />
        <path
          fill="#26A6D1"
          opacity="0.35"
          d="M-58.0 54.0 A2.4 2.4 0 0 1 -54.6 56.5 A2.1 2.1 0 0 1 -55.7 60.1 A2.4 2.4 0 0 1 -60.1 60.3 A2.4 2.4 0 0 1 -61.2 56.2 A2.2 2.2 0 0 1 -58.0 54.0Z"
        />
        <path
          d="M-12 54 L-24 63 L-26 73 M2 56 L12 67 L22 69"
          stroke="#26A6D1"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="rotate(12)">
          <path
            fill="#6CE0FF"
            stroke="#FFFFFF"
            strokeWidth="5"
            paintOrder="stroke fill"
            d={TRANSFER_BODY_PATH}
          />
          <path d="M-22 -14 q-20 -4 -40 7 l4 8 q16 -8 36 -7 Z" fill="#E28EFF" />
          <rect x="-27" y="-19" width="54" height="10" rx="5" fill="#E28EFF" />
          <circle cx="-12" cy="-28" r="4" fill="#E28EFF" />
          {renderScallopedFace(-4, 10, -36, -27, 3.5, 'o', mood)}
        </g>
      </g>
      <g transform="translate(565 2)">
        <path
          d="M-28 32 L-30 48 L-37 50 M-16 32 L-14 48 L-7 50"
          stroke="#D9475C"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 36 L18 50 L11 52 M32 36 L34 50 L41 52"
          stroke="#D9658B"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 -52 Q-8 -30 -22 -12 M6 -52 Q20 -24 26 -8"
          stroke="#72B636"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M6 -52 C14 -64 32 -64 38 -54 C30 -46 14 -46 6 -52 Z" fill="#B8F77E" />
        <path
          fill="#FF94BC"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          paintOrder="stroke fill"
          d={BORROW_CHERRY_PATH}
        />
        <ellipse
          cx="17"
          cy="3"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.5"
          transform="rotate(-30 17 3)"
        />
        <circle cx="12" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        <circle cx="40" cy="24" r="4" fill="#FF5C74" opacity="0.5" />
        {renderScallopedFace(20, 32, 16, 24, 3.2, 'o', mood)}
        <path
          fill="#FF5C74"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          paintOrder="stroke fill"
          d={LEND_CHERRY_PATH}
        />
        <ellipse
          cx="-31"
          cy="-1"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.4"
          transform="rotate(-30 -31 -1)"
        />
        <circle cx="-36" cy="20" r="4" fill="#FFA3C5" />
        <circle cx="-8" cy="20" r="4" fill="#FFA3C5" />
        {renderScallopedFace(-28, -16, 12, 19, 3.2, 'smile', mood)}
      </g>
    </svg>
  );
}
