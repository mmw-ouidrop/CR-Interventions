// Affichage des propriétés Notion lues en lecture seule (sans nom de colonne en dur).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

function formatDateString(s) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const withTime = s.includes('T')
  return new Intl.DateTimeFormat('fr-FR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d)
}

export function formatPropertyValue(prop) {
  const v = prop.value
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'number') return new Intl.NumberFormat('fr-FR').format(v)
  const s = String(v)
  if (['date', 'created_time', 'last_edited_time'].includes(prop.type) || (prop.type === 'formula' && ISO_DATE.test(s))) {
    // Intervalle « début → fin »
    return s.split(' → ').map(formatDateString).join(' → ')
  }
  return s
}

// Valeur d'un champ du formulaire, lisible (conflits, récapitulatifs).
export function formatFieldValue(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  return String(v)
}

export function formatTime(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
}

export function formatDateTime(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts))
}

// Libellé et ton de la pastille d'état d'une mission (modèle v2, voir db.js / lib/shared.js).
//   « à envoyer » = saisies locales pas encore dans Notion ; « envoi en échec » = dernière tentative refusée.
export function missionStatus(rec) {
  const validated = (rec.pendingStatus ? rec.pendingStatus.value : rec.shared && rec.shared.status) === 'validated'
  const pending = rec.needsSync === 1
  if (rec.syncing) return { label: 'Envoi en cours…', tone: 'info' }
  if (pending && rec.lastError && (rec.attempts || 0) > 0) {
    return { label: validated ? 'Validé · envoi en échec' : 'Envoi en échec', tone: 'danger' }
  }
  if (validated) return pending ? { label: 'Validé · à envoyer', tone: 'info' } : { label: '✓ Validé', tone: 'done' }
  if (pending) return { label: rec.lastSyncAt ? 'Modifié · à envoyer' : 'Brouillon · à envoyer', tone: 'info' }
  if (rec.lastSyncAt || (rec.baseRev || 0) > 0) return { label: 'Enregistré', tone: 'neutral' }
  return { label: 'Brouillon', tone: 'neutral' }
}
