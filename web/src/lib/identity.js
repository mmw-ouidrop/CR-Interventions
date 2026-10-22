// Identité de l'utilisateur de cet appareil : prénom + nom (déclarés, non vérifiés,
// il n'y a pas de comptes) et identifiant d'appareil. Le nom est inscrit en tête du
// rapport Notion avec chaque modification ; le clientId distingue deux appareils
// même s'ils portent le même nom.
import { uuid } from './uuid.js'

const KEY = 'ouidrop.identity.v1'

export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)

export const hasName = (i) => Boolean(i && cleanName(i.firstName) && cleanName(i.lastName))

export const fullName = (i) => (hasName(i) ? `${cleanName(i.firstName)} ${cleanName(i.lastName)}` : '')

export const authorOf = (i) => ({ firstName: cleanName(i.firstName), lastName: cleanName(i.lastName) })

export function loadIdentity(storage = globalThis.localStorage) {
  let saved = {}
  try {
    saved = JSON.parse(storage.getItem(KEY)) || {}
  } catch {
    saved = {}
  }
  const identity = {
    clientId: typeof saved.clientId === 'string' && saved.clientId.length >= 8 ? saved.clientId : uuid(),
    firstName: cleanName(saved.firstName),
    lastName: cleanName(saved.lastName)
  }
  if (identity.clientId !== saved.clientId) persist(identity, storage)
  return identity
}

function persist(identity, storage) {
  try {
    storage.setItem(KEY, JSON.stringify(identity))
    return true
  } catch {
    return false
  }
}

export function saveName(identity, firstName, lastName, storage = globalThis.localStorage) {
  const next = { ...identity, firstName: cleanName(firstName), lastName: cleanName(lastName) }
  persist(next, storage)
  return next
}
