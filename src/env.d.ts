/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FV_DEV_USER: string
  readonly VITE_FV_URL: string // ALPHA
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
