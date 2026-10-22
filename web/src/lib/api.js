// Client du middleware Google Apps Script (voir gas/Code.gs).
//
// Particularités GAS :
//  - GET sans en-tête personnalisé et POST en `text/plain` : ce sont des requêtes
//    « simples » qui évitent le preflight CORS (GAS ne répond pas aux OPTIONS) ;
//  - GAS répond toujours HTTP 200 ; le résultat est dans { ok, data | error }.
import { GAS_URL, APP_TOKEN } from '../config.js'

export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.extra = extra
  }
}

async function request(url, init, timeoutMs) {
  if (!GAS_URL || !APP_TOKEN) {
    throw new ApiError('CONFIG', "L'application n'est pas configurée (VITE_GAS_URL / VITE_APP_TOKEN).")
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' })
  } catch (err) {
    throw new ApiError(
      ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK',
      ctrl.signal.aborted ? 'Le serveur met trop de temps à répondre.' : 'Pas de réseau.'
    )
  } finally {
    clearTimeout(timer)
  }

  let body
  try {
    body = await res.json()
  } catch {
    throw new ApiError('BAD_RESPONSE', 'Réponse inattendue du serveur.')
  }
  if (!body || body.ok !== true) {
    const e = (body && body.error) || {}
    const { code, message, ...extra } = e
    throw new ApiError(code || 'SERVER', message || 'Erreur du serveur.', extra)
  }
  return body.data
}

const get = (params, timeoutMs = 30000) => {
  const q = new URLSearchParams({ ...params, appToken: APP_TOKEN })
  return request(`${GAS_URL}?${q}`, { method: 'GET' }, timeoutMs)
}

const post = (payload, timeoutMs) =>
  request(
    GAS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ appToken: APP_TOKEN, ...payload })
    },
    timeoutMs
  )

export const api = {
  getIntervention: (id) => get({ action: 'getIntervention', id }),

  // fileData : base64 sans préfixe. Renvoie { fileId, … }.
  uploadMedia: ({ fileData, fileName, mimeType, mediaId, reference }) =>
    post({ action: 'uploadMedia', fileData, fileName, mimeType, mediaId, reference }, 90000),

  // Relève légère des modifications des collègues (aucun appel à Notion tant que rien n'a bougé).
  getReport: ({ pageId, sinceRev, clientId, name }) =>
    get({ action: 'getReport', pageId, sinceRev: String(sinceRev ?? ''), clientId, name }, 20000),

  // Peut durer longtemps (transfert des photos vers Notion) : le GAS s'arrête à 6 min.
  syncReport: (payload) => post({ action: 'syncReport', ...payload }, 330000)
}
