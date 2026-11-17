import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import 'quasar/dist/quasar.css'
import './style.css'
import App from './App.vue'
createApp(App).use(createPinia()).use(Quasar).mount('#app')
