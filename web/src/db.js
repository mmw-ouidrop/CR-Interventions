// ============================================================================
//  Base locale (IndexedDB via Dexie) — source de vérité hors ligne
// ============================================================================
//
//  Store `interventions` — une fiche par mission
//    id            PK  — ID de la page Notion
//    reference         — ID court (« FI-252 »)
//    title, url        — titre et lien de la page Notion
//    readOnlyData      — [{label, value, type}] propriétés Notion, génériques
//    templateBlocks    — blocs du template (liste plate renvoyée par le GAS)
//    formData          — saisies : { [idComposant]: valeur }
//                        · texte / radio / etc. : string | boolean | string[]
//                        · image_upload         : string[] d'identifiants `mediaId`
//    status            — 'draft' | 'validated'   (validated = formulaire figé)
//    validatedAt       — timestamp de la dernière validation
//    syncStatus        — 'synced' | 'pending' | 'error'
//                        ⚠ concerne la REMONTÉE du CR validé :
//                        'pending' = un CR validé attend d'être envoyé à Notion ;
//                        'error'   = le dernier envoi a échoué (on réessaiera) ;
//                        'synced'  = rien à envoyer. Un brouillon jamais validé est
//                        donc 'synced' avec `lastSyncAt === null`.
//    lastUpdated       — timestamp de la dernière saisie locale
//    — champs additionnels —
//    syncId            — identifiant d'envoi (idempotence côté GAS), fixé à la
//                        validation et conservé jusqu'au succès
//    syncing, syncStartedAt — envoi en cours (verrou entre onglets, expire à 10 min)
//    lastSyncAt, lastError, syncAttempts
//    templateWarnings, remoteEditedAt, fetchedAt
//
//  Store `media_queue` — une ligne par photo
//    mediaId       PK  — UUID local
//    interventionId    — fiche liée
//    blockId           — ⚠ contient l'`id` du COMPOSANT du template (ex. « photo_compteur »),
//                        pas l'ID d'un bloc Notion
//    fileBlob          — l'image (JPEG), conservée tant que la fiche existe : elle est
//                        renvoyée à chaque re-validation (les copies Drive de transit
//                        sont supprimées après chaque envoi réussi)
//    uploadStatus      — 'queued' | 'uploading' | 'done'
//    driveFileId       — fichier de transit Drive pendant un envoi (remplace `driveUrl`
//                        du cahier des charges : plus de lien public, voir Code.gs)
//    fileName, mimeType, size, createdAt
// ============================================================================

import Dexie from 'dexie'
import { uuid } from './lib/uuid.js'

export const db = new Dexie('ouidrop-interventions')

db.version(1).stores({
  interventions: 'id, reference, syncStatus, status, lastUpdated',
  media_queue: 'mediaId, interventionId, blockId, uploadStatus, [interventionId+blockId]'
})

/* ───────────────────────────────── Erreurs ───────────────────────────────── */

export class LockedError extends Error {
  constructor() {
    super('Le CR est validé : rouvrez-le pour le modifier.')
    this.name = 'LockedError'
    this.code = 'LOCKED'
  }
}
export class NotFoundError extends Error {
  constructor(what) {
    super('Introuvable : ' + what)
    this.name = 'MissionNotFoundError'
    this.code = 'NOT_FOUND'
  }
}
export class SyncInProgressError extends Error {
  constructor() {
    super('Envoi en cours : patientez avant de rouvrir le CR.')
    this.name = 'SyncInProgressError'
    this.code = 'SYNC_IN_PROGRESS'
  }
}

const now = () => Date.now()
export const STALE_SYNC_MS = 10 * 60 * 1000

const isSyncRunning = (rec) => rec.syncing && now() - (rec.syncStartedAt || 0) < STALE_SYNC_MS

/* ────────────────────────────── Missions (lecture) ───────────────────────── */

export const getIntervention = (id) => db.interventions.get(id)

export function listInterventions() {
  return db.interventions.orderBy('lastUpdated').reverse().toArray()
}

// « FI-252 » exact ; ou « 252 » seul si une seule fiche locale finit par « -252 ».
export async function findByReference(ref) {
  if (!ref) return undefined
  const exact = await db.interventions.where('reference').equals(ref).first()
  if (exact || ref.includes('-')) return exact
  const suffix = '-' + ref
  const hits = await db.interventions.filter((r) => String(r.reference).endsWith(suffix)).toArray()
  return hits.length === 1 ? hits[0] : undefined
}

