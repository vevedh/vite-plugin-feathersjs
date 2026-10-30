import type { UserModule } from '~/types'

declare const __FEATHERS_PWA_ENABLED__: boolean

// https://github.com/antfu/vite-plugin-pwa#automatic-reload-when-new-content-available
export const install: UserModule = ({ isClient, router }) => {
  if (!isClient || !__FEATHERS_PWA_ENABLED__)
    return

  router.isReady()
    .then(async () => {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({ immediate: true })
    })
    .catch(() => {})
}
