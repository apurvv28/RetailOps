export const PALETTES = {
  forest: {
    id: 'forest',
    name: 'Forest',
    primary: '#0F4D2E',
    mid: '#1F7A4D',
    light: '#5DBB8A',
    tint: '#E6F2EA',
    darkTint: 'rgba(93, 187, 138, 0.15)',
    swatchColor: '#0F4D2E',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    primary: '#0D3B66',
    mid: '#1D5D9B',
    light: '#64B5F6',
    tint: '#E3F2FD',
    darkTint: 'rgba(100, 181, 246, 0.15)',
    swatchColor: '#0D3B66',
  },
  plum: {
    id: 'plum',
    name: 'Plum',
    primary: '#4A154B',
    mid: '#6B236E',
    light: '#BA68C8',
    tint: '#F3E5F5',
    darkTint: 'rgba(186, 104, 200, 0.15)',
    swatchColor: '#4A154B',
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    primary: '#8C2D19',
    mid: '#B83A1B',
    light: '#FF8A65',
    tint: '#FBE9E7',
    darkTint: 'rgba(255, 138, 101, 0.15)',
    swatchColor: '#8C2D19',
  },
};

const ACCENT_KEY = 'fernly_accent_theme';

export function applyAccentTheme(paletteId) {
  const selected = PALETTES[paletteId] || PALETTES.forest;
  const root = document.documentElement;

  root.style.setProperty('--accent-primary', selected.primary);
  root.style.setProperty('--accent-mid', selected.mid);
  root.style.setProperty('--accent-light', selected.light);
  root.style.setProperty('--accent-tint', selected.tint);
  root.style.setProperty('--accent-dark-tint', selected.darkTint);

  try {
    localStorage.setItem(ACCENT_KEY, selected.id);
  } catch (e) {
    // Storage access might fail in private browsing
  }
  return selected;
}

export function getActiveAccentTheme() {
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (saved && PALETTES[saved]) return saved;
  } catch (e) {
    // ignore
  }
  return 'forest';
}

// Auto-initialize on script load
if (typeof window !== 'undefined') {
  applyAccentTheme(getActiveAccentTheme());
}
