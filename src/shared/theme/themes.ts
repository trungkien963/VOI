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
    descriptionVi: 'Cam San Hô ấm áp trên nền kem Editorial (#F7F4EB)',
    accentHex: '#FF6B35',
    accentTextHex: '#FFFFFF',
    buddyShape: 'triangle',
  },
  cobalt: {
    id: 'cobalt',
    nameVi: 'Electric Cobalt',
    descriptionVi: 'Xanh dương sắc nét, hiện đại & tối giản',
    accentHex: '#3B82F6',
    accentTextHex: '#FFFFFF',
    buddyShape: 'hexagon',
  },
  matcha: {
    id: 'matcha',
    nameVi: 'Mint Emerald',
    descriptionVi: 'Xanh lá tươi mới, đại diện cho dòng tiền tích lũy',
    accentHex: '#10B981',
    accentTextHex: '#FFFFFF',
    buddyShape: 'square',
  },
  flamingo: {
    id: 'flamingo',
    nameVi: 'Lavender Amethyst',
    descriptionVi: 'Tím Lavender trẻ trung chuẩn vibe GenZ',
    accentHex: '#8B5CF6',
    accentTextHex: '#FFFFFF',
    buddyShape: 'circle',
  },
  sunny: {
    id: 'sunny',
    nameVi: 'Honey Marigold',
    descriptionVi: 'Vàng mật ong ấm áp như hũ tiết kiệm mỗi ngày',
    accentHex: '#FFB703',
    accentTextHex: '#18181B',
    buddyShape: 'arch',
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
