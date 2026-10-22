<script setup>
// Un champ du formulaire, selon son type : text, textarea, number, checkbox, radio_group,
// select, checkbox_group, date, image_upload. Type inconnu → texte (jamais de champ perdu).
// Le composant ne stocke rien : il émet `update` ; l'écran enregistre (autosave local).
import { computed, ref } from 'vue'
import PhotoField from './PhotoField.vue'
import { formatFieldValue, formatTime } from '../lib/format.js'

const props = defineProps({
  item: { type: Object, required: true },
  value: { default: undefined },
  disabled: Boolean,
  conflict: { type: Object, default: null },        // { mine, theirs:{ v, by, at } }
  rows: { type: Array, default: () => [] },         // photos locales (image_upload)
  remote: { type: Array, default: () => [] },       // photos du rapport partagé
  busy: Boolean,
  by: { type: String, default: '' }                 // dernier à avoir modifié (si ≠ moi)
})
const emit = defineEmits(['update', 'add-photos', 'remove-photo', 'keep-mine', 'keep-theirs', 'remove-field'])

const KNOWN = ['text', 'textarea', 'number', 'checkbox', 'radio_group', 'select', 'checkbox_group', 'date', 'image_upload']
const type = computed(() => (KNOWN.includes(props.item.type) ? props.item.type : 'text'))
const grouped = computed(() => ['radio_group', 'checkbox_group', 'image_upload'].includes(type.value))
const uid = computed(() => 'f-' + props.item.id.replace(/[^A-Za-z0-9_-]/g, '_'))
const options = computed(() => (Array.isArray(props.item.options) ? props.item.options : []))
const chosen = computed(() => (Array.isArray(props.value) ? props.value : []))
const label = computed(() => props.item.label || props.item.id)

function toggle(opt, on) {
  const next = new Set(chosen.value)
  if (on) next.add(opt); else next.delete(opt)
  emit('update', options.value.filter((o) => next.has(o)))     // ordre du template conservé
}
function onNumber(e) {
  const raw = e.target.value
  const n = Number(raw.replace(',', '.'))
  emit('update', raw.trim() === '' ? '' : Number.isFinite(n) ? n : raw)
}

const confirmRemove = ref(false)
</script>

