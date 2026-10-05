import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/inter'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import './assets/theme.css'
import './assets/base.css'

initTheme()
createApp(App).use(createPinia()).use(router).mount('#app')
