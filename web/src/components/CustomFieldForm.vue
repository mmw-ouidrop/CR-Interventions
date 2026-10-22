<script setup>
// Ajout d'un champ par le technicien (nom + type). Il apparaît dans « Ajouts terrain »,
// il est partagé avec les collègues et inscrit dans le rapport Notion.
import { ref } from 'vue'

// `add` : fonction asynchrone fournie par l'écran ; elle lève une erreur lisible si l'ajout est refusé.
const props = defineProps({ disabled: Boolean, add: { type: Function, required: true } })

const TYPES = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'checkbox', label: 'Case à cocher' },
  { value: 'radio_group', label: 'Choix unique' },
  { value: 'image_upload', label: 'Photos' }
]
const open = ref(false)
const label = ref('')
const type = ref('text')
const optionsText = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  const options = optionsText.value.split('\n').map((s) => s.trim()).filter(Boolean)
  try {
    await props.add({ label: label.value, type: type.value, options })
    label.value = ''; optionsText.value = ''; type.value = 'text'; open.value = false
  } catch (e) {
    error.value = (e && e.message) || 'Ajout impossible.'
  }
}
</script>

<template>
  <section class="card add" aria-labelledby="add-title">
    <h3 id="add-title" class="add__title">Un champ manque ?</h3>
    <button v-if="!open" type="button" class="btn btn--ghost" :disabled="props.disabled" @click="open = true">Ajouter un champ</button>
    <form v-else novalidate @submit.prevent="submit">
      <div class="field">
        <label for="cf-label">Nom du champ</label>
        <input id="cf-label" v-model="label" class="input" maxlength="200" autocomplete="off" />
      </div>
      <div class="field">
        <label for="cf-type">Type</label>
        <select id="cf-type" v-model="type" class="input">
          <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div v-if="type === 'radio_group'" class="field">
        <label for="cf-opts">Choix (un par ligne, 2 minimum)</label>
        <textarea id="cf-opts" v-model="optionsText" class="input" rows="3"></textarea>
      </div>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <div class="add__btns">
        <button class="btn" :disabled="!label.trim()">Ajouter</button>
        <button type="button" class="btn btn--ghost" @click="open = false">Annuler</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.add__title { margin-bottom: var(--s-3); }
.add__btns { display: flex; flex-wrap: wrap; gap: var(--s-2); }
</style>
