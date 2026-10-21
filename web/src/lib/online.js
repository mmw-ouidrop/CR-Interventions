import { ref } from 'vue'

// État réseau réactif. `navigator.onLine` = « une interface réseau existe » :
// il ne garantit pas qu'Internet est joignable. Les vrais échecs sont donc aussi
// traités à l'appel (ApiError 'NETWORK'), et la synchro réessaie sur l'événement
// `online` comme sur une action manuelle.
export const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))
}
