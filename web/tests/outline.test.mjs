import test from 'node:test'
import assert from 'node:assert/strict'
import { ancestorSections, buildOutline, jumpTargets, loadViewPrefs, saveViewPrefs, setAllCollapsed } from '../src/lib/outline.js'

const S = (id, level, text = id) => ({ k: 'section', id, level, text })
const F = (id, type = 'text', extra = {}) => ({ k: 'field', id, type, label: id, ...extra })
const items = [
  S('S:1', 1, 'Avant'), F('a'), F('b', 'text', { required: true }), { k: 'text', id: 'T:1', text: 'Consigne' },
  S('S:2', 1, 'Intervention'), F('c'), S('S:2a', 2, 'Détail'), F('d', 'image_upload', { required: true }), S('S:2b', 3, 'Intertitre'), F('e', 'checkbox'),
  S('S:3', 1, 'Clôture'), F('f')
]
const values = { a: 'x', e: true }
const ctx = (o = {}) => ({ value: (id) => values[id], photos: (id) => (id === 'd' ? 0 : 0), ...o })
const ids = (o) => o.rows.map((r) => r.id)

test('compteurs par section : une section couvre ses sous-sections', () => {
  const o = buildOutline(items, ctx())
  const sec = Object.fromEntries(o.rows.filter((r) => r.k === 'section').map((r) => [r.id, [r.filled, r.total]]))
  assert.deepEqual(sec, { 'S:1': [1, 2], 'S:2': [1, 3], 'S:2a': [1, 2], 'S:2b': [1, 1], 'S:3': [0, 1] })
  assert.equal(o.total, 6)
  assert.equal(o.filled, 2)
})

test('champs obligatoires manquants (photo = au moins une)', () => {
  assert.deepEqual(buildOutline(items, ctx()).missing.map((f) => f.id), ['b', 'd'])
  const o = buildOutline(items, ctx({ value: (id) => ({ ...values, b: 'ok' })[id], photos: (id) => (id === 'd' ? 2 : 0) }))
  assert.deepEqual(o.missing, [])
})

test('section repliée : ses champs et ses sous-sections disparaissent, la suivante reste', () => {
  const o = buildOutline(items, ctx({ collapsed: { 'S:2': true } }))
  assert.deepEqual(ids(o), ['S:1', 'a', 'b', 'T:1', 'S:2', 'S:3', 'f'])
  assert.equal(o.rows.find((r) => r.id === 'S:2').open, false)
  // H3 non repliable
  assert.equal(buildOutline(items, ctx({ collapsed: { 'S:2b': true } })).rows.find((r) => r.id === 'e') !== undefined, true)
})

test('sous-section repliée seule (l’intertitre H3 qu’elle contient se replie avec elle)', () => {
  const o = buildOutline(items, ctx({ collapsed: { 'S:2a': true } }))
  assert.deepEqual(ids(o), ['S:1', 'a', 'b', 'T:1', 'S:2', 'c', 'S:2a', 'S:3', 'f'])
})

test('masquer les champs remplis : consignes masquées aussi, champs en conflit conservés', () => {
  const o = buildOutline(items, ctx({ hideFilled: true }))
  assert.deepEqual(ids(o), ['S:1', 'b', 'S:2', 'c', 'S:2a', 'd', 'S:2b', 'S:3', 'f'])
  const k = buildOutline(items, ctx({ hideFilled: true, keep: new Set(['a']) }))
  assert.ok(ids(k).includes('a'))
})

test('section entièrement remplie : repérée « done »', () => {
  const o = buildOutline(items, ctx({ value: (id) => (id === 'e' ? true : 'x'), photos: () => 1 }))
  assert.ok(o.rows.filter((r) => r.k === 'section').every((r) => r.done))
})

test('menu « aller à » : H1/H2 avec avancement, indépendamment du repli', () => {
  const j = jumpTargets(items, ctx({ collapsed: { 'S:2': true } }))
  assert.deepEqual(j.map((x) => x.id), ['S:1', 'S:2', 'S:2a', 'S:3'])
})

test('réglages d’affichage : mémorisés par mission, tolérants aux données abîmées', () => {
  const mem = new Map()
  const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) }
  assert.deepEqual(loadViewPrefs('m1', st), { hideFilled: false, collapsed: {} })
  saveViewPrefs('m1', { hideFilled: true, collapsed: { 'S:1': true } }, st)
  assert.deepEqual(loadViewPrefs('m1', st), { hideFilled: true, collapsed: { 'S:1': true } })
  assert.deepEqual(loadViewPrefs('m2', st), { hideFilled: false, collapsed: {} })
  mem.set('ouidrop.view.v1.m3', '{pas du json')
  assert.deepEqual(loadViewPrefs('m3', st), { hideFilled: false, collapsed: {} })
  assert.deepEqual(setAllCollapsed(items, true), { 'S:1': true, 'S:2': true, 'S:2a': true, 'S:3': true })
  assert.deepEqual(setAllCollapsed(items, false), {})
})

test('sections à déplier pour atteindre un champ', () => {
  assert.deepEqual(ancestorSections(items, 'd'), ['S:2', 'S:2a'])
  assert.deepEqual(ancestorSections(items, 'e'), ['S:2', 'S:2a'])
  assert.deepEqual(ancestorSections(items, 'f'), ['S:3'])
  assert.deepEqual(ancestorSections(items, 'zz'), [])
})
