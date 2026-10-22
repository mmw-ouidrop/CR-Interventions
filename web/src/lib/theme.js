// Thème : « auto » (suit le téléphone), « light », « dark ». Réglage propre à l'appareil.
// Les couleurs vivent dans styles/tokens.css ; ici on ne pose que l'attribut data-theme.
import { ref } from 'vue'

const KEY = 'ouidrop.theme.v1'
export const THEMES = ['auto', 'light', 'dark']
export const THEME_LABELS = { auto: 'Auto', light: 'Clair', dark: 'Sombre' }
const THEME_COLOR = { light: '#0D2E5B', dark: '#08172E' }

export const normalizeTheme = (v) => (THEMES.includes(v) ? v : 'auto')

export function readTheme(storage = globalThis.localStorage) {
  try {
    return normalizeTheme(storage.getItem(KEY))
  } catch {
    return 'auto'
  }
}

export const theme = ref(readTheme())

function systemDark() {
  return Boolean(globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function applyTheme(mode = theme.value, doc = globalThis.document) {
  if (!doc) return
  const root = doc.documentElement
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  const meta = doc.querySelector('meta[name="theme-color"]')
  const dark = mode === 'dark' || (mode === 'auto' && systemDark())
  if (meta) meta.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light)
}

export function setTheme(mode, storage = globalThis.localStorage) {
  theme.value = normalizeTheme(mode)
  try {
    storage.setItem(KEY, theme.value)
  } catch { /* stockage indisponible : le réglage vaut pour cette session */ }
  applyTheme(theme.value)
}

export function initTheme() {
  applyTheme(theme.value)
  const mq = globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)')
  if (mq && mq.addEventListener) mq.addEventListener('change', () => applyTheme(theme.value))
}
