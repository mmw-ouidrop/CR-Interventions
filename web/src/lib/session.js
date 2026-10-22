// Pont entre l'interface Vue et le moteur de synchro : identité réactive + moteur unique.
import { ref, computed } from 'vue'
import store from '../db.js'
import { api } from './api.js'
import { online } from './online.js'
import { loadIdentity, saveName, hasName, fullName } from './identity.js'
import { createSyncEngine, watchMission } from './sync.js'

export const identity = ref(loadIdentity())
export const named = computed(() => hasName(identity.value))
export const displayName = computed(() => fullName(identity.value))

export function setName(firstName, lastName) {
  identity.value = saveName(identity.value, firstName, lastName)
}

export const engine = createSyncEngine({
  store,
  api,
  getIdentity: () => identity.value,
  isOnline: () => online.value
})

export const watch = (id) => watchMission(engine, store, id)

// À l'ouverture de l'app et au retour du réseau : on vide ce qui attend (toutes missions).
export function startBackgroundSync() {
  const run = () => engine.syncPending().catch(() => {})
  run()
  if (typeof window !== 'undefined') window.addEventListener('online', run)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run()
    })
  }
}
