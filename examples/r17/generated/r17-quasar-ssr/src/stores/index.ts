import { store } from 'quasar/wrappers'
import { createPinia } from 'pinia'
// A new Pinia instance for each SSR render (no authenticated state global).
export default store(() => createPinia())
