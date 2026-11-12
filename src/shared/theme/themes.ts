import type { ColorMode, GeometricShape, ThemeId } from '../../domain/types/entities';

export interface ThemePreset {
  id: ThemeId;
  nameVi: string;
  descriptionVi: string;
  accentHex: string;
  accentTextHex: string;
  buddyShape: GeometricShape;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  pop: {
    id: 'pop',
    nameVi: 'Coral Cost Pop',
    descriptionVi: 'Pantone 1505 C Orange (#FF7A1A) trên nền trắng Pantone (#FAFAFA)',
    accentHex: '#FF7A1A',
    accentTextHex: '#FAFAFA',
    buddyShape: 'triangle',
  },
  cobalt: {
    id: 'cobalt',
    nameVi: 'Electric Cobalt',
    descriptionVi: 'Pantone 2718 C Blue (#5E89ED) hiện đại & sắc nét',
    accentHex: '#5E89ED',
    accentTextHex: '#FAFAFA',
    buddyShape: 'hexagon',
  },
  matcha: {
    id: 'matcha',
    nameVi: 'Mint Emerald',
    descriptionVi: 'Pantone 360 C Green (#52C470) tươi mới, đại diện tích lũy',
    accentHex: '#52C470',
    accentTextHex: '#FAFAFA',
    buddyShape: 'square',
  },
  flamingo: {
    id: 'flamingo',
    nameVi: 'Lavender Amethyst',
    descriptionVi: 'Pantone 2567 C Lilac (#BF9BDE) trẻ trung chuẩn bảng màu mới',
    accentHex: '#BF9BDE',
    accentTextHex: '#191919',
    buddyShape: 'circle',
  },
  sunny: {
    id: 'sunny',
    nameVi: 'Honey Marigold',
    descriptionVi: 'Pantone 129 C Yellow (#F2D147) ấm áp như hũ tiết kiệm mỗi ngày',
    accentHex: '#F2D147',
    accentTextHex: '#191919',
    buddyShape: 'arch',
  },
  rose: {
    id: 'rose',
    nameVi: 'Blossom Pink',
    descriptionVi: 'Pantone 204 C Pink (#EF6EA5) rực rỡ & ngọt ngào của Mây Hào Hứng',
    accentHex: '#EF6EA5',
    accentTextHex: '#FAFAFA',
    buddyShape: 'pentagon',
  },
};

export const THEME_LIST: ThemePreset[] = Object.values(THEME_PRESETS);

const COLOR_SCHEME_META_ID = 'fn-color-scheme-meta';

export function applyThemeToDom(themeId: ThemeId, colorMode: ColorMode): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const preset = THEME_PRESETS[themeId] ?? THEME_PRESETS.pop;

  root.dataset.theme = preset.id;
  root.dataset.colorMode = colorMode;

  let meta = document.getElementById(COLOR_SCHEME_META_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.querySelector('meta[name="color-scheme"]');
  }
  if (meta) {
    meta.content = colorMode === 'system' ? 'light dark' : colorMode;
  }
}
