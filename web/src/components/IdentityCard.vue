<script setup>
// Prénom + nom du technicien : demandés une fois, inscrits dans le rapport Notion avec
// chaque modification (« Dernière modification : … »). Aucun compte : c'est déclaratif.
import { ref, watchEffect } from 'vue'
import { identity, named, setName } from '../lib/session.js'

const props = defineProps({
  // 'gate' : bloc d'accueil tant qu'il n'y a pas de nom ; 'edit' : modification dans les réglages
  mode: { type: String, default: 'gate' }
})
const first = ref('')
const last = ref('')
const editing = ref(false)
watchEffect(() => {
  if (!editing.value) { first.value = identity.value.firstName; last.value = identity.value.lastName }
})
const valid = () => first.value.trim() && last.value.trim()
function save() {
  if (!valid()) return
  setName(first.value, last.value)
  editing.value = false
}
</script>

<template>
  <form v-if="props.mode === 'gate' ? !named : true" class="card id" novalidate @submit.prevent="save">
    <h3 v-if="props.mode === 'gate'" class="id__title">Qui intervient ?</h3>
    <p v-if="props.mode === 'gate'" class="small muted">
      Votre nom apparaît dans le compte rendu avec chacune de vos modifications, pour que vos collègues et vos
      responsables sachent qui a saisi quoi. Il reste sur cet appareil et dans Notion.
    </p>
    <div class="id__row">
      <div class="field">
        <label for="id-first">Prénom</label>
        <input id="id-first" v-model="first" class="input" autocomplete="given-name" maxlength="40" @focus="editing = true" />
      </div>
      <div class="field">
        <label for="id-last">Nom</label>
        <input id="id-last" v-model="last" class="input" autocomplete="family-name" maxlength="40" @focus="editing = true" />
      </div>
    </div>
    <button class="btn" :class="{ 'btn--block': props.mode === 'gate' }" :disabled="!valid()">Enregistrer</button>
  </form>
</template>

<style scoped>
.id__title { margin-bottom: var(--s-2); }
.id__row { display: grid; gap: 0 var(--s-4); grid-template-columns: 1fr; }
@media (min-width: 480px) { .id__row { grid-template-columns: 1fr 1fr; } }
</style>
