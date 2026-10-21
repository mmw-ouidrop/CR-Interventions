// Demande au navigateur de ne pas purger les données de l'app.
// Sur iOS/Safari, IndexedDB peut être effacée après ~7 jours sans usage tant que
// l'app n'est pas installée sur l'écran d'accueil ; l'installation + cette demande
// réduisent fortement le risque (sans le supprimer totalement).
export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* non supporté */
  }
  return false
}

export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { usage, quota }
    }
  } catch {
    /* non supporté */
  }
  return null
}
