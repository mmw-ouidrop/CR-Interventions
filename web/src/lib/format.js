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

export function formatDateTime(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts))
}

// Libellé et ton de la pastille d'état d'une mission (voir db.js pour la sémantique).
export function missionStatus(rec) {
  if (rec.status === 'validated') {
    if (rec.syncing) return { label: 'Envoi en cours…', tone: 'info' }
    if (rec.syncStatus === 'error') return { label: "Envoi en échec", tone: 'danger' }
    if (rec.syncStatus === 'pending') return { label: 'Validé · à envoyer', tone: 'info' }
    return { label: '✓ Envoyé', tone: 'done' }
  }
  if (rec.lastSyncAt) return { label: 'En modification', tone: 'neutral' }
  return { label: 'Brouillon', tone: 'neutral' }
}
