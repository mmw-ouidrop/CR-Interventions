import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyPrefs, normalizePrefs, loadPrefs, savePrefs, orderProperties, splitVisible,
  moveProperty, setHidden, resetPrefs
} from '../src/lib/propPrefs.js'

const props = ['Nom', 'ID', 'Client', 'Adresse', 'Statut'].map((label) => ({ label, value: label.toLowerCase(), type: 'rich_text' }))
const labels = (l) => l.map((p) => p.label)
const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }
}

test('sans préférence : ordre du serveur, tout visible, section dépliée', () => {
  const s = splitVisible(props, emptyPrefs())
  assert.deepEqual(labels(s.visible), ['Nom', 'ID', 'Client', 'Adresse', 'Statut'])
  assert.deepEqual(s.hidden, [])
  assert.equal(emptyPrefs().collapsed, false)
})

test('ordre de l’utilisateur d’abord ; colonnes nouvelles ou non classées à la suite', () => {
  const prefs = { ...emptyPrefs(), order: ['Statut', 'Client', 'Disparue'] }
  assert.deepEqual(labels(orderProperties(props, prefs)), ['Statut', 'Client', 'Nom', 'ID', 'Adresse'])
})

test('moveProperty : échange avec le voisin, bornes respectées, entrée non modifiée', () => {
  const p0 = emptyPrefs()
  const p1 = moveProperty(props, p0, 'Statut', -1)
  assert.deepEqual(labels(orderProperties(props, p1)), ['Nom', 'ID', 'Client', 'Statut', 'Adresse'])
  assert.deepEqual(p0.order, [], 'les préférences passées ne sont pas modifiées')
  assert.equal(moveProperty(props, p0, 'Nom', -1), p0, 'déjà en haut')
  assert.equal(moveProperty(props, p0, 'Statut', +1), p0, 'déjà en bas')
  assert.equal(moveProperty(props, p0, 'Inconnue', +1), p0)
  const p2 = moveProperty(props, p1, 'Statut', -1)
  assert.deepEqual(labels(orderProperties(props, p2)), ['Nom', 'ID', 'Statut', 'Client', 'Adresse'])
})

test('masquer / réafficher ; un champ masqué reste déplaçable', () => {
  let prefs = setHidden(emptyPrefs(), 'ID', true)
  prefs = setHidden(prefs, 'Adresse', true)
  prefs = setHidden(prefs, 'ID', true)                    // idempotent
  assert.deepEqual([...prefs.hidden].sort(), ['Adresse', 'ID'])
  const s = splitVisible(props, prefs)
  assert.deepEqual(labels(s.visible), ['Nom', 'Client', 'Statut'])
  assert.deepEqual(labels(s.hidden), ['ID', 'Adresse'])
  prefs = moveProperty(props, prefs, 'ID', +1)
  assert.deepEqual(labels(orderProperties(props, prefs)).slice(0, 3), ['Nom', 'Client', 'ID'])
  prefs = setHidden(prefs, 'ID', false)
  assert.deepEqual(prefs.hidden, ['Adresse'])
})

test('un nom masqué qui n’existe plus dans la fiche est sans effet', () => {
  const s = splitVisible(props, { ...emptyPrefs(), hidden: ['Supprimée'] })
  assert.equal(s.visible.length, 5)
  assert.equal(s.hidden.length, 0)
})

test('resetPrefs : ordre et masquage effacés, état replié conservé', () => {
  const prefs = { order: ['Statut'], hidden: ['ID'], collapsed: true }
  assert.deepEqual(resetPrefs(prefs), { order: [], hidden: [], collapsed: true })
})

test('persistance : aller-retour, données abîmées, stockage indisponible', () => {
  const st = memory()
  const prefs = { order: ['Statut', 'Nom'], hidden: ['ID'], collapsed: true }
  assert.equal(savePrefs(prefs, st), true)
  assert.deepEqual(loadPrefs(st), prefs)

  st.setItem('ouidrop.props.v1', '{ pas du json')
  assert.deepEqual(loadPrefs(st), emptyPrefs())
  st.setItem('ouidrop.props.v1', JSON.stringify({ order: [1, 'A', null], hidden: 'x', collapsed: 'oui' }))
  assert.deepEqual(loadPrefs(st), { order: ['A'], hidden: [], collapsed: false })

  const refuse = { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('QuotaExceeded') } }
  assert.deepEqual(loadPrefs(refuse), emptyPrefs())
  assert.equal(savePrefs(prefs, refuse), false)
  assert.deepEqual(loadPrefs(undefined), emptyPrefs(), 'pas de localStorage (Node)')
  assert.deepEqual(normalizePrefs(null), emptyPrefs())
})
