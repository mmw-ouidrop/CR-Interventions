<script setup>
import { theme, setTheme, THEMES, THEME_LABELS } from '../lib/theme.js'
</script>

<template>
  <div class="theme" role="group" aria-label="Thème d'affichage">
    <button
      v-for="t in THEMES" :key="t" type="button" class="theme__btn"
      :aria-pressed="theme === t" @click="setTheme(t)"
    >{{ THEME_LABELS[t] }}</button>
  </div>
</template>

<style scoped>
.theme { display: inline-flex; border: 2px solid var(--line-strong); border-radius: var(--radius); overflow: hidden; }
.theme__btn {
  min-height: var(--tap); padding: 0 var(--s-4); border: 0; background: transparent; color: var(--accent);
  font: 700 var(--fs-cta)/1 var(--f-display); letter-spacing: .02em; text-transform: uppercase; cursor: pointer;
}
.theme__btn + .theme__btn { border-left: 2px solid var(--line-strong); }
.theme__btn[aria-pressed='true'] { background: var(--btn-bg); color: var(--btn-text); }
</style>