/* ─────────────────────── Missions (création / actualisation) ──────────────── */

// `m` = `data` renvoyé par la route GAS getIntervention.
// L'actualisation ne touche JAMAIS aux saisies, au statut ni à l'état d'envoi.
export function saveMission(m) {
  return db.transaction('rw', db.interventions, async () => {
    const prev = await db.interventions.get(m.id)
    const rec = {
      id: m.id,
      reference: m.reference,
      title: m.title || '',
      url: m.url || '',
      readOnlyData: m.properties || [],
      templateBlocks: m.templateBlocks || [],
      templateWarnings: m.warnings || [],
      remoteEditedAt: m.lastEditedTime || null,
      fetchedAt: now(),

      formData: prev ? prev.formData : {},
      status: prev ? prev.status : 'draft',
      validatedAt: prev ? prev.validatedAt : null,
      syncStatus: prev ? prev.syncStatus : 'synced',
      syncId: prev ? prev.syncId : null,
      syncing: prev ? prev.syncing : false,
      syncStartedAt: prev ? prev.syncStartedAt : null,
      syncAttempts: prev ? prev.syncAttempts : 0,
      lastSyncAt: prev ? prev.lastSyncAt : null,
      lastError: prev ? prev.lastError : null,
      lastUpdated: prev ? prev.lastUpdated : now()
    }
    await db.interventions.put(rec)
    return rec
  })
}

/* ─────────────────────────────── Saisies (autosave) ──────────────────────── */

// Fusionne `patch` dans formData en une transaction (atomique, sûr si plusieurs
// onglets). Une valeur `undefined` supprime la clé. Refusé si le CR est validé.
export function setFields(id, patch) {
  return db.transaction('rw', db.interventions, async () => {
    const rec = await db.interventions.get(id)
    if (!rec) throw new NotFoundError('mission ' + id)
    if (rec.status === 'validated') throw new LockedError()
    const formData = { ...rec.formData, ...patch }
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete formData[k]
    await db.interventions.update(id, { formData, lastUpdated: now() })
    return formData
  })
}

/* ──────────────────────────────────── Photos ─────────────────────────────── */

// `blob` : image déjà préparée (JPEG, voir lib/image.js).
export function addPhoto(interventionId, componentId, blob, { fileName } = {}) {
  return db.transaction('rw', db.interventions, db.media_queue, async () => {
    const rec = await db.interventions.get(interventionId)
    if (!rec) throw new NotFoundError('mission ' + interventionId)
    if (rec.status === 'validated') throw new LockedError()

    const mediaId = uuid()
    await db.media_queue.add({
      mediaId,
      interventionId,
      blockId: componentId,
      fileBlob: blob,
      fileName: fileName || `${componentId}-${now()}.jpg`,
      mimeType: blob.type || 'image/jpeg',
      size: blob.size,
      uploadStatus: 'queued',
      driveFileId: null,
      createdAt: now()
    })
    const list = Array.isArray(rec.formData[componentId]) ? rec.formData[componentId] : []
    await db.interventions.update(interventionId, {
      formData: { ...rec.formData, [componentId]: [...list, mediaId] },
      lastUpdated: now()
    })
    return mediaId
  })
}

export function removePhoto(mediaId) {
  return db.transaction('rw', db.interventions, db.media_queue, async () => {
    const media = await db.media_queue.get(mediaId)
    if (!media) return
    const rec = await db.interventions.get(media.interventionId)
    if (rec && rec.status === 'validated') throw new LockedError()
    await db.media_queue.delete(mediaId)
    if (rec) {
      const list = (rec.formData[media.blockId] || []).filter((m) => m !== mediaId)
      await db.interventions.update(rec.id, {
        formData: { ...rec.formData, [media.blockId]: list },
        lastUpdated: now()
      })
    }
  })
}

