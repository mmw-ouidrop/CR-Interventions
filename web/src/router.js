import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import MissionView from './views/MissionView.vue'
import { normalizeReference, consumeUrlReference } from './lib/ref.js'
import { DEFAULT_PREFIX } from './config.js'

// Historique par « hash » (#/m/FI-252) : aucune configuration serveur nécessaire,
// et l'app s'ouvre hors ligne sur n'importe quelle URL grâce au cache PWA.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/m/:reference', name: 'mission', component: MissionView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

// Lien d'ouverture direct : https://…/?id=FI-252  ou  https://…/#/?id=FI-252
let urlRefChecked = false
router.beforeEach((to) => {
  if (to.name !== 'home') return
  let raw = to.query.id
  if (!urlRefChecked) {
    urlRefChecked = true
    raw = raw || consumeUrlReference()
  }
  const reference = normalizeReference(Array.isArray(raw) ? raw[0] : raw, DEFAULT_PREFIX)
  if (reference) return { name: 'mission', params: { reference }, replace: true }
})
