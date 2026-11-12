import { useId, type ReactElement } from 'react';
import type { BuddyAccessory, BuddyMood, GeometricShape } from '../../domain/types/entities';

export type VoiElephantPose =
  | 'peeking' // 01-voi-lo-dau.svg
  | 'gentleman' // 02-quy-ong-tiet-kiem.svg
  | 'coin-toss' // 03-voi-tung-xu.svg
  | 'gym' // 04-voi-tap-gym.svg
  | 'slide' // 05-voi-truot-doc.svg
  | 'super' // 06-sieu-voi.svg
  | 'memory' // 07-voi-tri-nho.svg
  | 'family' // 08-voi-me-voi-con.svg
  | 'sleep'; // 09-voi-ngu.svg

export interface GeometricBuddyProps {
  shape: GeometricShape;
  colorHex?: string;
  mood?: BuddyMood;
  pose?: VoiElephantPose;
  accessory?: BuddyAccessory;
  blush?: boolean;
  size?: number;
  label?: string;
  className?: string;
}

const SHAPE_TO_ELEPHANT_POSE: Record<GeometricShape, VoiElephantPose> = {
  arch: 'gentleman', // 02-quy-ong-tiet-kiem (Bơ Ấm Áp / Quý Ông Voi)
  hexagon: 'memory', // 07-voi-tri-nho (Voi Tỉnh Táo / Voi Trí Nhớ)
  square: 'gym', // 04-voi-tap-gym (Mầm Tích Lũy / Voi Tập Gym)
  circle: 'coin-toss', // 03-voi-tung-xu (Tím Sáng Tạo / Voi Tung Xu)
  triangle: 'super', // 06-sieu-voi (Cam Năng Động / Siêu Voi)
  pentagon: 'family', // 08-voi-me-voi-con (Mây Hào Hứng / Voi Yêu Thương)
  diamond: 'peeking', // 01-voi-lo-dau
  rainbow: 'sleep', // 09-voi-ngu
};

function resolveElephantPose(
  shape: GeometricShape,
  mood: BuddyMood,
  explicitPose?: VoiElephantPose,
): VoiElephantPose {
  if (explicitPose) return explicitPose;
  if (mood === 'worried') return 'slide';
  if (mood === 'chill') return 'sleep';
  return SHAPE_TO_ELEPHANT_POSE[shape] ?? 'memory';
}

