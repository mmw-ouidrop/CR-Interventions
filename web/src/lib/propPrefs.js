// Préférences d'affichage des propriétés en lecture seule : ordre, champs masqués,
// section repliée. Propres à l'appareil (localStorage), communes à toutes les
// missions : elles portent sur le NOM des colonnes Notion, identiques d'une fiche
// à l'autre. L'ordre par défaut vient du serveur (propriété de script
// PROPERTY_ORDER) ; ces préférences ne font que le surcharger sur cet appareil.
const KEY = 'ouidrop.props.v1'

export const emptyPrefs = () => ({ order: [], hidden: [], collapsed: false })

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

export function normalizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return { order: strings(p.order), hidden: strings(p.hidden), collapsed: p.collapsed === true }
}

// localStorage peut être absent, plein ou refusé (navigation privée) : on ne plante jamais.
export function loadPrefs(storage = globalThis.localStorage) {
  try {
    return normalizePrefs(JSON.parse(storage.getItem(KEY)))
  } catch {
    return emptyPrefs()
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(normalizePrefs(prefs)))
    return true
  } catch {
    return false
  }
}

// Ordre d'affichage : d'abord les colonnes classées par l'utilisateur (dans son
// ordre), puis les autres dans l'ordre du serveur — une colonne nouvelle n'est
// donc jamais perdue.
export function orderProperties(props, prefs) {
  const byLabel = new Map(props.map((p) => [p.label, p]))
  const first = []
  for (const label of prefs.order) {
    if (byLabel.has(label)) {
      first.push(byLabel.get(label))
      byLabel.delete(label)
    }
  }
  return first.concat(props.filter((p) => byLabel.has(p.label)))
}

export function splitVisible(props, prefs) {
  const ordered = orderProperties(props, prefs)
  const hidden = new Set(prefs.hidden)
  return {
    all: ordered,
    visible: ordered.filter((p) => !hidden.has(p.label)),
    hidden: ordered.filter((p) => hidden.has(p.label))
  }
}

// Déplace une colonne d'un cran (delta = -1 : vers le haut, +1 : vers le bas) dans
// la liste COMPLÈTE (masquées comprises) : c'est la liste que l'utilisateur voit
// en mode « Personnaliser ».
export function moveProperty(props, prefs, label, delta) {
  const labels = orderProperties(props, prefs).map((p) => p.label)
  const i = labels.indexOf(label)
  const j = i + delta
  if (i < 0 || j < 0 || j >= labels.length) return prefs
  ;[labels[i], labels[j]] = [labels[j], labels[i]]
  return { ...prefs, order: labels }
}

export function setHidden(prefs, label, hidden) {
  const rest = prefs.hidden.filter((l) => l !== label)
  return { ...prefs, hidden: hidden ? rest.concat(label) : rest }
}

// Revient à l'ordre du serveur et réaffiche tout (l'état replié est conservé).
export function resetPrefs(prefs) {
  return { ...emptyPrefs(), collapsed: prefs.collapsed }
}
