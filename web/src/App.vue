<script setup>
import { useRegisterSW } from 'virtual:pwa-register/vue'
import BrandIcon from './components/BrandIcon.vue'
import BrandWordmark from './components/BrandWordmark.vue'
import { online } from './lib/online.js'
import { configOk } from './config.js'
import { startBackgroundSync } from './lib/session.js'

// Au lancement et au retour du réseau : envoie tout ce qui attend, mission par mission.
startBackgroundSync()

// Mise à jour de l'app : jamais automatique (le technicien peut être en pleine saisie).
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()
const close = () => {
  needRefresh.value = false
  offlineReady.value = false
}
</script>

<template>
  <header class="top">
    <router-link to="/" class="brand-link" aria-label="OUIDROP — accueil">
      <BrandIcon :height="30" />
      <BrandWordmark :height="20" />
    </router-link>
    <span class="app-name">Interventions</span>
  </header>

  <div v-if="!online" class="banner banner--offline" role="status">
    <strong>Hors ligne.</strong> Vos saisies sont enregistrées sur l'appareil.
  </div>
  <div v-if="needRefresh" class="banner" role="status">
    <span>Nouvelle version disponible.</span>
    <button class="btn btn--ghost" @click="updateServiceWorker(true)">Mettre à jour</button>
    <button class="btn btn--ghost" @click="close">Plus tard</button>
  </div>
  <div v-else-if="offlineReady" class="banner" role="status">
    <span>Prêt hors ligne.</span>
    <button class="btn btn--ghost" @click="close">OK</button>
  </div>
  <div v-if="!configOk" class="container" style="margin-top: 16px">
    <p class="alert" role="alert">
      <strong>Application non configurée.</strong> Renseignez <code>VITE_GAS_URL</code> et
      <code>VITE_APP_TOKEN</code> dans <code>.env.local</code>, puis relancez le build.
    </p>
  </div>

  <main class="container">
    <router-view />
  </main>
</template>

<style scoped>
/* Charte : sur fond foncé, le logo est blanc (version monochrome). */
.top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-4);
  padding: calc(var(--s-3) + env(safe-area-inset-top)) var(--s-4) var(--s-3);
  background: var(--top-bg); color: var(--top-text); border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}
.brand-link { display: flex; align-items: center; gap: var(--s-3); color: inherit; text-decoration: none; border-radius: var(--radius); }
.app-name { font: 500 18px/1 var(--f-display); letter-spacing: 0.06em; text-transform: uppercase; color: var(--top-sub); }
main { padding-block: var(--s-5) calc(var(--s-7) + env(safe-area-inset-bottom)); }
</style>
