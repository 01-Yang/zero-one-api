import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateChangedPaths, validateManifest } from './verify-ui-boundary.mjs'

const manifest = validateManifest(
  JSON.parse(readFileSync(new URL('./ui-baseline.json', import.meta.url), 'utf8')),
)

test('validates the approved UI baseline manifest', () => {
  assert.equal(manifest.baseline_ref, 'ui-approved-2026-08-19')
  assert.equal(manifest.edge_build.console_source, 'deploy/zero-one/recovered-frontend/console')
})

test('rejects protected UI changes while allowing API compatibility files', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        'frontend/src/components/layout/AppLayout.vue',
        'frontend/src/views/admin/RedeemView.vue',
        'landing/src/styles.css',
        'deploy/zero-one/recovered-frontend/console/index.html',
        'frontend/src/api/admin/redeem.ts',
        'frontend/src/types/index.ts',
      ],
      manifest,
    ),
    [
      'deploy/zero-one/recovered-frontend/console/index.html',
      'frontend/src/components/layout/AppLayout.vue',
      'frontend/src/views/admin/RedeemView.vue',
      'landing/src/styles.css',
    ],
  )
})

test('requires compatibility paths to be inside protected source paths', () => {
  const invalid = structuredClone(manifest)
  invalid.compatibility_paths.push('backend/internal/service/')
  assert.throws(() => validateManifest(invalid), /outside protected paths/)
})
