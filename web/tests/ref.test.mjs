import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReference, consumeUrlReference } from '../src/lib/ref.js'

test('normalizeReference : saisies courantes', () => {
  for (const v of ['FI-252', 'fi-252', 'fi252', 'fi 252', '  FI_252 ', 'FI-0252']) {
    assert.equal(normalizeReference(v), 'FI-252', v)
  }
})

test('normalizeReference : numéro seul et préfixe par défaut', () => {
  assert.equal(normalizeReference('252'), '252')
  assert.equal(normalizeReference('252', 'FI'), 'FI-252')
  assert.equal(normalizeReference('dev-7', 'FI'), 'DEV-7', 'un préfixe saisi prime')
})

test('normalizeReference : URL collées', () => {
  assert.equal(normalizeReference('https://app.example.com/?id=FI-252'), 'FI-252')
  assert.equal(normalizeReference('https://app.example.com/#/m/FI-252'), 'FI-252')
  assert.equal(normalizeReference('https://app.example.com/#/?id=fi-12'), 'FI-12')
  assert.equal(normalizeReference('https://app.example.com/'), null)
})

test('normalizeReference : rejette le non exploitable', () => {
  for (const v of ['', '   ', null, undefined, 'abc', 'FI-', '12 34 56', 'FI-252; DROP']) {
    assert.equal(normalizeReference(v), null, String(v))
  }
})

test('consumeUrlReference : lit ?id= et le retire de la barre d’adresse', () => {
  const calls = []
  const loc = { search: '?id=FI-252&utm=x', pathname: '/app/', hash: '#/' }
  const got = consumeUrlReference(loc, { replaceState: (...a) => calls.push(a) })
  assert.equal(got, 'FI-252')
  assert.equal(calls[0][2], '/app/?utm=x#/')
  assert.equal(consumeUrlReference({ search: '', pathname: '/', hash: '' }, { replaceState() {} }), null)
})