function renderSideElephantBase(earAngle = -8): ReactElement {
  return (
    <>
      {/* Back legs */}
      <rect x="-39.5" y="36" width="19" height="34" rx="9" fill="#2479B0" />
      <ellipse cx="-34" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <ellipse cx="-27" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <rect x="16.5" y="36" width="19" height="34" rx="9" fill="#2479B0" />
      <ellipse cx="22" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <ellipse cx="29" cy="68" rx="3" ry="2" fill="#D7ECF7" />

      {/* Tail with 3 tuft leaves */}
      <path
        d="M-60 2 C-74 -2 -78 -16 -86 -22"
        stroke="#2E8FCB"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="-90" cy="-24" rx="5" ry="3" fill="#2E8FCB" transform="rotate(-30 -90 -24)" />
      <ellipse cx="-88" cy="-30" rx="5" ry="3" fill="#2E8FCB" transform="rotate(-70 -88 -30)" />
      <ellipse cx="-94" cy="-20" rx="5" ry="3" fill="#2E8FCB" transform="rotate(10 -94 -20)" />

      {/* Torso, Head & Forehead */}
      <ellipse cx="-10" cy="14" rx="54" ry="40" fill="#2E8FCB" />
      <circle cx="30" cy="-14" r="35" fill="#2E8FCB" />
      <path d="M12 -40 C30 -54 52 -40 58 -20 L30 10 Z" fill="#2E8FCB" />

      {/* Front legs */}
      <rect x="-53.5" y="36" width="19" height="34" rx="9" fill="#2E8FCB" />
      <ellipse cx="-48" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <ellipse cx="-41" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <rect x="2.5" y="36" width="19" height="34" rx="9" fill="#2E8FCB" />
      <ellipse cx="8" cy="68" rx="3" ry="2" fill="#D7ECF7" />
      <ellipse cx="15" cy="68" rx="3" ry="2" fill="#D7ECF7" />

      {/* Signature Ear with inner shadow & rim highlight */}
      <g transform={`rotate(${earAngle} 6 -2)`}>
        <path
          d="M-4 -34 C-30 -34 -36 4 -24 20 C-14 34 14 32 22 18 C30 4 26 -32 -4 -34Z"
          fill="#2A86C2"
        />
        <path
          d="M-2 -24 C-20 -24 -24 2 -16 14 C-8 24 10 22 14 12 C18 0 14 -24 -2 -24Z"
          fill="#185C8E"
          opacity="0.28"
        />
        <path
          d="M-6 -30 C-24 -28 -30 -4 -24 12"
          stroke="#6DBBE8"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>

      {/* Top hair tuft */}
      <path
        d="M26 -48 c-2 -8 -6 -10 -10 -10 M30 -49 c0 -8 2 -11 6 -13 M34 -48 c3 -6 7 -7 11 -6"
        stroke="#185C8E"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function renderSideElephantFace(
  mood: BuddyMood,
  defaultFace: 'smile' | 'joy' | 'determined' | 'surprised' | 'hero' | 'sleep',
): ReactElement {
  // Explicit mood overrides for dynamic responsiveness (e.g. keypad typing or hero tap)
  if (mood === 'wink' && defaultFace !== 'sleep') {
    return (
      <>
        <path
          d="M36 -21 q5 -7 10 0"
          stroke="#12233F"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M36 -32 q5 -3 9 0"
          stroke="#185C8E"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M35 4 q9 7 17 -1"
          stroke="#12233F"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }

  if (mood === 'surprised' && defaultFace !== 'surprised') {
    return (
      <>
        <ellipse cx="41" cy="-22" rx="6" ry="7" fill="#FFFFFF" />
        <circle cx="42.5" cy="-21.5" r="3.4" fill="#12233F" />
        <circle cx="43.5" cy="-23" r="1.1" fill="#FFFFFF" />
        <path
          d="M35 -33 l9 -2"
          stroke="#185C8E"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="44" cy="6" rx="3.5" ry="4.5" fill="#12233F" />
      </>
    );
  }

  if (mood === 'excited' && defaultFace === 'smile') {
    return (
      <>
        <ellipse cx="41" cy="-22" rx="5.5" ry="6.5" fill="#FFFFFF" />
        <circle cx="42.5" cy="-21.5" r="3.2" fill="#12233F" />
        <circle cx="43.5" cy="-23" r="1" fill="#FFFFFF" />
        <path
          d="M36 -32 q5 -3 9 0"
          stroke="#185C8E"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M33 2 q11 16 22 0 q-11 4 -22 0Z" fill="#12233F" />
        <ellipse cx="44" cy="9" rx="5" ry="3.5" fill="#F28C7C" />
      </>
    );
  }

  switch (defaultFace) {
    case 'joy':
      return (
        <>
          <ellipse cx="41" cy="-22" rx="5.5" ry="6.5" fill="#FFFFFF" />
          <circle cx="42.5" cy="-21.5" r="3.2" fill="#12233F" />
          <circle cx="43.5" cy="-23" r="1" fill="#FFFFFF" />
          <path
            d="M36 -32 q5 -3 9 0"
            stroke="#185C8E"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M33 2 q11 16 22 0 q-11 4 -22 0Z" fill="#12233F" />
          <ellipse cx="44" cy="9" rx="5" ry="3.5" fill="#F28C7C" />
        </>
      );

    case 'determined':
      return (
        <>
          <ellipse cx="41" cy="-22" rx="5.5" ry="6.5" fill="#FFFFFF" />
          <circle cx="42" cy="-21" r="3" fill="#12233F" />
          <path
            d="M35 -31 l9 -3"
            stroke="#185C8E"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M37 5 h12"
            stroke="#12233F"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );

    case 'surprised':
      return (
        <>
          <ellipse cx="41" cy="-22" rx="5.5" ry="6.5" fill="#FFFFFF" />
          <circle cx="42" cy="-21" r="3" fill="#12233F" />
          <path
            d="M35 -31 l9 -3"
            stroke="#185C8E"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="44" cy="6" rx="3.5" ry="4.5" fill="#12233F" />
        </>
      );

    case 'hero':
      return (
        <>
          <path
            d="M36 -21 q5 -7 10 0"
            stroke="#12233F"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M36 -32 q5 -3 9 0"
            stroke="#185C8E"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M33 2 q11 16 22 0 q-11 4 -22 0Z" fill="#12233F" />
          <ellipse cx="44" cy="9" rx="5" ry="3.5" fill="#F28C7C" />
        </>
      );

    case 'sleep':
      return (
        <path
          d="M36 -22 q5 5 10 0"
          stroke="#12233F"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'smile':
    default:
      return (
        <>
          <ellipse cx="41" cy="-22" rx="5.5" ry="6.5" fill="#FFFFFF" />
          <circle cx="42.5" cy="-21.5" r="3.2" fill="#12233F" />
          <circle cx="43.5" cy="-23" r="1" fill="#FFFFFF" />
          <path
            d="M36 -32 q5 -3 9 0"
            stroke="#185C8E"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M35 4 q9 7 17 -1"
            stroke="#12233F"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

/**
 * VOI Brand Elephant Mascot (9 Official Poses in signature `#2E8FCB` Blue)
 * with crisp white die-cut sticker rim so VOI pops on every Theme card and screen.
 */
export function GeometricBuddy({
  shape,
  mood = 'happy',
  pose,
  size = 44,
  label,
  className = '',
}: GeometricBuddyProps): ReactElement {
  const rawId = useId().replace(/:/g, '');
  const texFilterId = `voi-tx-${rawId}`;

  const activePose = resolveElephantPose(shape, mood, pose);
  const isPeeking = activePose === 'peeking';
  const svgHeight = isPeeking ? Math.round((size * 126) / 228) : Math.round((size * 172) / 204);
  const stickerStyle = {
    filter:
      'drop-shadow(1.5px 0 0 #FFFFFF) drop-shadow(-1.5px 0 0 #FFFFFF) drop-shadow(0 1.5px 0 #FFFFFF) drop-shadow(0 -1.5px 0 #FFFFFF) drop-shadow(0 4px 8px rgba(18, 35, 63, 0.18))',
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={isPeeking ? '-114 -50 228 126' : '-102 -92 204 172'}
      preserveAspectRatio={isPeeking ? 'xMidYMax meet' : 'xMidYMid meet'}
      width={size}
      height={svgHeight}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={stickerStyle}
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <filter id={texFilterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="4"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="2.2"
            numOctaves="1"
            seed="9"
            result="g"
          />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -0.5"
            result="ga"
          />
          <feComposite in="ga" in2="d" operator="in" result="gm" />
          <feComposite in="gm" in2="d" operator="over" result="o" />
          <feBlend in="d" in2="gm" mode="multiply" />
        </filter>
      </defs>

      {/* 01. VOI LÓ ĐẦU (01-voi-lo-dau.svg — Full-bleed solid bottom peeking up from the bottom edge) */}
      {activePose === 'peeking' && (
        <g filter={`url(#${texFilterId})`}>
          {/* Solid lower base extending past viewBox bottom (y=76) so there are zero empty gaps */}
          <rect x="-132" y="22" width="264" height="96" fill="#2E8FCB" />
          <ellipse cx="-64" cy="28" rx="50" ry="58" fill="#2E8FCB" />
          <ellipse cx="-60" cy="48" rx="28" ry="38" fill="#2172A6" opacity="0.9" />
          <ellipse cx="66" cy="18" rx="54" ry="64" fill="#2E8FCB" />
          <ellipse cx="64" cy="42" rx="30" ry="44" fill="#2172A6" opacity="0.9" />
          <circle
            cx="0"
            cy="26"
            r="60"
            fill="#2E8FCB"
            stroke="#185C8E"
            strokeWidth="2.2"
            strokeOpacity="0.65"
          />
          <path
            d="M-10 -32 l-4 -14 M-3 -34 l-1 -16 M4 -34 l3 -15 M10 -32 l5 -10"
            stroke="#12233F"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="-24" cy="12" r="7.5" fill="#FFFFFF" />
          <circle cx="-23" cy="13" r="3.8" fill="#12233F" />
          <circle cx="24" cy="8" r="7.5" fill="#FFFFFF" />
          <circle cx="23" cy="9" r="3.8" fill="#12233F" />

          {/* Front paws gripping the bottom edge */}
          <ellipse
            cx="-40"
            cy="64"
            rx="16"
            ry="11"
            fill="#3CA1DF"
            stroke="#185C8E"
            strokeWidth="2.2"
          />
          <ellipse
            cx="42"
            cy="64"
            rx="16"
            ry="11"
            fill="#3CA1DF"
            stroke="#185C8E"
            strokeWidth="2.2"
          />
          <path
            d="M-44 70 v4 M-38 70 v4 M38 70 v4 M44 70 v4"
            stroke="#12233F"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Trunk with shadow & rings */}
          <path
            d="M-4 22 C-4 46 2 64 18 70 C24 73 30 71 33 64"
            stroke="#185C8E"
            strokeWidth="23"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.55"
          />
          <path
            d="M-4 22 C-4 46 2 64 18 70 C24 73 30 71 33 64"
            stroke="#389CD9"
            strokeWidth="19"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M-14.0 24 q10 2 20 0 M-13.4 30 q10 2 20 0 M-12.8 36 q10 2 20 0 M-12.2 42 q10 2 20 0 M-11.6 48 q10 2 20 0 M-11.0 54 q10 2 20 0"
            stroke="#12233F"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
          <path
            d="M2 58 q8 4 14 4 M8 64 q6 2 10 1"
            stroke="#12233F"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
        </g>
      )}

      {/* 02. QUÝ ÔNG TIẾT KIỆM (02-quy-ong-tiet-kiem.svg) */}
      {activePose === 'gentleman' && (
        <>
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M52 -6 C66 4 66 26 58 40"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M52 -6 C66 4 66 26 58 40"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'smile')}
          </g>
          {/* Top Hat, Bow Tie & Gold Coin */}
          <rect
            x="14"
            y="-84"
            width="28"
            height="30"
            rx="3"
            fill="#12233F"
            transform="rotate(-8 28 -60)"
          />
          <rect x="14" y="-62" width="28" height="7" fill="#F5A623" transform="rotate(-8 28 -60)" />
          <rect
            x="4"
            y="-56"
            width="48"
            height="6"
            rx="3"
            fill="#12233F"
            transform="rotate(-8 28 -60)"
          />
          <path d="M30 22 L19 15 L19 29 Z" fill="#F5A623" />
          <path d="M30 22 L41 15 L41 29 Z" fill="#F5A623" />
          <circle cx="30" cy="22" r="3.5" fill="#F5A623" />
          <circle cx="62" cy="48" r="10" fill="#F5A623" />
          <circle cx="62" cy="48" r="6.5" fill="none" stroke="#D9850F" strokeWidth="2" />
        </>
      )}

      {/* 03. VOI TUNG XU (03-voi-tung-xu.svg) */}
      {activePose === 'coin-toss' && (
        <>
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M50 -4 C68 -8 74 -36 66 -64"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M50 -4 C68 -8 74 -36 66 -64"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'joy')}
          </g>
          <circle cx="66" cy="-74" r="10" fill="#F5A623" />
          <circle cx="66" cy="-74" r="6.5" fill="none" stroke="#D9850F" strokeWidth="2" />
          <path
            d="M80 -84 l6 -6 M84 -70 l8 0 M52 -88 l-4 -6"
            stroke="#F5A623"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* 04. VOI TẬP GYM (04-voi-tap-gym.svg) */}
      {activePose === 'gym' && (
        <>
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M50 -4 C70 -10 74 -50 68 -82"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M50 -4 C70 -10 74 -50 68 -82"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'determined')}
          </g>
          <rect
            x="4"
            y="-44"
            width="56"
            height="7"
            rx="3.5"
            fill="#FF8FA3"
            transform="rotate(-12 32 -40)"
          />
          <path
            d="M40 -84 H96"
            stroke="#12233F"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="-84" r="10" fill="#F7B267" />
          <circle cx="40" cy="-84" r="4" fill="#FFF6E3" />
          <circle cx="96" cy="-84" r="10" fill="#F7B267" />
          <circle cx="96" cy="-84" r="4" fill="#FFF6E3" />
          <path d="M14 -62 q-3 6 0 8 q3 -2 0 -8Z" fill="#7CC3F0" />
          <path d="M2 -54 q-3 6 0 8 q3 -2 0 -8Z" fill="#7CC3F0" />
        </>
      )}

      {/* 05. VOI TRƯỢT DỐC (05-voi-truot-doc.svg) */}
      {activePose === 'slide' && (
        <>
          <path
            d="M-104 -40 h22 M-108 -22 h22 M-102 -4 h18"
            stroke="#6DBBE8"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
          <g transform="rotate(-12) translate(6 -6) scale(0.92)">
            <path
              d="M8 -8 C-14 -22 -30 -24 -52 -18"
              stroke="#F5A623"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 -8 C-12 -12 -28 -6 -48 -4"
              stroke="#F5A623"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g filter={`url(#${texFilterId})`}>
              <path
                d="M52 -6 C70 -4 82 -14 88 -30"
                stroke="#2E8FCB"
                strokeWidth="17"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M52 -6 C70 -4 82 -14 88 -30"
                stroke="#6DBBE8"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
                transform="translate(-4 0)"
              />
              {renderSideElephantBase(-20)}
              {renderSideElephantFace(mood, 'surprised')}
            </g>
            <path
              d="M-84 74 H70 q12 0 16 -10"
              stroke="#FF8FA3"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      )}

      {/* 06. SIÊU VOI (06-sieu-voi.svg) */}
      {activePose === 'super' && (
        <>
          <path d="M8 -20 C-30 -30 -80 -40 -104 -56 C-90 -20 -70 10 -40 22 Z" fill="#FF8A5B" />
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M52 -6 C70 -4 82 -14 88 -30"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M52 -6 C70 -4 82 -14 88 -30"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'hero')}
          </g>
          <rect x="28" y="-30" width="22" height="12" rx="6" fill="#FF8FA3" />
          <path d="M-14 -8 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2Z" fill="#F5A623" />
        </>
      )}

      {/* 07. VOI TRÍ NHỚ (07-voi-tri-nho.svg) */}
      {activePose === 'memory' && (
        <>
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M52 -6 C70 -4 82 -14 88 -30"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M52 -6 C70 -4 82 -14 88 -30"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'smile')}
          </g>
          <g transform="rotate(10 90 -38)">
            <rect x="76" y="-60" width="28" height="36" rx="3" fill="#FFFFFF" />
            <path
              d="M81 -51 h18 M81 -45 h18 M81 -39 h11"
              stroke="#185C8E"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <circle cx="41" cy="-22" r="8" fill="none" stroke="#12233F" strokeWidth="2.2" />
          <path
            d="M33 -22 l-8 -2"
            stroke="#12233F"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M-2 -70 a10 10 0 1 1 14 9 v5 h-6 v-5"
            stroke="#F5A623"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="-50" r="2" fill="#F5A623" />
        </>
      )}

      {/* 08. VOI MẸ VOI CON (08-voi-me-voi-con.svg) */}
      {activePose === 'family' && (
        <g transform="translate(-14, 0) scale(0.9)">
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M50 -4 C68 -2 80 10 92 8"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M50 -4 C68 -2 80 10 92 8"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'smile')}
          </g>
          <g transform="translate(78 30) scale(0.5)">
            <path
              d="M50 -4 C64 -10 64 -30 56 -40"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M50 -4 C64 -10 64 -30 56 -40"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'smile')}
          </g>
          <path d="M70 -40 c-6 -8 -16 -2 -8 6 l8 8 8 -8 c8 -8 -2 -14 -8 -6Z" fill="#FF8FA3" />
        </g>
      )}

      {/* 09. VOI NGỦ (09-voi-ngu.svg) */}
      {activePose === 'sleep' && (
        <>
          <g filter={`url(#${texFilterId})`}>
            <path
              d="M52 -6 C66 4 66 26 58 40"
              stroke="#2E8FCB"
              strokeWidth="17"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M52 -6 C66 4 66 26 58 40"
              stroke="#6DBBE8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              transform="translate(-4 0)"
            />
            {renderSideElephantBase(-8)}
            {renderSideElephantFace(mood, 'sleep')}
          </g>
          <text
            x="58"
            y="-52"
            fontSize="20"
            fontWeight="700"
            fill="#2479B0"
            fontFamily="sans-serif"
          >
            z
          </text>
          <text
            x="74"
            y="-70"
            fontSize="14"
            fontWeight="700"
            fill="#6DBBE8"
            fontFamily="sans-serif"
          >
            z
          </text>
        </>
      )}
    </svg>
  );
}
