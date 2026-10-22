import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'

// Doublures minimales du navigateur (l'autosave écoute document/window).
const listeners = { document: {}, window: {} }
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (t, f) => (listeners.document[t] = f),
  removeEventListener: (t) => delete listeners.document[t]
}
globalThis.window = {
  addEventListener: (t, f) => (listeners.window[t] = f),
  removeEventListener: (t) => delete listeners.window[t]
}

const { db, saveMission, setFields, setReportStatus, getIntervention } = await import('../src/db.js')
const { createAutosaver } = await import('../src/lib/autosave.js')

const mission = { id: 'p1', reference: 'FI-1', title: 't', properties: [], templateBlocks: [], warnings: [] }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

test.beforeEach(async () => {
  await db.interventions.clear()
  await db.media_queue.clear()
  await saveMission(mission)
})

test('regroupe les frappes rapides en une seule écriture', async () => {
  const states = []
  const saver = createAutosaver('p1', { delay: 30, onState: (s) => states.push(s) })
  saver.set('notes', 'a'); saver.set('notes', 'ab'); saver.set('notes', 'abc'); saver.set('etat', 'Usagé')
  assert.equal(saver.hasPending(), true)
  await wait(120)
  const f = (await getIntervention('p1')).fields
  assert.deepEqual({ notes: f.notes.v, etat: f.etat.v }, { notes: 'abc', etat: 'Usagé' })
  assert.equal(states.filter((s) => s === 'saving').length, 1)
  assert.equal(states.at(-1), 'saved')
  await saver.dispose()
})

test('flush immédiat quand la page passe en arrière-plan', async () => {
  const saver = createAutosaver('p1', { delay: 10_000 })     // le délai ne serait jamais atteint
  saver.set('notes', 'vite')
  document.visibilityState = 'hidden'
  listeners.document.visibilitychange()
  await wait(60)
  assert.equal((await getIntervention('p1')).fields.notes.v, 'vite')
  document.visibilityState = 'visible'
  await saver.dispose()
})

test('CR validé entre-temps : erreur LOCKED signalée, saisies abandonnées', async () => {
  const errors = []
  const saver = createAutosaver('p1', { delay: 10, onState: (s, e) => s === 'error' && errors.push(e.code) })
  await setFields('p1', { notes: 'avant' })
  await setReportStatus('p1', 'validated')
  saver.set('notes', 'après')
  await saver.flush()
  assert.deepEqual(errors, ['LOCKED'])
  assert.equal(saver.hasPending(), false)
  assert.equal((await getIntervention('p1')).fields.notes.v, 'avant')
  await saver.dispose()
})

test('échec d’écriture : les saisies restent en attente pour un nouvel essai', async () => {
  const saver = createAutosaver('inconnue', { delay: 10 })     // mission inexistante → NotFoundError
  saver.set('notes', 'x')
  await saver.flush()
  assert.equal(saver.hasPending(), true)
  await saver.dispose()
})

test('dispose retire les écouteurs et vide la file', async () => {
  const saver = createAutosaver('p1', { delay: 10_000 })
  saver.set('notes', 'final')
  await saver.dispose()
  assert.equal(listeners.document.visibilitychange, undefined)
  assert.equal((await getIntervention('p1')).fields.notes.v, 'final')
})
