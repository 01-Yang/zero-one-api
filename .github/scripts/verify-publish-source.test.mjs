import assert from 'node:assert/strict'
import test from 'node:test'
import { findSuccessfulRun, validateCommitSha } from './verify-publish-source.mjs'

const commitSha = 'a'.repeat(40)

test('requires a full lowercase commit SHA', () => {
  assert.equal(validateCommitSha(commitSha), commitSha)
  assert.throws(() => validateCommitSha('abc'), /40-character SHA/)
  assert.throws(() => validateCommitSha('A'.repeat(40)), /40-character SHA/)
})

test('selects the newest successful completed Zero One CI run for the commit', () => {
  const selected = findSuccessfulRun(
    {
      workflow_runs: [
        {
          head_sha: commitSha,
          status: 'completed',
          conclusion: 'success',
          updated_at: '2026-08-10T10:00:00Z',
          html_url: 'https://github.test/older',
        },
        {
          head_sha: commitSha,
          status: 'completed',
          conclusion: 'failure',
          updated_at: '2026-08-10T12:00:00Z',
          html_url: 'https://github.test/failed',
        },
        {
          head_sha: commitSha,
          status: 'completed',
          conclusion: 'success',
          updated_at: '2026-08-10T11:00:00Z',
          html_url: 'https://github.test/newer',
        },
      ],
    },
    commitSha,
  )

  assert.equal(selected?.html_url, 'https://github.test/newer')
})
