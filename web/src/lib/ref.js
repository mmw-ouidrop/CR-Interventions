// Normalise ce que le technicien saisit ou colle en identifiant de mission.
//   « FI-252 », « fi252 », « fi 252 »            → « FI-252 »
//   « 252 »                                      → « FI-252 » (si defaultPrefix = 'FI')
//   « https://…/?id=FI-252 », « https://…/#/m/FI-252 » → « FI-252 »
// Renvoie null si rien d'exploitable.
export function normalizeReference(input, defaultPrefix = '') {
  if (input === null || input === undefined) return null
  let s = String(input).trim()
  if (!s) return null

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const fromQuery = u.searchParams.get('id') || u.searchParams.get('ref')
      const fromHash = u.hash ? new URLSearchParams(u.hash.split('?')[1] || '').get('id') : null
      const lastSegment = (u.hash ? u.hash.split('?')[0] : u.pathname).split('/').filter(Boolean).pop()
      s = fromQuery || fromHash || decodeURIComponent(lastSegment || '')
    } catch {
      return null
    }
  }

  const m = s.match(/^([A-Za-z]{0,8})[\s\-_]*(\d{1,9})$/)
  if (!m) return null
  const prefix = (m[1] || defaultPrefix || '').toUpperCase()
  const num = String(parseInt(m[2], 10))
  return prefix ? `${prefix}-${num}` : num
}

// Identifiant porté par l'URL d'ouverture de l'app : ?id=FI-252 (avant le #)
// ou #/?id=FI-252. Retire le paramètre de la barre d'adresse après lecture.
export function consumeUrlReference(loc = globalThis.location, hist = globalThis.history) {
  if (!loc) return null
  const params = new URLSearchParams(loc.search)
  const raw = params.get('id') || params.get('ref')
  if (!raw) return null
  params.delete('id')
  params.delete('ref')
  const rest = params.toString()
  try {
    hist.replaceState(null, '', loc.pathname + (rest ? '?' + rest : '') + loc.hash)
  } catch {
    /* contexte sans History API : sans conséquence */
  }
  return raw
}
