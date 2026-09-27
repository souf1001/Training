// Runs before the page is drawn, so dark mode never flashes white.
// Same logic as applyTheme() in src/lib/theme.ts.
;(function () {
  var theme = 'system'
  try {
    theme = localStorage.getItem('forma.theme') || 'system'
  } catch (e) {}
  var media = window.matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    var current = document.documentElement.dataset.themeSetting || theme
    var dark = current === 'dark' || (current === 'system' && media.matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }
  document.documentElement.dataset.themeSetting = theme
  apply()
  media.addEventListener('change', apply) // follows the phone when set to "Auto"
})()
