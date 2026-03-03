/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_ANALYTICS_ENABLED?: string
  readonly VITE_ANALYTICS_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
