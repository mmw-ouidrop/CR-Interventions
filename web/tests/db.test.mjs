// Tests de la couche données (machine d'états du CR). Lancer : npm test
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  db, saveMission, setFields, addPhoto, removePhoto, listPhotos, findByReference,
  validateReport, reopenReport, beginSync, endSyncSuccess, endSyncError,
  listPendingSync, setMediaUploaded, deleteIntervention, getIntervention,
  LockedError, SyncInProgressError, NotFoundError, STALE_SYNC_MS
} from '../src/db.js'

const mission = (over = {}) => ({
  id: 'page-1', reference: 'FI-252', title: 'Compteur',
  properties: [{ label: 'Client', value: 'Dupont', type: 'rich_text' }],
  templateBlocks: [{ kind: 'component', id: 'photo_compteur', type: 'image_upload' }],
  warnings: [], lastEditedTime: '2026-10-19T08:00:00Z', url: 'https://notion.so/x', ...over
})
const jpeg = (n = 10) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' })

test.beforeEach(async () => {
  await db.interventions.clear()
  await db.media_queue.clear()
})

test('saveMission : crée un brouillon ; actualiser conserve saisies, statut et envoi', async () => {
  const a = await saveMission(mission())
  assert.equal(a.status, 'draft')
  assert.equal(a.syncStatus, 'synced')
  assert.equal(a.lastSyncAt, null)
  await setFields('page-1', { notes: 'RAS' })
  await validateReport('page-1')

  const b = await saveMission(mission({ title: 'Compteur (modifié)', templateBlocks: [] }))
  assert.equal(b.title, 'Compteur (modifié)')
  assert.deepEqual(b.formData, { notes: 'RAS' })
  assert.equal(b.status, 'validated')
  assert.equal(b.syncStatus, 'pending')
})

test('setFields : fusionne, supprime avec undefined, échoue si absent', async () => {
  await saveMission(mission())
  await setFields('page-1', { a: 1, b: 'x' })
  const fd = await setFields('page-1', { b: undefined, c: ['u', 'v'] })
  assert.deepEqual(fd, { a: 1, c: ['u', 'v'] })
  await assert.rejects(setFields('nope', { a: 1 }), NotFoundError)
})

test('validateReport : fige le formulaire, met en file d’envoi, idempotent', async () => {
  await saveMission(mission())
  await setFields('page-1', { notes: 'RAS' })
  const v1 = await validateReport('page-1')
  assert.equal(v1.status, 'validated')
  assert.equal(v1.syncStatus, 'pending')
  assert.ok(v1.syncId && v1.validatedAt)

  await assert.rejects(setFields('page-1', { notes: 'modif' }), LockedError)
  await assert.rejects(addPhoto('page-1', 'photo_compteur', jpeg()), LockedError)

  const v2 = await validateReport('page-1')
  assert.equal(v2.syncId, v1.syncId, 'revalider ne change pas le syncId')
})

test('reopenReport : redonne la main ; CR jamais parti = envoi annulé', async () => {
  await saveMission(mission())
  await validateReport('page-1')
  const r = await reopenReport('page-1')
  assert.equal(r.status, 'draft')
  assert.equal(r.syncStatus, 'synced')
  assert.equal(r.syncId, null)
  await setFields('page-1', { notes: 'ok' })                       // ne lève plus
  assert.equal((await listPendingSync()).length, 0)
})

test('photos : ajout, ordre, suppression, liaison avec formData', async () => {
  await saveMission(mission())
  const m1 = await addPhoto('page-1', 'photo_compteur', jpeg(), { fileName: 'a.jpg' })
  const m2 = await addPhoto('page-1', 'photo_compteur', jpeg(20))
  await addPhoto('page-1', 'autre', jpeg())

  let rec = await getIntervention('page-1')
  assert.deepEqual(rec.formData.photo_compteur, [m1, m2])
  const rows = await listPhotos('page-1', 'photo_compteur')
  assert.deepEqual(rows.map((r) => r.mediaId), [m1, m2])
  assert.equal(rows[0].uploadStatus, 'queued')
  assert.equal(rows[0].blockId, 'photo_compteur')
  assert.equal((await listPhotos('page-1')).length, 3)

  await removePhoto(m1)
  rec = await getIntervention('page-1')
  assert.deepEqual(rec.formData.photo_compteur, [m2])
  assert.equal((await listPhotos('page-1', 'photo_compteur')).length, 1)

  await validateReport('page-1')
  await assert.rejects(removePhoto(m2), LockedError)
})

