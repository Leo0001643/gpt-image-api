export { default as giaPreset } from './tailwind.preset';

export const GIA_TOKENS = {
  primary: 'var(--gia-600)',
  primaryGradient: 'var(--gia-gradient)',
  glow: 'var(--gia-glow)',
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'dark' : 'light';
    return;
  }
  root.dataset.theme = mode;
}
