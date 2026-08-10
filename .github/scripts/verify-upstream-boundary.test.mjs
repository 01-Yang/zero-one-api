import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateChangedPaths, validateBaseline } from './verify-upstream-boundary.mjs'

const baseline = validateBaseline(
  JSON.parse(readFileSync(new URL('../upstream-baseline.json', import.meta.url), 'utf8')),
)

test('allows the additive brand surfaces', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        '.github/workflows/zero-one-publish.yml',
        'README.md',
        'deploy/zero-one/compose.yml',
        'frontend/src/style.css',
        'landing/src/App.tsx',
      ],
      baseline,
    ),
    [],
  )
})

test('rejects backend and unrelated upstream changes', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      ['backend/internal/server/router.go', 'frontend/src/views/user/PaymentView.vue'],
      baseline,
    ),
    [
      'backend/internal/server/router.go is outside the approved brand overlay',
      'frontend/src/views/user/PaymentView.vue is outside the approved brand overlay',
    ],
  )
})

test('rejects immutable frontend contracts inside the otherwise allowed frontend', () => {
  assert.deepEqual(
    evaluateChangedPaths(['frontend/src/api/client.ts', 'frontend/vite.config.ts'], baseline),
    [
      'frontend/src/api/client.ts modifies immutable upstream path frontend/src/api/',
      'frontend/vite.config.ts modifies immutable upstream path frontend/vite.config.ts',
    ],
  )
})
