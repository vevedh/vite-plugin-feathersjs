/** Disabled-PWA fallback for Vite's virtual:pwa-register import in fast/transport modes. */
export function registerSW(_options?: { immediate?: boolean }): () => void {
  return () => {}
}
