/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_EDGE_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
