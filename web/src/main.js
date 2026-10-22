// Polices auto-hébergées (embarquées dans le build, donc disponibles hors ligne).
import '@fontsource/saira-condensed/latin-500.css'
import '@fontsource/saira-condensed/latin-600.css'
import '@fontsource/saira-condensed/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'

import './styles/tokens.css'
import './styles/base.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { requestPersistentStorage } from './lib/storage.js'
import { initTheme } from './lib/theme.js'

initTheme()

createApp(App).use(router).mount('#app')
requestPersistentStorage()
