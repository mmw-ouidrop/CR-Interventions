// Valeurs injectées au build depuis .env.local (voir .env.example).
export const GAS_URL = import.meta.env.VITE_GAS_URL || ''
export const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || ''
export const DEFAULT_PREFIX = (import.meta.env.VITE_DEFAULT_PREFIX ?? 'FI').trim()

export const configOk = Boolean(GAS_URL && APP_TOKEN)