<template>
  <div class="fld" :class="{ 'fld--conflict': conflict }" :data-field="item.id">
    <!-- Cases à cocher isolées : l'étiquette est la case elle-même -->
    <template v-if="type === 'checkbox'">
      <label class="check check--solo">
        <input type="checkbox" :checked="value === true" :disabled="disabled" @change="emit('update', $event.target.checked)" />
        <span>{{ label }}<template v-if="item.required"><em class="req" aria-hidden="true"> *</em><span class="sr-only"> (obligatoire)</span></template></span>
      </label>
    </template>

    <template v-else>
      <component :is="grouped ? 'fieldset' : 'div'" class="fld__body">
        <component :is="grouped ? 'legend' : 'label'" :for="grouped ? undefined : uid" class="fld__label">
          {{ label }}<template v-if="item.required"><em class="req" aria-hidden="true"> *</em><span class="sr-only"> (obligatoire)</span></template>
        </component>
        <p v-if="item.help" class="small muted fld__help">{{ item.help }}</p>

        <input
          v-if="type === 'text'" :id="uid" class="input" type="text" :value="value ?? ''" :disabled="disabled"
          :placeholder="item.placeholder || ''" autocomplete="off" @input="emit('update', $event.target.value)"
        />
        <textarea
          v-else-if="type === 'textarea'" :id="uid" class="input" :value="value ?? ''" :disabled="disabled"
          :placeholder="item.placeholder || ''" rows="4" @input="emit('update', $event.target.value)"
        ></textarea>
        <div v-else-if="type === 'number'" class="num">
          <input
            :id="uid" class="input" type="text" inputmode="decimal" :value="value ?? ''" :disabled="disabled"
            :placeholder="item.placeholder || ''" autocomplete="off" @input="onNumber"
          />
          <span v-if="item.unit" class="num__unit">{{ item.unit }}</span>
        </div>
        <input
          v-else-if="type === 'date'" :id="uid" class="input" type="date" :value="value ?? ''" :disabled="disabled"
          @input="emit('update', $event.target.value)"
        />
        <select
          v-else-if="type === 'select'" :id="uid" class="input" :value="value ?? ''" :disabled="disabled"
          @change="emit('update', $event.target.value)"
        >
          <option value="">— Choisir —</option>
          <option v-for="o in options" :key="o" :value="o">{{ o }}</option>
        </select>

        <div v-else-if="type === 'radio_group'" class="opts" role="radiogroup">
          <label v-for="o in options" :key="o" class="check">
            <input type="radio" :name="uid" :value="o" :checked="value === o" :disabled="disabled" @change="emit('update', o)" />
            <span>{{ o }}</span>
          </label>
          <button v-if="value && !disabled && !item.required" type="button" class="link" @click="emit('update', '')">Effacer le choix</button>
        </div>
        <div v-else-if="type === 'checkbox_group'" class="opts">
          <label v-for="o in options" :key="o" class="check">
            <input type="checkbox" :checked="chosen.includes(o)" :disabled="disabled" @change="toggle(o, $event.target.checked)" />
            <span>{{ o }}</span>
          </label>
        </div>
        <PhotoField
          v-else-if="type === 'image_upload'" :id="item.id" :rows="rows" :remote="remote" :max="Number(item.max) || 0"
          :disabled="disabled" :busy="busy" @add="emit('add-photos', $event)" @remove="emit('remove-photo', $event)"
        />
      </component>
    </template>

    <p v-if="by && !conflict" class="small muted fld__by">Modifié par {{ by }}</p>

    <!-- Un collègue a modifié ce champ après moi : rien n'est perdu, on choisit -->
    <div v-if="conflict" class="note conflict" role="status">
      <p>
        <strong>{{ conflict.theirs.by || 'Un collègue' }}</strong> a modifié ce champ
        à {{ formatTime(conflict.theirs.at) }} : « {{ formatFieldValue(conflict.theirs.v) }} ».
        Votre saisie était : « {{ formatFieldValue(conflict.mine) }} ».
      </p>
      <div class="conflict__btns">
        <button type="button" class="btn btn--ghost" :disabled="disabled" @click="emit('keep-mine')">Remettre la mienne</button>
        <button type="button" class="btn btn--ghost" @click="emit('keep-theirs')">Garder la sienne</button>
      </div>
    </div>

    <div v-if="item.custom && !disabled" class="custom">
      <span class="small muted">Champ ajouté sur le terrain</span>
      <button v-if="!confirmRemove" type="button" class="link" @click="confirmRemove = true">Retirer ce champ</button>
      <span v-else class="custom__confirm">
        <button type="button" class="link link--danger" @click="emit('remove-field')">Confirmer le retrait</button>
        <button type="button" class="link" @click="confirmRemove = false">Annuler</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.fld { padding: var(--s-3) 0; }
.fld--conflict { border-left: 6px solid var(--ring); padding-left: var(--s-3); }
.fld__body { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: var(--s-2); }
.fld__label { font: 600 var(--fs-small)/1.3 var(--f-body); color: var(--heading); padding: 0; }
.fld__help { margin: 0; }
.fld__by { margin: var(--s-1) 0 0; }
.req { color: var(--text); font-style: normal; font-weight: 700; }
.num { display: flex; align-items: center; gap: var(--s-2); }
.num .input { flex: 1 1 auto; }
.num__unit { font-weight: 600; color: var(--text-muted); }
.opts { display: grid; gap: var(--s-1); }
.check {
  display: flex; align-items: center; gap: var(--s-3); min-height: var(--tap); padding: var(--s-1) var(--s-3);
  border: 2px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); cursor: pointer;
}
.check--solo { border-width: 2px; }
.check input { width: 24px; height: 24px; flex: none; accent-color: var(--accent); }
.check:has(input:checked) { border-color: var(--accent); background: var(--surface-2); }
.check:has(input:disabled) { cursor: not-allowed; opacity: .75; }
.link { justify-self: start; min-height: 44px; padding: 0 var(--s-2); border: 0; background: transparent; color: var(--accent); font: 600 var(--fs-small)/1 var(--f-body); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.link--danger { color: var(--text); }
.conflict { margin-top: var(--s-3); }
.conflict p { margin-bottom: var(--s-3); }
.conflict__btns { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.custom { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); flex-wrap: wrap; }
.custom__confirm { display: inline-flex; gap: var(--s-2); }
</style>
