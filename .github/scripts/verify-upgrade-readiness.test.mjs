import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyUIPaths,
  evaluateDirtyPreflight,
  evaluateHotfixAudit,
  evaluatePinnedRelease,
  parseArguments,
} from './verify-upgrade-readiness.mjs'

test('parses stable release tags and worktree mode', () => {
  assert.deepEqual(
    parseArguments(['--old-ref', 'v0.1.178', '--new-ref', 'v0.1.179', '--worktree']),
    { oldRef: 'v0.1.178', newRef: 'v0.1.179', worktree: true },
  )
  assert.throws(
    () => parseArguments(['--old-ref', 'main', '--new-ref', 'v0.1.179']),
    /stable vMAJOR.MINOR.PATCH/,
  )
})

test('separates protected UI changes from compatibility paths', () => {
  const manifest = {
    protected_paths: ['frontend/src/', 'landing/src/'],
    compatibility_paths: ['frontend/src/api/', 'frontend/src/types/'],
  }
  assert.deepEqual(
    classifyUIPaths(
      [
        'frontend/src/components/App.vue',
        'frontend/src/api/admin/channels.ts',
        'frontend/src/types/index.ts',
        'landing/src/App.tsx',
        'backend/main.go',
      ],
      manifest,
    ),
    {
      compatibility: ['frontend/src/api/admin/channels.ts', 'frontend/src/types/index.ts'],
      protected: ['frontend/src/components/App.vue', 'landing/src/App.tsx'],
    },
  )
})

test('requires dirty worktrees to be isolated before verification', () => {
  assert.deepEqual(evaluateDirtyPreflight([]), [])
  assert.deepEqual(evaluateDirtyPreflight([' M backend/main.go', '?? local.tmp']), [
    'worktree must be isolated before upgrade verification: backend/main.go, local.tmp',
  ])
})

test('requires the new tag to match the pinned baseline', () => {
  const baseline = { release: 'v0.1.179', commit: 'a'.repeat(40) }
  assert.deepEqual(
    evaluatePinnedRelease({ newRef: baseline.release, newCommit: baseline.commit, baseline }),
    [],
  )
  assert.equal(
    evaluatePinnedRelease({ newRef: 'v0.1.180', newCommit: 'b'.repeat(40), baseline }).length,
    2,
  )
})

test('reports hotfix overlaps and forces upstream-equivalent paths to exit', () => {
  const audit = evaluateHotfixAudit(
    [{ name: 'billing', paths: ['billing.go', 'billing_test.go'] }],
    ['billing.go'],
    ['billing_test.go'],
  )
  assert.deepEqual(audit, [
    {
      name: 'billing',
      status: 'exit-required',
      overlaps: ['billing.go'],
      exit_candidates: ['billing_test.go'],
    },
  ])
})