test('envoi : verrou, erreur puis nouvel essai, succès', async () => {
  await saveMission(mission())
  assert.equal(await beginSync('page-1'), null, 'brouillon : rien à envoyer')

  const m = await addPhoto('page-1', 'photo_compteur', jpeg())
  const v = await validateReport('page-1')
  assert.equal((await listPendingSync()).length, 1)

  const s1 = await beginSync('page-1')
  assert.ok(s1 && s1.syncing)
  assert.equal(s1.syncId, v.syncId)
  assert.equal(await beginSync('page-1'), null, 'déjà en cours (autre onglet)')
  assert.equal((await listPendingSync()).length, 0, 'en cours : non proposé')
  await assert.rejects(reopenReport('page-1'), SyncInProgressError)

  await setMediaUploaded(m, 'DRIVE_ID_1')
  await endSyncError('page-1', Object.assign(new Error('Pas de réseau.'), { code: 'NETWORK' }))
  let rec = await getIntervention('page-1')
  assert.equal(rec.syncStatus, 'error')
  assert.equal(rec.lastError.code, 'NETWORK')
  assert.equal((await listPendingSync()).length, 1, "l'erreur est rejouable")

  const s2 = await beginSync('page-1')
  assert.equal(s2.syncId, v.syncId, 'même syncId : le GAS dédoublonne')
  assert.equal(s2.syncAttempts, 2)
  assert.equal((await listPhotos('page-1'))[0].driveFileId, 'DRIVE_ID_1', 'upload partiel conservé au 2e essai')

  await endSyncSuccess('page-1')
  rec = await getIntervention('page-1')
  assert.equal(rec.syncStatus, 'synced')
  assert.equal(rec.status, 'validated', 'reste figé et visible comme envoyé')
  assert.ok(rec.lastSyncAt)
  assert.equal(rec.syncId, null)
  assert.equal((await listPhotos('page-1'))[0].driveFileId, null, 'transit Drive supprimé par le GAS')
  assert.equal(await beginSync('page-1'), null)
})

test('envoi bloqué depuis plus de 10 min : repris', async () => {
  await saveMission(mission())
  await validateReport('page-1')
  await beginSync('page-1')
  await db.interventions.update('page-1', { syncStartedAt: Date.now() - STALE_SYNC_MS - 1000 })
  assert.equal((await listPendingSync()).length, 1)
  assert.ok(await beginSync('page-1'))
  await db.interventions.update('page-1', { syncStartedAt: Date.now() - STALE_SYNC_MS - 1000 })
  assert.ok(await reopenReport('page-1'), 'un envoi périmé ne bloque plus la réouverture')
})

test('cycle complet : valider → envoyé → rouvrir → modifier → re-valider', async () => {
  await saveMission(mission())
  const m = await addPhoto('page-1', 'photo_compteur', jpeg())
  const first = await validateReport('page-1')
  await beginSync('page-1')
  await setMediaUploaded(m, 'DRIVE_ID_1')
  await endSyncSuccess('page-1')

  const reopened = await reopenReport('page-1')
  assert.equal(reopened.status, 'draft')
  assert.ok((await getIntervention('page-1')).lastSyncAt, 'on sait qu’une version est déjà dans Notion')

  await setFields('page-1', { notes: 'ajout' })
  const second = await validateReport('page-1')
  assert.equal(second.syncStatus, 'pending')
  assert.notEqual(second.syncId, first.syncId, 'nouveau syncId pour la nouvelle version')
  const media = (await listPhotos('page-1'))[0]
  assert.equal(media.uploadStatus, 'queued', 'les photos repartent (transit Drive purgé)')
  assert.equal(media.driveFileId, null)
  assert.ok(media.fileBlob.size > 0, 'le fichier local est toujours là')
})

test('findByReference : exact, numéro seul unique, ambigu', async () => {
  await saveMission(mission())
  await saveMission(mission({ id: 'page-2', reference: 'FI-300' }))
  await saveMission(mission({ id: 'page-3', reference: 'DEV-300' }))
  assert.equal((await findByReference('FI-252')).id, 'page-1')
  assert.equal((await findByReference('252')).id, 'page-1')
  assert.equal(await findByReference('300'), undefined, 'ambigu → pas de choix arbitraire')
  assert.equal(await findByReference('FI-999'), undefined)
})

test('deleteIntervention : refuse un CR validé non remonté, supprime fiche + photos', async () => {
  await saveMission(mission())
  await addPhoto('page-1', 'photo_compteur', jpeg())
  await validateReport('page-1')
  await assert.rejects(deleteIntervention('page-1'), /pas encore remonté/)
  await deleteIntervention('page-1', { force: true })
  assert.equal(await getIntervention('page-1'), undefined)
  assert.equal((await listPhotos('page-1')).length, 0)
})
