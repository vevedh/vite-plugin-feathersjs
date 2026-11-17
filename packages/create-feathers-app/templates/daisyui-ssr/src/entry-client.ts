import { createApp, createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
const route = window.location.pathname.replace(/\/$/, '') || '/'
// Static HTML in production is hydrated. A dev-only empty shell is mounted normally.
const hydrated = Boolean(document.querySelector('#app')?.firstElementChild)
const app = hydrated ? createSSRApp(App, { route }) : createApp(App, { route })
app.use(createPinia()).mount('#app')
