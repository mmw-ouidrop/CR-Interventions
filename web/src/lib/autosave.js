import { setFields } from '../db.js'

// Sauvegarde automatique des saisies dans IndexedDB.
//  - regroupe les frappes rapides (un seul write par pause de `delay` ms) ;
//  - vide la file dès que la page passe en arrière-plan ou se ferme
//    (sur mobile, `visibilitychange` est le signal le plus fiable) ;
//  - ne perd rien si un write échoue : les valeurs restent en attente.
//
//  const saver = createAutosaver(missionId, { onState: (s, err) => … })
//  saver.set('etat_materiel', 'Usagé')   // s ∈ 'dirty' | 'saving' | 'saved' | 'error'
//  saver.dispose()                       // à appeler au démontage du composant
export function createAutosaver(interventionId, { delay = 300, onState } = {}) {
  let pending = {}
  let timer = null
  let chain = Promise.resolve()
  const emit = (state, err) => onState && onState(state, err)
  const hasPending = () => Object.keys(pending).length > 0

  function flush() {
    clearTimeout(timer)
    timer = null
    if (!hasPending()) return chain
    const batch = pending
    pending = {}
    emit('saving')
    chain = chain
      .then(() => setFields(interventionId, batch))
      .then(
        () => {
          if (!hasPending()) emit('saved')
        },
        (err) => {
          // CR validé entre-temps : ces saisies ne peuvent plus être écrites.
          if (!err || err.code !== 'LOCKED') pending = { ...batch, ...pending }
          emit('error', err)
        }
      )
    return chain
  }

  function set(componentId, value) {
    pending[componentId] = value
    emit('dirty')
    clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', flush)

  function dispose() {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
    return flush()
  }

  return { set, flush, dispose, hasPending }
}
