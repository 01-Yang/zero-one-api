import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  evaluateChangedPaths,
  evaluateConsoleEntryReferences,
  validateManifest,
} from './verify-ui-boundary.mjs'

const manifest = validateManifest(
  JSON.parse(readFileSync(new URL('./ui-baseline.json', import.meta.url), 'utf8')),
)

test('validates the approved UI baseline manifest', () => {
  assert.equal(manifest.baseline_ref, 'ui-approved-2026-08-20-r5')
  assert.equal(manifest.baseline_commit, '45b7c1435a2ba8605c51a964e191171fefe86046')
  assert.equal(manifest.edge_build.console_source, 'deploy/zero-one/recovered-frontend/console')
  assert.deepEqual(
    manifest.protected_surfaces.map(({ name }) => name),
    [
      'landing-home',
      'auth',
      'console-shell',
      'model-plaza-pricing',
      'redeem-benefits-mystery-box',
    ],
  )
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

test('requires the console entry to keep the approved asset references', () => {
  const approved = [
    '<script type="module">await import("/assets/pricing-autofill-fix/index-approved.js")</script>',
    '<link rel="stylesheet" href="/assets/index-approved.css">',
  ].join('')
  assert.deepEqual(evaluateConsoleEntryReferences(approved, approved, 'console/index.html'), [])
  assert.deepEqual(
    evaluateConsoleEntryReferences(
      approved.replace('index-approved.js', 'repaired/index.js'),
      approved,
      'console/index.html',
    ),
    ['console/index.html asset references differ from approved baseline'],
  )
})
