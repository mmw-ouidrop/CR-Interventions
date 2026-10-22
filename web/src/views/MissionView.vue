<script setup>
// Étape 2 : coquille de l'écran mission. Prouve le chemin complet
// (IndexedDB d'abord → réseau seulement si la mission n'est pas encore là)
// et affiche les propriétés Notion en lecture seule, de façon générique.
// Le formulaire interactif (composants JSON, photos, bouton « Valider le CR »,
// synchronisation) arrive à l'étape 3.
import { ref, watch, onUnmounted } from 'vue'
import { liveQuery } from 'dexie'
import { findByReference, saveMission, getIntervention } from '../db.js'
import { api } from '../lib/api.js'
import { normalizeReference } from '../lib/ref.js'
import { missionStatus } from '../lib/format.js'
import { online } from '../lib/online.js'
import { DEFAULT_PREFIX } from '../config.js'
import PropertiesPanel from '../components/PropertiesPanel.vue'

const props = defineProps({ reference: { type: String, required: true } })

const mission = ref(null)
const state = ref('loading') // loading | ready | missing | error
const error = ref('')
let sub

async function load() {
  sub && sub.unsubscribe()
  mission.value = null
  state.value = 'loading'
  error.value = ''

  const wanted = normalizeReference(props.reference, DEFAULT_PREFIX) || props.reference
  let rec = await findByReference(wanted)

  if (!rec) {
    if (!online.value) {
      state.value = 'missing'
      return
    }
    try {
      rec = await saveMission(await api.getIntervention(wanted))
    } catch (e) {
      state.value = e.code === 'NETWORK' ? 'missing' : 'error'
      error.value = e.code === 'NOT_FOUND' ? `Aucune mission « ${wanted} ».` : e.message
      return
    }
  }

  // Suit la fiche en direct (autosave, changements d'état d'envoi…).
  sub = liveQuery(() => getIntervention(rec.id)).subscribe({ next: (r) => (mission.value = r) })
  state.value = 'ready'
}

watch(() => props.reference, load, { immediate: true })
onUnmounted(() => sub && sub.unsubscribe())

const componentCount = (m) => m.templateBlocks.filter((b) => b.kind === 'component').length
</script>

<template>
  <p><router-link to="/">← Missions</router-link></p>

  <p v-if="state === 'loading'" role="status">Chargement…</p>

  <div v-else-if="state === 'missing'" class="alert" role="alert">
    <strong>Mission absente de l'appareil.</strong>
    Connectez-vous au réseau une première fois pour la charger.
  </div>

  <div v-else-if="state === 'error'" class="alert" role="alert">{{ error }}</div>

  <template v-else-if="mission">
    <h2>{{ mission.reference }}</h2>
    <p>
      <span class="chip" :class="'chip--' + missionStatus(mission).tone">{{ missionStatus(mission).label }}</span>
    </p>
    <h4 v-if="mission.title">{{ mission.title }}</h4>

    <PropertiesPanel :properties="mission.readOnlyData" />

    <p class="small muted" style="margin-top: var(--s-4)">
      Template chargé : {{ componentCount(mission) }} champ(s) à remplir. Disponible hors ligne.
    </p>
  </template>
</template>
