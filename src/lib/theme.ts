// Light / dark mode. public/theme.js applies the saved choice before the first paint.
import type { Theme } from './types'

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem('forma.theme', theme)
  } catch {
    // private mode: the theme just isn't remembered on this device
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.themeSetting = theme
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