export async function listPhotos(interventionId, componentId) {
  const rows = componentId
    ? await db.media_queue.where('[interventionId+blockId]').equals([interventionId, componentId]).toArray()
    : await db.media_queue.where('interventionId').equals(interventionId).toArray()
  // Ordre d'ajout (l'index ne garantit pas l'ordre chronologique).
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

/* ─────────────────────── Validation / réouverture du CR ───────────────────── */

// « Valider le CR » : fige le formulaire et met le CR en file d'envoi.
// Idempotent. Les photos repassent en 'queued' : leurs copies Drive de transit
// ont été supprimées après l'envoi précédent, il faut donc les renvoyer.
export function validateReport(id) {
  return db.transaction('rw', db.interventions, db.media_queue, async () => {
    const rec = await db.interventions.get(id)
    if (!rec) throw new NotFoundError('mission ' + id)
    if (rec.status === 'validated') return rec
    const patch = {
      status: 'validated',
      validatedAt: now(),
      syncStatus: 'pending',
      syncId: uuid(),
      syncing: false,
      syncStartedAt: null,
      lastError: null
    }
    await db.interventions.update(id, patch)
    await db.media_queue
      .where('interventionId')
      .equals(id)
      .modify({ uploadStatus: 'queued', driveFileId: null })
    return { ...rec, ...patch }
  })
}

// « Modifier à nouveau » : redonne la main sur le formulaire.
// Refusé pendant un envoi. Si le CR validé n'était pas encore parti, l'envoi est
// annulé (il n'y a plus rien à remonter tant que le CR n'est pas re-validé) ;
// s'il était déjà dans Notion, cette version y reste jusqu'à la re-validation.
export function reopenReport(id) {
  return db.transaction('rw', db.interventions, async () => {
    const rec = await db.interventions.get(id)
    if (!rec) throw new NotFoundError('mission ' + id)
    if (rec.status === 'draft') return rec
    if (isSyncRunning(rec)) throw new SyncInProgressError()
    const patch = { status: 'draft', syncStatus: 'synced', syncId: null, lastError: null, lastUpdated: now() }
    await db.interventions.update(id, patch)
    return { ...rec, ...patch }
  })
}

/* ───────────────────── États d'envoi (utilisés par le moteur de synchro) ──── */

// Missions à remonter : CR validé, en attente ou en erreur (nouvel essai).
export async function listPendingSync() {
  const rows = await db.interventions.where('syncStatus').anyOf('pending', 'error').toArray()
  return rows.filter((r) => r.status === 'validated' && !isSyncRunning(r))
}

// Réserve l'envoi (verrou atomique : deux onglets ne partent pas en même temps).
// Renvoie la fiche, ou null s'il n'y a rien à faire / un envoi est déjà en cours.
export function beginSync(id) {
  return db.transaction('rw', db.interventions, async () => {
    const rec = await db.interventions.get(id)
    if (!rec || rec.status !== 'validated' || rec.syncStatus === 'synced') return null
    if (isSyncRunning(rec)) return null
    const patch = {
      syncing: true,
      syncStartedAt: now(),
      syncId: rec.syncId || uuid(),
      syncAttempts: (rec.syncAttempts || 0) + 1
    }
    await db.interventions.update(id, patch)
    return { ...rec, ...patch }
  })
}

export const setMediaStatus = (mediaId, uploadStatus) => db.media_queue.update(mediaId, { uploadStatus })

export const setMediaUploaded = (mediaId, driveFileId) =>
  db.media_queue.update(mediaId, { uploadStatus: 'done', driveFileId })

export function endSyncSuccess(id) {
  return db.transaction('rw', db.interventions, db.media_queue, async () => {
    await db.interventions.update(id, {
      syncStatus: 'synced',
      syncing: false,
      syncStartedAt: null,
      syncId: null,
      syncAttempts: 0,
      lastSyncAt: now(),
      lastError: null
    })
    // Les fichiers Drive de transit viennent d'être supprimés par le GAS.
    await db.media_queue.where('interventionId').equals(id).modify({ uploadStatus: 'done', driveFileId: null })
  })
}

export function endSyncError(id, err) {
  return db.interventions.update(id, {
    syncStatus: 'error',
    syncing: false,
    syncStartedAt: null,
    lastError: { code: (err && err.code) || 'UNKNOWN', message: (err && err.message) || String(err), at: now() }
  })
}

/* ───────────────────────────────── Nettoyage ─────────────────────────────── */

// Retire une mission de l'appareil (fiche + photos). Refusé si un CR validé n'est
// pas encore remonté, sauf `force`.
export function deleteIntervention(id, { force = false } = {}) {
  return db.transaction('rw', db.interventions, db.media_queue, async () => {
    const rec = await db.interventions.get(id)
    if (!rec) return
    const owed = rec.status === 'validated' && rec.syncStatus !== 'synced'
    if (owed && !force) throw new Error("Ce CR n'est pas encore remonté dans Notion.")
    await db.media_queue.where('interventionId').equals(id).delete()
    await db.interventions.delete(id)
  })
}
