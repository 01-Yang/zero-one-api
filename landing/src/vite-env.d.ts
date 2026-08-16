/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_EDGE_PREVIEW?: string
  readonly VITE_VISUAL_TEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
