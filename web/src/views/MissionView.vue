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
import { formatPropertyValue, missionStatus } from '../lib/format.js'
import { online } from '../lib/online.js'
import { DEFAULT_PREFIX } from '../config.js'

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

    <section class="card" aria-labelledby="info-title">
      <h3 id="info-title">Mission</h3>
      <dl class="props">
        <template v-for="p in mission.readOnlyData" :key="p.label">
          <dt>{{ p.label }}</dt>
          <dd>{{ formatPropertyValue(p) }}</dd>
        </template>
      </dl>
    </section>

    <p class="small muted" style="margin-top: var(--s-4)">
      Template chargé : {{ componentCount(mission) }} champ(s) à remplir. Disponible hors ligne.
    </p>
  </template>
</template>

<style scoped>
.props { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px var(--s-4); margin: 0; }
.props dt { font: 600 var(--fs-small)/1.3 var(--f-body); color: var(--c-navy); margin-top: var(--s-3); }
.props dt:first-child { margin-top: 0; }
.props dd { margin: 0; overflow-wrap: anywhere; }
@media (min-width: 560px) {
  .props { grid-template-columns: minmax(120px, 1fr) 2fr; }
  .props dt { margin-top: 0; padding-top: var(--s-2); }
  .props dd { padding-top: var(--s-2); }
}
</style>
